/* Trident Lead Cards: service worker.
   Serves /data/* from the PRIVATE lead-finder repo on GitHub using a read-only token that lives only on this phone (IndexedDB).
   Nothing about any lead is stored in this public app repo. Network first, cached copy when offline. */
const SHELL = 'tla-shell-v4', DATA = 'tla-data-v1';
const SHELL_FILES = ['./', 'index.html', 'cardup.js', 'shim.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const DEFAULT_REPO = 'Slaphead123/lead-finder', RESULTS_DIR = 'results';

const idb = () => new Promise((res, rej) => { const r = indexedDB.open('tla', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const kvGet = async k => { const d = await idb(); return new Promise(res => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); };

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil((async () => { for (const k of await caches.keys()) if (![SHELL, DATA].includes(k)) await caches.delete(k); await self.clients.claim(); })()); });

const HEAD_INJECT = shim => `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Lead Cards"><link rel="manifest" href="../manifest.webmanifest"><link rel="apple-touch-icon" href="../icon-180.png"><link rel="icon" href="../icon-192.png">
<style>[hidden]{display:none!important}img{max-width:100%}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}</style><script>${shim}</script><script defer src="../cardup.js"></script>`;

let shimText = null;
async function getShim() { if (!shimText) shimText = await (await fetch(new URL('shim.js', self.registration.scope))).text(); return shimText; }

const page = (title, body) => new Response(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title><body style="font:16px/1.5 system-ui;background:#07182b;color:#e8ecf1;padding:24px;max-width:480px;margin:auto"><h2>${title}</h2>${body}<p><a style="color:#6ff2e0" href="../">Back to setup</a></p>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

async function upstream(path, cfg) {
  if (cfg.base) return fetch(cfg.base.replace(/\/?$/, '/') + path);                           // test mode only
  const url = `https://api.github.com/repos/${cfg.repo || DEFAULT_REPO}/contents/${RESULTS_DIR}/${path.split('/').map(encodeURIComponent).join('/')}`;
  return fetch(url, { headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' } });
}

async function handleData(req, rel) {
  const cfg = await kvGet('cfg');
  if (!cfg || (!cfg.token && !cfg.base)) return Response.redirect(new URL('../', req.url).href, 302);
  const path = rel || 'lead_cards.html', isPage = path === 'lead_cards.html', cache = await caches.open(DATA);
  let res = null;
  try { res = await upstream(path, cfg); } catch (e) { res = null; }
  if (res && res.ok) {
    cache.put(req.url, res.clone());
  } else {
    const hit = await cache.match(req.url);
    if (hit) res = hit;
    else if (res && (res.status === 401 || res.status === 403)) return isPage ? page('Token not accepted', '<p>GitHub refused the token. Check it has read access to Contents on the lead-finder repo and has not expired, then paste a new one.</p>') : new Response('', { status: res.status });
    else if (res && res.status === 404) return isPage ? page('No cards yet', '<p>The lead-finder repo has no <code>results/lead_cards.html</code> yet. Run the weekly pipeline once, then open this again.</p>') : new Response('', { status: 404 });
    else return isPage ? page('You are offline', '<p>No saved copy of the cards on this phone yet. Open the app once with a connection.</p>') : new Response('', { status: 504 });
  }
  if (!isPage) return res;
  const html = await res.text(), shim = await getShim();
  return new Response(HEAD_INJECT(shim) + html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url), scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const rel = decodeURIComponent(url.pathname.slice(scope.pathname.length));
  if (rel.startsWith('data/')) return e.respondWith(handleData(req, rel.slice(5)));
  if (req.mode === 'navigate' && (rel === '' || rel === 'index.html') && !url.search) {
    return e.respondWith((async () => { const cfg = await kvGet('cfg'); if (cfg && (cfg.token || cfg.base)) return Response.redirect(new URL('data/lead_cards.html', scope).href, 302); return (await caches.match('index.html')) || fetch(req); })());
  }
  e.respondWith(caches.match(req).then(h => h || fetch(req)));
});
