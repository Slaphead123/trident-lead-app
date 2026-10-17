/* Stands in for the Claude artifact runtime (claude.use('db') / claude.use('downloads')) so the cards page runs as a normal app.
   Reply tracking, notes and checklist ticks are saved in this phone's localStorage. */
(function () {
  const P = 'tla:', subs = {};
  const load = c => { try { return JSON.parse(localStorage.getItem(P + c) || '{}'); } catch (e) { return {}; } };
  const save = (c, o) => { try { localStorage.setItem(P + c, JSON.stringify(o)); } catch (e) {} };
  const snap = c => { const o = load(c); return { docs: Object.keys(o).map(id => ({ id, data: () => o[id] })) }; };
  const later = f => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => setTimeout(f, 0)) : setTimeout(f, 0);
  const on = (k, f) => { (subs[k] = subs[k] || []).push(f); later(f); return () => { subs[k] = (subs[k] || []).filter(x => x !== f); }; };
  const emit = (c, id) => { (subs[c] || []).slice().forEach(f => f()); (subs[c + '/' + id] || []).slice().forEach(f => f()); };
  const docRef = (c, id) => ({
    set: async d => { const o = load(c); o[id] = JSON.parse(JSON.stringify(d)); save(c, o); emit(c, id); },
    get: async () => { const v = load(c)[id]; return { id, exists: v !== undefined, data: () => v }; },
    onSnapshot: fn => on(c + '/' + id, () => { const v = load(c)[id]; fn({ id, exists: v !== undefined, data: () => v }); })
  });
  const db = { collection: c => ({ onSnapshot: fn => on(c, () => fn(snap(c))), doc: id => docRef(c, id) }), doc: p => { const [c, id] = p.split('/'); return docRef(c, id); } };
  const downloads = { save: async ({ filename, data }) => { const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])), a = document.createElement('a'); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 3000); } };
  window.claude = { use: async n => n === 'db' ? db : n === 'downloads' ? downloads : null };
})();
