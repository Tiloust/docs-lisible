importScripts('core.js');

function getToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (t) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(typeof t === 'string' ? t : t.token);
    });
  });
}
function dropToken(t) { return new Promise((r) => chrome.identity.removeCachedAuthToken({ token: t }, r)); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(url, token, body) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (i + 1)); continue; }
    return res;
  }
  throw new Error('Google est surchargé, réessaie dans une minute.');
}

async function run(docId, options) {
  let token = await getToken(true);
  const base = 'https://docs.googleapis.com/v1/documents/' + docId;
  let res = await call(base, token);
  if (res.status === 401) { await dropToken(token); token = await getToken(true); res = await call(base, token); }
  if (!res.ok) throw new Error('Lecture impossible (' + res.status + ')');
  const doc = await res.json();
  const out = self.DocsLisible.buildRequests(doc, options);
  let wc = { requiredRevisionId: doc.revisionId };
  for (const part of self.DocsLisible.chunk(out.requests, 400)) {
    const r = await call(base + ':batchUpdate', token, { requests: part, writeControl: wc });
    if (!r.ok) {
      const e = await r.text();
      throw new Error(r.status === 400 && e.includes('revision') ? 'Le document a changé pendant l\'opération, relance.' : 'Écriture impossible (' + r.status + ')');
    }
    const j = await r.json();
    if (j.writeControl && j.writeControl.requiredRevisionId) wc = { requiredRevisionId: j.writeControl.requiredRevisionId };
  }
  return out.stats;
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg && msg.type === 'format') {
    run(msg.docId, msg.options).then((stats) => send({ ok: true, stats })).catch((e) => send({ ok: false, error: String(e.message || e) }));
    return true;
  }
});
