// Geldwijzer Financial Engine + Alert Engine.
// Alle bedragen worden hier berekend; teksten leggen alleen uit wat hier is uitgerekend.
// De functies krijgen de analyse (analyze()) en instellingen mee en raken de DOM niet aan,
// zodat een latere AI-assistent precies dezelfde functies als "tools" kan gebruiken.
import { CAT, cleanName, monthLabel, eur0, monthsBetween } from './analysis.js';

const ym = (d) => d.slice(0, 7);
const dimOf = (k) => { const [y, m] = k.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const addM = (k, n) => { let [y, m] = k.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${String(m).padStart(2, '0')}`; };
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
const r2 = (n) => Math.round(n * 100) / 100;
const dayLabel = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${monthLabel(`${y}-${m}`, false, false)}`; };
const iso = (k, d) => `${k}-${String(Math.min(d, dimOf(k))).padStart(2, '0')}`;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
// budgetten gaan over de gewone, wisselende uitgaven: geen vaste lasten, geen grote eenmalige uitgaven
const SPEND = (t) => t.group === 'variabel';
const z = (n) => (Math.abs(n) < 0.005 ? 0 : n);

/** Peildatum: het laatste moment waarover je gegevens hebt. Alles is "vanaf hier gezien". */
export function context(a) {
  const peil = a.period.tot; const month = ym(peil); const day = Number(peil.slice(8, 10)); const n = dimOf(month);
  const complete = day >= n;
  const history = (a.fullMonths.length ? a.fullMonths : a.months).filter((m) => m !== month || complete).slice(-6);
  const prevMonth = complete ? addM(month, -1) : addM(month, -1);
  return { peil, month, day, n, complete, rest: n - day, history, prevMonth };
}

/** Per categorie: besteed deze maand, normaal per maand, verwacht eind van de maand, budget en status. */
export function calculateBudgetForecast(a, settings) {
  const c = context(a); const budgets = settings.budgets || {};
  const hist = c.history.filter((m) => m !== c.month);
  const cats = new Set([...Object.keys(budgets), ...a.tx.filter((t) => SPEND(t) && hist.includes(t.month)).map((t) => t.cat)]);
  const out = [];
  for (const cat of cats) {
    if (!CAT[cat] || CAT[cat].group === 'inkomen' || CAT[cat].group === 'intern') continue;
    const spent = z(r2(-a.tx.filter((t) => SPEND(t) && t.cat === cat && t.month === c.month).reduce((x, t) => x + t.amount, 0)));
    const perM = hist.map((m) => -a.tx.filter((t) => SPEND(t) && t.cat === cat && t.month === m).reduce((x, t) => x + t.amount, 0));
    const typical = z(r2(median(perM)));
    const forecast = r2(c.complete ? spent : spent + typical * (c.rest / c.n));
    const budget = Number(budgets[cat]) || 0;
    let status = 'geen budget';
    if (budget) {
      if (spent > budget) status = 'over';
      else if (!c.complete && spent >= budget * 0.9) status = 'bijna op';
      else if (!c.complete && forecast > budget * 1.05) status = 'loopt voor';
      else status = 'op schema';
    }
    out.push({ cat, label: CAT[cat].label, group: CAT[cat].group, spent, typical, forecast, budget, status, pct: budget ? spent / budget : null,
      calc: [['Normaal per maand (mediaan laatste ' + hist.length + ' maanden)', typical], ['Besteed t/m ' + dayLabel(c.peil), spent], ...(c.complete ? [] : [[`Verwacht nog (${c.rest} van ${c.n} dagen × normaal)`, r2(forecast - spent)]]), ['Verwacht eind van de maand', forecast], ...(budget ? [['Budget', budget]] : [])] });
  }
  return out.sort((x, y) => (y.budget ? 1 : 0) - (x.budget ? 1 : 0) || y.typical - x.typical);
}

/** Vaste posten (inclusief automatisch sparen) die in de komende `days` dagen na de peildatum worden afgeschreven. */
export function getUpcomingExpenses(a, days = 7, until = null) {
  const c = context(a); const end = until || new Date(Date.parse(c.peil) + days * 86400000).toISOString().slice(0, 10);
  const items = a.recurring.filter((r) => r.status !== 'gestopt?' && r.freq !== 'incidenteel' && (r.freq === 'maandelijks' || /× per jaar$/.test(r.freq)));
  const out = [];
  for (const r of items) {
    const d = r.day || Number(r.lastDate.slice(8, 10));
    for (const k of [c.month, addM(c.month, 1), addM(c.month, 2)]) {
      const date = iso(k, d);
      if (date <= c.peil || date > end) continue;
      if (ym(r.lastDate) === k) continue; // deze maand al betaald
      out.push({ date, name: r.sparen ? 'Sparen: ' + r.name : cleanName(r.name), amount: r2(r.last || r.monthly), sparen: !!r.sparen, cat: r.cat });
    }
  }
  return out.sort((x, y) => (x.date < y.date ? -1 : 1));
}

/** Volgende salarisdag: de grootste vaste inkomstenbron op zijn gebruikelijke dag. */
export function nextPayday(a) {
  const c = context(a); const main = [...a.incomeStreams].sort((x, y) => y.base - x.base)[0];
  if (!main) return null;
  const d = main.day || 25;
  const received = a.tx.some((t) => t.month === c.month && t.amount > 0 && t.key && main.key.endsWith('|' + t.key));
  const k = !received && c.day < d && !c.complete ? c.month : addM(c.month, 1);
  return { date: iso(k, d), amount: main.base, name: cleanName(main.name) };
}

/** Vrij besteedbaar tot je volgende salaris: saldo − vaste posten − normale uitgaven − buffer. */
export function calculateAvailableToSpend(a, settings, varPerMonth) {
  const c = context(a);
  if (a.balance == null) return { ok: false, reason: 'Je export bevat geen saldo, dus ik kan niet uitrekenen wat er nog vrij is.' };
  const pay = nextPayday(a);
  if (!pay) return { ok: false, reason: 'Ik vind geen vast inkomen, dus ik weet niet wanneer je volgende salaris komt.' };
  const days = Math.max(0, daysBetween(c.peil, pay.date) - 1);
  const fixed = getUpcomingExpenses(a, 0, new Date(Date.parse(pay.date) - 86400000).toISOString().slice(0, 10));
  const fixedSum = r2(fixed.reduce((x, f) => x + f.amount, 0));
  const variable = r2((varPerMonth || 0) * days / 30.4);
  const buffer = Number(settings.buffer) || 0;
  const available = r2(a.balance - fixedSum - variable - buffer);
  return { ok: true, available, balance: a.balance, fixed, fixedSum, variable, buffer, payday: pay, days,
    calc: [['Saldo op ' + dayLabel(c.peil), a.balance], [`Vaste posten tot ${dayLabel(pay.date)} (${fixed.length})`, -fixedSum], [`Normale uitgaven voor ${days} dagen`, -variable], ...(buffer ? [['Je minimumbuffer', -buffer]] : []), ['Vrij te besteden', available]] };
}

/** Verwacht saldo aan het eind van de lopende maand. */
export function calculateEndOfMonthBalance(a, varPerMonth) {
  const c = context(a); if (a.balance == null) return null;
  if (c.complete) return { month: c.month, balance: a.balance, calc: [['Saldo eind ' + monthLabel(c.month, true), a.balance]] };
  const endIso = iso(c.month, c.n);
  const fixed = getUpcomingExpenses(a, 0, endIso).reduce((x, f) => x + f.amount, 0);
  const pay = nextPayday(a); const income = pay && pay.date <= endIso ? pay.amount : 0;
  const variable = (varPerMonth || 0) * c.rest / c.n;
  const bal = r2(a.balance + income - fixed - variable);
  return { month: c.month, balance: bal, calc: [['Saldo nu', a.balance], ['Nog te ontvangen', income], ['Nog vaste posten', -r2(fixed)], ['Nog normale uitgaven', -r2(variable)], ['Verwacht eind van de maand', bal]] };
}

/** Uitgaven (zonder eenmalig) deze periode tegenover vorige maand en tegenover normaal; bij een lopende maand tot dezelfde dag. */
export function comparePeriods(a) {
  const c = context(a);
  const upto = (m, day) => a.tx.filter((t) => t.month === m && (t.group === 'vast' || t.group === 'variabel') && t.amount < 0 && Number(t.date.slice(8, 10)) <= day);
  const tot = (list) => -list.reduce((x, t) => x + t.amount, 0);
  const lim = c.complete ? 31 : c.day;
  const cur = upto(c.month, lim), prev = upto(c.prevMonth, lim);
  const byCat = (list) => { const m = new Map(); list.forEach((t) => m.set(t.cat, (m.get(t.cat) || 0) - t.amount)); return m; };
  const cc = byCat(cur), pc = byCat(prev);
  const diffs = [...new Set([...cc.keys(), ...pc.keys()])].map((k) => ({ cat: k, label: CAT[k].label, now: r2(cc.get(k) || 0), before: r2(pc.get(k) || 0), diff: r2((cc.get(k) || 0) - (pc.get(k) || 0)) })).sort((x, y) => y.diff - x.diff);
  const normal = r2(median(c.history.filter((m) => m !== c.month).map((m) => tot(upto(m, lim)))));
  const income = (m) => a.tx.filter((t) => t.month === m && t.group === 'inkomen').reduce((x, t) => x + t.amount, 0);
  return { month: c.month, prevMonth: c.prevMonth, complete: c.complete, day: lim, now: r2(tot(cur)), before: r2(tot(prev)), normal, diff: r2(tot(cur) - tot(prev)), diffs,
    netNow: r2(income(c.month) - tot(cur)), netBefore: r2(income(c.prevMonth) - tot(prev)) };
}

/** Alert Engine: zet de berekeningen om in meldingen. severity: critical | warning | info | good */
export function generateAlerts(a, settings, extra = {}) {
  const c = context(a); const alerts = []; const per = c.month;
  const add = (x) => alerts.push({ period: per, ...x });
  const mLong = monthLabel(c.month, true, false);

  // 1 + 2: budgetten
  for (const b of calculateBudgetForecast(a, settings).filter((x) => x.budget)) {
    if (b.status === 'over') add({ id: `budget-over-${b.cat}-${per}`, type: 'budget', severity: 'critical', title: `${b.label}: budget overschreden`, message: `Je hebt ${eur0(b.spent)} uitgegeven van je budget van ${eur0(b.budget)}, dat is ${eur0(b.spent - b.budget)} te veel${c.complete ? ` in ${mLong}` : ''}.`, amount: b.spent - b.budget, category: b.cat, calc: b.calc });
    else if (b.status === 'bijna op') add({ id: `budget-90-${b.cat}-${per}`, type: 'budget', severity: 'critical', title: `${b.label}: budget bijna op`, message: `Je hebt ${eur0(b.spent)} van ${eur0(b.budget)} gebruikt en hebt nog ${c.rest} ${c.rest === 1 ? 'dag' : 'dagen'} te gaan.`, amount: b.budget - b.spent, category: b.cat, calc: b.calc });
    else if (b.status === 'loopt voor') add({ id: `budget-ahead-${b.cat}-${per}`, type: 'budget', severity: 'warning', title: `${b.label} loopt voor op schema`, message: `Je budget is ${eur0(b.budget)}. Op basis van je uitgaven tot nu toe verwachten we ${eur0(b.forecast)}, dus ${eur0(b.forecast - b.budget)} erboven.`, amount: b.forecast - b.budget, category: b.cat, calc: b.calc });
  }
  // 3: komende vaste lasten
  const up = getUpcomingExpenses(a, 7);
  if (up.length) {
    const sum = up.reduce((x, u) => x + u.amount, 0);
    add({ id: `upcoming-${c.peil}`, type: 'upcoming', severity: 'info', title: `Komende 7 dagen wordt ${eur0(sum)} afgeschreven`, message: up.slice(0, 4).map((u) => `${dayLabel(u.date)} ${u.name} ${eur0(u.amount)}`).join(' · ') + (up.length > 4 ? ` en nog ${up.length - 4}` : ''), amount: sum, calc: up.map((u) => [`${dayLabel(u.date)} · ${u.name}`, -u.amount]) });
  }
  // 4: vrij besteedbaar
  const av = calculateAvailableToSpend(a, settings, extra.varPerMonth);
  if (av.ok) {
    const sev = av.available < 0 ? 'critical' : av.available < 250 ? 'warning' : 'info';
    add({ id: `available-${c.peil}`, type: 'available', severity: sev,
      title: av.available < 0 ? `Tot je salaris kom je ${eur0(-av.available)} tekort` : `Tot je salaris nog ${eur0(av.available)} vrij te besteden`,
      message: `Je salaris komt naar verwachting op ${dayLabel(av.payday.date)}. ${av.available < 0 ? (av.buffer ? 'Je zakt dan onder je buffer van ' + eur0(av.buffer) + '.' : 'Je saldo zakt dan onder nul.') : `Na je vaste posten${av.buffer ? ', normale uitgaven en je buffer van ' + eur0(av.buffer) : ' en normale uitgaven'}.`}`,
      amount: av.available, calc: av.calc });
  }
  // laagste saldo in de prognose
  if (extra.lowNext && extra.lowNext.low < (Number(settings.buffer) || 0)) {
    const L = extra.lowNext; const buf = Number(settings.buffer) || 0;
    add({ id: `low-${L.month}`, type: 'low', severity: L.low < 0 ? 'critical' : 'warning', title: L.low < 0 ? `Rood staan rond de ${L.day}e ${monthLabel(L.month, true, false)}` : `Onder je buffer rond de ${L.day}e ${monthLabel(L.month, true, false)}`,
      message: `Je saldo zakt naar verwachting tot ${eur0(L.low)}, vlak voordat je salaris binnenkomt.${buf ? ` Je buffer is ${eur0(buf)}.` : ''}`, amount: L.low, calc: [['Saldo begin van de maand', r2(L.start)], ['Laagste punt (' + L.day + 'e)', r2(L.low)]] });
  }
  // 5 + 6: vergelijking met vorige maand
  const cmp = comparePeriods(a);
  const scope = cmp.complete ? `in ${monthLabel(cmp.month, true, false)}` : `t/m de ${cmp.day}e`;
  if (cmp.before > 0 && cmp.diff > Math.max(100, cmp.before * 0.1)) {
    const top = cmp.diffs.filter((d) => d.diff > 0).slice(0, 3);
    add({ id: `higher-${per}`, type: 'compare', severity: 'warning', title: `${eur0(cmp.diff)} meer uitgegeven dan vorige maand`, message: `Vaste lasten en overige uitgaven ${scope}: ${eur0(cmp.now)} tegen ${eur0(cmp.before)}. Grootste verschillen: ${top.map((d) => `${d.label} +${eur0(d.diff)}`).join(', ')}.`, amount: cmp.diff, calc: [['Deze maand', cmp.now], ['Vorige maand', cmp.before], ['Normaal (mediaan)', cmp.normal], ...top.map((d) => [d.label, d.diff])] });
  } else if (cmp.before > 0 && cmp.diff < -Math.max(100, cmp.before * 0.1)) {
    const top = [...cmp.diffs].reverse().filter((d) => d.diff < 0).slice(0, 3);
    add({ id: `lower-${per}`, type: 'compare', severity: 'good', title: `${eur0(-cmp.diff)} minder uitgegeven dan vorige maand`, message: `Vaste lasten en overige uitgaven ${scope}: ${eur0(cmp.now)} tegen ${eur0(cmp.before)}. Vooral ${top.map((d) => `${d.label} −${eur0(-d.diff)}`).join(', ')}.`, amount: -cmp.diff, calc: [['Deze maand', cmp.now], ['Vorige maand', cmp.before], ...top.map((d) => [d.label, d.diff])] });
  }
  if (cmp.complete && cmp.netNow - cmp.netBefore > 100) {
    add({ id: `net-${per}`, type: 'positive', severity: 'good', title: `Je hield ${eur0(cmp.netNow - cmp.netBefore)} meer over dan vorige maand`, message: `In ${monthLabel(cmp.month, true, false)} bleef er ${eur0(cmp.netNow)} over na vaste lasten en overige uitgaven, in ${monthLabel(cmp.prevMonth, true, false)} ${eur0(cmp.netBefore)}.`, amount: cmp.netNow - cmp.netBefore, calc: [['Over deze maand', cmp.netNow], ['Over vorige maand', cmp.netBefore]] });
  }
  if (extra.overNext != null && extra.overNext > 0 && !alerts.some((x) => x.type === 'positive')) {
    add({ id: `over-${per}`, type: 'positive', severity: 'good', title: `Je houdt naar verwachting ${eur0(extra.overNext)} per maand over`, message: 'Na vaste lasten, automatisch sparen en een normale maand. Zie Prognose voor de opbouw.', amount: extra.overNext, calc: extra.overCalc || [] });
  }
  const rank = { critical: 0, warning: 1, info: 2, good: 3 };
  const dismissed = settings.dismissed || {};
  return alerts.filter((x) => !dismissed[x.id]).sort((x, y) => rank[x.severity] - rank[y.severity] || Math.abs(y.amount || 0) - Math.abs(x.amount || 0));
}

export { monthsBetween };
