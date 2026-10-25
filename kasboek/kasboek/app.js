import { parseCSVFile, parseRabobankPDF, decodeText } from './parsers.js';
import { analyze, CATEGORIES, CAT, GROUPS, eur, eur0, monthLabel, nameKey, cleanName } from './analysis.js';
import { sampleData } from './sample.js';

// ---------- opslag (optioneel, alleen in deze browser) ----------
const LS = { settings: 'kasboek.settings.v1', tx: 'kasboek.tx.v1' };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* geen opslag */ } },
};
const defaultSettings = () => ({ holders: [], ownIbans: [], overrides: {}, txOverrides: {}, eenmaligThreshold: 750, keepRules: true, keepTx: false });

const state = { settings: { ...defaultSettings(), ...(store.get(LS.settings) || {}) }, files: [], tx: [], meta: {}, sample: false, a: null, fc: null, tab: 'overzicht' };

function saveSettings() {
  if (state.settings.keepRules) store.set(LS.settings, state.settings); else store.del(LS.settings);
  if (state.settings.keepTx && !state.sample && state.tx.length) store.set(LS.tx, { files: state.files, tx: state.tx, meta: state.meta });
  else store.del(LS.tx);
}

// ---------- DOM-hulpjes ----------
const $ = (s) => document.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const svgNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const COLORS = () => ({ in: css('--in'), vast: css('--vast'), var: css('--var'), een: css('--een'), muted: css('--muted'), line: css('--line'), rule: css('--rule'), ink: css('--ink'), accent: css('--accent'), warn: css('--warn') });

// ---------- tooltip ----------
const tipEl = $('#tip');
function showTip(ev, title, rows) {
  tipEl.replaceChildren(h('div', { class: 't' }, title), ...rows.map(([c, l, v]) => h('div', { class: 'r' }, h('span', {}, c ? h('i', { class: 'sw', style: `background:${c}` }) : null, l), h('b', {}, v))));
  tipEl.hidden = false;
  const r = tipEl.getBoundingClientRect();
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
  tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = Math.max(8, y) + 'px';
}
const hideTip = () => { tipEl.hidden = true; };

// ---------- bestanden laden ----------
let pdfjsP = null;
async function getPdfjs() {
  if (!pdfjsP) pdfjsP = import('./lib/polyfills.mjs').then(() => import('./lib/pdf.min.mjs')).then((m) => { m.GlobalWorkerOptions.workerSrc = new URL('./lib/pdf.worker.shim.mjs', import.meta.url).href; return m; });
  return pdfjsP;
}

async function readFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isPdf = /\.pdf$/i.test(file.name) || (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46);
  if (isPdf) {
    const pdfjs = await getPdfjs();
    return parseRabobankPDF(pdfjs, buf, (page, total) => progress(`${file.name}: pagina ${page} van ${total}`));
  }
  return parseCSVFile(decodeText(buf), file.name);
}
const dropTitle = $('#drop-title'); const dropTitleText = dropTitle.textContent;
function progress(text) { dropTitle.textContent = text || dropTitleText; }

async function handleFiles(list, { replace = false } = {}) {
  const files = [...list];
  if (!files.length) return;
  const drop = $('#drop'); drop.classList.add('busy');
  const err = $('#load-error'); err.hidden = true;
  const errors = [];
  if (replace || state.sample) { state.files = []; state.tx = []; state.meta = {}; state.sample = false; }
  progress('Bezig met lezen…');
  for (const f of files) {
    try {
      const r = await readFile(f);
      const fileId = state.files.length;
      state.files.push({ name: f.name, bank: r.bank, count: r.transactions.length, accounts: r.accounts, check: r.check });
      if (r.holder) addHolder(r.holder);
      r.transactions.forEach((t, i) => state.tx.push({ ...t, file: fileId, seq: i }));
    } catch (e) {
      console.error(e);
      errors.push(`${f.name}: ${e.message || e}`);
    }
  }
  drop.classList.remove('busy'); progress('');
  if (errors.length) { err.textContent = errors.join(' '); err.hidden = false; }
  if (!state.tx.length) return;
  finalizeData();
  saveSettings();
  showResult();
}

function addHolder(name) {
  const k = nameKey(name);
  if (!state.settings.holders.some((x) => nameKey(x) === k)) state.settings.holders.push(name);
}

function finalizeData() {
  // dubbele transacties (zelfde export twee keer geladen) eruit
  const seen = new Set();
  const out = [];
  for (const t of state.tx) {
    const k = [t.account, t.date, t.amount.toFixed(2), t.name, t.desc].join('|');
    if (seen.has(k)) continue; seen.add(k); out.push(t);
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.file - b.file || a.seq - b.seq));
  state.tx = out.map((t, i) => ({ ...t, id: stableId(t) }));
  const accounts = [...new Set(state.files.flatMap((f) => f.accounts))];
  // periode: PDF-afschriften kennen hun exacte periode
  const pdfChecks = state.files.map((f) => f.check).filter(Boolean);
  const dates = state.tx.map((t) => t.date);
  let van = dates[0], tot = dates[dates.length - 1];
  pdfChecks.forEach((c) => { if (c.van && c.van < van) van = c.van; if (c.tot && c.tot > tot) tot = c.tot; });
  // eindsaldo: per rekening het saldo na de laatste transactie
  let endBalance = 0, known = 0;
  for (const acc of accounts.length ? accounts : ['']) {
    const ts = state.tx.filter((t) => (t.account || '') === acc);
    if (!ts.length) continue;
    const lastDate = ts[ts.length - 1].date;
    const sameDay = ts.filter((t) => t.date === lastDate && t.balance != null && !isNaN(t.balance));
    let bal = null;
    if (sameDay.length) {
      // de bank sorteert soms aflopend; kies het saldo dat past bij de volgorde in het bestand
      const asc = ts[0].seq <= ts[ts.length - 1].seq;
      const pick = sameDay.reduce((a, t) => ((asc ? t.seq > a.seq : t.seq < a.seq) ? t : a), sameDay[0]);
      bal = pick.balance;
    }
    const chk = pdfChecks.find((c) => c.eindsaldo != null && state.files.some((f) => f.check === c && f.accounts.includes(acc)));
    if (chk) bal = chk.eindsaldo;
    if (bal != null) { endBalance += bal; known++; }
  }
  state.meta = { accounts, van, tot, endBalance: known && known === Math.max(1, accounts.length) ? Math.round(endBalance * 100) / 100 : null };
}
function stableId(t) {
  const str = [t.account, t.date, t.amount, t.name, t.desc, t.seq].join('|');
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  return (x >>> 0).toString(36);
}

// ---------- weergave ----------
function showResult() {
  $('#start').hidden = true; $('#result').hidden = false; $('#bar-actions').hidden = false;
  $('#sample-banner').hidden = !state.sample;
  state.fc = null;
  recompute();
  selectTab(location.hash.slice(1) && document.getElementById('p-' + location.hash.slice(1)) ? location.hash.slice(1) : 'overzicht', false);
  window.scrollTo({ top: 0 });
}

