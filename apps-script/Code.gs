function onOpen() {
  DocumentApp.getUi().createMenu('Docs Lisible')
    .addItem('Rendre lisible…', 'showSidebar')
    .addItem('Rendre lisible (derniers réglages)', 'quickRun')
    .addToUi();
}
function onInstall() { onOpen(); }

function showSidebar() {
  DocumentApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Docs Lisible'));
}

function getOptions() {
  var s = PropertiesService.getUserProperties().getProperty('opts');
  return Object.assign({}, DocsLisible.DEFAULTS, s ? JSON.parse(s) : {});
}

function quickRun() {
  var st = applyFormatting(getOptions());
  DocumentApp.getUi().alert('Terminé : ' + st.titres + ' titres, ' + st.puces + ' puces, ' + st.sources + ' sources.');
}

function applyFormatting(options) {
  PropertiesService.getUserProperties().setProperty('opts', JSON.stringify(options));
  var id = DocumentApp.getActiveDocument().getId();
  var doc = Docs.Documents.get(id);
  var res = DocsLisible.buildRequests(doc, options);
  var wc = { requiredRevisionId: doc.revisionId };
  DocsLisible.chunk(res.requests, 400).forEach(function (part) {
    var r = Docs.Documents.batchUpdate({ requests: part, writeControl: wc }, id);
    if (r.writeControl && r.writeControl.requiredRevisionId) wc = { requiredRevisionId: r.writeControl.requiredRevisionId };
  });
  return res.stats;
}
