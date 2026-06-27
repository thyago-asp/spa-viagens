/* ============================================================================
 * QuitaCharts — gráficos (Chart.js). Só desenha; recebe resultados do engine.
 * ==========================================================================*/
var QuitaCharts = (function () {
  'use strict';

  var COLORS = {
    avalanche: '#CBFF00',
    snowball: '#4dc3ff',
    grid: 'rgba(255,255,255,0.06)',
    tick: '#999999',
    zero: '#4dd07a'
  };
  var FONT = "'Montserrat', system-ui, sans-serif";

  var timeline = null, interest = null, firstWin = null;

  function brl(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }

  function baseOpts() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: COLORS.tick, font: { family: FONT, size: 12 }, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
          titleColor: '#fff', bodyColor: '#ddd', padding: 10, titleFont: { family: FONT }, bodyFont: { family: FONT }
        }
      }
    };
  }

  function init() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = FONT;
    Chart.defaults.color = COLORS.tick;

    timeline = new Chart(document.getElementById('chartTimeline'), {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: Object.assign(baseOpts(), {
        scales: {
          x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.tick, maxTicksLimit: 12 }, title: { display: true, text: 'meses', color: COLORS.tick } },
          y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.tick, callback: function (v) { return brl(v); } }, beginAtZero: true }
        },
        plugins: Object.assign(baseOpts().plugins, {
          tooltip: Object.assign(baseOpts().plugins.tooltip, {
            callbacks: { label: function (c) { return c.dataset.label + ': ' + brl(c.parsed.y); } }
          })
        })
      })
    });

    interest = new Chart(document.getElementById('chartInterest'), {
      type: 'bar',
      data: { labels: ['Avalanche', 'Bola de neve'], datasets: [{ label: 'Juros totais', data: [0, 0], backgroundColor: [COLORS.avalanche, COLORS.snowball], borderRadius: 4 }] },
      options: Object.assign(baseOpts(), {
        plugins: Object.assign(baseOpts().plugins, {
          legend: { display: false },
          tooltip: Object.assign(baseOpts().plugins.tooltip, { callbacks: { label: function (c) { return brl(c.parsed.y); } } })
        }),
        scales: {
          x: { grid: { display: false }, ticks: { color: COLORS.tick } },
          y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.tick, callback: function (v) { return brl(v); } }, beginAtZero: true }
        }
      })
    });

    firstWin = new Chart(document.getElementById('chartFirstWin'), {
      type: 'bar',
      data: { labels: ['Avalanche', 'Bola de neve'], datasets: [{ label: 'Meses até a 1ª quitação', data: [0, 0], backgroundColor: [COLORS.avalanche, COLORS.snowball], borderRadius: 4 }] },
      options: Object.assign(baseOpts(), {
        plugins: Object.assign(baseOpts().plugins, {
          legend: { display: false },
          tooltip: Object.assign(baseOpts().plugins.tooltip, { callbacks: { label: function (c) { return c.parsed.y + ' meses'; } } })
        }),
        scales: {
          x: { grid: { display: false }, ticks: { color: COLORS.tick } },
          y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.tick, precision: 0 }, beginAtZero: true }
        }
      })
    });
  }

  // monta um array de saldo por índice de mês a partir do schedule
  function seriesFrom(schedule, length) {
    var arr = new Array(length).fill(null);
    schedule.forEach(function (p) { if (p.month < length) arr[p.month] = p.totalBalance; });
    // depois da quitação, mantém em 0 para a linha encostar no eixo
    var lastFilled = schedule.length ? schedule[schedule.length - 1].month : 0;
    for (var i = lastFilled + 1; i < length; i++) arr[i] = 0;
    return arr;
  }

  function payoffPoints(result, length) {
    var arr = new Array(length).fill(null);
    if (result && result.months < length) arr[result.months] = 0;
    return arr;
  }

  function update(av, sb, recommended) {
    if (!timeline) return;
    var maxMonths = Math.max(av ? av.months : 0, sb ? sb.months : 0) + 1;
    var labels = [];
    for (var i = 0; i < maxMonths; i++) labels.push(i);

    var avRec = recommended === 'avalanche';
    var sbRec = recommended === 'snowball';

    timeline.data.labels = labels;
    timeline.data.datasets = [
      {
        label: 'Avalanche' + (avRec ? ' ✓' : ''),
        data: av ? seriesFrom(av.schedule, maxMonths) : [],
        borderColor: COLORS.avalanche, backgroundColor: 'transparent',
        borderWidth: avRec ? 3 : 2, pointRadius: 0, tension: 0.15, spanGaps: true
      },
      {
        label: 'Bola de neve' + (sbRec ? ' ✓' : ''),
        data: sb ? seriesFrom(sb.schedule, maxMonths) : [],
        borderColor: COLORS.snowball, backgroundColor: 'transparent',
        borderWidth: sbRec ? 3 : 2, pointRadius: 0, tension: 0.15, spanGaps: true,
        borderDash: [5, 4]
      },
      {
        label: 'Quitação avalanche',
        data: payoffPoints(av, maxMonths),
        borderColor: COLORS.avalanche, backgroundColor: COLORS.avalanche,
        pointRadius: 6, pointStyle: 'rectRot', showLine: false
      },
      {
        label: 'Quitação bola de neve',
        data: payoffPoints(sb, maxMonths),
        borderColor: COLORS.snowball, backgroundColor: COLORS.snowball,
        pointRadius: 6, pointStyle: 'rectRot', showLine: false
      }
    ];
    timeline.update();

    interest.data.datasets[0].data = [av ? av.totalInterest : 0, sb ? sb.totalInterest : 0];
    interest.update();

    firstWin.data.datasets[0].data = [
      av ? (av.firstDebtPayoffMonth || 0) : 0,
      sb ? (sb.firstDebtPayoffMonth || 0) : 0
    ];
    firstWin.update();
  }

  return { init: init, update: update };
})();
