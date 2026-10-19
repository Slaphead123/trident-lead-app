/* Per-card upload for the Lead Cards page (loaded by the service worker into the cards page).
   Choose the logo and photos together; the app guesses the logo and you can change it. Files go to uploads/<business>/ in the private lead-finder repo using the
   same key the app already holds (it needs Contents: Read and write). A push there rebuilds that design automatically; pull down to reload in a few minutes. */
(function () {
  var UPREPO = 'Slaphead123/lead-finder';
  var idb = function () { return new Promise(function (res, rej) { var r = indexedDB.open('tla', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); };
  var kvGet = function (k) { return idb().then(function (d) { return new Promise(function (res) { var q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(undefined); }; }); }); };
  var kvSet = function (k, v) { return idb().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = function () { rej(t.error); }; }); }); };
  var kvDel = function (k) { return idb().then(function (d) { return new Promise(function (res) { var t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; }); }); };
  var gh = function (repo, tok, path, opt) { opt = opt || {}; return fetch('https://api.github.com/repos/' + repo + '/' + path, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opt.headers || {}) })); };

  var css = document.createElement('style');
  css.textContent = '.upr{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 2px}.upr button{font:600 14px system-ui;padding:10px 14px;min-height:44px;border-radius:99px;border:1px solid #6ff2e0;background:transparent;color:#6ff2e0;cursor:pointer}.upr .ups{font:13px system-ui;opacity:.8}'
    + '#upm{position:fixed;inset:0;z-index:100;background:rgba(3,10,18,.86);display:none;overflow:auto;padding:max(16px,env(safe-area-inset-top,0px)) 16px max(24px,env(safe-area-inset-bottom,0px))}#upm.on{display:block}'
    + '#upm .pn{max-width:460px;margin:0 auto;background:#0d2a40;color:#e8ecf1;border:1px solid #1d4258;border-radius:16px;padding:16px;font:16px/1.5 system-ui}#upm h2{font-size:1.15rem;margin:0 0 4px}#upm .m{color:#9fb2c4;font-size:14px;margin:4px 0}#upm a{color:#6ff2e0}'
    + '#upm input[type=password]{width:100%;font:inherit;padding:14px;border-radius:12px;border:1px solid #1d4258;background:#081f33;color:#e8ecf1;margin:8px 0}#upm .go{display:block;width:100%;font:700 16px system-ui;padding:14px;border:0;border-radius:99px;background:#6ff2e0;color:#06202a;min-height:48px;margin-top:10px;cursor:pointer}#upm .go[disabled]{opacity:.45}#upm .x{background:transparent;border:1px solid #1d4258;color:#e8ecf1}'
    + '#upm .pick{display:block;text-align:center;border:1.5px dashed #1d4258;border-radius:14px;padding:18px;min-height:56px;cursor:pointer;margin:10px 0}#upm .pick input{display:none}'
    + '#upm .th{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}#upm .t{position:relative;border:2px solid #1d4258;border-radius:10px;overflow:hidden;aspect-ratio:1;background:#081f33}#upm .t.lg{border-color:#6ff2e0}#upm .t img{width:100%;height:100%;object-fit:contain}#upm .t button{position:absolute;left:4px;right:4px;bottom:4px;font:700 12px system-ui;padding:8px 4px;min-height:36px;border:0;border-radius:99px;background:rgba(3,10,18,.85);color:#e8ecf1;cursor:pointer}#upm .t.lg button{background:#6ff2e0;color:#06202a}'
    + '#upm .chk{display:flex;gap:10px;align-items:flex-start;margin:10px 0}#upm .chk input{width:22px;height:22px;margin-top:3px}#upm .ok{color:#8ef5b0}#upm .er{color:#ff9b9b}';
  document.head.appendChild(css);

  var modal = document.createElement('div'); modal.id = 'upm'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); document.body.appendChild(modal);
  var cur = null, files = [], logoIx = -1, TOKEN = '';

  function guessLogo(items) {   // small, square-ish or transparent images and files named logo are probably the logo
    var best = -1, bs = 0;
    items.forEach(function (it, i) { var s = 0, f = it.file, r = it.w / it.h;
      if (/logo/i.test(f.name)) s += 3; if (/png|svg/.test(f.type)) s += 1.5; if (r > 0.4 && r < 3.2) s += 0.5; if (Math.max(it.w, it.h) <= 900) s += 1; if (f.size < 250000) s += 1;
      if (s > bs) { bs = s; best = i; } });
    return bs >= 3 ? best : -1;
  }
  async function shrink(file, logo) {
    var max = logo ? 900 : 1800, png = logo && /png|svg|webp/.test(file.type), bmp = await createImageBitmap(file), s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    var c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    var blob = await new Promise(function (r) { c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.86); });
    var b64 = await new Promise(function (r) { var fr = new FileReader(); fr.onload = function () { r(String(fr.result).split(',')[1]); }; fr.readAsDataURL(blob); });
    return { b64: b64, ext: png ? 'png' : 'jpg' };
  }
  async function put(slug, name, b64, msg) {
    var path = 'contents/uploads/' + encodeURIComponent(slug) + '/' + name, sha, ex = await gh(UPREPO, TOKEN, path); if (ex.ok) sha = (await ex.json()).sha;
    var r = await gh(UPREPO, TOKEN, path, { method: 'PUT', body: JSON.stringify({ message: msg, content: b64, sha: sha }) });
    if (!r.ok) throw new Error((r.status === 401 || r.status === 403 || r.status === 404) ? 'Your saved key can only read. Open the app link with ?reset on the end and paste a key with Contents: Read and write on lead-finder.' : 'GitHub error ' + r.status);
  }
  var h = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  async function open(slug, name, statusEl) {
    cur = { slug: slug, name: name, el: statusEl }; files = []; logoIx = -1;
    var cfg = await kvGet('cfg'); TOKEN = (cfg && cfg.token) || ''; modal.classList.add('on'); render();
  }
  function close() { modal.classList.remove('on'); modal.innerHTML = ''; }
  function render(msg, cls) {
    if (!TOKEN) { modal.innerHTML = '<div class="pn"><h2>Key needed</h2><p class="m">Open the app link with <b>?reset</b> on the end and paste your key first.</p><button class="go" id="upc">Close</button></div>'; modal.querySelector('#upc').onclick = close; return; }
    var th = files.map(function (it, i) { return '<div class="t' + (i === logoIx ? ' lg' : '') + '"><img alt="" src="' + it.url + '"><button data-i="' + i + '">' + (i === logoIx ? 'Logo' : 'Photo') + '</button></div>'; }).join('');
    modal.innerHTML = '<div class="pn"><h2>' + h(cur.name) + '</h2><p class="m">Pick the logo and photos together. Tap a picture to mark it as the logo (only one).</p>'
      + '<label class="pick"><input id="upf" type="file" accept="image/*" multiple>Tap to choose from your photos or camera</label><div class="th">' + th + '</div>'
      + (files.length ? '<p class="m">' + (logoIx >= 0 ? '1 logo, ' + (files.length - 1) + ' photo' + (files.length - 1 === 1 ? '' : 's') : 'No logo marked, ' + files.length + ' photo' + (files.length === 1 ? '' : 's')) + '</p>' : '')
      + '<label class="chk"><input id="upr" type="checkbox"><span class="m">I have the right to use these: the business gave them to me, or I took them. Not copied from their website or Facebook.</span></label>'
      + '<button class="go" id="upg" disabled>Upload</button><button class="go x" id="upc">Close</button><p class="' + (cls || 'm') + '" id="upm2" role="status" aria-live="polite">' + h(msg || '') + '</p></div>';
    var go = modal.querySelector('#upg'), rt = modal.querySelector('#upr'), sync = function () { go.disabled = !(files.length && rt.checked); }; rt.onchange = sync;
    modal.querySelector('#upc').onclick = close;
    modal.querySelector('#upf').onchange = async function (e) {
      var list = Array.prototype.slice.call(e.target.files), items = [];
      for (var i = 0; i < list.length; i++) { try { var b = await createImageBitmap(list[i]); items.push({ file: list[i], url: URL.createObjectURL(list[i]), w: b.width, h: b.height }); } catch (x) {} }
      files = files.concat(items); logoIx = logoIx >= 0 ? logoIx : guessLogo(files); render(); };
    modal.querySelectorAll('.t button').forEach(function (b) { b.onclick = function () { var i = +b.dataset.i; logoIx = logoIx === i ? -1 : i; render(); }; });
    rt.checked = false;
    go.onclick = async function () {
      go.disabled = true; var done = 0, n = files.length;
      try {
        for (var i = 0; i < files.length; i++) { var isL = i === logoIx, s = await shrink(files[i].file, isL);
          await put(cur.slug, isL ? 'logo.' + s.ext : 'photo-' + Date.now() + '-' + i + '.jpg', s.b64, (isL ? 'logo' : 'photo') + ' for ' + cur.name + '; rights confirmed on phone'); done++;
          modal.querySelector('#upm2').textContent = 'Uploaded ' + done + ' of ' + n + '…'; }
        cur.el.textContent = 'Uploaded. The design rebuilds by itself; pull down to reload in a few minutes.';
        files = []; logoIx = -1; render('Done. ' + done + ' file' + (done === 1 ? '' : 's') + ' uploaded. The design rebuilds by itself; pull down to reload in a few minutes.', 'ok');
      } catch (e) { render((e && e.message) || 'Upload failed', 'er'); }
    };
  }

  document.querySelectorAll('section[data-slug]').forEach(function (sec) {
    var row = document.createElement('div'); row.className = 'upr';
    var up = document.createElement('button'); up.type = 'button'; up.textContent = 'Add logo + photos';
    var st = document.createElement('span'); st.className = 'ups'; st.setAttribute('role', 'status');
    up.onclick = function () { open(sec.dataset.slug, sec.dataset.name || sec.dataset.slug, st); };
    row.appendChild(up); row.appendChild(st);
    var img = sec.querySelector('img.shot'); if (img && img.parentNode === sec) img.insertAdjacentElement('afterend', row); else sec.appendChild(row);
  });
})();