function recompute() {
  state.a = analyze(state.tx, state.settings, state.meta);
  renderAll();
}

function renderAll() {
  renderSummary();
  renderTab(state.tab);
}

function renderTab(tab) {
  if (!state.a) return;
  ({ overzicht: renderOverzicht, vast: renderVast, prognose: renderPrognose, sparen: renderSparen, cat: renderCat, tx: renderTx })[tab]();
}

function selectTab(tab, push = true) {
  state.tab = tab;
  document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== 'p-' + tab; });
  if (push) history.replaceState(null, '', '#' + tab);
  renderTab(tab);
}
document.querySelectorAll('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
$('.tabs').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const tabs = [...document.querySelectorAll('.tabs [role=tab]')];
  const i = tabs.findIndex((b) => b.dataset.tab === state.tab);
  const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
  n.focus(); selectTab(n.dataset.tab);
});

const fmtDate = (d) => { const [y, m, dd] = d.split('-'); return `${+dd} ${monthLabel(`${y}-${m}`, false, false)} ${y}`; };
const shortDate = (d) => { const [, m, dd] = d.split('-'); return `${dd}-${m}`; };

function renderSummary() {
  const a = state.a;
  const banks = [...new Set(state.files.map((f) => f.bank))].join(', ');
  const nAcc = state.meta.accounts.length;
  $('#r-title').textContent = state.sample ? 'Voorbeeldhuishouden' : 'Je huishoudboekje';
  $('#r-meta').textContent = `${fmtDate(a.period.van)} t/m ${fmtDate(a.period.tot)} · ${state.tx.length} transacties · ${banks}${nAcc > 1 ? ` · ${nAcc} rekeningen` : ''}`;
  const checks = state.files.map((f) => f.check).filter(Boolean);
  const c = $('#r-check');
  if (checks.length) {
    const ok = checks.every((x) => x.ok);
    c.hidden = false; c.className = 'check ' + (ok ? 'ok' : 'bad');
    c.textContent = ok ? 'Totalen kloppen met het afschrift' : `Let op: totalen wijken af van het afschrift (${checks.map((x) => `af ${eur(x.af)} i.p.v. ${eur(x.expectedAf)}`).join(', ')})`;
  } else c.hidden = true;
}

function tile(lbl, big, sub, cls = '') { return h('div', { class: 'tile' }, h('span', { class: 'lbl' }, lbl), h('span', { class: 'big ' + cls }, big), sub ? h('span', { class: 'sub' }, sub) : null); }

function tileBtn(id, lbl, big, sub, cls = '') {
  const open = state.openTile === id;
  return h('button', { type: 'button', class: 'tile tile-btn' + (open ? ' open' : ''), 'aria-expanded': String(open), 'aria-controls': 'tile-detail',
    onclick: () => { state.openTile = open ? null : id; renderOverzicht(); if (!open) document.getElementById('tile-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } },
  h('span', { class: 'lbl' }, lbl, h('span', { class: 'chev', 'aria-hidden': 'true' }, open ? '▾' : '▸')), h('span', { class: 'big ' + cls }, big), sub ? h('span', { class: 'sub' }, sub) : null);
}

// posten (ontvangers/afzenders) binnen een selectie transacties; sign -1 voor uitgaven
function postsOf(ts, sign = -1, div = 1) {
  const by = new Map();
  for (const t of ts) {
    if (!by.has(t.key)) by.set(t.key, { label: cleanName(t.name) || '(zonder naam)', n: 0, total: 0 });
    const r = by.get(t.key); r.n++; r.total += (sign * t.amount) / div;
  }
  return [...by.values()].filter((r) => Math.abs(r.total) >= 0.005).sort((a, b) => b.total - a.total);
}
function catsOf(ts, sign = -1, div = 1) {
  const by = new Map();
  for (const t of ts) { if (!by.has(t.cat)) by.set(t.cat, []); by.get(t.cat).push(t); }
  return [...by.entries()].map(([cat, list]) => ({ label: CAT[cat].label, cat, n: list.length, total: (sign * list.reduce((x, t) => x + t.amount, 0)) / div, children: postsOf(list, sign, div) }))
    .filter((r) => Math.abs(r.total) >= 0.005).sort((a, b) => b.total - a.total);
}

// tabel met uitklapbare regels: secties -> regels -> posten
function breakdown(sections, { unit = '', note = '' } = {}) {
  const money = (v) => eur(v);
  const line = (r, depth) => {
    const kids = (r.children || []).slice(0, 25);
    const more = (r.children || []).length - kids.length;
    const head = [h('span', { class: 'bd-l' }, r.label, r.n != null ? h('span', { class: 'bd-n' }, r.n === 1 ? '1 transactie' : `${r.n} transacties`) : null), h('span', { class: 'bd-v ' + (r.cls || '') }, (r.sign || '') + money(r.total))];
    if (!kids.length) return h('div', { class: 'bd-row d' + depth }, ...head);
    return h('details', { class: 'bd-row d' + depth }, h('summary', {}, ...head),
      h('div', { class: 'bd-kids' }, ...kids.map((c) => line(c, depth + 1)), more > 0 ? h('div', { class: 'bd-row d' + (depth + 1) + ' muted' }, h('span', { class: 'bd-l' }, `en nog ${more} posten`), h('span', { class: 'bd-v' }, money((r.children || []).slice(25).reduce((x, c) => x + c.total, 0)))) : null));
  };
  return h('div', { class: 'bd' },
    ...sections.map((sec) => h('section', { class: 'bd-sec' },
      h('div', { class: 'bd-head' }, h('span', {}, sec.title), h('span', { class: 'bd-v ' + (sec.cls || '') }, (sec.sign || '') + money(sec.total))),
      ...sec.rows.map((r) => line(r, 0)))),
    note ? h('p', { class: 'hint bd-note' }, note) : null);
}

function renderTileDetail() {
  const el = $('#tile-detail'); const id = state.openTile; const a = state.a;
  if (!id || !a) { el.hidden = true; el.replaceChildren(); return; }
  el.hidden = false;
  const n = a.months.length;
  let title, intro, body;
  const close = h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.openTile = null; renderOverzicht(); } }, 'Sluiten');
  if (id === 'bij') {
    const ts = a.tx.filter((t) => t.group === 'inkomen');
    const rows = catsOf(ts, 1);
    title = `Bij in ${n} maanden`; intro = 'Alles wat binnenkwam, per categorie. Klik op een regel om te zien van wie.';
    body = breakdown([{ title: 'Inkomsten', total: rows.reduce((x, r) => x + r.total, 0), rows }]);
  } else if (id === 'af') {
    const secs = [['vast', 'Vaste lasten'], ['variabel', 'Overige uitgaven'], ['eenmalig', 'Eenmalige uitgaven']].map(([g, l]) => {
      const rows = catsOf(a.tx.filter((t) => t.group === g));
      return { title: l, total: rows.reduce((x, r) => x + r.total, 0), rows };
    }).filter((sct) => sct.rows.length);
    title = `Af in ${n} maanden`; intro = 'Alles wat eruit ging, per soort en categorie. Overboekingen naar je eigen rekeningen tellen niet mee.';
    body = breakdown(secs);
  } else if (id === 'normaal') {
    const full = new Set(a.fullMonths.length ? a.fullMonths : a.months); const m = full.size;
    const secs = [['vast', 'Vaste lasten'], ['variabel', 'Overige uitgaven']].map(([g, l]) => {
      const rows = catsOf(a.tx.filter((t) => t.group === g && full.has(t.month)), -1, m);
      return { title: l, total: rows.reduce((x, r) => x + r.total, 0), rows };
    });
    title = 'Normale maand'; intro = `Gemiddeld per maand over ${m} volledige maanden, zonder eenmalige uitgaven.`;
    body = breakdown(secs, { note: 'Bedragen zijn gemiddelden per maand. Een post die je één keer per jaar betaalt telt dus voor een twaalfde mee.' });
  } else {
    const fc = forecast(); const p = fc.params;
    const active = a.recurring.filter((r) => r.status !== 'gestopt?' && r.freq !== 'incidenteel');
    const vast = active.filter((r) => !r.sparen).map((r) => ({ label: cleanName(r.name), total: r.monthly, n: null }));
    const sparen = active.filter((r) => r.sparen && r.freq === 'maandelijks').map((r) => ({ label: cleanName(r.name), total: r.monthly }));
    const inc = a.incomeStreams.map((r) => ({ label: cleanName(r.name), total: r.base }));
    const edited = !!state.fc;
    title = 'Over per maand, verwacht'; intro = 'Zo is het verwachte bedrag opgebouwd. Klik op een regel voor de posten.';
    body = breakdown([{ title: 'Opbouw per maand', total: fc.rows[0]?.netto ?? 0, cls: (fc.rows[0]?.netto ?? 0) >= 0 ? 'pos' : 'neg', rows: [
      { label: 'Vast inkomen', total: p.inkomen, sign: '+ ', children: edited ? [] : inc },
      { label: 'Vaste lasten', total: p.vast, sign: '− ', children: edited ? [] : vast },
      { label: 'Vast sparen', total: p.sparen, sign: '− ', children: edited ? [] : sparen },
      { label: 'Overige uitgaven in een normale maand', total: p.variabel, sign: '− ' },
    ] }], { note: (edited ? 'Je hebt de aannames op het tabblad Prognose aangepast; die bedragen staan hier. ' : '') + 'Overige uitgaven is de middelste maand van de periode (de helft van de maanden gaf je meer uit, de helft minder). Vakantiegeld, bonussen en eenmalige uitgaven tellen hier niet mee.' });
  }
  el.replaceChildren(h('header', { class: 'bd-top' }, h('div', {}, h('h2', {}, title), h('p', {}, intro)), close), body);
}

