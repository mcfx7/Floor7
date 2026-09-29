// Floor 7 — main app
(() => {
  'use strict';

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayIso = () => iso(new Date());
  const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const niceDate = (s) => { const d = parseIso(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

  function money(v, signed = true) {
    const a = Math.abs(v);
    const s = a.toLocaleString('en-US', { minimumFractionDigits: a % 1 ? 2 : 0, maximumFractionDigits: 2 });
    if (!signed) return '$' + s;
    return (v < 0 ? '-$' : '+$') + s;
  }
  const price = (v) => (v == null ? '–' : Number(v).toFixed(5));
  function short(v) {
    const a = Math.abs(v), sign = v < 0 ? '-$' : '+$';
    if (a >= 1000) return sign + (a / 1000).toFixed(a >= 10000 ? 0 : 1) + 'k';
    return sign + Math.round(a);
  }
  const rText = (r) => (r == null ? '' : (r >= 0 ? '+' : '') + r.toFixed(1) + 'R');
  const cls = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');

  const ICON = {
    left: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    buy: '<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg>',
    sell: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 9v8H9"/></svg>',
    tick: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    cross: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M16 3l5 5L9 20H4v-5z"/></svg>',
    hi: '<svg viewBox="0 0 24 24"><path d="M9 11l6 6M4 20l5-1 10-10-4-4L5 15z"/></svg>',
    eraser: '<svg viewBox="0 0 24 24"><path d="M20 20H9L4 15l10-10 7 7-8 8"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    hand: '<svg viewBox="0 0 24 24"><path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3 14a1.5 1.5 0 0 1 2.4-1.8L8 15"/></svg>',
    swap: '<svg viewBox="0 0 24 24"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/></svg>',
  };

  // ---------- Trading maths (EURUSD: 1 pip = 0.0001, $10 per pip per 1 lot) ----------
  const PIP = 0.0001, PIP_VALUE = 10;
  const pips = (a, b) => Math.abs(a - b) / PIP;
  function riskUsd(t) { return t.entry != null && t.sl != null && t.lots ? pips(t.entry, t.sl) * t.lots * PIP_VALUE : null; }
  function targetUsd(t) { return t.entry != null && t.tp != null && t.lots ? pips(t.entry, t.tp) * t.lots * PIP_VALUE : null; }
  function resultAt(t, exit, commission) {
    const move = t.direction === 'sell' ? t.entry - exit : exit - t.entry;
    const gross = (move / PIP) * t.lots * PIP_VALUE;
    const pnl = Math.round((gross - (commission || 0) * t.lots) * 100) / 100;
    const risk = riskUsd(t);
    return { pnl, r: risk ? Math.round((pnl / risk) * 100) / 100 : null };
  }

  // ---------- State ----------
  let state = { accounts: [], trades: [], notes: [], settings: { theme: 'auto' } };
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => DB.set('state', state).catch(() => toast('Could not save. Storage may be full.')), 250);
  }
  const acctById = (id) => state.accounts.find((a) => a.id === id);
  const closed = (list) => list.filter((t) => t.status === 'closed');

  let view = 'calendar';
  let cursor = new Date(); cursor.setDate(1);
  let journalFilter = 'all';

  // ---------- Theme ----------
  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('f7-theme', t); } catch (e) {}
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = isDark() ? '#000000' : '#F2F2F7';
  }
  const isDark = () => {
    const t = state.settings.theme;
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------- Sheet (pop-up panel) ----------
  let sheetClose = null;
  function openSheet(html, onClose) {
    const sheet = $('#sheet');
    sheet.innerHTML = html;
    sheet.hidden = false; $('#sheet-backdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    sheetClose = onClose || null;
    const first = sheet.querySelector('[autofocus]');
    if (first && window.matchMedia('(min-width: 820px)').matches) first.focus();
    return sheet;
  }
  function closeSheet() {
    $('#sheet').hidden = true; $('#sheet-backdrop').hidden = true;
    $('#sheet').innerHTML = '';
    document.body.style.overflow = '';
    const fn = sheetClose; sheetClose = null;
    if (fn) fn();
  }
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  // ---------- Images ----------
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
  function shrink(dataUrl, max = 1400, quality = 0.78) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
  function pickFile(input) {
    return new Promise((resolve) => {
      input.value = '';
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });
  }

  // ---------- Navigation ----------
  function go(v) {
    view = v;
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    $$('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
    $('#fab').classList.toggle('hidden', v === 'notes' || v === 'more');
    render();
    window.scrollTo(0, 0);
    try { sessionStorage.setItem('f7-view', v); } catch (e) {}
  }
  $$('.nav-item').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
  $('#fab').addEventListener('click', () => startLog());

  function render() {
    if (view === 'calendar') renderCalendar();
    else if (view === 'journal') renderJournal();
    else if (view === 'accounts') renderAccounts();
    else if (view === 'notes') renderNotes();
    else if (view === 'more') renderMore();
  }

  // ---------- Calendar ----------
  function renderCalendar() {
    const el = $('#view-calendar');
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const prefix = `${y}-${pad(m + 1)}`;
    const monthTrades = state.trades.filter((t) => t.date.startsWith(prefix));
    const done = closed(monthTrades);
    const total = done.reduce((s, t) => s + t.pnl, 0);
    const wins = done.filter((t) => t.pnl > 0).length;
    const days = new Set(monthTrades.map((t) => t.date)).size;
    const rs = done.filter((t) => t.r != null);
    const avgR = rs.length ? rs.reduce((s, t) => s + t.r, 0) / rs.length : null;
    const planPct = done.length ? Math.round((done.filter((t) => t.plan).length / done.length) * 100) : null;

    // Build Monday-to-Friday weeks
    const first = new Date(y, m, 1);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const last = new Date(y, m + 1, 0);
    const byDate = {};
    for (const t of state.trades) (byDate[t.date] = byDate[t.date] || []).push(t);
    const today = todayIso();

    let rows = '';
    for (let d = new Date(start); d <= last; d.setDate(d.getDate() + 7)) {
      const fri = new Date(d); fri.setDate(d.getDate() + 4);
      if (d.getMonth() !== m && fri.getMonth() !== m) continue; // week with no weekdays in this month
      let cells = '', wkTotal = 0, wkCount = 0;
      for (let i = 0; i < 5; i++) {
        const day = new Date(d); day.setDate(d.getDate() + i);
        const key = iso(day);
        const inMonth = day.getMonth() === m;
        if (!inMonth) { cells += `<div class="day out" aria-hidden="true"><span class="n">${day.getDate()}</span></div>`; continue; }
        const list = byDate[key] || [];
        const c = closed(list);
        const sum = c.reduce((s, t) => s + t.pnl, 0);
        wkTotal += sum; wkCount += c.length;
        let klass = 'day', amt = '', amtS = '', count = '';
        if (c.length) { klass += sum >= 0 ? ' upd' : ' dnd'; amt = money(sum); amtS = short(sum); count = c.length === 1 ? '1 trade' : c.length + ' trades'; }
        else if (list.length) { klass += ' openonly'; amt = 'Open'; amtS = 'Open'; count = list.length === 1 ? '1 open' : list.length + ' open'; }
        if (key === today) klass += ' today';
        const label = `${niceDate(key)}${amt ? ', ' + amt : ', no trades'}`;
        cells += `<button class="${klass}" data-day="${key}" aria-label="${esc(label)}"><span class="n">${day.getDate()}</span><span class="a"><span class="full">${esc(amt)}</span><span class="short">${esc(amtS)}</span></span><span class="c">${esc(count)}</span></button>`;
      }
      const wkCls = wkCount ? cls(wkTotal) : 'muted';
      cells += `<div class="wkc"><span class="a ${wkCls}"><span class="full">${wkCount ? money(wkTotal) : '$0'}</span><span class="short">${wkCount ? short(wkTotal) : '$0'}</span></span><span class="c">${wkCount === 1 ? '1 trade' : wkCount + ' trades'}</span></div>`;
      rows += `<div class="cal-row">${cells}</div>`;
    }

    el.innerHTML = `
      <div class="head">
        <div class="month-nav">
          <button class="icon-btn" data-act="prev" aria-label="Previous month">${ICON.left}</button>
          <h1 style="padding: 0 10px">${MONTHS[m]} ${y}</h1>
          <button class="icon-btn" data-act="next" aria-label="Next month">${ICON.right}</button>
        </div>
        <button class="icon-btn" data-act="theme" aria-label="${isDark() ? 'Switch to light mode' : 'Switch to dark mode'}">${isDark() ? ICON.sun : ICON.moon}</button>
      </div>
      <div class="stats">
        <div class="card stat big"><span class="k">Month P&amp;L</span><span class="v ${cls(total)}">${done.length ? money(total) : '$0'}</span></div>
        <div class="card stat"><span class="k">Trades</span><span class="v">${done.length}</span></div>
        <div class="card stat"><span class="k">Trading days</span><span class="v">${days}</span></div>
        <div class="card stat"><span class="k">Win rate</span><span class="v">${done.length ? Math.round((wins / done.length) * 100) + '%' : '–'}</span></div>
        <div class="card stat"><span class="k">Average R</span><span class="v">${avgR == null ? '–' : avgR.toFixed(1) + 'R'}</span></div>
        <div class="card stat"><span class="k">Followed plan</span><span class="v">${planPct == null ? '–' : planPct + '%'}</span></div>
      </div>
      <div class="cal">
        <div class="cal-row">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => `<div class="cal-h">${d}</div>`).join('')}<div class="cal-h wk">Week</div></div>
        ${rows}
      </div>
      ${state.trades.length ? '' : `<div class="card empty">Your month fills in as you log trades. Tap <b>+</b> to add your first one${state.accounts.length ? '' : ', starting with your funded account'}.</div>`}
    `;
    el.querySelector('[data-act="prev"]').onclick = () => { cursor.setMonth(cursor.getMonth() - 1); renderCalendar(); };
    el.querySelector('[data-act="next"]').onclick = () => { cursor.setMonth(cursor.getMonth() + 1); renderCalendar(); };
    el.querySelector('[data-act="theme"]').onclick = () => { state.settings.theme = isDark() ? 'light' : 'dark'; applyTheme(); save(); renderCalendar(); };
    $$('[data-day]', el).forEach((b) => b.addEventListener('click', () => openDay(b.dataset.day)));
  }

  // ---------- Day view ----------
  async function openDay(date) {
    const list = state.trades.filter((t) => t.date === date);
    const done = closed(list);
    const total = done.reduce((s, t) => s + t.pnl, 0);
    const totalR = done.reduce((s, t) => s + (t.r || 0), 0);
    const cards = await Promise.all(list.map(tradeCard));
    const sheet = openSheet(`
      <div class="sheet-top"><span class="title">${esc(niceDate(date))}</span><button class="btn-link" data-close>Done</button></div>
      ${list.length ? `
      <div class="card summary">
        <div><div class="v ${cls(total)}">${done.length ? money(total) : '–'}</div><div class="k">Day P&amp;L</div></div>
        <div><div class="v">${list.length}</div><div class="k">Trades</div></div>
        <div><div class="v">${done.length ? rText(totalR) : '–'}</div><div class="k">Total R</div></div>
      </div>
      ${cards.join('')}` : `<div class="card empty">No trades on this day.</div>`}
      <button class="btn btn-plain" data-add>${ICON.plus} Log a trade on this day</button>
    `);
    sheet.querySelector('[data-close]').onclick = closeSheet;
    sheet.querySelector('[data-add]').onclick = () => startLog(date);
    wireTradeCards(sheet, () => openDay(date));
  }

  async function tradeCard(t) {
    const a = acctById(t.accountId);
    let img = '';
    if (t.shotKey) { const src = await DB.get(t.shotKey).catch(() => null); if (src) img = `<img src="${src}" alt="Chart screenshot for this trade">`; }
    const status = t.status === 'open' ? '<span class="pill open">Open</span>'
      : `<span class="pill">${t.outcome === 'tp' ? 'Hit TP' : t.outcome === 'sl' ? 'Hit SL' : 'Closed early'}</span>`;
    const plan = t.plan ? `<span class="up" style="display:flex;align-items:center;gap:5px;font-size:13px">${ICON.tick.replace('<svg', '<svg style="width:14px;height:14px;stroke-width:2.8"')} Followed plan</span>`
      : `<span class="down" style="display:flex;align-items:center;gap:5px;font-size:13px">${ICON.cross.replace('<svg', '<svg style="width:14px;height:14px;stroke-width:2.8"')} Broke plan</span>`;
    return `
      <div class="card trade">
        ${img}
        <div class="body">
          <div class="head">
            <div style="display:flex;flex-direction:column;gap:2px">
              <span style="font-size:17px;font-weight:600">${t.direction === 'sell' ? 'Sell' : 'Buy'} EURUSD · ${t.lots} lots</span>
              <span class="muted" style="font-size:13px">${esc(a ? a.name : 'No account')}</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              ${t.status === 'closed' ? `<span style="font-size:20px;font-weight:700" class="${cls(t.pnl)}">${money(t.pnl)}</span><span class="muted" style="font-size:13px;font-weight:600">${rText(t.r)}</span>` : status}
            </div>
          </div>
          <div class="kv">
            <div><span class="k">Entry</span><span class="v">${price(t.entry)}</span></div>
            <div><span class="k">Stop loss</span><span class="v">${price(t.sl)}</span></div>
            <div><span class="k">Take profit</span><span class="v">${price(t.tp)}</span></div>
            <div><span class="k">Risk</span><span class="v">${riskUsd(t) != null ? money(riskUsd(t), false) : '–'}</span></div>
            ${t.status === 'closed' ? `<div><span class="k">Exit</span><span class="v">${price(t.exit)}</span></div><div><span class="k">Result</span><span class="v">${status}</span></div>` : ''}
          </div>
          <div class="head">${plan}${t.note ? `<span class="muted" style="font-size:13px">${esc(t.note)}</span>` : ''}</div>
          <div class="actions">
            ${t.status === 'open' ? `<button class="btn btn-primary" data-close-trade="${t.id}">Close trade</button>` : ''}
            <button class="btn btn-plain" data-edit="${t.id}">Edit</button>
            <button class="btn btn-danger" data-del="${t.id}">Delete</button>
          </div>
        </div>
      </div>`;
  }

  function wireTradeCards(root, back) {
    $$('[data-close-trade]', root).forEach((b) => b.onclick = () => closeTradeSheet(state.trades.find((t) => t.id === b.dataset.closeTrade), back));
    $$('[data-edit]', root).forEach((b) => b.onclick = () => tradeForm(state.trades.find((t) => t.id === b.dataset.edit), { back }));
    $$('[data-del]', root).forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this trade? This can’t be undone.')) return;
      const t = state.trades.find((x) => x.id === b.dataset.del);
      state.trades = state.trades.filter((x) => x !== t);
      if (t && t.shotKey) DB.del(t.shotKey).catch(() => {});
      save(); render(); toast('Trade deleted');
      back();
    });
  }

  // ---------- Log a trade ----------
  function startLog(date) {
    if (!state.accounts.length) {
      const s = openSheet(`
        <div class="sheet-top"><span class="title">Log a trade</span><button class="btn-link" data-close>Cancel</button></div>
        <div class="card empty">Add your funded account first, so Floor 7 knows your risk and limits.</div>
        <button class="btn btn-primary" data-acct>Add account</button>`);
      s.querySelector('[data-close]').onclick = closeSheet;
      s.querySelector('[data-acct]').onclick = () => accountForm(null, () => startLog(date));
      return;
    }
    const s = openSheet(`
      <div class="sheet-top"><span class="title">Log a trade</span><button class="btn-link" data-close>Cancel</button></div>
      <button class="drop" data-shot>${ICON.image}<span><b>Add entry screenshot</b><br>Floor 7 reads the trade for you</span></button>
      <button class="btn btn-plain" data-manual>Enter it myself</button>
      <p class="hint">Best results: a screenshot of the MT5 chart straight after entry, with the TP and SL lines showing.</p>`);
    s.querySelector('[data-close]').onclick = closeSheet;
    s.querySelector('[data-manual]').onclick = () => tradeForm(null, { date });
    s.querySelector('[data-shot]').onclick = async () => {
      const file = await pickFile($('#file-shot'));
      if (!file) return;
      const full = await fileToDataUrl(file);
      const small = await shrink(full);
      const r = openSheet(`
        <div class="sheet-top"><span class="title">Reading your screenshot</span><button class="btn-link" data-close>Cancel</button></div>
        <div class="drop"><img src="${small}" alt="Your screenshot"></div>
        <div class="progress"><i></i></div>
        <p class="hint" data-msg>The first time takes a little longer while the reader loads.</p>`);
      let cancelled = false;
      r.querySelector('[data-close]').onclick = () => { cancelled = true; closeSheet(); };
      try {
        const found = await Reader.read(full, (p) => { const bar = $('#sheet .progress i'); if (bar) bar.style.width = Math.round(p * 100) + '%'; });
        if (cancelled) return;
        tradeForm(null, { date, shot: small, found });
      } catch (err) {
        if (cancelled) return;
        toast(err.message || 'Could not read the screenshot');
        tradeForm(null, { date, shot: small, found: {} });
      }
    };
  }

  // Trade form: used for confirming a read screenshot, manual entry, and editing
  function tradeForm(existing, opts = {}) {
    const found = opts.found || null;
    const t = existing ? { ...existing } : {
      id: uid(), date: opts.date || todayIso(), accountId: (state.settings.lastAccount && acctById(state.settings.lastAccount)) ? state.settings.lastAccount : state.accounts[0].id,
      direction: (found && found.direction) || 'buy', lots: found ? found.lots : null, entry: found ? found.entry : null,
      sl: found ? found.sl : null, tp: found ? found.tp : null, status: 'open', plan: true, note: '',
    };
    let shot = opts.shot || null;
    const flag = (k) => (found && (found[k] == null) ? ' flag' : '');
    const missing = found ? ['lots', 'entry', 'sl', 'tp'].filter((k) => found[k] == null) : [];
    const title = existing ? 'Edit trade' : found ? 'Check your trade' : 'New trade';

    const s = openSheet(`
      <div class="sheet-top"><button class="btn-link" data-close>Cancel</button><span class="title">${title}</span><span style="width:60px"></span></div>
      ${found ? `<p class="hint">${missing.length ? 'Some boxes couldn’t be read. Fill in the highlighted ones, then check the rest.' : 'Here’s what Floor 7 read. Check it matches your trade.'}</p>` : ''}
      <div class="seg" role="group" aria-label="Direction">
        <button data-dir="buy" class="${t.direction === 'buy' ? 'on' : ''}" aria-pressed="${t.direction === 'buy'}">Buy</button>
        <button data-dir="sell" class="${t.direction === 'sell' ? 'on' : ''}" aria-pressed="${t.direction === 'sell'}">Sell</button>
      </div>
      <div class="group">
        <div class="field"><label for="f-acct">Account</label><select id="f-acct">${state.accounts.map((a) => `<option value="${a.id}" ${a.id === t.accountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Pair</label><span class="val">EURUSD</span></div>
        <div class="field"><label for="f-date">Date</label><input id="f-date" type="date" value="${t.date}"></div>
      </div>
      <div class="group">
        <div class="field${flag('lots')}"><label for="f-lots">Lots</label><input id="f-lots" inputmode="decimal" placeholder="0.00" value="${t.lots ?? ''}"></div>
        <div class="field${flag('entry')}"><label for="f-entry">Entry</label><input id="f-entry" inputmode="decimal" placeholder="1.00000" value="${t.entry ?? ''}"></div>
        <div class="field${flag('sl')}"><label for="f-sl">Stop loss</label><input id="f-sl" inputmode="decimal" placeholder="1.00000" value="${t.sl ?? ''}"></div>
        <div class="field${flag('tp')}"><label for="f-tp">Take profit</label><input id="f-tp" inputmode="decimal" placeholder="1.00000" value="${t.tp ?? ''}"></div>
        ${existing && existing.status === 'closed' ? `<div class="field"><label for="f-exit">Exit price</label><input id="f-exit" inputmode="decimal" value="${t.exit ?? ''}"></div>` : ''}
      </div>
      <div class="card summary" data-sum></div>
      <div class="group">
        <div class="field"><label id="plan-l">Followed my plan?</label><button class="switch" role="switch" aria-labelledby="plan-l" aria-checked="${!!t.plan}" data-plan><i></i></button></div>
      </div>
      <textarea class="note" id="f-note" rows="2" placeholder="One line on this trade (optional)">${esc(t.note || '')}</textarea>
      ${existing ? '' : `<button class="drop" data-shot style="min-height:90px">${shot ? `<img src="${shot}" alt="Chart screenshot">` : `${ICON.image}<span>Add chart screenshot (optional)</span>`}</button>`}
      <button class="btn btn-primary" data-save>${found ? 'Yes, save' : existing ? 'Save changes' : 'Save trade'}</button>
    `);

    const read = () => {
      t.accountId = $('#f-acct').value;
      t.date = $('#f-date').value || todayIso();
      t.lots = num($('#f-lots').value); t.entry = num($('#f-entry').value);
      t.sl = num($('#f-sl').value); t.tp = num($('#f-tp').value);
      t.note = $('#f-note').value.trim();
      if ($('#f-exit')) t.exit = num($('#f-exit').value);
    };
    const summary = () => {
      read();
      const risk = riskUsd(t), target = targetUsd(t);
      const planned = risk && target ? target / risk : null;
      const a = acctById(t.accountId);
      const riskPct = a && risk && a.size ? (risk / a.size) * 100 : null;
      s.querySelector('[data-sum]').innerHTML = `
        <div><div class="v">${risk != null ? money(risk, false) : '–'}</div><div class="k">Risk${riskPct != null ? ` (${riskPct.toFixed(2)}%)` : ''}</div></div>
        <div><div class="v up">${target != null ? money(target) : '–'}</div><div class="k">Target</div></div>
        <div><div class="v">${planned != null ? planned.toFixed(1) + 'R' : '–'}</div><div class="k">Planned</div></div>`;
    };
    summary();
    $$('input, select', s).forEach((i) => i.addEventListener('input', summary));
    $$('[data-dir]', s).forEach((b) => b.onclick = () => {
      t.direction = b.dataset.dir;
      $$('[data-dir]', s).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    });
    s.querySelector('[data-plan]').onclick = (e) => { t.plan = !t.plan; e.currentTarget.setAttribute('aria-checked', t.plan); };
    s.querySelector('[data-close]').onclick = () => { closeSheet(); if (opts.back) opts.back(); };
    const shotBtn = s.querySelector('[data-shot]');
    if (shotBtn) shotBtn.onclick = async () => {
      const f = await pickFile($('#file-chart'));
      if (!f) return;
      shot = await shrink(await fileToDataUrl(f));
      shotBtn.innerHTML = `<img src="${shot}" alt="Chart screenshot">`;
    };
    s.querySelector('[data-save]').onclick = async () => {
      read();
      if (!t.lots || t.entry == null || t.sl == null) { toast('Add lots, entry and stop loss to save'); return; }
      if (t.tp != null && ((t.direction === 'buy' && t.tp < t.entry) || (t.direction === 'sell' && t.tp > t.entry))) {
        if (!confirm('The take profit is on the wrong side of the entry for a ' + t.direction + '. Save anyway?')) return;
      }
      if (shot && !t.shotKey) { t.shotKey = 'img:' + t.id; await DB.set(t.shotKey, shot); }
      if (t.status === 'closed' && t.exit != null) Object.assign(t, resultAt(t, t.exit, (acctById(t.accountId) || {}).commission));
      const i = state.trades.findIndex((x) => x.id === t.id);
      if (i >= 0) state.trades[i] = t; else state.trades.push(t);
      state.settings.lastAccount = t.accountId;
      save(); closeSheet(); render();
      toast(existing ? 'Changes saved' : 'Trade saved as open');
      if (opts.back) opts.back();
    };
  }

  // ---------- Close a trade ----------
  function closeTradeSheet(t, back) {
    if (!t) return;
    const a = acctById(t.accountId) || {};
    let pick = null;
    const s = openSheet(`
      <div class="sheet-top"><button class="btn-link" data-close>Cancel</button><span class="title">How did it end?</span><span style="width:60px"></span></div>
      <p class="hint">${t.direction === 'sell' ? 'Sell' : 'Buy'} ${t.lots} lots EURUSD from ${price(t.entry)}</p>
      <div class="seg" role="group" aria-label="Outcome">
        <button data-o="tp" ${t.tp == null ? 'disabled' : ''}>Hit TP</button>
        <button data-o="sl">Hit SL</button>
        <button data-o="manual">Closed early</button>
      </div>
      <div class="group hidden" data-exitwrap><div class="field"><label for="c-exit">Exit price</label><input id="c-exit" inputmode="decimal" placeholder="${t.entry}"></div></div>
      <div class="card big-result"><span class="muted" style="font-size:13px">Result${a.commission ? ` (after $${a.commission}/lot commission)` : ''}</span><span class="v" data-res>–</span><span class="muted" data-r></span></div>
      <button class="btn btn-primary" data-save disabled>Save result</button>`);
    const exitVal = () => (pick === 'tp' ? t.tp : pick === 'sl' ? t.sl : num($('#c-exit').value));
    const update = () => {
      const x = exitVal();
      const ok = pick && x != null;
      s.querySelector('[data-save]').disabled = !ok;
      if (!ok) { s.querySelector('[data-res]').textContent = '–'; s.querySelector('[data-r]').textContent = ''; return; }
      const r = resultAt(t, x, a.commission);
      const el = s.querySelector('[data-res]');
      el.textContent = money(r.pnl); el.className = 'v ' + cls(r.pnl);
      s.querySelector('[data-r]').textContent = rText(r.r);
    };
    $$('[data-o]', s).forEach((b) => b.onclick = () => {
      pick = b.dataset.o;
      $$('[data-o]', s).forEach((x) => x.classList.toggle('on', x === b));
      s.querySelector('[data-exitwrap]').classList.toggle('hidden', pick !== 'manual');
      if (pick === 'manual') $('#c-exit').focus();
      update();
    });
    s.querySelector('#c-exit').addEventListener('input', update);
    s.querySelector('[data-close]').onclick = () => { closeSheet(); if (back) back(); };
    s.querySelector('[data-save]').onclick = () => {
      const x = exitVal(); if (x == null) return;
      Object.assign(t, { status: 'closed', outcome: pick, exit: x }, resultAt(t, x, a.commission));
      save(); closeSheet(); render();
      toast('Result saved: ' + money(t.pnl));
      if (back) back();
    };
  }

  // ---------- Journal ----------
  async function renderJournal() {
    const el = $('#view-journal');
    let list = [...state.trades];
    if (journalFilter === 'open') list = list.filter((t) => t.status === 'open');
    if (journalFilter === 'wins') list = list.filter((t) => t.status === 'closed' && t.pnl > 0);
    if (journalFilter === 'losses') list = list.filter((t) => t.status === 'closed' && t.pnl <= 0);
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const groups = {};
    for (const t of list) (groups[t.date] = groups[t.date] || []).push(t);

    const row = (t) => {
      const a = acctById(t.accountId);
      const planIcon = t.plan ? ICON.tick.replace('<svg', '<svg class="up" aria-label="Followed plan"') : ICON.cross.replace('<svg', '<svg class="down" aria-label="Broke plan"');
      return `<button class="row" data-trade="${t.id}">
        <span class="dir ${t.direction === 'sell' ? 'down' : 'up'}">${t.direction === 'sell' ? ICON.sell : ICON.buy}</span>
        <span class="mid"><span class="t1">${t.direction === 'sell' ? 'Sell' : 'Buy'} · EURUSD</span><span class="t2">${t.status === 'closed' ? planIcon : ''}${esc(a ? a.name : '')} · ${t.lots} lots</span></span>
        <span class="end">${t.status === 'closed' ? `<span class="amt ${cls(t.pnl)}">${money(t.pnl)}</span><span class="muted" style="font-size:13px">${rText(t.r)}</span>` : '<span class="pill open">Open</span>'}</span>
      </button>`;
    };

    const filters = [['all', 'All'], ['open', 'Open'], ['wins', 'Wins'], ['losses', 'Losses']];
    el.innerHTML = `
      <div class="head"><h1>Journal</h1></div>
      <div class="seg" role="group" aria-label="Filter">${filters.map(([k, l]) => `<button data-f="${k}" class="${journalFilter === k ? 'on' : ''}" aria-pressed="${journalFilter === k}">${l}</button>`).join('')}</div>
      ${list.length ? Object.keys(groups).map((d) => `<div style="display:flex;flex-direction:column;gap:6px"><div class="group-label">${esc(niceDate(d))}</div><div class="card list">${groups[d].map(row).join('')}</div></div>`).join('')
        : `<div class="card empty">${state.trades.length ? 'No trades match this filter.' : 'No trades yet. Tap + to log your first one.'}</div>`}
    `;
    $$('[data-f]', el).forEach((b) => b.onclick = () => { journalFilter = b.dataset.f; renderJournal(); });
    $$('[data-trade]', el).forEach((b) => b.onclick = () => openDay(state.trades.find((t) => t.id === b.dataset.trade).date));
  }

  // ---------- Accounts ----------
  function accountStats(a) {
    const list = closed(state.trades.filter((t) => t.accountId === a.id));
    const total = list.reduce((s, t) => s + t.pnl, 0);
    const today = list.filter((t) => t.date === todayIso()).reduce((s, t) => s + t.pnl, 0);
    const dailyLeft = (a.dailyLimit || 0) + Math.min(0, today);
    const ddLeft = (a.maxDD || 0) + Math.min(0, total);
    let status = ['safe', 'Safe to trade'];
    if ((a.dailyLimit && dailyLeft <= 0) || (a.maxDD && ddLeft <= 0)) status = ['bad', 'Limit hit'];
    else if (a.target && total >= a.target) status = ['safe', 'Target reached'];
    else if (a.dailyLimit && dailyLeft < a.dailyLimit * 0.3) status = ['warn', 'Near daily limit'];
    return { total, today, dailyLeft, ddLeft, status };
  }

  function renderAccounts() {
    const el = $('#view-accounts');
    const bar = (label, left, of, pct, colour) => `
      <div class="bar-row"><div class="bar-top"><span class="muted">${label}</span><span><b>${left}</b> <span class="muted">of ${of}</span></span></div>
      <div class="bar" role="progressbar" aria-label="${label}" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0, Math.min(100, pct))}%;background:${colour}"></i></div></div>`;
    el.innerHTML = `
      <div class="head"><h1>Accounts</h1><button class="icon-btn" data-add aria-label="Add account">${ICON.plus}</button></div>
      ${state.accounts.length ? `<div class="acct-grid">${state.accounts.map((a) => {
        const st = accountStats(a);
        const warnCol = st.status[0] === 'bad' ? 'var(--down)' : st.status[0] === 'warn' ? 'var(--warn)' : 'var(--accent)';
        return `<button class="card acct" data-acct="${a.id}" style="text-align:left">
          <div class="head" style="align-items:flex-start;width:100%">
            <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:17px;font-weight:600">${esc(a.name)}</span><span class="muted" style="font-size:13px">${a.size ? money(a.size, false) : ''}${a.phase ? ' · ' + esc(a.phase) : ''} · ${a.riskPct || 1}% risk</span></div>
            <span class="pill ${st.status[0]}">${st.status[1]}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px;width:100%">
            ${a.target ? bar('Profit target', money(st.total), money(a.target, false), (Math.max(0, st.total) / a.target) * 100, 'var(--up)') : ''}
            ${a.dailyLimit ? bar('Daily loss left', money(st.dailyLeft, false), money(a.dailyLimit, false), (st.dailyLeft / a.dailyLimit) * 100, warnCol) : ''}
            ${a.maxDD ? bar('Max drawdown left', money(st.ddLeft, false), money(a.maxDD, false), (st.ddLeft / a.maxDD) * 100, st.ddLeft <= 0 ? 'var(--down)' : 'var(--accent)') : ''}
          </div>
        </button>`;
      }).join('')}</div>` : `<div class="card empty">Add each funded account to track its profit target, daily loss and drawdown.</div><button class="btn btn-primary" data-add2>Add account</button>`}
    `;
    const add = () => accountForm(null);
    el.querySelector('[data-add]').onclick = add;
    if (el.querySelector('[data-add2]')) el.querySelector('[data-add2]').onclick = add;
    $$('[data-acct]', el).forEach((b) => b.onclick = () => accountForm(acctById(b.dataset.acct)));
  }

  function accountForm(existing, after) {
    const a = existing ? { ...existing } : { id: uid(), name: '', size: null, phase: '', riskPct: 1, target: null, dailyLimit: null, maxDD: null, commission: 0 };
    const f = (id, label, val, ph, mode = 'decimal') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" inputmode="${mode}" placeholder="${ph}" value="${val ?? ''}"></div>`;
    const s = openSheet(`
      <div class="sheet-top"><button class="btn-link" data-close>Cancel</button><span class="title">${existing ? 'Edit account' : 'New account'}</span><span style="width:60px"></span></div>
      <div class="group">
        ${f('a-name', 'Name', esc(a.name), 'e.g. FundedNext 50k', 'text')}
        ${f('a-phase', 'Phase', esc(a.phase), 'e.g. Phase 1', 'text')}
        ${f('a-size', 'Account size ($)', a.size, '50000')}
        ${f('a-risk', 'Risk per trade (%)', a.riskPct, '1')}
      </div>
      <div class="group">
        ${f('a-target', 'Profit target ($)', a.target, '4000')}
        ${f('a-daily', 'Daily loss limit ($)', a.dailyLimit, '2500')}
        ${f('a-dd', 'Max drawdown ($)', a.maxDD, '5000')}
        ${f('a-comm', 'Commission per lot ($)', a.commission || '', '0')}
      </div>
      <p class="hint">Find these in your prop firm’s rules. Leave any you don’t need blank.</p>
      <button class="btn btn-primary" data-save>${existing ? 'Save changes' : 'Add account'}</button>
      ${existing ? '<button class="btn btn-danger" data-del>Delete account</button>' : ''}`, null);
    s.querySelector('[data-close]').onclick = () => { closeSheet(); if (after && !existing) render(); };
    s.querySelector('[data-save]').onclick = () => {
      a.name = $('#a-name').value.trim() || 'My account';
      a.phase = $('#a-phase').value.trim();
      a.size = num($('#a-size').value); a.riskPct = num($('#a-risk').value) || 1;
      a.target = num($('#a-target').value); a.dailyLimit = num($('#a-daily').value);
      a.maxDD = num($('#a-dd').value); a.commission = num($('#a-comm').value) || 0;
      const i = state.accounts.findIndex((x) => x.id === a.id);
      if (i >= 0) state.accounts[i] = a; else state.accounts.push(a);
      save(); closeSheet(); render(); toast(existing ? 'Account saved' : 'Account added');
      if (after) after();
    };
    const del = s.querySelector('[data-del]');
    if (del) del.onclick = () => {
      const count = state.trades.filter((t) => t.accountId === a.id).length;
      if (!confirm(count ? `Delete this account? Its ${count} trade(s) will stay in your journal without an account.` : 'Delete this account?')) return;
      state.accounts = state.accounts.filter((x) => x.id !== a.id);
      save(); closeSheet(); render(); toast('Account deleted');
    };
  }

  // ---------- Notes ----------
  let currentNote = null, sketch = null, noteQuery = '', tool = 'pen', colour = 'ink', fingerOn = false;

  function renderNotes() {
    const el = $('#view-notes');
    if (sketch) { sketch.destroy(); sketch = null; }
    const q = noteQuery.toLowerCase();
    const list = state.notes
      .filter((n) => !q || (n.title + ' ' + n.text).toLowerCase().includes(q))
      .sort((a, b) => b.updated - a.updated);
    const note = currentNote ? state.notes.find((n) => n.id === currentNote) : null;
    const when = (ts) => { const d = new Date(ts); return iso(d) === todayIso() ? 'Today' : `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };

    const swatches = ['ink', 'yellow', 'green', 'red', 'blue'].map((c) => `<button class="sw ${colour === c ? 'on' : ''}" data-c="${c}" aria-label="${c === 'ink' ? 'Black or white' : c}" style="background:${c === 'ink' ? 'var(--text)' : Sketch.COLOURS[c]}"></button>`).join('');
    const tools = [['pen', 'Pen', ICON.pen], ['hi', 'Highlighter', ICON.hi], ['eraser', 'Eraser', ICON.eraser]]
      .map(([k, l, i]) => `<button class="tool ${tool === k ? 'on' : ''}" data-tool="${k}" aria-label="${l}" aria-pressed="${tool === k}">${i}</button>`).join('');

    el.innerHTML = `
      <div class="notes-wrap ${note ? 'editing' : ''}">
        <div class="notes-side">
          <div class="head"><h1>Notes</h1><button class="icon-btn" data-new aria-label="New note">${ICON.plus}</button></div>
          <label class="search">${ICON.search}<input type="search" placeholder="Search notes" aria-label="Search notes" value="${esc(noteQuery)}" data-q></label>
          <div class="notes-list">${list.length ? list.map((n) => `<button class="note-item ${n.id === currentNote ? 'on' : ''}" data-note="${n.id}"><b>${esc(n.title || 'Untitled')}</b><small>${when(n.updated)}</small></button>`).join('')
            : `<div class="empty">${state.notes.length ? 'No notes match.' : 'Make a note for each thing you learn, like FVGs or order blocks.'}</div>`}</div>
        </div>
        ${note ? `
        <div class="editor">
          <div class="head"><button class="btn-link" data-back style="display:flex;align-items:center">${ICON.left} Notes</button><button class="btn-link" data-delnote style="color:var(--down)">Delete</button></div>
          <input class="title-in" data-title placeholder="Title" value="${esc(note.title)}" aria-label="Note title">
          <textarea data-text placeholder="Type here…" aria-label="Note text">${esc(note.text)}</textarea>
          <div class="card toolbar">
            <div class="tools">${tools}<button class="tool ${fingerOn ? 'on' : ''}" data-finger aria-label="Draw with finger" aria-pressed="${fingerOn}">${ICON.hand}</button></div>
            <div class="tools">${swatches}<button class="tool" data-undo aria-label="Undo">${ICON.undo}</button></div>
          </div>
          <div class="canvas-box ${fingerOn ? 'finger' : ''}" data-canvas></div>
          <p class="hint">Draw with Apple Pencil or a mouse. Your finger scrolls, unless you turn on finger drawing.</p>
        </div>` : '<div class="editor"></div>'}
      </div>`;

    el.querySelector('[data-new]').onclick = () => {
      const n = { id: uid(), title: '', text: '', drawing: { h: 1.1, strokes: [] }, updated: Date.now() };
      state.notes.push(n); currentNote = n.id; save(); renderNotes();
      const t = $('[data-title]'); if (t) t.focus();
    };
    const qIn = el.querySelector('[data-q]');
    qIn.oninput = () => { noteQuery = qIn.value; const pos = qIn.selectionStart; renderNotes(); const again = $('[data-q]'); again.focus(); again.setSelectionRange(pos, pos); };
    $$('[data-note]', el).forEach((b) => b.onclick = () => { currentNote = b.dataset.note; renderNotes(); });

    if (!note) return;
    const touch = () => { note.updated = Date.now(); save(); };
    el.querySelector('[data-back]').onclick = () => { currentNote = null; renderNotes(); };
    el.querySelector('[data-delnote]').onclick = () => {
      if (!confirm('Delete this note?')) return;
      state.notes = state.notes.filter((n) => n.id !== note.id); currentNote = null; save(); renderNotes(); toast('Note deleted');
    };
    const titleIn = el.querySelector('[data-title]');
    titleIn.oninput = () => { note.title = titleIn.value; touch(); const item = $(`[data-note="${note.id}"] b`); if (item) item.textContent = note.title || 'Untitled'; };
    const ta = el.querySelector('[data-text]');
    const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.oninput = () => { note.text = ta.value; grow(); touch(); };
    requestAnimationFrame(grow);

    if (!note.drawing) note.drawing = { h: 1.1, strokes: [] };
    sketch = Sketch.mount(el.querySelector('[data-canvas]'), note.drawing, touch);
    sketch.setTool(tool); sketch.setColour(colour); sketch.setFinger(fingerOn);
    $$('[data-tool]', el).forEach((b) => b.onclick = () => {
      tool = b.dataset.tool; sketch.setTool(tool);
      $$('[data-tool]', el).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    });
    $$('[data-c]', el).forEach((b) => b.onclick = () => {
      colour = b.dataset.c; sketch.setColour(colour);
      if (tool === 'eraser') { tool = 'pen'; sketch.setTool('pen'); $$('[data-tool]', el).forEach((x) => x.classList.toggle('on', x.dataset.tool === 'pen')); }
      $$('[data-c]', el).forEach((x) => x.classList.toggle('on', x === b));
    });
    el.querySelector('[data-finger]').onclick = (e) => { fingerOn = !fingerOn; sketch.setFinger(fingerOn); e.currentTarget.classList.toggle('on', fingerOn); e.currentTarget.setAttribute('aria-pressed', fingerOn); };
    el.querySelector('[data-undo]').onclick = () => { if (!sketch.undo()) toast('Nothing to undo'); };
  }

  // ---------- More: converter, appearance, backup ----------
  async function getRate(force) {
    const cached = state.settings.rate;
    if (!force && cached && Date.now() - cached.at < 60 * 60 * 1000) return cached;
    const urls = ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP', 'https://api.frankfurter.app/latest?from=USD&to=GBP'];
    for (const u of urls) {
      try {
        const r = await fetch(u);
        if (!r.ok) continue;
        const j = await r.json();
        if (j && j.rates && j.rates.GBP) { state.settings.rate = { v: j.rates.GBP, at: Date.now(), day: j.date }; save(); return state.settings.rate; }
      } catch (e) { /* try the next one */ }
    }
    return cached || null;
  }

  let convFrom = 'USD';
  function renderMore() {
    const el = $('#view-more');
    const theme = state.settings.theme;
    el.innerHTML = `
      <div class="head"><h1>More</h1></div>
      <h2>USD to GBP</h2>
      <div class="card conv">
        <div class="conv-row"><span class="cur" data-cur1>${convFrom}</span><input data-amt inputmode="decimal" value="100" aria-label="Amount in ${convFrom}"></div>
        <div class="head"><button class="btn btn-plain" data-swap>${ICON.swap} Swap</button><span class="muted" data-rate style="font-size:13px">Getting today’s rate…</span></div>
        <div class="conv-row"><span class="cur" data-cur2>${convFrom === 'USD' ? 'GBP' : 'USD'}</span><span data-out style="font-size:28px;font-weight:700">–</span></div>
      </div>
      <h2>Appearance</h2>
      <div class="seg" role="group" aria-label="Appearance">
        ${[['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button data-theme="${k}" class="${theme === k ? 'on' : ''}" aria-pressed="${theme === k}">${l}</button>`).join('')}
      </div>
      <h2>Backup</h2>
      <div class="card">
        <button class="settings-row" data-export><span>Export everything</span><span class="muted">.json</span></button>
        <button class="settings-row" data-import><span>Import a backup</span><span class="muted">Replaces current data</span></button>
      </div>
      <p class="hint">Automatic syncing between your devices and nightly backups arrive in the next update. Until then, your data is saved on this device.</p>
    `;
    const amt = el.querySelector('[data-amt]');
    let rate = null;
    const calc = () => {
      const v = num(amt.value);
      const out = el.querySelector('[data-out]');
      if (v == null || !rate) { out.textContent = '–'; return; }
      const res = convFrom === 'USD' ? v * rate.v : v / rate.v;
      out.textContent = (convFrom === 'USD' ? '£' : '$') + res.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    amt.oninput = calc;
    getRate().then((r) => {
      rate = r;
      const lbl = el.querySelector('[data-rate]');
      if (!lbl) return;
      lbl.textContent = r ? `$1 = £${r.v.toFixed(4)}${r.day ? ' · ' + r.day : ''}` : 'No connection. Try again when online.';
      calc();
    });
    el.querySelector('[data-swap]').onclick = () => { convFrom = convFrom === 'USD' ? 'GBP' : 'USD'; renderMore(); };
    $$('[data-theme]', el).forEach((b) => b.onclick = () => { state.settings.theme = b.dataset.theme; applyTheme(); save(); renderMore(); });

    el.querySelector('[data-export]').onclick = async () => {
      const images = {};
      for (const t of state.trades) if (t.shotKey) { const v = await DB.get(t.shotKey).catch(() => null); if (v) images[t.shotKey] = v; }
      const blob = new Blob([JSON.stringify({ app: 'floor7', version: 1, exported: new Date().toISOString(), state, images })], { type: 'application/json' });
      const name = `floor7-backup-${todayIso()}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Floor 7 backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    el.querySelector('[data-import]').onclick = async () => {
      const f = await pickFile($('#file-import'));
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (data.app !== 'floor7' || !data.state) throw new Error();
        if (!confirm('Replace everything in Floor 7 with this backup?')) return;
        state = data.state;
        for (const [k, v] of Object.entries(data.images || {})) await DB.set(k, v);
        save(); applyTheme(); render(); toast('Backup imported');
      } catch (e) { toast('That file isn’t a Floor 7 backup'); }
    };
  }

  // ---------- Start ----------
  async function init() {
    try {
      const saved = await DB.get('state');
      if (saved) state = { ...state, ...saved, settings: { theme: 'auto', ...(saved.settings || {}) } };
    } catch (e) { toast('Storage is unavailable, so changes won’t be saved.'); }
    applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); render(); });
    let start = 'calendar';
    try { start = sessionStorage.getItem('f7-view') || 'calendar'; } catch (e) {}
    go(start);
    setTimeout(() => { const sp = $('#splash'); sp.classList.add('gone'); setTimeout(() => sp.remove(), 600); }, 900);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
  init();
})();
