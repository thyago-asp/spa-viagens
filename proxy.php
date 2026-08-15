<?php
session_start();

$data = file_get_contents('php://input');
$payload = json_decode($data, true);

// Dedup: mesma combinação nome+celular+destino+data dentro de 60s retorna o resultado anterior
$dedupKey = 'cotacao_' . md5(implode('|', [
    strtolower(trim($payload['campoNome']    ?? '')),
    preg_replace('/\D/', '', $payload['campoCelular']  ?? ''),
    strtolower(trim($payload['campoDestino'] ?? '')),
    $payload['campoDataInicial'] ?? '',
]));

if (isset($_SESSION[$dedupKey]) && (time() - $_SESSION[$dedupKey]['time']) < 60) {
    header('Content-Type: application/json');
    echo $_SESSION[$dedupKey]['response'];
    exit;
}

$ch = curl_init('https://agencia.iddas.com.br/so/iks58ver');
curl_setopt($ch, CURLOPT_CUSTOMREQUEST,  'POST');
curl_setopt($ch, CURLOPT_POSTFIELDS,     $data);
curl_setopt($ch, CURLOPT_HTTPHEADER,     [
    'Content-Type: application/json',
    'Content-Length: ' . strlen($data),
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT,        30);

$response = curl_exec($ch);
$error    = curl_error($ch);
curl_close($ch);

header('Content-Type: application/json');

if ($error) {
    echo json_encode(['sucesso' => 'N', 'msg' => $error]);
} else {
    $result = json_decode($response, true);
    if (!empty($result['sucesso']) && $result['sucesso'] === 'S') {
        $_SESSION[$dedupKey] = ['time' => time(), 'response' => $response];
    }
    echo $response;
}