function renderOverzicht() {
  const a = state.a, k = a.kpi, n = a.months.length;
  const fc = forecast();
  const ot = (id, ...args) => tileBtn(id, ...args);
  $('#tiles-overzicht').replaceChildren(
    ot('bij', `Bij in ${n} maanden`, eur0(k.totIn), `Gemiddeld ${eur0(k.totIn / n)} per maand`),
    ot('af', `Af in ${n} maanden`, eur0(k.totOut), k.eenmaligTotal ? `Waarvan ${eur0(k.eenmaligTotal)} eenmalig` : `Gemiddeld ${eur0(k.totOut / n)} per maand`),
    ot('normaal', 'Normale maand', eur0(k.regular), 'Vaste lasten en overige uitgaven, zonder eenmalig'),
    ot('over', 'Over per maand, verwacht', eur0(fc.rows[0]?.netto ?? 0), 'Na vaste lasten, sparen en een normale maand', (fc.rows[0]?.netto ?? 0) >= 0 ? 'pos' : 'neg'),
  );
  renderTileDetail();
  monthChart($('#ch-months'), a.monthRows);
  const notes = $('#notes');
  notes.replaceChildren(...(a.notes.length ? a.notes.map((x) => h('li', { class: x.kind }, x.text)) : [h('li', { class: 'empty' }, 'Niets bijzonders gevonden.')]));
  const C = COLORS();
  const cats = a.expenseCats.slice(0, 14), max = Math.max(...cats.map((c) => c.total), 1);
  $('#ch-cats').replaceChildren(...cats.flatMap((c) => {
    const g = Object.entries(c.groups).sort((x, y) => x[1] - y[1])[0]?.[0];
    const col = g === 'vast' ? C.vast : g === 'eenmalig' ? C.een : C.var;
    const open = state.openCat === c.cat;
    const row = h('button', {
      type: 'button', class: 'hbar-row' + (open ? ' open' : ''), 'aria-expanded': String(open), 'aria-controls': 'cd-' + c.cat,
      onclick: () => { hideTip(); state.openCat = open ? null : c.cat; renderOverzicht(); },
      onmousemove: (e) => { if (!open) showTip(e, c.label, [[col, 'Totaal', eur(c.total)], [null, 'Per maand', eur(c.perMonth)], [null, 'Transacties', String(c.count)], [null, '', 'Klik voor details']]); }, onmouseleave: hideTip,
    },
    h('span', { class: 'lab', title: c.label }, c.label),
    h('span', { class: 'track' }, h('span', { class: 'bar', style: `width:${(c.total / max) * 72}%;background:${col}` }), h('span', { class: 'val' }, eur0(c.total)), h('span', { class: 'chev', 'aria-hidden': 'true' }, open ? '▾' : '▸')));
    return open ? [row, catDetail(c, col)] : [row];
  }));
  $('#tb-income').replaceChildren(...a.incomeCats.map((c) => h('tr', {}, h('td', {}, c.label), h('td', { class: 'num' }, eur(c.total)), h('td', { class: 'num' }, eur(c.perMonth)))));
  $('#tb-eenmalig').replaceChildren(...(a.eenmalig.length ? a.eenmalig.slice(0, 12).map((t) => h('tr', {}, h('td', { class: 'num' }, shortDate(t.date)), h('td', {}, cleanName(t.name), h('span', { class: 'sm' }, CAT[t.cat].label)), h('td', { class: 'num' }, eur(-t.amount)))) : [h('tr', { class: 'muted' }, h('td', { colspan: 3 }, 'Geen grote eenmalige uitgaven.'))]));
}

