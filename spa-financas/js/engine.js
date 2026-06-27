/* ============================================================================
 * SPAFinEngine — motor de simulação de quitação de dívidas
 * ----------------------------------------------------------------------------
 * PURO: sem DOM, sem localStorage, sem estado global. Recebe dados, devolve
 * resultados. Determinístico (a data inicial é um parâmetro, não new Date()).
 *
 * Esta é a especificação de referência para a futura migração ao backend
 * Python: cada função abaixo deve ser traduzível 1:1, com os mesmos resultados.
 *
 * Convenções de unidade:
 *   - balance, minPayment, monthlyExtra: R$ (number)
 *   - interestRate: % AO MÊS (ex.: 12 = 12%/mês)
 *   - startDate: { year, month }  (month de 1 a 12)
 * ==========================================================================*/
var SPAFinEngine = (function () {
  'use strict';

  var MAX_MONTHS = 600; // teto de segurança da simulação (50 anos)
  var EPS = 0.005;      // tolerância de centavo

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function plural(n, sing, plur) { return n === 1 ? sing : plur; }

  // Formatação BRL própria (mantém o motor autossuficiente para gerar o texto
  // da recomendação; no Python equivale a um f-string com locale pt-BR).
  function formatBRL(n) {
    var neg = n < 0;
    var v = Math.abs(round2(n)).toFixed(2).split('.');
    var int = v[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + 'R$ ' + int + ',' + v[1];
  }

  // Rótulo de mês "AAAA-MM" deslocado `offset` meses a partir de start.
  function monthLabel(start, offset) {
    var y = start.year;
    var m = (start.month - 1) + offset;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return y + '-' + String(m + 1).padStart(2, '0');
  }

  /* Ordena as dívidas conforme o método.
   * avalanche → maior juros primeiro (desempate: menor saldo)
   * snowball  → menor saldo primeiro (desempate: maior juros)        */
  function orderDebts(debts, method) {
    var arr = debts.slice();
    if (method === 'avalanche') {
      arr.sort(function (a, b) {
        return (b.interestRate - a.interestRate) || (a.balance - b.balance);
      });
    } else { // snowball
      arr.sort(function (a, b) {
        return (a.balance - b.balance) || (b.interestRate - a.interestRate);
      });
    }
    return arr;
  }

  /* Simula o cronograma mês a mês até zerar todas as dívidas.
   * Modelo: orçamento mensal fixo = soma das parcelas mínimas + extra.
   * A cada mês: incidem juros → pagam-se os mínimos → a sobra ataca o
   * primeiro alvo ainda em aberto (na ordem do método). Quando uma dívida
   * zera, sua parcela é absorvida pelo orçamento e rola para o próximo alvo. */
  function simulate(debts, monthlyExtra, method, startDate) {
    var active = debts.filter(function (d) { return d.balance > EPS; });
    if (!active.length) return null;

    var ordered = orderDebts(active, method);
    var sumMin = active.reduce(function (s, d) { return s + (d.minPayment || 0); }, 0);
    var budget = sumMin + (monthlyExtra || 0);

    var sim = ordered.map(function (d) {
      return {
        id: d.id, name: d.name,
        rate: (d.interestRate || 0) / 100,
        min: d.minPayment || 0,
        bal: d.balance,
        payoffMonth: null
      };
    });

    var schedule = [];
    var totalInterest = 0;
    var month = 0;
    var stalled = false;

    function remaining() { return sim.filter(function (d) { return d.bal > EPS; }); }
    function totalBal() { return sim.reduce(function (s, d) { return s + Math.max(0, d.bal); }, 0); }

    // ponto inicial (mês 0)
    schedule.push({ month: 0, date: monthLabel(startDate, 0), totalBalance: round2(totalBal()), interestThisMonth: 0 });

    while (remaining().length && month < MAX_MONTHS) {
      month++;
      // 1) juros do mês
      var interestThisMonth = 0;
      sim.forEach(function (d) {
        if (d.bal > EPS) { var i = d.bal * d.rate; d.bal += i; interestThisMonth += i; totalInterest += i; }
      });
      // 2) parcelas mínimas
      var pool = budget;
      remaining().forEach(function (d) {
        var pay = Math.min(d.min, d.bal, pool);
        d.bal -= pay; pool -= pay;
      });
      // 3) sobra ataca o primeiro alvo ainda em aberto
      for (var k = 0; k < sim.length && pool > EPS; k++) {
        var t = sim[k];
        if (t.bal > EPS) { var ep = Math.min(pool, t.bal); t.bal -= ep; pool -= ep; }
      }
      // 4) marca quitações
      sim.forEach(function (d) {
        if (d.bal <= EPS && d.payoffMonth === null) { d.bal = 0; d.payoffMonth = month; }
      });
      schedule.push({ month: month, date: monthLabel(startDate, month), totalBalance: round2(totalBal()), interestThisMonth: round2(interestThisMonth) });

      // 5) estagnação: orçamento não cobre nem os juros que correm
      var still = remaining();
      var interestLoad = still.reduce(function (s, d) { return s + d.bal * d.rate; }, 0);
      if (month > 2 && budget <= interestLoad + EPS) { stalled = true; break; }
    }

    var firstPayoff = sim.reduce(function (m, d) {
      if (d.payoffMonth === null) return m;
      return m === null ? d.payoffMonth : Math.min(m, d.payoffMonth);
    }, null);

    return {
      method: method,
      months: month,
      payoffDate: monthLabel(startDate, month),
      totalInterest: round2(totalInterest),
      firstDebtPayoffMonth: firstPayoff,
      order: sim.map(function (d) { return { id: d.id, name: d.name, payoffMonth: d.payoffMonth }; }),
      schedule: schedule,
      stalled: stalled || month >= MAX_MONTHS,
      budget: round2(budget),
      sumMin: round2(sumMin)
    };
  }

  /* Roda os dois métodos e recomenda um, com justificativa em texto.
   * Regra: delta = juros(snowball) - juros(avalanche)  (>= 0 quase sempre).
   * Se delta% <= threshold → bola de neve (motivação); senão → avalanche. */
  function recommend(debts, monthlyExtra, startDate, thresholdPct) {
    var av = simulate(debts, monthlyExtra, 'avalanche', startDate);
    var sb = simulate(debts, monthlyExtra, 'snowball', startDate);
    if (!av || !sb) return null;

    var threshold = (thresholdPct == null) ? 10 : thresholdPct;

    if (av.stalled || sb.stalled) {
      return {
        avalanche: av, snowball: sb,
        recommendation: {
          recommended: null,
          reason: 'O orçamento atual não cobre os juros que correm todo mês — nesse ritmo a dívida não fecha. ' +
                  'Antes de escolher o método: aumente o valor mensal disponível, renegocie as taxas ou porte a dívida mais cara para uma linha mais barata.',
          interestDelta: null, interestDeltaPct: null, monthsDelta: null
        }
      };
    }

    var delta = round2(sb.totalInterest - av.totalInterest);
    var deltaPct = av.totalInterest > 0 ? Math.round((delta / av.totalInterest) * 100) : 0;
    var monthsDelta = sb.months - av.months;

    var recommended, reason;
    if (deltaPct <= threshold) {
      recommended = 'snowball';
      reason = 'A diferença de juros entre os dois métodos é pequena: ' + formatBRL(Math.abs(delta)) +
        ' (' + Math.abs(deltaPct) + '%). Como o custo é parecido, vale priorizar vitórias rápidas — ' +
        'a bola de neve quita a 1ª dívida em ' + sb.firstDebtPayoffMonth + ' ' +
        plural(sb.firstDebtPayoffMonth, 'mês', 'meses') + ', e cada dívida que some ajuda a manter o plano de pé.';
    } else {
      recommended = 'avalanche';
      reason = 'A avalanche economiza ' + formatBRL(Math.abs(delta)) + ' em juros (' + Math.abs(deltaPct) +
        '% a menos) frente à bola de neve. Como a diferença é relevante, compensa atacar a dívida mais cara primeiro.';
    }

    return {
      avalanche: av, snowball: sb,
      recommendation: {
        recommended: recommended, reason: reason,
        interestDelta: delta, interestDeltaPct: deltaPct, monthsDelta: monthsDelta
      }
    };
  }

  var api = {
    MAX_MONTHS: MAX_MONTHS,
    simulate: simulate,
    recommend: recommend,
    orderDebts: orderDebts,
    monthLabel: monthLabel,
    formatBRL: formatBRL,
    round2: round2
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
