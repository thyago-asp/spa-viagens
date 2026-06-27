/* ============================================================================
 * QuitaUI — renderização do DOM e formatação. Não calcula, não persiste.
 * Recebe estado + resultados do engine e desenha; dispara callbacks de eventos.
 * ==========================================================================*/
var QuitaUI = (function () {
  'use strict';

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function fmtBRL(n) {
    if (!isFinite(n)) n = 0;
    return 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtBRL0(n) {
    if (!isFinite(n)) n = 0;
    return 'R$ ' + Math.round(Number(n)).toLocaleString('pt-BR');
  }
  function fmtMonthPT(ym) {
    if (!ym) return '—';
    var p = ym.split('-');
    var mi = parseInt(p[1], 10) - 1;
    return (MESES[mi] || '?') + '/' + p[0];
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function el(id) { return document.getElementById(id); }

  /* ---- Lista de dívidas (editável inline) ---- */
  function renderDebts(state, handlers) {
    var box = el('debtList');
    if (!state.debts.length) {
      box.innerHTML = '<div class="empty">Nenhuma dívida ainda. Adicione a primeira acima — ou clique em <b>Carregar exemplo</b> no topo.</div>';
      return;
    }
    var html = '<div class="col-head">' +
      '<span>Dívida</span><span>Saldo (R$)</span><span class="hide-sm">Juros %/mês</span>' +
      '<span class="hide-sm">Parcela mín.</span><span class="hide-sm">Venc.</span><span></span></div>';
    state.debts.forEach(function (d) {
      html += '<div class="debt-row">' +
        inp(d.id, 'name', 'text', d.name, 'Nome') +
        inp(d.id, 'balance', 'number', d.balance, '0,00') +
        inp(d.id, 'interestRate', 'number', d.interestRate, '0', 'hide-sm') +
        inp(d.id, 'minPayment', 'number', d.minPayment, '0,00', 'hide-sm') +
        inp(d.id, 'dueDay', 'number', d.dueDay, '1', 'hide-sm') +
        '<button class="icon-btn" data-del="' + d.id + '" title="Remover">✕</button>' +
        '</div>';
    });
    box.innerHTML = html;

    box.querySelectorAll('input[data-id]').forEach(function (input) {
      input.addEventListener('change', function () {
        handlers.onEdit(input.dataset.id, input.dataset.field, input.value);
      });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { handlers.onDelete(b.dataset.del); });
    });
  }

  function inp(id, field, type, val, ph, cls) {
    var step = type === 'number' ? ' step="0.01" min="0"' : '';
    return '<input class="cell-input ' + (cls || '') + '" data-id="' + id + '" data-field="' + field + '" type="' + type + '"' +
      step + ' value="' + esc(val) + '" placeholder="' + (ph || '') + '"/>';
  }

  /* ---- Controles do valor mensal (sincroniza input + slider) ---- */
  function syncExtraControls(value, sliderMax) {
    var s = el('sliderExtra'), n1 = el('inExtra'), n2 = el('inExtra2');
    if (s) { s.max = sliderMax; s.value = Math.min(value, sliderMax); }
    if (n1) n1.value = value || '';
    if (n2) n2.value = value || '';
  }

  /* ---- Recomendação + ordem de ataque + métricas do método ---- */
  function renderPlan(state, results, methodView) {
    var box = el('planContent');
    if (!results) {
      box.innerHTML = '<div class="empty">Cadastre dívidas na aba <b>Dívidas</b> para o motor gerar a recomendação.</div>';
      return;
    }
    var rec = results.recommendation;
    var view = methodView || rec.recommended || 'avalanche';
    var sim = view === 'snowball' ? results.snowball : results.avalanche;

    var html = '';

    // caixa de recomendação
    if (rec.recommended === null) {
      html += '<div class="rec-box warn"><div class="rec-tag">Atenção</div>' +
        '<p>' + esc(rec.reason) + '</p></div>';
    } else {
      var label = rec.recommended === 'snowball' ? 'Bola de neve' : 'Avalanche';
      html += '<div class="rec-box"><div class="rec-tag">Recomendado: ' + label + '</div>' +
        '<p>' + esc(rec.reason) + '</p></div>';
    }

    // alternador de visualização
    html += '<div class="method-toggle">' +
      tgl('avalanche', 'Avalanche', view, rec.recommended) +
      tgl('snowball', 'Bola de neve', view, rec.recommended) +
      '</div>';

    // métricas do método em exibição
    html += '<div class="metrics">' +
      metric('Tempo até zerar', sim.stalled ? '—' : sim.months + ' meses', sim.stalled ? 'ajuste o orçamento' : fmtMonthPT(sim.payoffDate), 'lime') +
      metric('Juros totais', fmtBRL0(sim.totalInterest), 'no caminho até quitar', '') +
      metric('1ª dívida quitada', sim.firstDebtPayoffMonth ? ('mês ' + sim.firstDebtPayoffMonth) : '—', 'primeira vitória', 'green') +
      metric('Orçamento mensal', fmtBRL0(sim.budget), fmtBRL0(sim.sumMin) + ' mín + ' + fmtBRL0(state.monthlyExtra) + ' extra', '') +
      '</div>';

    // ordem de ataque
    html += '<div class="section-label">Ordem de ataque — ' + (view === 'snowball' ? 'bola de neve' : 'avalanche') + '</div>';
    sim.order.forEach(function (o, i) {
      var d = state.debts.find(function (x) { return x.id === o.id; }) || {};
      var isTarget = i === 0;
      var meta = o.payoffMonth ? ('Quita no mês ' + o.payoffMonth + ' · ' + fmtMonthPT(sim.schedule[Math.min(o.payoffMonth, sim.schedule.length - 1)].date))
        : 'Não quita no horizonte';
      html += '<div class="plan-step' + (isTarget ? ' target' : '') + '">' +
        '<div class="pnum">' + (i + 1) + '</div>' +
        '<div><div class="pname">' + esc(d.name || o.name) + '</div>' +
        '<div class="pmeta">Saldo ' + fmtBRL(d.balance || 0) + (d.interestRate ? ' · ' + d.interestRate + '%/mês' : '') + ' · ' + meta + '</div></div>' +
        (isTarget ? '<span class="ptag foco">Foco agora</span>' : '<span class="ptag minimo">Só o mínimo</span>') +
        '</div>';
    });

    box.innerHTML = html;

    box.querySelectorAll('[data-method]').forEach(function (b) {
      b.addEventListener('click', function () { renderPlan(state, results, b.dataset.method); });
    });
  }

  function tgl(method, label, view, recommended) {
    var active = view === method ? ' active' : '';
    var star = recommended === method ? ' ★' : '';
    return '<button class="mtgl' + active + '" data-method="' + method + '">' + label + star + '</button>';
  }

  /* ---- Painel de números-chave ---- */
  function renderPainel(state, results) {
    var box = el('painelContent');
    var total = QuitaState.totalBalance(state);

    // quanto caiu no mês: total no início do mês corrente vs agora
    var ym = QuitaState.todayStr().slice(0, 7);
    var baseline = null;
    state.snapshots.forEach(function (s) {
      if (s.date.slice(0, 7) < ym) baseline = s;            // último de meses anteriores
      else if (s.date.slice(0, 7) === ym && baseline === null) baseline = s; // 1º do mês atual
    });
    var dropped = baseline ? (baseline.totalBalance - total) : 0;

    // próximo vencimento
    var next = nextDueDate(state.debts);

    // liberdade prevista (método recomendado)
    var sim = results ? (results.recommendation.recommended === 'snowball' ? results.snowball : results.avalanche) : null;

    var html = '<div class="metrics">' +
      metric('Dívida total atual', fmtBRL0(total), state.debts.length + ' dívida(s)', '') +
      metric('Caiu neste mês', (dropped >= 0 ? '' : '') + fmtBRL0(dropped), dropped > 0 ? 'a menos que no início do mês' : 'sem queda registrada', dropped > 0 ? 'green' : '') +
      metric('Próximo vencimento', next ? ('dia ' + next.day) : '—', next ? esc(next.name) + ' · ' + fmtMonthPT(next.ym) : 'sem dívidas ativas', 'lime') +
      metric('Sobra p/ abater', fmtBRL0(state.monthlyExtra), 'além das parcelas mínimas', '') +
      '</div>';

    if (sim && !sim.stalled) {
      html += '<div class="metrics" style="margin-top:1rem">' +
        metric('Liberdade prevista', fmtMonthPT(sim.payoffDate), sim.months + ' meses pelo método recomendado', 'lime') +
        '</div>';
    }

    html += '<div class="alert info" style="margin-top:1.5rem">💡 <span>Antes de pegar crédito novo, ' +
      '<b>cuide do que já existe</b>: renegociar uma taxa ou quitar a menor dívida é o resultado mais perto, com menos esforço.</span></div>';

    box.innerHTML = html;
  }

  function nextDueDate(debts) {
    var active = debts.filter(function (d) { return d.balance > 0.005; });
    if (!active.length) return null;
    var now = new Date();
    var today = now.getDate();
    var best = null;
    active.forEach(function (d) {
      var day = Math.min(31, Math.max(1, d.dueDay || 1));
      var dt = new Date(now.getFullYear(), now.getMonth(), day);
      if (day < today) dt = new Date(now.getFullYear(), now.getMonth() + 1, day);
      if (!best || dt < best.dt) {
        best = { dt: dt, day: day, name: d.name, ym: dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') };
      }
    });
    return best;
  }

  /* ---- Delta do simulador "e se" ---- */
  function renderDelta(baseRes, curRes, baseExtra, curExtra) {
    var box = el('deltaBox');
    if (!box) return;
    if (!baseRes || !curRes) { box.innerHTML = ''; return; }
    var baseSim = baseRes.recommendation.recommended === 'snowball' ? baseRes.snowball : baseRes.avalanche;
    var curSim = curRes.recommendation.recommended === 'snowball' ? curRes.snowball : curRes.avalanche;

    if (baseExtra === curExtra) {
      box.innerHTML = '<span class="delta-muted">Arraste o valor para simular. Comparação relativa a ' + fmtBRL0(baseExtra) + '/mês (base).</span>';
      return;
    }
    var dMonths = curSim.months - baseSim.months;
    var dInterest = curSim.totalInterest - baseSim.totalInterest; // negativo = economia
    var faster = dMonths < 0;
    var cheaper = dInterest < 0;

    box.innerHTML =
      '<span class="delta-pill ' + (faster ? 'good' : (dMonths > 0 ? 'bad' : '')) + '">' +
        (dMonths === 0 ? 'mesmo prazo' : (faster ? Math.abs(dMonths) + ' meses mais cedo' : Math.abs(dMonths) + ' meses mais tarde')) + '</span>' +
      '<span class="delta-pill ' + (cheaper ? 'good' : (dInterest > 0 ? 'bad' : '')) + '">' +
        (cheaper ? 'economiza ' : 'custa ') + fmtBRL0(Math.abs(dInterest)) + ' em juros</span>' +
      '<span class="delta-muted">vs base ' + fmtBRL0(baseExtra) + '/mês</span>';
  }

  function metric(label, value, sub, cls) {
    return '<div class="metric"><div class="mlabel">' + label + '</div>' +
      '<div class="mvalue ' + (cls || '') + '">' + value + '</div>' +
      '<div class="msub">' + (sub || '') + '</div></div>';
  }

  function bindTabs(onSwitch) {
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
        el('panel-' + t.dataset.tab).classList.add('active');
        if (onSwitch) onSwitch(t.dataset.tab);
      });
    });
  }

  function toast(msg) {
    var t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  return {
    fmtBRL: fmtBRL, fmtBRL0: fmtBRL0, fmtMonthPT: fmtMonthPT,
    renderDebts: renderDebts, syncExtraControls: syncExtraControls,
    renderPlan: renderPlan, renderPainel: renderPainel, renderDelta: renderDelta,
    bindTabs: bindTabs, toast: toast, el: el
  };
})();