// Uitsplitsing van één categorie naar de posten (ontvangers) waaruit hij bestaat.
function catDetail(c, col) {
  const ts = state.a.tx.filter((t) => t.cat === c.cat && t.group !== 'inkomen' && t.group !== 'intern');
  const by = new Map();
  for (const t of ts) {
    const name = cleanName(t.name) || '(zonder naam)';
    if (!by.has(t.key)) by.set(t.key, { name, n: 0, total: 0, last: t.date });
    const r = by.get(t.key); r.n++; r.total -= t.amount; if (t.date > r.last) r.last = t.date;
  }
  const rows = [...by.values()].filter((r) => Math.abs(r.total) >= 0.005).sort((a, b) => b.total - a.total);
  const top = rows.slice(0, 12), rest = rows.slice(12);
  const max = Math.max(...top.map((r) => r.total), 1);
  return h('div', { class: 'hbar-detail', id: 'cd-' + c.cat },
    h('table', { class: 'ledger compact' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Post'), h('th', { class: 'num' }, 'Aantal'), h('th', { class: 'num' }, 'Totaal'))),
      h('tbody', {}, ...top.map((r) => h('tr', {},
        h('td', {}, r.name, h('span', { class: 'mini', style: `width:${Math.max(2, (r.total / max) * 100)}%;background:${col}` })),
        h('td', { class: 'num' }, String(r.n)),
        h('td', { class: 'num' }, eur(r.total), h('span', { class: 'sm' }, c.total ? Math.round((r.total / c.total) * 100) + '%' : '')))),
      rest.length ? h('tr', { class: 'muted' }, h('td', {}, `${rest.length} andere posten`), h('td', { class: 'num' }, String(rest.reduce((s, r) => s + r.n, 0))), h('td', { class: 'num' }, eur(rest.reduce((s, r) => s + r.total, 0)))) : null)),
    h('div', { class: 'hbar-detail-actions' },
      h('button', { type: 'button', class: 'btn link', onclick: () => { selectTab('tx'); $('#x-cat').value = c.cat; $('#x-month').value = ''; $('#x-q').value = ''; renderTx(); } }, 'Alle transacties bekijken'),
      c.cat === 'overig' ? h('button', { type: 'button', class: 'btn link', onclick: () => { selectTab('cat'); $('#c-only').checked = true; renderCat(); } }, 'Deze posten indelen') : null));
}

function axisY(svg, y, W, m, max, fmt = eur0) {
  const ticks = niceTicks(0, max, 5);
  ticks.forEach((v) => {
    svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid-line' }));
    svg.append(s('text', { x: m.l - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, compact(v)));
  });
  return ticks;
}
function niceTicks(lo, hi, n) {
  if (hi <= lo) hi = lo + 1;
  const step0 = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= step0);
  const out = []; for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.5; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}
const compactFmt = new Intl.NumberFormat('nl-NL', { notation: 'compact', maximumFractionDigits: 1 });
const compact = (v) => '€ ' + (Math.abs(v) >= 10000 ? compactFmt.format(v) : new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 }).format(v));

function monthChart(el, rows) {
  const W = el.clientWidth; if (!W) return;
  const C = COLORS();
  const legend = [[C.in, 'Bij'], [C.vast, 'Vaste lasten'], [C.var, 'Overige uitgaven'], [C.een, 'Eenmalig']];
  $('#leg-months').replaceChildren(...legend.map(([c, l]) => h('span', {}, h('i', { style: `background:${c}` }), l)));
  const H = 300, m = { t: 10, r: 6, b: 26, l: 58 };
  const max = Math.max(...rows.map((r) => Math.max(r.inkomen, r.uitgaven)), 1);
  const ticks = niceTicks(0, max, 5); const top = ticks[ticks.length - 1];
  const y = (v) => m.t + (H - m.t - m.b) * (1 - v / top);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Inkomsten en uitgaven per maand' });
  axisY(svg, y, W, m, top);
  const band = (W - m.l - m.r) / rows.length, bw = Math.min(26, band * 0.34), gap = Math.min(4, band * 0.06);
  const every = band < 34 ? Math.ceil(34 / band) : 1;
  rows.forEach((r, i) => {
    const cx = m.l + band * i + band / 2;
    const g = s('g');
    g.append(s('rect', { x: cx - bw - gap / 2, y: y(r.inkomen), width: bw, height: Math.max(0, y(0) - y(r.inkomen)), rx: 3, fill: C.in }));
    let acc = 0;
    [['vast', C.vast], ['variabel', C.var], ['eenmalig', C.een]].forEach(([k, c]) => {
      const v = Math.max(0, r[k]); if (!v) return;
      g.append(s('rect', { x: cx + gap / 2, y: y(acc + v), width: bw, height: Math.max(0, y(acc) - y(acc + v)), fill: c }));
      acc += v;
    });
    if (i % every === 0) g.append(s('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, monthLabel(r.month)));
    const hit = s('rect', { x: m.l + band * i, y: m.t, width: band, height: H - m.t - m.b, fill: 'transparent' });
    hit.addEventListener('mousemove', (e) => showTip(e, monthLabel(r.month, true) + (r.full ? '' : ' (deels)'), [[C.in, 'Bij', eur(r.inkomen)], [C.vast, 'Vaste lasten', eur(r.vast)], [C.var, 'Overige uitgaven', eur(r.variabel)], [C.een, 'Eenmalig', eur(r.eenmalig)], [null, 'Saldo maand', eur(r.netto)], ...(r.intern ? [[null, r.intern < 0 ? 'Naar spaarrekening' : 'Van spaarrekening', eur(Math.abs(r.intern))]] : [])]));
    hit.addEventListener('mouseleave', hideTip);
    g.append(hit);
    svg.append(g);
  });
  svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: C.muted, 'stroke-width': 1 }));
  el.replaceChildren(svg);
}

// ---------- vaste lasten ----------
function renderVast() {
  const a = state.a;
  const vast = a.recurring.filter((r) => !r.sparen);
  const sparen = a.recurring.filter((r) => r.sparen && r.freq === 'maandelijks');
  const actief = vast.filter((r) => r.status !== 'gestopt?' && r.freq !== 'incidenteel');
  const fc = forecast();
  const inc = fc.params.inkomen || 1;
  $('#tiles-vast').replaceChildren(
    tile('Vaste lasten per maand', eur0(a.kpi.vastPm), `${actief.length} posten`),
    tile('Per jaar', eur0(a.kpi.vastPm * 12), 'Bij de huidige bedragen'),
    tile('Vast sparen per maand', eur0(a.kpi.sparenPm), sparen.length ? sparen.map((r) => cleanName(r.name)).join(', ') : 'Geen vaste overboeking gevonden'),
    tile('Deel van je vaste inkomen', Math.round(((a.kpi.vastPm) / inc) * 100) + '%', `Van ${eur0(fc.params.inkomen)} per maand`),
  );
  const rows = [...vast].sort((x, y) => (x.status === 'gestopt?') - (y.status === 'gestopt?') || (x.freq === 'incidenteel') - (y.freq === 'incidenteel') || y.monthly - x.monthly);
  const pill = (st) => { const cls = st === 'actief' ? '' : st === 'nieuw' ? 'good' : st === 'gestopt?' ? 'off' : 'warn'; return h('span', { class: 'pill ' + cls }, st); };
  $('#tb-vast').replaceChildren(...rows.map((r) => {
    const counted = r.status !== 'gestopt?' && r.freq !== 'incidenteel';
    return h('tr', { class: counted ? '' : 'muted' },
      h('td', {}, cleanName(r.name), h('span', { class: 'sm' }, `Laatst ${fmtDate(r.lastDate)} · ${eur(r.last)}`)),
      h('td', { class: 'hide-sm' }, CAT[r.cat]?.label || r.cat),
      h('td', { class: 'hide-sm' }, r.freq),
      h('td', { class: 'num' }, counted ? eur(r.monthly) : '–'),
      h('td', { class: 'num hide-sm' }, counted ? eur(r.monthly * 12) : '–'),
      h('td', {}, pill(r.freq === 'incidenteel' ? 'eenmalig betaald' : r.status), Math.abs(r.change) >= 0.08 ? h('span', { class: 'sm' }, `${r.change > 0 ? '+' : ''}${Math.round(r.change * 100)}% sinds begin`) : null));
  }));
  $('#tf-vast').replaceChildren(h('tr', {}, h('td', {}, 'Totaal meegeteld'), h('td', { class: 'hide-sm' }), h('td', { class: 'hide-sm' }), h('td', { class: 'num' }, eur(a.kpi.vastPm)), h('td', { class: 'num hide-sm' }, eur(a.kpi.vastPm * 12)), h('td')));
  barChart($('#ch-vast'), a.monthRows.map((r) => ({ label: r.month, v: r.vast })), COLORS().vast, 'Vaste lasten');
}

