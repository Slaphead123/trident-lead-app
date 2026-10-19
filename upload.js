/* Upload logos and photos from the phone to the PRIVATE lead-uploads repo with a separate, single-repo write token kept only on this phone.
   Images are shrunk on the phone first. Files land at <slug>/logo.png or <slug>/photo-<time>.jpg. Nothing is published anywhere. */
const UPREPO = 'Slaphead123/lead-uploads', $ = id => document.getElementById(id);
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('tla', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const kvGet = async k => { const d = await idb(); return new Promise(res => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); };
const kvSet = async (k, v) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
const kvDel = async k => { const d = await idb(); return new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; }); };
let TOKEN = '', files = [];

const gh = (path, opt = {}) => fetch(`https://api.github.com/repos/${UPREPO}/${path}`, { ...opt, headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opt.headers || {}) } });

async function shrink(file, kind) {
  const max = kind === 'logo' ? 900 : 1800, png = kind === 'logo' && /png|svg|webp/.test(file.type);
  const bmp = await createImageBitmap(file), s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.86));
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  return { b64, ext: png ? 'png' : 'jpg', url: URL.createObjectURL(blob) };
}
const say = (t, cls = '') => { const p = document.createElement('p'); p.className = cls; p.textContent = t; $('log').prepend(p); };

async function put(slug, name, b64, msg) {
  const path = `${encodeURIComponent(slug)}/${name}`;
  let sha; const ex = await gh('contents/' + path);
  if (ex.ok) sha = (await ex.json()).sha;
  const r = await gh('contents/' + path, { method: 'PUT', body: JSON.stringify({ message: msg, content: b64, sha }) });
  if (!r.ok) throw new Error(r.status === 404 ? 'Repo lead-uploads not found, or the key cannot write to it.' : r.status === 401 || r.status === 403 ? 'GitHub refused the key. Check it can write Contents on lead-uploads.' : 'GitHub error ' + r.status);
}

async function loadBiz() {
  const sel = $('biz'); sel.innerHTML = '<option value="">Choose a business</option>';
  try {
    const r = await fetch('data/design_gate.json'); if (!r.ok) throw 0; const g = await r.json();
    Object.entries(g).map(([slug, v]) => [slug, (v && v.name) || slug]).sort((a, b) => a[1].localeCompare(b[1])).forEach(([slug, n]) => sel.add(new Option(n, slug)));
  } catch (e) { sel.innerHTML = '<option value="">Could not load the list (open the lead cards once first)</option>'; }
}
const refresh = () => { $('up').disabled = !($('biz').value && files.length && $('rt').checked); };

async function init() {
  const cfg = await kvGet('upl'); TOKEN = cfg && cfg.token || '';
  $('setup').hidden = !!TOKEN; $('form').hidden = !TOKEN; if (TOKEN) loadBiz();
}
$('save').onclick = async () => {
  const t = $('tok').value.trim(), e = $('se'); e.textContent = '';
  if (!/^(github_pat_|ghp_)/.test(t)) { e.textContent = 'That does not look like a GitHub token. It starts with github_pat_.'; return; }
  TOKEN = t; const r = await gh('contents/').catch(() => null);
  if (!r || (!r.ok && r.status !== 404)) { e.textContent = 'GitHub did not accept that key for lead-uploads.'; TOKEN = ''; return; }
  await kvSet('upl', { token: t }); init();
};
$('chg').onclick = async e => { e.preventDefault(); await kvDel('upl'); TOKEN = ''; init(); };
$('biz').onchange = refresh; $('rt').onchange = refresh;
$('f').onchange = () => { files = [...$('f').files]; $('pv').innerHTML = ''; files.slice(0, 8).forEach(f => { const i = new Image(); i.alt = ''; i.src = URL.createObjectURL(f); $('pv').append(i); }); refresh(); };
$('up').onclick = async () => {
  const slug = $('biz').value, name = $('biz').selectedOptions[0].text, kind = document.querySelector('input[name=k]:checked').value, b = $('up'); b.disabled = true;
  try {
    const list = kind === 'logo' ? files.slice(0, 1) : files;
    for (const f of list) {
      const s = await shrink(f, kind), fn = kind === 'logo' ? 'logo.' + s.ext : `photo-${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
      await put(slug, fn, s.b64, `${kind} for ${name}; rights confirmed on phone`); say(`Uploaded ${kind} for ${name}`, 'ok');
    }
    files = []; $('f').value = ''; $('pv').innerHTML = ''; $('rt').checked = false;
  } catch (e) { say(e.message || 'Upload failed', 'err'); }
  refresh();
};
init();
