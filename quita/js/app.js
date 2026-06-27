/* ============================================================================
 * app.js — orquestração: liga state ↔ engine ↔ charts ↔ ui e trata eventos.
 * ==========================================================================*/
(function () {
  'use strict';

  var S = QuitaState, E = QuitaEngine, C = QuitaCharts, U = QuitaUI;

  var state = S.load();
  var baselineExtra = state.monthlyExtra;   // referência do simulador "e se" (sessão)

  // dataset de exemplo embutido (espelha data/exemplo.json; evita depender de fetch)
  var EXAMPLE = {
    schemaVersion: 1,
    monthlyExtra: 600,
    settings: { recommendationThresholdPct: 10 },
    debts: [
      { name: 'Cartão de crédito', balance: 4200, interestRate: 13.5, minPayment: 380, dueDay: 8 },
      { name: 'Cheque especial', balance: 1800, interestRate: 8, minPayment: 150, dueDay: 1 },
      { name: 'Empréstimo pessoal', balance: 9500, interestRate: 3.2, minPayment: 520, dueDay: 15 },
      { name: 'Crediário loja', balance: 700, interestRate: 4.5, minPayment: 120, dueDay: 20 }
    ]
  };

  function startDate() {
    var d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  function threshold() { return state.settings.recommendationThresholdPct; }

  function sliderMax() {
    var total = S.totalBalance(state);
    return Math.max(2000, Math.ceil((total * 0.25) / 100) * 100);
  }

  function persist() { S.recordSnapshot(state); S.save(state); }

  function recompute() {
    var sd = startDate();
    var cur = state.debts.length ? E.recommend(state.debts, state.monthlyExtra, sd, threshold()) : null;
    var base = state.debts.length ? E.recommend(state.debts, baselineExtra, sd, threshold()) : null;

    U.renderDebts(state, { onEdit: onEdit, onDelete: onDelete });
    U.syncExtraControls(state.monthlyExtra, sliderMax());
    U.renderPlan(state, cur, null);
    U.renderPainel(state, cur);
    U.renderDelta(base, cur, baselineExtra, state.monthlyExtra);
    if (cur) C.update(cur.avalanche, cur.snowball, cur.recommendation.recommended);
    else C.update(null, null, null);
  }

  /* ---- handlers de dívida ---- */
  function onEdit(id, field, value) {
    var d = state.debts.find(function (x) { return x.id === id; });
    if (!d) return;
    if (field === 'name') d.name = String(value);
    else if (field === 'dueDay') d.dueDay = Math.min(31, Math.max(1, Math.round(+value) || 1));
    else d[field] = +value || 0;
    persist(); recompute();
  }
  function onDelete(id) {
    state.debts = state.debts.filter(function (x) { return x.id !== id; });
    persist(); recompute();
  }

  function addDebt() {
    var name = U.el('inName').value.trim();
    var balance = +U.el('inBalance').value || 0;
    if (!name) { U.el('inName').focus(); return; }
    if (!balance) { U.el('inBalance').focus(); return; }
    state.debts.push(S.newDebt({
      name: name, balance: balance,
      interestRate: +U.el('inRate').value || 0,
      minPayment: +U.el('inMin').value || 0,
      dueDay: +U.el('inDue').value || 1
    }));
    ['inName', 'inBalance', 'inRate', 'inMin', 'inDue'].forEach(function (i) { U.el(i).value = ''; });
    U.el('inName').focus();
    persist(); recompute();
  }

  /* ---- valor mensal disponível (input + slider sincronizados) ---- */
  function setExtra(v) {
    state.monthlyExtra = Math.max(0, +v || 0);
    persist(); recompute();
  }

  /* ---- bootstrap ---- */
  function init() {
    C.init();
    U.bindTabs(function () { /* gráficos já vivos; nada a fazer */ });

    U.el('btnAddDebt').addEventListener('click', addDebt);
    ['inName', 'inBalance', 'inRate', 'inMin', 'inDue'].forEach(function (i) {
      U.el(i).addEventListener('keydown', function (e) { if (e.key === 'Enter') addDebt(); });
    });

    U.el('inExtra').addEventListener('input', function () { setExtra(this.value); });
    U.el('inExtra2').addEventListener('input', function () { setExtra(this.value); });
    U.el('sliderExtra').addEventListener('input', function () { setExtra(this.value); });

    U.el('inThreshold').value = threshold();
    U.el('inThreshold').addEventListener('input', function () {
      state.settings.recommendationThresholdPct = Math.min(100, Math.max(0, +this.value || 0));
      persist(); recompute();
    });

    U.el('btnResetBaseline').addEventListener('click', function () {
      baselineExtra = state.monthlyExtra;
      recompute();
      U.toast('Base redefinida para ' + U.fmtBRL0(baselineExtra) + '/mês.');
    });

    U.el('btnExample').addEventListener('click', function () {
      if (state.debts.length && !confirm('Carregar o exemplo substitui as dívidas atuais. Continuar?')) return;
      state = S.migrate(EXAMPLE);
      baselineExtra = state.monthlyExtra;
      persist(); recompute();
      U.toast('Exemplo carregado.');
    });

    U.el('btnExport').addEventListener('click', function () {
      S.exportJSON(state);
      U.toast('Backup exportado.');
    });

    U.el('btnImport').addEventListener('click', function () { U.el('fileImport').click(); });
    U.el('fileImport').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      S.importJSON(f).then(function (imported) {
        state = imported;
        baselineExtra = state.monthlyExtra;
        persist(); recompute();
        U.toast('Dados importados.');
      }).catch(function (err) { U.toast(err.message || 'Falha ao importar.'); });
      this.value = '';
    });

    U.el('btnReset').addEventListener('click', function () {
      if (!confirm('Apagar todos os dados deste navegador? Faça um backup antes (Exportar). Continuar?')) return;
      S.clearStorage();
      state = S.defaults();
      baselineExtra = 0;
      recompute();
      U.toast('Dados apagados.');
    });

    recompute();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