function barChart(el, data, color, name) {
  const W = el.clientWidth; if (!W) return;
  const H = 220, m = { t: 10, r: 6, b: 26, l: 58 };
  const max = Math.max(...data.map((d) => d.v), 1); const ticks = niceTicks(0, max, 4); const top = ticks[ticks.length - 1];
  const y = (v) => m.t + (H - m.t - m.b) * (1 - v / top);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': name + ' per maand' });
  axisY(svg, y, W, m, top);
  const band = (W - m.l - m.r) / data.length, bw = Math.min(30, band * 0.6);
  const every = band < 34 ? Math.ceil(34 / band) : 1;
  data.forEach((d, i) => {
    const cx = m.l + band * i + band / 2;
    const r = s('rect', { x: cx - bw / 2, y: y(d.v), width: bw, height: Math.max(0, y(0) - y(d.v)), rx: 3, fill: color });
    r.addEventListener('mousemove', (e) => showTip(e, monthLabel(d.label, true), [[color, name, eur(d.v)]])); r.addEventListener('mouseleave', hideTip);
    svg.append(r);
    if (i % every === 0) svg.append(s('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, monthLabel(d.label)));
  });
  el.replaceChildren(svg);
}

// ---------- prognose ----------
function defaults() {
  const a = state.a;
  return { inkomen: a.kpi.incomeBase, vast: a.kpi.vastPm, sparen: a.kpi.sparenPm, variabel: a.kpi.varBase, ruim: a.kpi.varHigh, start: a.balance ?? 0, vakantiegeld: true };
}
function forecast() {
  const a = state.a; const p = { ...defaults(), ...(state.fc || {}) };
  const extraRuim = Math.max(0, a.kpi.varHigh - a.kpi.varBase);
  const rows = []; let sb = p.start, sr = p.start;
  a.forecast.forEach((f) => {
    const extra = p.vakantiegeld ? Math.max(0, f.inkomen - a.kpi.incomeBase) : 0;
    const bij = p.inkomen + extra;
    const af = p.vast + p.sparen + p.variabel;
    const netto = bij - af, nettoRuim = netto - extraRuim;
    sb += netto; sr += nettoRuim;
    rows.push({ month: f.month, bij, af, netto, nettoRuim, saldo: sb, saldoRuim: sr });
  });
  return { params: p, rows };
}

function renderPrognose() {
  const a = state.a; const fc = forecast(); const p = fc.params; const R = fc.rows;
  const last = R[R.length - 1];
  const dec = R.find((r) => r.month.endsWith('-12'));
  $('#tiles-prognose').replaceChildren(
    tile('Over per maand', eur0(R[0].netto), `Ruim scenario: ${eur0(R[0].nettoRuim)}`, R[0].netto >= 0 ? 'pos' : 'neg'),
    tile('Over in 12 maanden', eur0(last.saldo - p.start), `Ruim scenario: ${eur0(last.saldoRuim - p.start)}`),
    dec ? tile(`Saldo eind ${dec.month.slice(0, 4)}`, eur0(dec.saldo), `Ruim scenario: ${eur0(dec.saldoRuim)}`) : null,
    tile(`Saldo ${monthLabel(last.month, true)}`, eur0(last.saldo), `Ruim scenario: ${eur0(last.saldoRuim)}`),
  );
  const inputs = { inkomen: '#f-inkomen', vast: '#f-vast', sparen: '#f-sparen', variabel: '#f-var', start: '#f-start' };
  for (const [k, sel] of Object.entries(inputs)) { const el = $(sel); if (el !== document.activeElement) el.value = Math.round(p[k]); }
  $('#f-vg').checked = !!p.vakantiegeld;
  $('#saldo-note').textContent = a.balance != null
    ? 'Tot de laatste maand het werkelijke saldo van je geladen rekening(en), daarna de prognose in twee scenario\'s.'
    : 'Je export bevat geen saldo. Vul bij de aannames je huidige saldo in; de lijn laat zien hoe dat zich ontwikkelt.';
  saldoChart($('#ch-saldo'), a, R);
  $('#tb-prog').replaceChildren(...R.map((r) => h('tr', {}, h('td', {}, monthLabel(r.month)), h('td', { class: 'num' }, eur0(r.bij)), h('td', { class: 'num' }, eur0(r.af)), h('td', { class: 'num ' + (r.netto >= 0 ? 'bij' : '') }, eur0(r.netto)), h('td', { class: 'num' }, eur0(r.saldo)))));
}
['#f-inkomen', '#f-vast', '#f-sparen', '#f-var', '#f-start'].forEach((sel, i) => $(sel).addEventListener('input', (e) => {
  const v = Number(e.target.value); if (isNaN(v)) return;
  state.fc = { ...(state.fc || {}), [['inkomen', 'vast', 'sparen', 'variabel', 'start'][i]]: v };
  renderPrognose();
}));
$('#f-vg').addEventListener('change', (e) => { state.fc = { ...(state.fc || {}), vakantiegeld: e.target.checked }; renderPrognose(); });
$('#f-reset').addEventListener('click', () => { state.fc = null; renderPrognose(); });

function saldoChart(el, a, R) {
  const W = el.clientWidth; if (!W) return;
  const C = COLORS();
  const hasBal = a.balance != null;
  const act = hasBal ? a.monthRows.map((r) => ({ m: r.month, v: r.saldo })) : [];
  const start = { m: a.monthRows[a.monthRows.length - 1].month, v: R.length ? R[0].saldo - R[0].netto : 0 };
  const pb = [start, ...R.map((r) => ({ m: r.month, v: r.saldo }))];
  const pr = [start, ...R.map((r) => ({ m: r.month, v: r.saldoRuim }))];
  $('#leg-saldo').replaceChildren(
    hasBal ? h('span', {}, h('i', { class: 'line', style: `background:${C.ink}` }), 'Werkelijk') : null,
    h('span', {}, h('i', { class: 'line', style: `background:${C.in}` }), 'Prognose basis'),
    h('span', {}, h('i', { class: 'dash', style: `border-color:${C.een}` }), 'Prognose ruim'));
  const all = [...act, ...pb, ...pr];
  const months = [...new Set(all.map((p) => p.m))].sort();
  const lo = Math.min(0, ...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v), 1);
  const ticks = niceTicks(lo, hi, 5); const tlo = ticks[0], thi = ticks[ticks.length - 1];
  const H = 300, m = { t: 12, r: 70, b: 26, l: 58 };
  const x = (k) => m.l + (W - m.l - m.r) * (months.indexOf(k) / Math.max(1, months.length - 1));
  const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - tlo) / (thi - tlo));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Saldo werkelijk en verwacht' });
  ticks.forEach((v) => { svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid-line' })); svg.append(s('text', { x: m.l - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, compact(v))); });
  if (tlo < 0) svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: C.warn, 'stroke-dasharray': '2 3' }));
  svg.append(s('line', { x1: x(start.m), x2: x(start.m), y1: m.t, y2: H - m.b, stroke: C.line, 'stroke-dasharray': '3 3' }));
  const path = (pts, color, dash) => svg.append(s('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`).join(''), fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': dash }));
  if (act.length) path(act, C.ink);
  path(pr, C.een, '5 4'); path(pb, C.in);
  const endLab = (pts, color, dy) => { const p = pts[pts.length - 1]; svg.append(s('circle', { cx: x(p.m), cy: y(p.v), r: 3.5, fill: color })); svg.append(s('text', { x: x(p.m) + 7, y: y(p.v) + dy, 'dominant-baseline': 'middle', fill: color }, compact(p.v))); };
  const dyB = y(pb[pb.length - 1].v) - y(pr[pr.length - 1].v) > -14 && y(pb[pb.length - 1].v) - y(pr[pr.length - 1].v) < 14 ? -8 : 0;
  endLab(pb, C.in, dyB); endLab(pr, C.een, -dyB);
  const every = Math.ceil(months.length / Math.max(2, Math.floor((W - m.l - m.r) / 52)));
  months.forEach((k, i) => { if (i % every === 0) svg.append(s('text', { x: x(k), y: H - 8, 'text-anchor': 'middle' }, monthLabel(k))); });
  const dot = s('circle', { r: 4, fill: C.ink, visibility: 'hidden' }); svg.append(dot);
  const hit = s('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' });
  hit.addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) * (W / r.width);
    const i = Math.round(((px - m.l) / (W - m.l - m.r)) * (months.length - 1)); const k = months[Math.max(0, Math.min(months.length - 1, i))];
    const a1 = act.find((p) => p.m === k), b1 = R.find((p) => p.month === k);
    dot.setAttribute('cx', x(k)); dot.setAttribute('cy', y(b1 ? b1.saldo : a1 ? a1.v : 0)); dot.setAttribute('visibility', 'visible');
    showTip(e, monthLabel(k, true), b1 ? [[C.in, 'Basis', eur0(b1.saldo)], [C.een, 'Ruim', eur0(b1.saldoRuim)]] : a1 ? [[C.ink, 'Saldo', eur0(a1.v)]] : []);
  });
  hit.addEventListener('mouseleave', () => { hideTip(); dot.setAttribute('visibility', 'hidden'); });
  svg.append(hit);
  el.replaceChildren(svg);
}

