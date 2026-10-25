// Verzonnen voorbeeldhuishouden, zodat je de app kunt bekijken zonder eigen gegevens.
export function sampleData() {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)); // laatste dag vorige maand
  const months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1)); months.push([d.getUTCFullYear(), d.getUTCMonth() + 1]); }
  const acc = 'NL00VOOR0000000001';
  const tx = [];
  const add = (y, m, d, amount, name, desc = '', kind = '', counterIban = '') => {
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    tx.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`, amount: Math.round(amount * 100) / 100, name, desc, counterIban, account: acc, balance: null, kind });
  };
  months.forEach(([y, m], i) => {
    add(y, m, 24, 3185.4 + (m === 5 ? 2410 : 0), 'Zorggroep Midden BV', m === 5 ? 'Salaris en vakantiegeld' : 'Salaris', 'overboeking', 'NL00VOOR0000000099');
    add(y, m, 1, -1045, 'Woonstichting De Linde', 'Huur', 'incasso');
    add(y, m, 5, i < 7 ? -168 : -184, 'Vattenfall', 'Termijnbedrag energie', 'incasso');
    add(y, m, 2, -152.35, 'Zilveren Kruis', 'Premie zorgverzekering', 'incasso');
    add(y, m, 20, -61.5, 'Ziggo Services BV', 'Internet en tv', 'incasso');
    add(y, m, 21, -17.5, 'Odido', 'Mobiel abonnement', 'incasso');
    add(y, m, 14, -13.99, 'Netflix International B.V.', 'Netflix maandabonnement', 'incasso');
    add(y, m, 27, -29.99, 'Basic-Fit Nederland', 'Lidmaatschap', 'incasso');
    add(y, m, 8, -43.1, 'Centraal Beheer', 'Woonverzekering en aansprakelijkheid', 'incasso');
    add(y, m, 12, -21.5, 'Vitens NV', 'Voorschot water', 'incasso');
    if (m >= 2 && m <= 11) add(y, m, 28, -58.3, 'Gemeente Utrecht', 'Gemeentelijke belastingen termijn', 'incasso');
    add(y, m, 25, -300, 'J. Jansen', 'Naar spaarrekening', 'overboeking', 'NL00VOOR0000000002');
    add(y, m, 1, -4.25, 'Bank', 'Kosten betaalrekening basispakket', 'kosten');
    const shops = ['Albert Heijn 1402', 'Jumbo Utrecht', 'Lidl Utrecht', 'Albert Heijn 8812', 'Bakkerij Bart'];
    for (let w = 0; w < 9 + Math.floor(rnd() * 4); w++) add(y, m, 1 + Math.floor(rnd() * 28), -(14 + rnd() * 76), pick(shops), 'Betaalautomaat', 'pin');
    for (let w = 0; w < 2 + Math.floor(rnd() * 3); w++) add(y, m, 1 + Math.floor(rnd() * 28), -(12 + rnd() * 48), pick(['Thuisbezorgd.nl', 'Cafe De Zaak', 'Restaurant Lokaal', 'Starbucks Utrecht CS']), 'Betaalautomaat', 'pin');
    for (let w = 0; w < 2; w++) add(y, m, 1 + Math.floor(rnd() * 28), -(45 + rnd() * 30), pick(['Shell Utrecht', 'TinQ Nieuwegein']), 'Brandstof', 'pin');
    add(y, m, 3 + Math.floor(rnd() * 20), -(20 + rnd() * 25), 'NS Reizigers', 'OV-chipkaart saldo', 'ideal');
    if (rnd() < 0.7) add(y, m, 1 + Math.floor(rnd() * 28), -(15 + rnd() * 90), 'bol.com', 'Bestelling', 'ideal');
    if (rnd() < 0.5) add(y, m, 1 + Math.floor(rnd() * 28), -(9 + rnd() * 30), 'Kruidvat 7731', 'Betaalautomaat', 'pin');
    if (rnd() < 0.4) add(y, m, 1 + Math.floor(rnd() * 28), -(25 + rnd() * 80), pick(['H&M Utrecht', 'Zara Hoog Catharijne', 'Decathlon']), 'Betaalautomaat', 'pin');
    if (rnd() < 0.5) add(y, m, 1 + Math.floor(rnd() * 28), 10 + Math.round(rnd() * 30), 'AAB INZ TIKKIE', 'Tikkie etentje', 'overboeking');
    if (rnd() < 0.3) add(y, m, 10, -100, 'Geldmaat Utrecht', 'Geldopname', 'geldautomaat');
  });
  const [y4, m4] = months[4]; add(y4, m4, 16, -2380, 'Keukenstudio Noord', 'Factuur nieuw aanrecht', 'overboeking');
  const [y7, m7] = months[7]; add(y7, m7, 9, -1240, 'Transavia', 'Vliegtickets zomervakantie', 'ideal');
  const [y6, m6] = months[6]; add(y6, m6, 18, 612, 'Belastingdienst', 'Teruggaaf inkomstenbelasting', 'overboeking');
  tx.sort((a, b) => (a.date < b.date ? -1 : 1));
  let bal = 1850;
  tx.forEach((t) => { bal += t.amount; t.balance = Math.round(bal * 100) / 100; });
  return { holder: 'J. Jansen', accounts: [acc], transactions: tx };
}
