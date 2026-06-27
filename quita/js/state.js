/* ============================================================================
 * QuitaState — modelo de dados + persistência (localStorage) + export/import
 * ----------------------------------------------------------------------------
 * Camada de dados. Não calcula nada (isso é do engine.js) e não desenha nada
 * (isso é do ui.js / charts.js). Só guarda, carrega, valida e move dados.
 * ==========================================================================*/
var QuitaState = (function () {
  'use strict';

  var KEY = 'quita_state_v1';
  var SCHEMA = 1;

  function nowISO() { return new Date().toISOString(); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function defaults() {
    return {
      schemaVersion: SCHEMA,
      debts: [],
      monthlyExtra: 0,
      settings: { recommendationThresholdPct: 10 },
      snapshots: [],
      meta: { createdAt: nowISO(), updatedAt: nowISO() }
    };
  }

  /* Normaliza qualquer objeto carregado (de localStorage ou de import) para o
   * formato atual. É aqui que futuras migrações de schema entram. */
  function migrate(raw) {
    var d = defaults();
    raw = raw || {};
    if (Array.isArray(raw.debts)) {
      d.debts = raw.debts.map(function (x) {
        return {
          id: x.id || genId(),
          name: String(x.name || ''),
          balance: +x.balance || 0,
          interestRate: +x.interestRate || 0,
          minPayment: +x.minPayment || 0,
          dueDay: clampDay(+x.dueDay || 1),
          createdAt: x.createdAt || nowISO()
        };
      });
    }
    d.monthlyExtra = +raw.monthlyExtra || 0;
    if (raw.settings && typeof raw.settings === 'object') {
      d.settings.recommendationThresholdPct = +raw.settings.recommendationThresholdPct || 10;
    }
    if (Array.isArray(raw.snapshots)) {
      d.snapshots = raw.snapshots.filter(function (s) { return s && s.date; })
        .map(function (s) { return { date: s.date, totalBalance: +s.totalBalance || 0 }; });
    }
    if (raw.meta && typeof raw.meta === 'object') {
      d.meta.createdAt = raw.meta.createdAt || d.meta.createdAt;
    }
    d.schemaVersion = SCHEMA;
    return d;
  }

  function clampDay(n) { return Math.min(31, Math.max(1, Math.round(n) || 1)); }
  function genId() { return 'd_' + Math.random().toString(36).slice(2, 9); }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      return migrate(JSON.parse(raw));
    } catch (e) { return defaults(); }
  }

  function save(state) {
    state.meta = state.meta || {};
    state.meta.updatedAt = nowISO();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function clearStorage() { try { localStorage.removeItem(KEY); } catch (e) {} }

  function newDebt(p) {
    p = p || {};
    return {
      id: genId(),
      name: String(p.name || '').trim(),
      balance: +p.balance || 0,
      interestRate: +p.interestRate || 0,
      minPayment: +p.minPayment || 0,
      dueDay: clampDay(+p.dueDay || 1),
      createdAt: nowISO()
    };
  }

  function totalBalance(state) {
    return state.debts.reduce(function (s, d) { return s + (+d.balance || 0); }, 0);
  }

  /* Registra (no máximo um por dia) a foto da dívida total, para o painel
   * conseguir dizer "quanto caiu no mês". */
  function recordSnapshot(state) {
    var t = todayStr();
    var tb = totalBalance(state);
    var last = state.snapshots[state.snapshots.length - 1];
    if (last && last.date === t) { last.totalBalance = tb; }
    else { state.snapshots.push({ date: t, totalBalance: tb }); }
    // mantém histórico enxuto (últimos ~400 registros)
    if (state.snapshots.length > 400) state.snapshots.splice(0, state.snapshots.length - 400);
  }

  /* ---- Export / Import ---- */
  function exportJSON(state) {
    var data = JSON.stringify(state, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'quita-backup-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function importJSON(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        try { resolve(migrate(JSON.parse(r.result))); }
        catch (e) { reject(new Error('Arquivo inválido ou corrompido.')); }
      };
      r.onerror = function () { reject(new Error('Não foi possível ler o arquivo.')); };
      r.readAsText(file);
    });
  }

  return {
    KEY: KEY, SCHEMA: SCHEMA,
    load: load, save: save, clearStorage: clearStorage, defaults: defaults, migrate: migrate,
    newDebt: newDebt, totalBalance: totalBalance, recordSnapshot: recordSnapshot,
    exportJSON: exportJSON, importJSON: importJSON, todayStr: todayStr
  };
})();