// ---------- sparen ----------
// Naam van de spaarrekening of spaarpot: "naar: Vrij Spaargeld" / "van: Hypotheek aflossing", anders het rekeningnummer.
function potOf(t) {
  const flat = (t.desc || '').replace(/\s*\|\s*/g, '');
  const m = (t.desc || '').replace(/\s*\|\s*/g, '\u0000').match(/(?:^|\s)(?:naar|van):\s*([^\u0000]+(?:\u0000[^\u0000]+)?)/i);
  let pot = m ? m[1].replace(/\u0000/g, '').trim() : '';
  if (pot.length > 40) pot = pot.slice(0, 40);
  const note = m ? (t.desc || '').replace(/\s*\|\s*/g, '').split(/(?:naar|van):/i)[0].trim() : (flat || '');
  if (!pot) pot = t.counterIban ? 'Spaarrekening ••' + t.counterIban.slice(-4) : (cleanName(t.name) || 'Eigen rekening');
  return { pot, note: note.slice(0, 60) };
}

function renderSparen() {
  const a = state.a; const C = COLORS();
  const ts = a.tx.filter((t) => t.group === 'intern');
  const naar = -ts.filter((t) => t.amount < 0).reduce((x, t) => x + t.amount, 0);
  const van = ts.filter((t) => t.amount > 0).reduce((x, t) => x + t.amount, 0);
  const net = naar - van;
  const vast = a.recurring.filter((r) => r.sparen && r.freq === 'maandelijks' && r.status !== 'gestopt?');
  $('#tiles-sparen').replaceChildren(
    tile('Naar je spaarrekening', eur0(naar), `${ts.filter((t) => t.amount < 0).length} overboekingen`),
    tile('Terug naar je betaalrekening', eur0(van), `${ts.filter((t) => t.amount > 0).length} overboekingen`),
    tile(net >= 0 ? 'Netto gespaard' : 'Netto opgenomen', eur0(Math.abs(net)), `Over ${a.months.length} maanden`, net >= 0 ? 'pos' : 'neg'),
    tile('Vast per maand', eur0(a.kpi.sparenPm), vast.length ? (() => {
      const ids = new Set(vast.flatMap((r) => [...r.ids])); const lastM = a.months[a.months.length - 1];
      const recent = ts.filter((t) => ids.has(t.id) && t.amount < 0); const lm = recent.length ? recent[recent.length - 1].month : lastM;
      const by = new Map(); recent.filter((t) => t.month === lm).forEach((t) => { const p = potOf(t).pot; by.set(p, (by.get(p) || 0) - t.amount); });
      return [...by].map(([p, v]) => `${eur0(v)} naar ${p}`).join(' en ');
    })() : 'Geen vaste maandelijkse overboeking'),
  );
  // grafiek: naar boven, van onder
  const el = $('#ch-sparen'); const W = el.clientWidth;
  if (W) {
    $('#leg-sparen').replaceChildren(h('span', {}, h('i', { style: `background:${C.in}` }), 'Naar spaarrekening'), h('span', {}, h('i', { style: `background:${C.een}` }), 'Terug naar betaalrekening'), h('span', {}, h('i', { class: 'line', style: `background:${C.ink}` }), 'Netto'));
    const rows = a.months.map((m) => { const mt = ts.filter((t) => t.month === m); return { m, naar: -mt.filter((t) => t.amount < 0).reduce((x, t) => x + t.amount, 0), van: mt.filter((t) => t.amount > 0).reduce((x, t) => x + t.amount, 0), list: mt }; });
    const hi = Math.max(1, ...rows.map((r) => r.naar)), lo = Math.max(1, ...rows.map((r) => r.van));
    const ticks = niceTicks(-lo, hi, 5); const tlo = ticks[0], thi = ticks[ticks.length - 1];
    const H = 300, mg = { t: 10, r: 6, b: 26, l: 58 };
    const y = (v) => mg.t + (H - mg.t - mg.b) * (1 - (v - tlo) / (thi - tlo));
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Overboekingen naar en van spaarrekeningen per maand' });
    ticks.forEach((v) => { svg.append(s('line', { x1: mg.l, x2: W - mg.r, y1: y(v), y2: y(v), class: 'grid-line' })); svg.append(s('text', { x: mg.l - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, compact(v))); });
    const band = (W - mg.l - mg.r) / rows.length, bw = Math.min(28, band * 0.6), every = band < 34 ? Math.ceil(34 / band) : 1;
    const pts = [];
    rows.forEach((r, i) => {
      const cx = mg.l + band * i + band / 2;
      if (r.naar) svg.append(s('rect', { x: cx - bw / 2, y: y(r.naar), width: bw, height: Math.max(0, y(0) - y(r.naar)), rx: 3, fill: C.in }));
      if (r.van) svg.append(s('rect', { x: cx - bw / 2, y: y(0), width: bw, height: Math.max(0, y(-r.van) - y(0)), rx: 3, fill: C.een }));
      pts.push([cx, y(r.naar - r.van)]);
      if (i % every === 0) svg.append(s('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, monthLabel(r.m)));
      const hit = s('rect', { x: mg.l + band * i, y: mg.t, width: band, height: H - mg.t - mg.b, fill: 'transparent' });
      const pots = new Map(); r.list.forEach((t) => { const p = potOf(t).pot; pots.set(p, (pots.get(p) || 0) - t.amount); });
      hit.addEventListener('mousemove', (e) => showTip(e, monthLabel(r.m, true), [[C.in, 'Naartoe', eur(r.naar)], [C.een, 'Terug', eur(r.van)], [null, 'Netto', eur(r.naar - r.van)], ...[...pots].filter(([, v]) => Math.abs(v) > 0.005).sort((x2, y2) => Math.abs(y2[1]) - Math.abs(x2[1])).slice(0, 4).map(([p, v]) => [null, p, (v >= 0 ? '+ ' : '− ') + eur(Math.abs(v))])]));
      hit.addEventListener('mouseleave', hideTip);
      svg.append(hit);
    });
    svg.append(s('line', { x1: mg.l, x2: W - mg.r, y1: y(0), y2: y(0), stroke: C.muted, 'stroke-width': 1 }));
    svg.append(s('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(''), fill: 'none', stroke: C.ink, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'pointer-events': 'none' }));
    pts.forEach((p) => svg.append(s('circle', { cx: p[0], cy: p[1], r: 2.5, fill: C.ink, 'pointer-events': 'none' })));
    el.replaceChildren(svg);
  }
  // per pot
  const pots = new Map();
  ts.forEach((t) => { const p = potOf(t).pot; if (!pots.has(p)) pots.set(p, { naar: 0, van: 0, n: 0 }); const r = pots.get(p); r.n++; if (t.amount < 0) r.naar -= t.amount; else r.van += t.amount; });
  const potRows = [...pots].sort((x, y2) => (y2[1].naar + y2[1].van) - (x[1].naar + x[1].van));
  $('#tb-pots').replaceChildren(...(potRows.length ? potRows.map(([p, r]) => h('tr', {}, h('td', {}, p, h('span', { class: 'sm' }, `${r.n} overboekingen`)), h('td', { class: 'num' }, r.naar ? eur(r.naar) : ''), h('td', { class: 'num' }, r.van ? eur(r.van) : ''), h('td', { class: 'num ' + (r.naar - r.van >= 0 ? 'bij' : 'af') }, (r.naar - r.van >= 0 ? '+ ' : '− ') + eur(Math.abs(r.naar - r.van))))) : [h('tr', { class: 'muted' }, h('td', { colspan: 4 }, 'Geen overboekingen naar eigen rekeningen gevonden.'))]));
  $('#tf-pots').replaceChildren(potRows.length > 1 ? h('tr', {}, h('td', {}, 'Totaal'), h('td', { class: 'num' }, eur(naar)), h('td', { class: 'num' }, eur(van)), h('td', { class: 'num' }, (net >= 0 ? '+ ' : '− ') + eur(Math.abs(net)))) : '');
  // lijst
  const list = [...ts].reverse();
  $('#sp-count').textContent = `${list.length} overboekingen, nieuwste eerst. Groen ging naar je spaarrekening, goud kwam terug.`;
  $('#tb-sp').replaceChildren(...list.slice(0, 400).map((t) => { const p = potOf(t); return h('tr', {},
    h('td', { class: 'num' }, shortDate(t.date) + (a.months.length > 12 ? "'" + t.date.slice(2, 4) : '')),
    h('td', {}, p.pot, p.note && p.note.toLowerCase() !== p.pot.toLowerCase() ? h('span', { class: 'sm' }, p.note) : null),
    h('td', { class: 'num ' + (t.amount < 0 ? 'bij' : 'af') }, (t.amount < 0 ? '→ ' : '← ') + eur(Math.abs(t.amount)))); }));
}

// ---------- categorieën ----------
function catSelect(current, auto, onChange) {
  const groups = { inkomen: 'Inkomen', vast: 'Vaste lasten', variabel: 'Uitgaven', intern: 'Eigen rekeningen' };
  const sel = h('select', { class: auto ? 'auto' : '', 'aria-label': 'Categorie' },
    ...Object.entries(groups).map(([g, l]) => h('optgroup', { label: l }, ...CATEGORIES.filter((c) => c.group === g).map((c) => h('option', { value: c.id, selected: c.id === current }, c.label)))));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}
function setOverride(key, cat) {
  state.settings.overrides[key] = cat;
  saveSettings();
  const sc = document.querySelector('#p-' + state.tab + ' .scroll'); const top = sc ? sc.scrollTop : 0;
  recompute();
  const sc2 = document.querySelector('#p-' + state.tab + ' .scroll'); if (sc2) sc2.scrollTop = top;
}

function renderCat() {
  const a = state.a;
  const byKey = new Map();
  for (const t of a.tx) {
    if (!byKey.has(t.key)) byKey.set(t.key, { key: t.key, name: cleanName(t.name), n: 0, bij: 0, af: 0, cat: t.cat, auto: t.auto });
    const r = byKey.get(t.key); r.n++; if (t.amount > 0) r.bij += t.amount; else r.af -= t.amount; r.cat = t.cat; r.auto = t.auto;
  }
  const q = $('#c-q').value.trim().toLowerCase(); const only = $('#c-only').checked;
  const rows = [...byKey.values()].filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!only || ['overig', 'overig_in'].includes(r.cat))).sort((x, y) => (y.af + y.bij) - (x.af + x.bij));
  $('#tb-cat').replaceChildren(...rows.slice(0, 600).map((r) => h('tr', {},
    h('td', {}, r.name || '(zonder naam)'), h('td', { class: 'num' }, String(r.n)),
    h('td', { class: 'num bij' }, r.bij ? eur(r.bij) : ''), h('td', { class: 'num' }, r.af ? eur(r.af) : ''),
    h('td', {}, catSelect(r.cat, r.auto, (v) => setOverride(r.key, v))))));
}
$('#c-q').addEventListener('input', renderCat); $('#c-only').addEventListener('change', renderCat);

// ---------- transacties ----------
function renderTx() {
  const a = state.a;
  const cs = $('#x-cat'), ms = $('#x-month');
  if (!cs.options.length || cs.dataset.n !== String(a.tx.length)) {
    const cur = cs.value, curM = ms.value;
    cs.replaceChildren(h('option', { value: '' }, 'Alle categorieën'), ...Object.entries(GROUPS).map(([g, l]) => h('option', { value: 'g:' + g }, '— ' + l)), ...CATEGORIES.filter((c) => a.tx.some((t) => t.cat === c.id)).map((c) => h('option', { value: c.id }, c.label)));
    ms.replaceChildren(h('option', { value: '' }, 'Alle maanden'), ...[...a.months].reverse().map((m) => h('option', { value: m }, monthLabel(m, true))));
    cs.value = cur; ms.value = curM; cs.dataset.n = String(a.tx.length);
  }
  const q = $('#x-q').value.trim().toLowerCase(), c = cs.value, mo = ms.value;
  const list = a.tx.filter((t) => (!c || (c.startsWith('g:') ? t.group === c.slice(2) : t.cat === c)) && (!mo || t.month === mo) && (!q || (t.name + ' ' + t.desc).toLowerCase().includes(q))).reverse();
  const bij = list.filter((t) => t.amount > 0).reduce((x, t) => x + t.amount, 0), af = -list.filter((t) => t.amount < 0).reduce((x, t) => x + t.amount, 0);
  $('#tx-count').textContent = `${list.length} transacties · bij ${eur(bij)} · af ${eur(af)}`;
  const shown = list.slice(0, 800);
  $('#tb-tx').replaceChildren(...shown.map((t) => h('tr', {},
    h('td', { class: 'num' }, shortDate(t.date)),
    h('td', { class: 'namecell' }, cleanName(t.name) || '(zonder naam)', t.desc ? h('span', { class: 'sm', title: t.desc }, t.desc) : null, h('span', { class: 'sm show-sm' }, CAT[t.cat].label)),
    h('td', { class: 'hide-sm' }, catSelect(t.cat, t.auto, (v) => setOverride(t.key, v)), t.group !== CAT[t.cat].group ? h('span', { class: 'sm' }, GROUPS[t.group]) : null),
    h('td', { class: 'num ' + (t.amount > 0 ? 'bij' : '') }, (t.amount > 0 ? '+ ' : '− ') + eur(Math.abs(t.amount))))),
  list.length > shown.length ? h('tr', { class: 'muted' }, h('td', { colspan: 4 }, `En nog ${list.length - shown.length} transacties. Gebruik het zoekveld of de filters.`)) : null);
}
$('#x-q').addEventListener('input', renderTx); $('#x-cat').addEventListener('change', renderTx); $('#x-month').addEventListener('change', renderTx);
$('#x-export').addEventListener('click', () => {
  const a = state.a; const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Datum', 'Naam', 'Omschrijving', 'Tegenrekening', 'Categorie', 'Soort', 'Bedrag'].join(';'),
    ...a.tx.map((t) => [t.date, q(cleanName(t.name)), q(t.desc), t.counterIban || '', q(CAT[t.cat].label), q(GROUPS[t.group]), t.amount.toFixed(2).replace('.', ',')].join(';'))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: `geldwijzer-${a.period.van}-${a.period.tot}.csv` }); document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

// ---------- instellingen ----------
const dlg = $('#dlg-settings');
$('#btn-settings').addEventListener('click', () => {
  const st = state.settings;
  $('#s-holders').value = st.holders.join(', ');
  $('#s-ibans').value = st.ownIbans.join('\n');
  $('#s-threshold').value = st.eenmaligThreshold;
  $('#s-keep-rules').checked = st.keepRules; $('#s-keep-tx').checked = st.keepTx;
  dlg.showModal();
});
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'save') return;
  const st = state.settings;
  st.holders = $('#s-holders').value.split(',').map((x) => x.trim()).filter(Boolean);
  st.ownIbans = $('#s-ibans').value.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(x));
  const th = Number($('#s-threshold').value); if (th >= 50) st.eenmaligThreshold = th;
  st.keepRules = $('#s-keep-rules').checked; st.keepTx = $('#s-keep-tx').checked && st.keepRules;
  saveSettings();
  if (state.tx.length) recompute();
});
$('#s-wipe').addEventListener('click', () => {
  store.del(LS.settings); store.del(LS.tx);
  state.settings = defaultSettings(); state.tx = []; state.files = []; state.meta = {}; state.a = null; state.sample = false;
  dlg.close('cancel');
  history.replaceState(null, '', location.pathname);
  $('#result').hidden = true; $('#start').hidden = false; $('#bar-actions').hidden = true;
});

