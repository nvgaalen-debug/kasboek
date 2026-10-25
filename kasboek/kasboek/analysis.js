// Analyse: categorieën, vaste lasten, eenmalige uitgaven en prognose.

export const GROUPS = { inkomen: 'Inkomen', vast: 'Vaste lasten', variabel: 'Variabel', eenmalig: 'Eenmalig', intern: 'Eigen rekeningen' };

// Volgorde telt: eerste treffer wint. `fixed: false` = nooit automatisch een vaste last.
export const CATEGORIES = [
  { id: 'intern', label: 'Eigen rekening / sparen', group: 'intern', re: /\b(vrij spaargeld|spaarrekening|oranje spaarrekening|eigen rekening|spaardeposito|kwartaalsparen|bonusrente|doelsparen|spaarpot)\b/i },
  { id: 'salaris', label: 'Salaris & uitkering', group: 'inkomen', credit: true, re: /\b(salaris|loon|salary|uwv|svb|pensioen|uitkering|vakantiegeld|vakantietoeslag|dertiende maand|abp|pfzw|pmt|bpfbouw)\b/i },
  { id: 'toeslag', label: 'Toeslagen & teruggave', group: 'inkomen', credit: true, re: /\b(toeslag|kinderbijslag|teruggaaf|teruggave|belastingdienst|dienst toeslagen)\b/i },
  { id: 'rente', label: 'Rente', group: 'inkomen', credit: true, re: /\b(rente|interest)\b/i },
  { id: 'hypotheek', label: 'Hypotheek', group: 'vast', re: /\b(hypothe[ek]k?|hyp\b|obvion|florius|munt hyp|bijbouw|venn hyp|tellius|hypotrust|lot hypotheken|woonfonds|dynamic credit|nibc|blg wonen|attens|rabo hypotheek)/i },
  { id: 'huur', label: 'Huur', group: 'vast', re: /\b(huur|woonstichting|woningcorporatie|woonbedrijf|wooncorporatie|vestia|ymere|portaal|eigen haard|de alliantie|stadgenoot|rochdale|woonstad|havensteder|mitros|vivare|volkshuisvesting|woonbron|woonzorg)\b/i },
  { id: 'energie', label: 'Energie', group: 'vast', re: /\b(eneco services|eneco b\.?v|vattenfall|nuon|essent|greenchoice|budget energie|energiedirect|vandebron|engie|oxxio|pure energie|frank energie|tibber|zonneplan|anwb energie|delta energie|innova|mega energie|liander|stedin|enexis|westland infra|coteq|rendo)\b/i },
  { id: 'water', label: 'Water', group: 'vast', re: /\b(vitens|evides|waternet|brabant water|pwn|dunea|oasen|wml|waterbedrijf groningen|wmd|watermaatschappij)\b/i },
  { id: 'gemeente', label: 'Gemeente & waterschap', group: 'vast', re: /\b(gemeente(lijke)? belasting|gemeente [a-z]|waterschap|hoogheemraadschap|belastingsamenwerking|bsgw|gbt|bghu|cocensus|svhw|rbg|bsr\b|hhnk|wbd|noord-holland noord|belastingen gemeente|regionale belasting|gemeentebelasting)/i },
  { id: 'zorg', label: 'Zorgverzekering', group: 'vast', re: /\b(zilveren kruis|\bcz\b|cz groep|vgz|menzis|dsw|zorg en zekerheid|onvz|asr ikz|ikz zorg|ditzo zorg|fbto zorg|infomedics|achmea zorg|salland|zorgverzekering|eno zorg|stad holland|unive zorg|de friesland|interpolis zorg|anderzorg|caresq|just zorg|zekur)\b/i },
  { id: 'verzekering', label: 'Verzekeringen', group: 'vast', re: /\b(interpolis|centraal beheer|fbto|ohra|nationale.?nederlanden|nn schade|unive|ditzo|allianz|asr\b|a\.s\.r|aegon|ansvar|anwb verzekering|inshared|promovendum|reaal|klaverblad|dela|monuta|yarden|verzekering)/i },
  { id: 'telecom', label: 'Internet & telefoon', group: 'vast', re: /\b(ziggo|kpn|t-mobile|odido|vodafone|youfone|simpel|lebara|\bben\b|tele2|hollandsnieuwe|delta fiber|caiway|budget mobiel|lycamobile|vidaphone|50plusmobiel|robin mobile|freedom internet|online\.nl|glasvezel)\b/i },
  { id: 'abonnement', label: 'Abonnementen & loterij', group: 'vast', re: /\b(netflix|spotify|disney|videoland|hbo|max\.com|apple\.com|icloud|google|youtube|amazon prime|dpg media|mediahuis|ndc|telegraaf|volkskrant|nrc|trouw|parool|gelderlander|postcode ?loterij|staatsloterij|vriendenloterij|bankgiro ?loterij|basic-fit|anytime fitness|fit for free|sportcity|trainmore|sportschool|audible|storytel|kobo|patreon|chatgpt|openai|microsoft|adobe|dropbox|nintendo|playstation|xbox)\b/i },
  { id: 'kinderopvang', label: 'Kinderopvang & school', group: 'vast', re: /\b(kinderopvang|kinderdagverblijf|kdv|bso|partou|smallsteps|kids first|kinderrijk|humankind|duo\b|school|ouderbijdrage)\b/i },
  { id: 'bank', label: 'Bankkosten', group: 'vast', re: /\b(totaalpakket|betaalpakket|kosten betaalrekening|rabo .*pakket|basispakket|ing kosten|abn amro kosten|kosten gebruik|rekeningkosten|bunq b\.?v)\b/i },
  { id: 'creditcard', label: 'Creditcard', group: 'variabel', fixed: false, re: /\b(creditcard|kaartnummer|icscards|international card services|american express|amex|rabo card|creditcar)/i },
  { id: 'contant', label: 'Contant geld', group: 'variabel', fixed: false, re: /\b(geldmaat|geldautomaat|\bgea\b|opname|atm)\b/i },
  { id: 'boodschappen', label: 'Boodschappen', group: 'variabel', fixed: false, re: /\b(albert heijn|\bah\b|ah to go|jumbo|lidl|aldi|plus\b|dirk|dekamarkt|hoogvliet|coop|spar\b|vomar|poiesz|picnic|crisp|ekoplaza|kaufland|marqt|deen|nettorama|boni|jan linders|mcd supermarkt|vandervalk|bakker|bakkerij|slager|slagerij|groenteman|groente|kaas|poelier|visboer|delicatess|toko|amazing oriental|edeka|rewe|carrefour|delhaize|colruyt|intermarche|leclerc)/i },
  { id: 'horeca', label: 'Uit eten & bezorging', group: 'variabel', fixed: false, re: /\b(restaurant|cafe|café|bar\b|pizza|domino|thuisbezorgd|takeaway|uber ?eats|deliveroo|mcdonald|burger king|kfc|starbucks|lunch|eetcafe|brasserie|grandcafe|grand cafe|ijssalon|snackbar|febo|new york pizza|sushi|wok|bistro|pub|kebab|shoarma|friet|bakery|koffie|coffee|bagels|wagamama|vapiano|loetje|la place|smullers)/i },
  { id: 'vervoer', label: 'Auto & vervoer', group: 'variabel', fixed: false, re: /\b(ns\b|ns groep|ns reizigers|ov-chipkaart|translink|gvb|\bret\b|htm|arriva|connexxion|qbuzz|keolis|9292|uber\b|bolt\.eu|freenow|tango|shell|bp\b|esso|totalenergies|tinq|texaco|gulf|argos|q8|avia|tamoil|carwash|wasstraat|parkeer|parking|q-park|easypark|parkmobile|yellowbrick|anwb|tankstation|apk|garage|autobedrijf|fastned|allego|vattenfall incharge|ionity|tesla|parkeren|veerbedrijf|vignet|tol\b|nlov)/i },
  { id: 'huis', label: 'Huis, tuin & klussen', group: 'variabel', fixed: false, re: /\b(gamma|praxis|karwei|hornbach|intratuin|groenrijk|ikea|action\b|jysk|leen bakker|kwantum|blokker|hema|xenos|welkoop|tuincentrum|bauhaus|hubo|formido|fonq|flinders|beddenreus|swiss sense|gall|kruidvat huis|hoveniers?|loodgieter|schilder|aannemer|installatie)/i },
  { id: 'online', label: 'Online winkelen', group: 'variabel', fixed: false, re: /\b(bol\.?com|amazon|zalando|coolblue|wehkamp|aliexpress|temu|shein|marktplaats|klarna|riverty|afterpay|paypal|mediamarkt|otto|vinted|lidl\.nl)/i },
  { id: 'kleding', label: 'Kleding & verzorging', group: 'variabel', fixed: false, re: /\b(h&m|h & m|zara|primark|c&a|we fashion|only\b|jack ?& ?jones|kruidvat|etos|da drogist|trekpleister|douglas|ici paris|rituals|kapper|kapsalon|hair|barber|nike|adidas|decathlon|intersport|hunkemoller|hunkemöller|bijenkorf|zeeman|wibra|scapino|van haren|bristol|schoenen|nagelstudio|schoonheid)/i },
  { id: 'gezondheid', label: 'Gezondheid', group: 'variabel', fixed: false, re: /\b(apotheek|tandarts|fysio|fysiotherap|huisarts|ziekenhuis|optiek|specsavers|pearle|hans anders|mondzorg|dierenarts|psycholoog)\b/i },
  { id: 'vrijetijd', label: 'Vrije tijd & uitjes', group: 'variabel', fixed: false, re: /\b(bioscoop|path[eé]|vue\b|kinepolis|museum|dierentuin|efteling|apenheul|blijdorp|artis|sauna|thermen|theater|concert|ticketmaster|eventim|zwembad|sportfondsen|bowling|escape|pretpark|attractie|openlucht|speeltuin|boekhandel|bruna|ako\b|primera|intertoys|bart smit|top1toys|lego)/i },
  { id: 'reizen', label: 'Reizen & vakantie', group: 'variabel', fixed: false, re: /\b(booking\.com|airbnb|klm|transavia|ryanair|easyjet|vueling|lufthansa|tui\b|corendon|sunweb|d-reizen|camping|hotel|hostel|vakantiepark|center parcs|landal|roompot|flughafen|airport|schiphol|expedia)/i },
  { id: 'goededoelen', label: 'Goede doelen', group: 'variabel', fixed: false, re: /\b(kwf|unicef|rode kruis|greenpeace|wnf|amnesty|artsen zonder grenzen|hartstichting|alzheimer|clubactie|collecte|giro555|stichting .*fonds|natuurmonumenten)\b/i },
  { id: 'personen', label: 'Overboekingen aan personen', group: 'variabel', fixed: true, person: true, re: null },
  { id: 'tikkie', label: 'Tikkies & betaalverzoeken', group: 'variabel', fixed: false, re: /\b(tikkie|betaalverzoek)\b/i },
  { id: 'belasting', label: 'Belastingdienst', group: 'variabel', fixed: false, re: /\b(belastingdienst)\b/i },
  { id: 'overig', label: 'Overig', group: 'variabel', re: null },
  { id: 'overig_in', label: 'Overig inkomen', group: 'inkomen', re: null },
];
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const cleanName = (s) => String(s || '').replace(/^(ccv|bck|sumup|nya|c&m|zettle_?|pay\.nl|mollie|sp|iz|pp)\s*\*\s*/i, '').trim();
const PERSON = /^(?:(?:hr|mw|dhr|mevr|fam)\.?\s+)?(?:[A-Z]\.){1,5}\s*(?:[a-z]+\s+){0,2}[A-Z][a-zA-Z'-]+(?:\s+(?:en\/of|eo|e\/o)\s+.*)?$/;
export const isPerson = (name) => PERSON.test(String(name || '').trim());

export function nameKey(s) {
  return cleanName(s).toLowerCase()
    .replace(/\s+via\s+.*$/, '')
    .replace(/\b(b\.?v\.?|n\.?v\.?|gmbh|bv|nv|vof|holding)\b/g, '')
    .replace(/[^a-z0-9à-ÿ& ]+/g, ' ').replace(/\b\d{3,}\b/g, ' ').replace(/\s+/g, ' ').trim();
}

const ym = (d) => d.slice(0, 7);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r2 = (n) => Math.round(n * 100) / 100;
export function monthsBetween(a, b) { const out = []; let [y, m] = a.split('-').map(Number); const [yb, mb] = b.split('-').map(Number); while (y < yb || (y === yb && m <= mb)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; }
const addMonths = (k, n) => { let [y, m] = k.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${String(m).padStart(2, '0')}`; };
const daysIn = (k) => { const [y, m] = k.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

function ruleCategory(t) {
  const name = t.name || '', text = name + ' ' + (t.desc || '');
  const credit = t.amount > 0;
  for (const c of CATEGORIES) {
    if (!c.re) continue;
    if (c.credit && !credit) continue;
    // eerst op naam, daarna op naam + omschrijving
    if (c.re.test(name) || c.re.test(text)) {
      if (credit && c.id === 'tikkie') return 'overig_in';
      if (c.id === 'belasting' && credit) return 'toeslag';
      return c.id;
    }
  }
  if (!credit && isPerson(cleanName(name)) && t.kind !== 'pin') return 'personen';
  return credit ? 'overig_in' : 'overig';
}

/**
 * tx: samengevoegde transacties; settings: { holders:[], ownIbans:[], overrides:{nameKey:catId}, txOverrides:{id:{group}}, eenmaligThreshold }
 * meta: { balances: [{account, date, balance}], checks: [...] }
 */
export function analyze(txIn, settings = {}, meta = {}) {
  const own = new Set([...(settings.ownIbans || []), ...(meta.accounts || [])].map((s) => s.replace(/\s/g, '').toUpperCase()).filter(Boolean));
  const holders = new Set((settings.holders || []).map(nameKey).filter(Boolean));
  const overrides = settings.overrides || {};
  const txOv = settings.txOverrides || {};
  const threshold = settings.eenmaligThreshold ?? 750;

  const tx = txIn.map((t) => {
    const key = nameKey(t.name) || nameKey((t.desc || '').slice(0, 30));
    let cat = overrides[key] || null, auto = !cat;
    if (!cat) {
      const internal = (t.counterIban && own.has(t.counterIban) && t.counterIban !== t.account && t.kind !== 'kosten') || (holders.has(key) && t.kind !== 'pin' && t.kind !== 'incasso');
      cat = internal ? 'intern' : ruleCategory(t);
    }
    return { ...t, key, cat, auto, group: CAT[cat].group, month: ym(t.date) };
  });
  if (!tx.length) return null;

  const firstDate = tx.reduce((a, t) => (t.date < a ? t.date : a), tx[0].date);
  const lastDate = tx.reduce((a, t) => (t.date > a ? t.date : a), tx[0].date);
  const period = { van: meta.van || firstDate, tot: meta.tot || lastDate };
  const months = monthsBetween(ym(period.van), ym(period.tot));
  const fullMonths = months.filter((m) => {
    const start = m === ym(period.van) ? Number(period.van.slice(8, 10)) : 1;
    const end = m === ym(period.tot) ? Number(period.tot.slice(8, 10)) : daysIn(m);
    return start <= 3 && end >= daysIn(m) - 3;
  });
  const statMonths = fullMonths.length ? fullMonths : months;
  const span = statMonths.length;

  // --- terugkerende afschrijvingen: maak er vaste lasten van ---
  const byKey = new Map();
  for (const t of tx) {
    if (t.amount >= 0) continue;
    const k = (t.group === 'intern' ? 'I:' : '') + t.key;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(t);
  }
  const recurring = [];
  for (const [k, list] of byKey) {
    const perMonth = {};
    list.forEach((t) => { perMonth[t.month] = (perMonth[t.month] || 0) + -t.amount; });
    const ms = Object.keys(perMonth).sort();
    const amounts = list.map((t) => -t.amount);
    const perMonthCount = list.length / ms.length;
    const med = median(amounts);
    const stable = amounts.filter((a) => Math.abs(a - med) <= Math.max(0.25 * med, 2)).length / amounts.length >= 0.7;
    const catCount = {}; list.forEach((t) => { catCount[t.cat] = (catCount[t.cat] || 0) + 1; });
    const cat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0];
    const c = CAT[cat];
    const isFixedCat = c.group === 'vast' || c.group === 'intern';
    const gm = ms.length > 1 ? (monthsBetween(ms[0], ms[ms.length - 1]).length - 1) / (ms.length - 1) : 99;
    const monthlyLike = gm <= 1.4 && ms.filter((m) => statMonths.includes(m)).length / span >= 0.5;
    const qualifies = ms.length >= 3 && perMonthCount <= 2.2 && (isFixedCat ? true : stable && c.fixed !== false && monthlyLike);
    const qualifiesFixedCat = isFixedCat && c.group === 'vast' && ms.length >= 1; // ook eenmalige rekening van een vaste-lastenpost telt als vast
    if (!qualifies && !qualifiesFixedCat) continue;
    const last = list.reduce((a, t) => (t.date > a.date ? t : a), list[0]);
    const first = list.reduce((a, t) => (t.date < a.date ? t : a), list[0]);
    const lastMonth = ym(last.date);
    const coverage = ms.filter((m) => statMonths.includes(m)).length / span;
    let freq, monthly;
    const gapMonths = ms.length > 1 ? (monthsBetween(ms[0], ms[ms.length - 1]).length - 1) / (ms.length - 1) : null;
    if (coverage >= 0.6 && gapMonths != null && gapMonths <= 1.4) { freq = 'maandelijks'; monthly = perMonth[lastMonth]; }
    else if (gapMonths && gapMonths >= 2.5 && gapMonths <= 3.5) { freq = 'per kwartaal'; monthly = median(Object.values(perMonth)) / 3; }
    else if (gapMonths && gapMonths >= 10) { freq = 'per jaar'; monthly = median(Object.values(perMonth)) / 12; }
    else if (ms.length < 3) { freq = 'incidenteel'; monthly = amounts.reduce((s, a) => s + a, 0) / Math.max(12, span); }
    else { freq = 'onregelmatig'; monthly = Object.values(perMonth).reduce((s, a) => s + a, 0) / span; }
    if (!qualifies) { freq = 'incidenteel'; monthly = amounts.reduce((s, a) => s + a, 0) / Math.max(12, span); }
    const endM = ym(period.tot);
    const monthsSinceLast = monthsBetween(lastMonth, endM).length - 1;
    let status = 'actief';
    if (freq === 'maandelijks' && monthsSinceLast >= 2) status = 'gestopt?';
    else if (freq === 'maandelijks' && monthsSinceLast === 1) status = 'laatste maand niet betaald';
    else if (freq === 'onregelmatig' && monthsSinceLast >= 3) status = 'gestopt?';
    if (freq === 'maandelijks' && ms[0] >= addMonths(endM, -1) ) status = 'nieuw';
    const lastAmt = perMonth[lastMonth];
    const early = median(ms.slice(0, Math.max(1, Math.floor(ms.length / 2))).map((m) => perMonth[m]));
    const change = freq === 'maandelijks' && ms.length >= 4 && early > 0 ? (lastAmt - early) / early : 0;
    recurring.push({
      key: k, name: last.name, cat: list.some((t) => t.group === 'intern') ? 'intern' : cat, sparen: c.group === 'intern' || k.startsWith('I:'),
      freq, monthly: r2(monthly), last: r2(lastAmt), lastDate: last.date, firstDate: first.date, months: ms.length, total: r2(amounts.reduce((s, a) => s + a, 0)),
      status, change, ids: new Set(list.map((t) => t.id)),
    });
  }
  const recurringIds = new Set();
  recurring.filter((r) => !r.sparen && r.freq !== 'incidenteel').forEach((r) => r.ids.forEach((id) => recurringIds.add(id)));
  for (const t of tx) {
    if (t.group === 'variabel' && recurringIds.has(t.id)) t.group = 'vast';
  }
  // --- eenmalig: grote losse afschrijvingen ---
  for (const t of tx) {
    const o = txOv[t.id];
    if (o && o.group) { t.group = o.group; t.manualGroup = true; continue; }
    if (t.amount < 0 && t.group === 'variabel' && -t.amount >= threshold && !['creditcard', 'contant'].includes(t.cat)) t.group = 'eenmalig';
  }

  // --- maandoverzicht ---
  const monthRows = months.map((m) => {
    const ts = tx.filter((t) => t.month === m);
    const sum = (g) => r2(ts.filter((t) => t.group === g).reduce((s, t) => s + t.amount, 0));
    const r = { month: m, inkomen: sum('inkomen'), vast: -sum('vast'), variabel: -sum('variabel'), eenmalig: -sum('eenmalig'), intern: sum('intern'), full: statMonths.includes(m) };
    r.uitgaven = r2(r.vast + r.variabel + r.eenmalig);
    r.netto = r2(r.inkomen - r.uitgaven);
    return r;
  });

  // saldo per maand (als bekend)
  let balance = null;
  if (meta.endBalance != null) {
    let b = meta.endBalance;
    for (let i = monthRows.length - 1; i >= 0; i--) { monthRows[i].saldo = r2(b); b -= monthRows[i].netto + monthRows[i].intern; }
    balance = meta.endBalance;
  }

  // --- categorieën ---
  const catMap = new Map();
  for (const t of tx) {
    if (t.group === 'intern') continue;
    const k = t.cat + '|' + (t.group === 'inkomen' ? 'in' : 'out');
    if (!catMap.has(k)) catMap.set(k, { cat: t.cat, label: CAT[t.cat].label, income: t.group === 'inkomen', total: 0, count: 0, groups: {} });
    const c = catMap.get(k); c.total += t.amount; c.count++; c.groups[t.group] = (c.groups[t.group] || 0) + t.amount;
  }
  const cats = [...catMap.values()].map((c) => ({ ...c, total: r2(c.income ? c.total : -c.total), perMonth: r2((c.income ? c.total : -c.total) / months.length) }));
  const expenseCats = cats.filter((c) => !c.income && c.total > 0).sort((a, b) => b.total - a.total);
  const incomeCats = cats.filter((c) => c.income).sort((a, b) => b.total - a.total);

  // --- structureel inkomen ---
  const incByKey = new Map();
  for (const t of tx) if (t.group === 'inkomen' && t.amount > 0 && !/tikkie|betaalverzoek/i.test(t.name + ' ' + t.desc)) { const k = t.cat + '|' + t.key; if (!incByKey.has(k)) incByKey.set(k, []); incByKey.get(k).push(t); }
  const incomeStreams = [];
  const notes = [];
  for (const [k, list] of incByKey) {
    const perMonth = {}; list.forEach((t) => { perMonth[t.month] = (perMonth[t.month] || 0) + t.amount; });
    const ms = Object.keys(perMonth).filter((m) => statMonths.includes(m));
    if (ms.length < Math.max(3, Math.ceil(span * 0.6))) continue;
    const vals = ms.map((m) => perMonth[m]); const med = median(vals);
    const peaks = ms.filter((m) => perMonth[m] > med * 1.4 && perMonth[m] - med > 250).map((m) => ({ month: m, extra: r2(perMonth[m] - med) }));
    const lows = ms.filter((m) => perMonth[m] < med * 0.6 && med > 250).map((m) => ({ month: m, amount: r2(perMonth[m]) }));
    const missing = med > 250 ? statMonths.filter((m) => !perMonth[m] && m > ms[0]) : [];
    incomeStreams.push({ key: k, name: list[list.length - 1].name, cat: list[list.length - 1].cat, base: r2(med), months: ms.length, peaks, lows, missing });
    const nm = list[list.length - 1].name;
    peaks.forEach((p) => notes.push({ kind: 'info', text: `${nm}: in ${monthLabel(p.month, true)} ${eur(p.extra)} meer dan normaal${['05', '06'].includes(p.month.slice(5)) ? ' (waarschijnlijk vakantiegeld)' : ' (bonus of nabetaling?)'}.` }));
    lows.forEach((p) => notes.push({ kind: 'warn', text: `${nm}: in ${monthLabel(p.month, true)} maar ${eur(p.amount)} ontvangen, normaal ${eur(med)}.` }));
    missing.forEach((m) => notes.push({ kind: 'warn', text: `${nm}: niets ontvangen in ${monthLabel(m, true)}.` }));
  }

  // --- notities over vaste lasten ---
  recurring.filter((r) => !r.sparen).forEach((r) => {
    if (r.status === 'gestopt?') notes.push({ kind: 'info', text: `${r.name} is sinds ${monthLabel(ym(r.lastDate), true)} niet meer afgeschreven. Niet meegenomen in de prognose.` });
    if (r.status === 'laatste maand niet betaald') notes.push({ kind: 'warn', text: `${r.name} is de laatste maand niet afgeschreven (normaal ${eur(r.last)}).` });
    if (Math.abs(r.change) >= 0.08 && r.months >= 3) notes.push({ kind: r.change > 0 ? 'warn' : 'good', text: `${r.name} is ${r.change > 0 ? 'gestegen' : 'gedaald'} met ${Math.round(Math.abs(r.change) * 100)}% naar ${eur(r.last)} per maand.` });
  });
  const eenmalig = tx.filter((t) => t.group === 'eenmalig').sort((a, b) => a.amount - b.amount);
  const eenmaligTotal = -eenmalig.reduce((s, t) => s + t.amount, 0);
  const internNet = r2(tx.filter((t) => t.group === 'intern').reduce((s, t) => s + t.amount, 0));
  if (eenmaligTotal > 0) notes.unshift({ kind: 'info', text: `${eenmalig.length} grote eenmalige uitgaven, samen ${eur(eenmaligTotal)}${internNet > 1000 ? `. Per saldo ${eur(internNet)} van je eigen spaarrekening(en) gehaald.` : '.'}` });
  else if (internNet > 1000) notes.unshift({ kind: 'warn', text: `Per saldo ${eur(internNet)} van je spaarrekening(en) gehaald.` });
  else if (internNet < -500) notes.unshift({ kind: 'good', text: `Per saldo ${eur(-internNet)} naar je spaarrekening(en) gezet.` });
  const overig = tx.filter((t) => t.cat === 'overig' && t.group !== 'vast');
  if (overig.length) notes.push({ kind: 'info', text: `${overig.length} uitgaven konden niet worden ingedeeld (${eur(-overig.reduce((s, t) => s + t.amount, 0))}). Deel ze in bij Categorieën.` });

  // --- prognose ---
  const varMonths = monthRows.filter((r) => r.full || !fullMonths.length).map((r) => r.variabel);
  const varBase = r2(median(varMonths)), varHigh = r2(mean(varMonths));
  const active = recurring.filter((r) => r.status !== 'gestopt?' && r.freq !== 'incidenteel' && (!r.sparen || r.freq === 'maandelijks'));
  const vastPm = r2(active.filter((r) => !r.sparen).reduce((s, r) => s + r.monthly, 0));
  const sparenPm = r2(active.filter((r) => r.sparen).reduce((s, r) => s + r.monthly, 0));
  const incomeBase = r2(incomeStreams.reduce((s, r) => s + r.base, 0));
  const startM = addMonths(ym(period.tot), 1);
  const forecast = []; let sb = balance ?? 0, sr = balance ?? 0;
  for (let i = 0; i < 12; i++) {
    const m = addMonths(startM, i);
    const extra = incomeStreams.reduce((s, r) => s + r.peaks.filter((p) => p.month.slice(5) === m.slice(5) && ['05', '06'].includes(m.slice(5))).reduce((a, p) => a + p.extra, 0), 0);
    const inkomen = r2(incomeBase + extra);
    const nb = r2(inkomen - vastPm - sparenPm - varBase), nr = r2(inkomen - vastPm - sparenPm - varHigh);
    sb += nb; sr += nr;
    forecast.push({ month: m, inkomen, vast: vastPm, sparen: sparenPm, variabel: varBase, variabelRuim: varHigh, netto: nb, nettoRuim: nr, saldo: r2(sb), saldoRuim: r2(sr) });
  }

  const totIn = r2(monthRows.reduce((s, r) => s + r.inkomen, 0));
  const totOut = r2(monthRows.reduce((s, r) => s + r.uitgaven, 0));
  const regular = statMonths.length ? r2(monthRows.filter((r) => statMonths.includes(r.month)).reduce((s, r) => s + r.vast + r.variabel, 0) / statMonths.length) : 0;

  return {
    tx, period, months, fullMonths, monthRows, expenseCats, incomeCats, recurring: recurring.sort((a, b) => b.monthly - a.monthly),
    incomeStreams, notes, forecast, eenmalig, balance,
    kpi: { totIn, totOut, net: r2(totIn - totOut), regular, vastPm, sparenPm, varBase, varHigh, incomeBase, internNet, eenmaligTotal: r2(eenmaligTotal) },
  };
}

export const eurFmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
export const eur0Fmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const eur = (n) => eurFmt.format(n);
export const eur0 = (n) => eur0Fmt.format(n);
const MN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export function monthLabel(k, long = false, withYear = true) { const [y, m] = k.split('-'); const n = MN[+m - 1]; return (long ? n : (n === 'maart' ? 'mrt' : n.slice(0, 3))) + (withYear ? ' ' + (long ? y : "'" + y.slice(2)) : ''); }
