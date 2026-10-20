/* ===== Figuras, histórico (desfazer/refazer), salvar e abrir ===== */
const H = {stack:[], idx:-1}, KEY = 'geometria:projeto:v2';
const dump = () => JSON.stringify({v:3, figs:S.figs, sel:S.figs.indexOf(S.sel)});
function persist(s) { try { localStorage.setItem(KEY, s); } catch (_) {} }
function syncHistoryBtns() { $('#undo').disabled = H.idx <= 0; $('#redo').disabled = H.idx >= H.stack.length - 1; }

function commit() {                                      // chame depois de cada mudança concluída
  const s = dump(); if (H.stack[H.idx] === s) return;
  H.stack = H.stack.slice(0, H.idx + 1); H.stack.push(s);
  if (H.stack.length > 100) H.stack.shift();
  H.idx = H.stack.length - 1; persist(s); syncHistoryBtns();
}

/* Confere se os dados de uma figura são seguros antes de usar (arquivos quebrados não derrubam o programa) */
const vec3 = a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
function sane(f) {
  if (!f || !Array.isArray(f.verts) || !f.verts.every(vec3)) return false;
  const n = f.verts.length, ok = i => Number.isInteger(i) && i >= 0 && i < n;
  if (f.faces && !(Array.isArray(f.faces) && f.faces.every(fc => Array.isArray(fc) && fc.length > 2 && fc.every(ok)))) return false;
  if (f.extra && !(Array.isArray(f.extra) && f.extra.every(p => Array.isArray(p) && p.length === 2 && p.every(ok)))) return false;
  if (f.pos && !vec3(f.pos)) return false;
  if (f.rot && !vec3(f.rot)) return false;
  return true;
}
function loadData(s) {
  const d = JSON.parse(s);
  if (!d || !Array.isArray(d.figs) || !d.figs.every(sane)) throw new Error('arquivo inválido');
  S.figs = d.figs.map((f, i) => {
    const o = mkFig(f, i);
    if (o.type && !SHAPES[o.type]) { o.type = null; o.edited = true; }   // forma que não existe mais no catálogo
    return o;
  });
  S.sel = S.figs[d.sel] || S.figs[0] || null; S.selV = null; S.pending = []; S.hover = null; infoSig = ''; refreshAll();
}
function undo() { if (H.idx <= 0) return toast('Nada para desfazer'); H.idx--; loadData(H.stack[H.idx]); persist(H.stack[H.idx]); syncHistoryBtns(); toast('Desfeito'); }
function redo() { if (H.idx >= H.stack.length - 1) return toast('Nada para refazer'); H.idx++; loadData(H.stack[H.idx]); persist(H.stack[H.idx]); syncHistoryBtns(); toast('Refeito'); }

function saveFile() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([dump()], {type:'application/json'})); a.download = 'geometria.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Projeto salvo em geometria.json');
}
function openFile(file) {
  const r = new FileReader();
  r.onload = () => { try { loadData(r.result); H.stack = []; H.idx = -1; commit(); toast('Projeto aberto'); } catch (_) { toast('Arquivo inválido'); } };
  r.readAsText(file);
}

/* ----- Operações nas figuras ----- */
function addFig(o) {
  const f = mkFig(o, S.figs.length);
  S.figs.push(f); select(f); commit(); return f;
}
function addShape(key) {
  const sh = SHAPES[key], p = {}; sh.params.forEach(q => p[q.k] = q.def);
  return addFig({nome:sh.nome, type:key, params:p, ...sh.make(p)});
}
function select(f) { S.sel = f; S.selV = null; S.pending = []; S.hover = null; infoSig = ''; refreshAll(); }
function removeSel() {
  if (!S.sel) return;
  S.figs = S.figs.filter(f => f !== S.sel); select(S.figs[S.figs.length - 1] || null); commit(); toast('Figura excluída');
}
function duplicateSel() {
  if (!S.sel) return;
  const c = JSON.parse(JSON.stringify(S.sel)); c.nome += ' (cópia)'; c.pos = [c.pos[0] + 2, c.pos[1], c.pos[2] + 2]; c.hue = (c.hue + .13) % 1;
  S.figs.push(c); select(c); commit(); toast('Figura duplicada');
}
function clearAll() { if (!confirm('Apagar todas as figuras?')) return; S.figs = []; select(null); commit(); }