// ---------- invoer ----------
const drop = $('#drop');
$('#file').addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });
$('#file2').addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });
$('#btn-add').addEventListener('click', () => $('#file2').click());
['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); drop.classList.add('over'); } }));
['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => { if (ev === 'dragleave' && e.relatedTarget) return; drop.classList.remove('over'); }));
document.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); handleFiles(e.dataTransfer.files); } });
$('#btn-sample').addEventListener('click', () => {
  const d = sampleData();
  state.files = [{ name: 'voorbeeld.csv', bank: 'Voorbeeld', count: d.transactions.length, accounts: d.accounts, check: null }];
  state.tx = d.transactions.map((t, i) => ({ ...t, file: 0, seq: i }));
  state.sample = true;
  const keep = state.settings; state.settings = { ...defaultSettings(), holders: [d.holder], keepRules: false };
  state.settingsBackup = keep;
  finalizeData();
  showResult();
});
$('#btn-sample-off').addEventListener('click', () => {
  if (state.settingsBackup) state.settings = state.settingsBackup;
  state.sample = false; state.tx = []; state.files = []; state.a = null;
  $('#result').hidden = true; $('#start').hidden = false; $('#bar-actions').hidden = true;
  history.replaceState(null, '', location.pathname);
  $('#file').click();
});

let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => state.a && renderTab(state.tab), 150); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => state.a && renderTab(state.tab));

// bewaarde gegevens terugzetten
const saved = state.settings.keepTx ? store.get(LS.tx) : null;
if (saved && saved.tx?.length) { state.files = saved.files; state.tx = saved.tx; state.meta = saved.meta; showResult(); }

// offline gebruik: de app zelf wordt in de browser bewaard (nooit je gegevens)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
