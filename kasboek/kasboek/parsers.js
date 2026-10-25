// Inlezen van bankexports. Alles draait lokaal; er wordt niets verstuurd.
// Elke parser levert { bank, holder?, accounts:[iban], check?, transactions:[...] }
// transactie: { date:'YYYY-MM-DD', amount:Number, name, desc, counterIban, account, balance:Number|null, kind }

export function parseAmount(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/[€\s]|EUR/gi, '');
  if (!s) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) {
    if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lc > -1) {
    s = s.replace(',', '.');
  } else if (ld > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return isNaN(n) ? NaN : (neg ? -n : n);
}

export function parseDate(raw) {
  const s = String(raw || '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const iban = (s) => clean(s).replace(/\s/g, '').toUpperCase();

// ---------- CSV ----------
export function decodeText(buf) {
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
  return t.replace(/^﻿/, '');
}

function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const count = (d) => { let n = 0, q = false; for (const c of line) { if (c === '"') q = !q; else if (c === d && !q) n++; } return n; };
  return ['\t', ';', ','].map((d) => [d, count(d)]).sort((a, b) => b[1] - a[1])[0][0];
}

export function parseCSV(text, delim) {
  delim = delim || detectDelimiter(text);
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else f += c;
  }
  row.push(f); if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (h) => clean(h).toLowerCase();

function byHeader(rows) {
  const h = rows[0].map(norm);
  const idx = (...names) => { for (const n of names) { const i = h.indexOf(n); if (i > -1) return i; } return -1; };
  const find = (re) => h.findIndex((x) => re.test(x));
  return { h, idx, find, body: rows.slice(1) };
}

function fromRabobankCSV(rows) {
  const { idx, body } = byHeader(rows);
  const c = {
    own: idx('iban/bban'), date: idx('datum'), amt: idx('bedrag'), bal: idx('saldo na trn'),
    ciban: idx('tegenrekening iban/bban'), name: idx('naam tegenpartij'), end: idx('naam uiteindelijke partij'),
    code: idx('code'), d1: idx('omschrijving-1'), d2: idx('omschrijving-2'), d3: idx('omschrijving-3'),
  };
  return body.map((r) => ({
    date: parseDate(r[c.date]), amount: parseAmount(r[c.amt]),
    name: clean(r[c.name]) || clean(r[c.end]) || clean(r[c.d1]).slice(0, 40),
    desc: clean([r[c.d1], r[c.d2], r[c.d3]].filter(Boolean).join(' ')),
    counterIban: iban(r[c.ciban]), account: iban(r[c.own]), balance: c.bal > -1 ? parseAmount(r[c.bal]) : null,
    kind: kindFromCode(clean(r[c.code])),
  }));
}

function fromING(rows) {
  const { idx, find, body } = byHeader(rows);
  const c = {
    date: idx('datum'), name: idx('naam / omschrijving'), own: idx('rekening'), ciban: idx('tegenrekening'),
    code: idx('code'), afbij: idx('af bij'), amt: find(/^bedrag/), soort: idx('mutatiesoort'),
    msg: idx('mededelingen'), bal: idx('saldo na mutatie'),
  };
  return body.map((r) => {
    const a = Math.abs(parseAmount(r[c.amt]));
    const neg = /^af/i.test(clean(r[c.afbij]));
    return {
      date: parseDate(r[c.date]), amount: neg ? -a : a, name: clean(r[c.name]),
      desc: clean(r[c.msg]), counterIban: iban(r[c.ciban]), account: iban(r[c.own]),
      balance: c.bal > -1 ? parseAmount(r[c.bal]) : null, kind: kindFromText(clean(r[c.soort]) + ' ' + clean(r[c.code])),
    };
  });
}

function fromBunq(rows) {
  const { idx, find, body } = byHeader(rows);
  const c = { date: idx('date'), amt: idx('amount'), own: idx('account'), ciban: idx('counterparty'), name: idx('name'), desc: idx('description'), bal: find(/balance/) };
  return body.map((r) => ({
    date: parseDate(r[c.date]), amount: parseAmount(r[c.amt]), name: clean(r[c.name]), desc: clean(r[c.desc]),
    counterIban: iban(r[c.ciban]), account: iban(r[c.own]), balance: c.bal > -1 ? parseAmount(r[c.bal]) : null, kind: '',
  }));
}

function abnName(desc) {
  let m;
  if ((m = desc.match(/\/NAME\/([^/]+)/))) return clean(m[1]);
  if ((m = desc.match(/Naam:\s*(.+?)(?:\s{2,}|\s+(?:Omschrijving|Kenmerk|Machtiging|IBAN|BIC|Incassant):|$)/))) return clean(m[1]);
  if ((m = desc.match(/^(?:BEA|GEA|eCom)[^,]*,\s*(?:Apple Pay|Google Pay|Betaalpas|Pas)?\s*(.+?),PAS/i))) return clean(m[1]);
  if ((m = desc.match(/^(?:BEA|GEA)\s+(?:NR:\S+\s+)?\d{2}\.\d{2}\.\d{2}\/\d{2}[.:]\d{2}\s+(.+?)(?:,PAS|$)/i))) return clean(m[1]);
  return clean(desc).slice(0, 40);
}

function fromABN(rows) {
  return rows.map((r) => {
    const desc = clean(r[7]);
    const m = desc.match(/\/IBAN\/([A-Z0-9]+)/) || desc.match(/IBAN:\s*([A-Z0-9]+)/);
    return {
      date: parseDate(r[2]), amount: parseAmount(r[6]), name: abnName(desc), desc,
      counterIban: m ? m[1] : '', account: iban(r[0]), balance: parseAmount(r[4]),
      kind: /^(BEA|GEA)/.test(desc) ? 'pin' : /INCASSO|SEPA Incasso/i.test(desc) ? 'incasso' : '',
    };
  });
}

function fromASN(rows) {
  // ASN / SNS / RegioBank / BLG: geen kopregel, vaste kolommen
  return rows.map((r) => ({
    date: parseDate(r[0]), amount: parseAmount(r[10]), name: clean(r[3]) || clean(r[17]).slice(0, 40),
    desc: clean(r[17]), counterIban: iban(r[2]), account: iban(r[1]),
    balance: isNaN(parseAmount(r[8])) ? null : Math.round((parseAmount(r[8]) + parseAmount(r[10])) * 100) / 100,
    kind: kindFromText(clean(r[14]) + ' ' + clean(r[13])),
  }));
}

function fromTriodos(rows) {
  return rows.map((r) => {
    const a = Math.abs(parseAmount(r[2]));
    return {
      date: parseDate(r[0]), amount: /^debet/i.test(clean(r[3])) ? -a : a, name: clean(r[4]) || clean(r[7]).slice(0, 40),
      desc: clean(r[7]), counterIban: iban(r[5]), account: iban(r[1]), balance: r[8] ? parseAmount(r[8]) : null, kind: kindFromText(clean(r[6])),
    };
  });
}

function fromGeneric(rows) {
  const { find, body } = byHeader(rows);
  const c = {
    date: find(/^(boek)?datum|^date|transactiedatum|boekingsdatum/), amt: find(/bedrag|amount/),
    afbij: find(/af.?bij|debet.?\/?.?credit|^d\/c$|credit.?debet/), name: find(/naam|tegenpartij|counterparty|^name|begunstigde|ontvanger/),
    desc: find(/omschrijving|description|mededeling|memo/), ciban: find(/tegenrekening|counterparty.?(iban|account)/),
    own: find(/^(iban|rekening(nummer)?|account)$/), bal: find(/saldo|balance/),
  };
  if (c.date < 0 || c.amt < 0) return null;
  return body.map((r) => {
    let a = parseAmount(r[c.amt]);
    if (c.afbij > -1) { const v = clean(r[c.afbij]).toLowerCase(); if (/^(af|d|debet|debit)/.test(v)) a = -Math.abs(a); else if (/^(bij|c|credit)/.test(v)) a = Math.abs(a); }
    return {
      date: parseDate(r[c.date]), amount: a, name: c.name > -1 ? clean(r[c.name]) : '', desc: c.desc > -1 ? clean(r[c.desc]) : '',
      counterIban: c.ciban > -1 ? iban(r[c.ciban]) : '', account: c.own > -1 ? iban(r[c.own]) : '',
      balance: c.bal > -1 ? parseAmount(r[c.bal]) : null, kind: '',
    };
  });
}

function kindFromCode(code) {
  return { bc: 'pin', ba: 'pin', ei: 'incasso', id: 'ideal', ga: 'geldautomaat', cb: 'overboeking', bg: 'overboeking', tb: 'overboeking', sb: 'overboeking', db: 'kosten' }[code.toLowerCase()] || '';
}
function kindFromText(t) {
  t = t.toLowerCase();
  if (/incasso|\bic\b|\bei\b/.test(t)) return 'incasso';
  if (/betaalautomaat|pin|\bba\b|\bbc\b/.test(t)) return 'pin';
  if (/geldautomaat|\bga\b/.test(t)) return 'geldautomaat';
  if (/ideal|online bankieren/.test(t)) return 'ideal';
  if (/overschrijving|overboeking|\bov\b|\bgt\b/.test(t)) return 'overboeking';
  return '';
}

export function parseCSVFile(text, filename = '') {
  const delim = detectDelimiter(text);
  const rows = parseCSV(text, delim);
  if (!rows.length) throw new Error('Het bestand is leeg.');
  const h = rows[0].map(norm);
  let bank, tx;
  if (h.includes('naam tegenpartij') && h.includes('iban/bban')) { bank = 'Rabobank'; tx = fromRabobankCSV(rows); }
  else if (h.includes('naam / omschrijving') && h.includes('af bij')) { bank = 'ING'; tx = fromING(rows); }
  else if (h.includes('counterparty') && h.includes('amount')) { bank = 'bunq'; tx = fromBunq(rows); }
  else if (delim === '\t' && rows[0].length >= 8 && /^\d{6,}$/.test(clean(rows[0][0])) && /^[A-Z]{3}$/.test(clean(rows[0][1]))) { bank = 'ABN AMRO'; tx = fromABN(rows); }
  else if (rows[0].length >= 18 && parseDate(rows[0][0]) && !isNaN(parseAmount(rows[0][10]))) { bank = 'ASN / SNS / RegioBank'; tx = fromASN(rows); }
  else if (rows[0].length >= 8 && parseDate(rows[0][0]) && /^(debet|credit)$/i.test(clean(rows[0][3]))) { bank = 'Triodos'; tx = fromTriodos(rows); }
  else { tx = fromGeneric(rows); bank = 'CSV'; }
  if (!tx) throw new Error(`Ik herken de kolommen in ${filename || 'dit bestand'} niet. Exporteer als CSV met kolommen voor datum, bedrag en naam of omschrijving.`);
  tx = tx.filter((t) => t.date && !isNaN(t.amount));
  if (!tx.length) throw new Error(`Geen transacties gevonden in ${filename || 'dit bestand'}.`);
  return { bank, holder: '', accounts: [...new Set(tx.map((t) => t.account).filter(Boolean))], check: null, transactions: tx };
}

// ---------- Rabobank PDF ----------
const AMT = /^\d{1,3}(\.\d{3})*,\d\d$/;
const DM = /^\d\d-\d\d$/;

export async function parseRabobankPDF(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const tx = []; let cur = null; const head = {};
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const H = page.getViewport({ scale: 1 }).height;
    const items = (await page.getTextContent()).items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ s: it.str.trim(), x0: it.transform[4], x1: it.transform[4] + it.width, y: H - it.transform[5] }));
    if (p === 1) readHeader(items, head);
    const hdr = items.find((i) => i.s === 'datum' && i.x0 < 45);
    const foot = items.find((i) => /=\s*tegoed/.test(i.s) || i.s === 'tegoed');
    const top = hdr ? hdr.y + 4 : 0, bottom = foot ? foot.y - 3 : H;
    const lines = [];
    for (const it of items.filter((i) => i.y > top && i.y < bottom).sort((a, b) => a.y - b.y || a.x0 - b.x0)) {
      const L = lines.find((l) => Math.abs(l.y - it.y) < 2.5);
      if (L) L.items.push(it); else lines.push({ y: it.y, items: [it] });
    }
    for (const L of lines) {
      const its = L.items.sort((a, b) => a.x0 - b.x0);
      const first = its[0];
      const amts = its.filter((i) => AMT.test(i.s) && i.x1 > 465);
      if (DM.test(first.s) && first.x0 < 50 && amts.length) {
        const a = amts[amts.length - 1];
        const sign = a.x1 < 500 ? -1 : 1;
        const typ = its[1] && its[1].x0 < 85 ? its[1].s : '';
        cur = {
          rd: first.s, type: typ, counterIban: its.filter((i) => i.x0 >= 85 && i.x0 < 200).map((i) => i.s).join('').replace(/\s/g, ''),
          name: clean(its.filter((i) => i.x0 >= 200 && i.x0 < a.x0 - 2).map((i) => i.s).join(' ')),
          amount: sign * parseAmount(a.s), oms: [],
        };
        tx.push(cur);
      } else if (cur && !cur.done) {
        const t = clean(its.filter((i) => i.x0 >= 200).map((i) => i.s).join(' '));
        if (t) cur.oms.push(t);
        if (/^Verwerkingsdatum/.test(t)) cur.done = true;
      }
    }
  }
  if (!tx.length) throw new Error('Geen transacties gevonden. Is dit een Rabobank-rekeningafschrift?');
  const account = (head.iban || '').replace(/\s/g, '');
  const out = tx.map((t) => {
    const vd = t.oms.map((o) => o.match(/Verwerkingsdatum:\s*(\d\d-\d\d-\d{4})/)).find(Boolean);
    const desc = t.oms.filter((o) => !/^Verwerkingsdatum/.test(o)).join(' | ');
    return {
      date: vd ? parseDate(vd[1]) : null, amount: Math.round(t.amount * 100) / 100,
      name: t.name || (desc.split(' | ')[0] || '').slice(0, 40), desc, counterIban: t.counterIban,
      account, balance: null, kind: kindFromCode(t.type),
    };
  }).filter((t) => t.date);
  const af = -out.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const bij = out.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const check = head.totalAf != null ? {
    expectedAf: head.totalAf, expectedBij: head.totalBij, af: round2(af), bij: round2(bij),
    ok: Math.abs(af - head.totalAf) < 0.005 && Math.abs(bij - head.totalBij) < 0.005,
    beginsaldo: head.begin, eindsaldo: head.end, van: head.van, tot: head.tot,
  } : null;
  if (check && head.end != null && out.length) {
    // eindsaldo als saldo na de laatste transactie
    out[out.length - 1].balance = head.end;
  }
  return { bank: 'Rabobank (PDF)', holder: head.holder || '', accounts: account ? [account] : [], check, transactions: out };
}

