exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ erro: 'Método não permitido' }) };
  }

  const apiKey = process.env.CASADOSDADOS_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ erro: 'API key não configurada' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ erro: 'JSON inválido' }) };
  }

  const cnpj = (body.cnpj || '').replace(/\D/g, '');
  if (!cnpj || cnpj.length !== 14) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'CNPJ inválido. Informe 14 dígitos.' }) };
  }

  try {
    const resp = await fetch('https://api.casadosdados.com.br/v5/cnpj/pesquisa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        query: { cnpj: [cnpj] },
        tipo_resultado: 'completo',
      }),
    });

    const data = await resp.json();

    return {
      statusCode: resp.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ erro: 'Erro ao conectar à Casa dos Dados' }),
    };
  }
};
