const IDS = ['detectHeadings', 'stripMarkdown', 'boldLabels', 'styleSources', 'styleCitations', 'spacing'];
const DEF = { theme: 'rouge', detectHeadings: true, stripMarkdown: true, boldLabels: true, styleSources: true, styleCitations: true, spacing: true };
const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(DEF, (o) => {
  $('theme').value = o.theme;
  IDS.forEach((k) => ($(k).checked = !!o[k]));
});

$('go').onclick = async () => {
  const msg = $('msg'), btn = $('go');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const m = tab && tab.url && /docs\.google\.com\/document\/d\/([\w-]+)/.exec(tab.url);
  if (!m) { msg.textContent = 'Ouvre d\'abord un Google Doc dans cet onglet.'; return; }
  const options = { theme: $('theme').value };
  IDS.forEach((k) => (options[k] = $(k).checked));
  chrome.storage.sync.set(options);
  btn.disabled = true; msg.textContent = 'Mise en forme en cours…';
  chrome.runtime.sendMessage({ type: 'format', docId: m[1], options }, (r) => {
    btn.disabled = false;
    if (!r || !r.ok) { msg.textContent = 'Erreur : ' + ((r && r.error) || 'inconnue'); return; }
    msg.textContent = 'Terminé : ' + r.stats.titres + ' titres, ' + r.stats.puces + ' puces, ' + r.stats.sources + ' sources. Recharge l\'onglet pour voir le résultat.';
  });
};
