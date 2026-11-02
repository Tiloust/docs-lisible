const test = require('node:test');
const assert = require('node:assert');
const { buildRequests, chunk } = require('../format-core.js');

function makeDoc(lines) {
  let idx = 1; const content = [];
  lines.forEach(l => {
    const end = idx + l.length + 1;
    content.push({ startIndex: idx, endIndex: end, paragraph: { elements: [{ startIndex: idx, endIndex: end, textRun: { content: l + '\n' } }], paragraphStyle: { namedStyleType: 'NORMAL_TEXT' } } });
    idx = end;
  });
  return { body: { content } };
}

function simulate(lines, opts) {
  let full = lines.join('\n') + '\n';
  const { requests, stats } = buildRequests(makeDoc(lines), opts);
  const seen = { para: [], text: [], bullets: [] };
  requests.forEach(r => {
    if (r.deleteContentRange) { const { startIndex: s, endIndex: e } = r.deleteContentRange.range; full = full.slice(0, s - 1) + full.slice(e - 1); }
    else if (r.insertText) { const i = r.insertText.location.index; full = full.slice(0, i - 1) + r.insertText.text + full.slice(i - 1); }
    else if (r.updateParagraphStyle) { const g = r.updateParagraphStyle; seen.para.push([full.slice(g.range.startIndex - 1, g.range.endIndex - 1), g.paragraphStyle]); }
    else if (r.updateTextStyle) { const g = r.updateTextStyle; seen.text.push([full.slice(g.range.startIndex - 1, g.range.endIndex - 1), g.textStyle]); }
    else if (r.createParagraphBullets) { const g = r.createParagraphBullets; seen.bullets.push([full.slice(g.range.startIndex - 1, g.range.endIndex - 1), g.bulletPreset]); }
  });
  return { full, seen, stats, requests };
}
const letters = s => s.replace(/[^A-Za-z\u00C0-\u00FF]/g, '');

const SAMPLE = [
  '# Les monarchies europ\u00e9ennes',
  'Le roi r\u00e8gne mais ne gouverne pas [web:1]. Voici **un point cl\u00e9** et *un mot*.',
  '',
  'I. Un invariant politique',
  'A. Du Bill of Rights \u00e0 1974',
  '- Su\u00e8de : r\u00e9forme de 1974',
  '  - sous-point imbriqu\u00e9',
  '- Belgique : ciment national',
  '',
  '1. Premier argument qui est une phrase longue et compl\u00e8te avec une conclusion.',
  '2. Second argument qui est aussi une phrase longue et compl\u00e8te avec une fin.',
  'Source : Linz, 1996',
  'CONCLUSION',
];

test('aucun mot supprim\u00e9', () => {
  const { full } = simulate(SAMPLE);
  assert.strictEqual(letters(full), letters(SAMPLE.join('\n')));
});

test('titres, listes et sources cibl\u00e9s au bon endroit', () => {
  const { seen, full, stats } = simulate(SAMPLE);
  const heads = seen.para.filter(p => p[1].namedStyleType).map(p => [p[0].trim(), p[1].namedStyleType]);
  assert.deepStrictEqual(heads, [
    ['Les monarchies europ\u00e9ennes', 'HEADING_1'], ['I. Un invariant politique', 'HEADING_1'],
    ['A. Du Bill of Rights \u00e0 1974', 'HEADING_2'], ['CONCLUSION', 'HEADING_1']]);
  assert.ok(!/(^|\n)#|\*\*/.test(full.replace(/\t/g, '')));
  assert.strictEqual(seen.bullets.length, 2);
  assert.strictEqual(seen.bullets[1][1], 'BULLET_DISC_CIRCLE_SQUARE');
  assert.ok(seen.bullets[0][0].includes('\u2022') === false);
  const bolds = seen.text.filter(t => t[1].bold).map(t => t[0]);
  assert.ok(bolds.includes('un point cl\u00e9') && bolds.includes('Su\u00e8de') && bolds.includes('Belgique'));
  assert.ok(seen.text.some(t => t[0] === 'un mot' && t[1].italic));
  assert.ok(seen.text.some(t => t[0] === '[web:1]' && t[1].baselineOffset === 'SUPERSCRIPT'));
  assert.ok(seen.text.some(t => t[0] === 'Source : Linz, 1996' && t[1].italic));
  assert.strictEqual(stats.sources, 1);
});

test('imbrication des puces conserv\u00e9e', () => {
  const { seen } = simulate(SAMPLE);
  const grp = seen.bullets.find(b => b[1] === 'BULLET_DISC_CIRCLE_SQUARE')[0];
  assert.ok(grp.split('\n').some(l => l.startsWith('\t')));
});

test('50 pages en peu de requ\u00eates et moins de 2 s', () => {
  const lines = [];
  for (let i = 0; i < 400; i++) {
    lines.push('## Section ' + i, 'Un paragraphe avec **gras** et du texte normal [1].', '- Point : explication', '- Autre point : suite', '');
  }
  const t = Date.now();
  const { requests } = buildRequests(makeDoc(lines));
  assert.ok(Date.now() - t < 2000);
  assert.ok(chunk(requests, 400).length >= 1);
});

test('idempotent : un titre d\u00e9j\u00e0 styl\u00e9 n\u2019est pas retouch\u00e9', () => {
  const d = makeDoc(['Titre existant']);
  d.body.content[0].paragraph.paragraphStyle.namedStyleType = 'HEADING_2';
  const { requests } = buildRequests(d);
  assert.ok(!requests.some(r => r.updateParagraphStyle && r.updateParagraphStyle.paragraphStyle.namedStyleType));
});

test('liste de mots courts num\u00e9rot\u00e9s reste une liste', () => {
  const { seen } = simulate(['1. Paris', '2. Lyon', '3. Nice']);
  assert.strictEqual(seen.bullets[0][1], 'NUMBERED_DECIMAL_ALPHA_ROMAN');
});