const round2 = (n) => Math.round(n * 100) / 100;

function readHeader(items, head) {
  const below = (label, dx = 60) => {
    const l = items.find((i) => i.s === label);
    if (!l) return [];
    return items.filter((i) => i.y > l.y + 4 && i.y < l.y + 16 && i.x0 > l.x0 - dx && i.x0 < l.x1 + dx).sort((a, b) => a.x0 - b.x0);
  };
  const name = below('Ten name van', 5).filter((i) => i.x0 < 200).map((i) => i.s).join(' ');
  head.holder = clean(name);
  const num = (arr) => { const a = arr.find((i) => AMT.test(i.s)); return a ? parseAmount(a.s) * (arr.some((i) => i.s === 'D') ? -1 : 1) : null; };
  head.begin = num(below('Beginsaldo'));
  head.end = num(below('Eindsaldo'));
  head.totalAf = num(below('Totaal afgeschreven'));
  head.totalBij = num(below('Totaal bijgeschreven'));
  const d1 = below('Datum vanaf').find((i) => parseDate(i.s)); head.van = d1 ? parseDate(d1.s) : null;
  const d2 = below('Datum tot en met').find((i) => parseDate(i.s)); head.tot = d2 ? parseDate(d2.s) : null;
  const ib = below('IBAN / Rekeningnummer', 5).filter((i) => i.x0 < 250).map((i) => i.s).join(' ');
  const m = ib.replace(/\s/g, '').match(/[A-Z]{2}\d{2}[A-Z]{4}\d{10}/); head.iban = m ? m[0] : '';
}
