/* ===== Painéis laterais, barra de ferramentas e inicialização ===== */
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const xyz = (kind, nome, a) => `<div class="row"><span>${nome}</span>` +
  [0, 1, 2].map(j => `<input type="number" step="${kind === 'rot' ? 15 : 0.5}" data-t="${kind}" data-j="${j}" title="${'XYZ'[j]}" value="${a[j]}">`).join('') + '</div>';
const vertWorld = f => toWorld(f, f.verts[S.selV]).toArray().map(r3);

function refreshAll() { renderList(); renderParams(); build(); $('#empty').hidden = S.figs.length > 0; }
function hintReset() { $('#hint').textContent = TOOLS.find(t => t[0] === S.tool)[2]; }

/* ----- Lista de figuras ----- */
function renderList() {
  $('#figList').innerHTML = S.figs.map((f, i) => `<li data-i="${i}" class="${f === S.sel ? 'on' : ''} ${f.hidden ? 'off' : ''}">
    <i style="background:hsl(${Math.round(f.hue * 360)} 65% 52%)"></i><span class="nm">${esc(f.nome)}</span>
    <button data-a="eye" title="Mostrar/ocultar">${f.hidden ? '◌' : '●'}</button>
    <button data-a="dup" title="Duplicar">⧉</button><button data-a="del" title="Excluir">✕</button></li>`).join('')
    || '<li class="mute">Nenhuma figura ainda.</li>';
}
$('#figList').onclick = e => {
  const li = e.target.closest('li[data-i]'); if (!li) return;
  const f = S.figs[+li.dataset.i], a = e.target.dataset.a;
  if (a === 'eye') { f.hidden = !f.hidden; renderList(); build(); commit(); }
  else if (a === 'dup') { select(f); duplicateSel(); }
  else if (a === 'del') { select(f); removeSel(); }
  else select(f);
};

/* ----- Figura selecionada ----- */
function renderParams() {
  const el = $('#params'), f = S.sel;
  if (!f) { el.innerHTML = '<p class="mute">Nenhuma figura selecionada. Adicione uma ou clique em uma.</p>'; return; }
  let h = `<label class="row"><span>Nome</span><input type="text" id="nm" value="${esc(f.nome)}"></label>`
    + xyz('pos', 'Posição', f.pos) + xyz('rot', 'Rotação (°)', f.rot)
    + `<div class="rowb"><button data-r="0" title="Gira 90° em torno de X">↻ X 90°</button><button data-r="1" title="Gira 90° em torno de Y (vertical)">↻ Y 90°</button><button data-r="2" title="Gira 90° em torno de Z (deita um prisma em pé)">↻ Z 90°</button></div>`
    + `<div class="rowb2"><button id="rest">Apoiar no chão</button><button id="zero">Zerar giro</button></div>`;
  if (S.selV !== null && f.verts[S.selV]) h += xyz('v', 'Vértice ' + vname(S.selV), vertWorld(f));
  if (f.type && !f.edited) h += SHAPES[f.type].params.map(q => `<label class="row"><span>${q.label}</span>
    <input type="number" data-k="${q.k}" min="${q.min}" max="${q.max}" step="${q.step}" value="${f.params[q.k]}"></label>`).join('');
  else h += '<p class="mute">Figura editada à mão: os parâmetros automáticos não se aplicam mais.</p>';
  if (f.faces.length === 1) h += '<label class="row"><span>Altura</span><input id="exh" type="number" value="3" step="0.5"></label><button id="ext">Extrudar em prisma</button>';
  el.innerHTML = h;

  const done = () => commit(), all = k => [...el.querySelectorAll(`[data-t=${k}]`)];
  $('#nm').oninput = e => { f.nome = e.target.value; renderList(); }; $('#nm').onchange = done;
  el.querySelectorAll('[data-k]').forEach(i => {
    i.oninput = () => { const v = parseFloat(i.value); if (!(v > 0)) return; f.params[i.dataset.k] = v; Object.assign(f, SHAPES[f.type].make(f.params)); f.extra = []; build(); };
    i.onchange = done;
  });
  all('pos').forEach(i => {
    i.oninput = () => { const v = parseFloat(i.value); if (isNaN(v)) return; f.pos[+i.dataset.j] = v; build(); };
    i.onchange = done;
  });
  all('rot').forEach(i => {
    i.oninput = () => { const r = all('rot').map(x => parseFloat(x.value)); if (r.some(isNaN)) return; setRot(f, r); build(); syncPos(); };
    i.onchange = () => { if (S.view.apoiar) restOnGround(f); commit(); build(); syncPos(); };
  });
  all('v').forEach(i => {
    i.oninput = () => {
      const w = all('v').map(x => parseFloat(x.value)); if (w.some(isNaN) || S.selV === null || !f.verts[S.selV]) return;
      f.verts[S.selV] = toLocal(f, new THREE.Vector3(...w)).toArray().map(r3); f.edited = true; build();
    };
    i.onchange = done;
  });
  el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    rotateWorld(f, +b.dataset.r, Math.PI / 2); if (S.view.apoiar) restOnGround(f); commit(); renderParams(); build();
  });
  $('#rest').onclick = () => { restOnGround(f); commit(); renderParams(); build(); toast('Figura apoiada no chão'); };
  $('#zero').onclick = () => { setRot(f, [0, 0, 0]); if (S.view.apoiar) restOnGround(f); commit(); renderParams(); build(); };
  if ($('#ext')) $('#ext').onclick = () => {
    const hh = parseFloat($('#exh').value) || 3, fc = f.faces[0], V = f.verts, n = V.length;
    const nn = cross(sub(V[fc[1]], V[fc[0]]), sub(V[fc[2]], V[fc[0]])), l = len(nn); if (!l) return toast('Não deu para extrudar essa face');
    const o = nn.map(x => x / l * hh);
    f.verts = [...V, ...V.map(v => v.map((x, j) => r3(x + o[j])))];
    f.faces = [fc, fc.map(i => i + n), ...fc.map((a, i) => { const b = fc[(i + 1) % fc.length]; return [a, b, b + n, a + n]; })];
    f.edited = true; commit(); renderParams(); build(); toast('Prisma criado');
  };
}
function syncPos() {                                     // atualiza os campos enquanto arrasta ou gira
  const f = S.sel; if (!f) return;
  document.querySelectorAll('#params [data-t]').forEach(i => {
    const k = i.dataset.t;
    const a = k === 'pos' ? f.pos : k === 'rot' ? f.rot : (S.selV !== null && f.verts[S.selV] ? vertWorld(f) : null);
    if (a && document.activeElement !== i) i.value = a[+i.dataset.j];
  });
}

/* ----- Informações calculadas ----- */
function refreshInfo() {
  const f = S.sel, out = $('#infoOut'), chk = $('#infoChk');
  if (!f) { chk.innerHTML = out.innerHTML = ''; infoSig = ''; return; }
  const m = measures(f), keys = Object.keys(m), s = keys.join();
  if (s !== infoSig) {
    infoSig = s;
    chk.innerHTML = keys.map(k => `<label><input type="checkbox" data-i="${k}" ${S.hidden.has(k) ? '' : 'checked'}>${INFO[k][0]}</label>`).join('');
  }
  out.innerHTML = keys.filter(k => !S.hidden.has(k)).map(k => `<div><dt>${INFO[k][0]}</dt><dd>${fmt(m[k])} <small>${INFO[k][1]}</small></dd></div>`).join('');
}
$('#infoChk').onchange = e => { e.target.checked ? S.hidden.delete(e.target.dataset.i) : S.hidden.add(e.target.dataset.i); refreshInfo(); };

/* ----- Guia de uso ----- */
function openHelp() { $('#help').hidden = false; }
function closeHelp() { $('#help').hidden = true; try { localStorage.setItem('geometria:visto', '1'); } catch (_) {} }
function toggleHelp() { $('#help').hidden ? openHelp() : closeHelp(); }
$('#helpBtn').onclick = toggleHelp;
$('#help').onclick = e => { if (e.target.id === 'help' || e.target.hasAttribute('data-close')) closeHelp(); };

/* ----- Montagem da interface ----- */
$('#shapeSel').innerHTML = Object.entries(SHAPES).map(([k, s]) => `<option value="${k}">${s.nome}</option>`).join('');
$('#addBtn').onclick = () => addShape($('#shapeSel').value);
$('#tools').innerHTML = TOOLS.map(([id, nome, dica], i) =>
  `<label title="${dica}"><input type="radio" name="tool" value="${id}" ${i ? '' : 'checked'}><span>${nome}</span><kbd>${i + 1}</kbd></label>`).join('');
$('#tools').onchange = e => { S.tool = e.target.value; S.pending = []; S.hover = null; hintReset(); build(); };
$('#views').innerHTML = VIEWS.map(([id, nome]) => `<label><input type="checkbox" data-v="${id}" ${S.view[id] ? 'checked' : ''}>${nome}</label>`).join('');
$('#views').onchange = e => { S.view[e.target.dataset.v] = e.target.checked; build(); };
$('#nav').textContent = 'W A S D andar · Q / E descer / subir · Shift correr · arraste no vazio para olhar · scroll avança · F focar · R início · H ajuda';
$('#undo').onclick = undo; $('#redo').onclick = redo; $('#home').onclick = resetCam; $('#focus').onclick = focusSel;
document.querySelectorAll('#camBar [data-cam]').forEach(b => b.onclick = () => setView(b.dataset.cam));
$('#saveBtn').onclick = saveFile; $('#clearBtn').onclick = clearAll;
$('#openBtn').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = e => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; };
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });   // evita que Espaço aperte o último botão

/* ----- Início ----- */
resetCam(); hintReset();
let saved = null; try { saved = localStorage.getItem(KEY); } catch (_) {}
if (saved) { try { loadData(saved); } catch (_) { saved = null; } }
if (!saved) { addShape('prisma'); addShape('retangulo'); select(S.figs[0]); }
H.stack = []; H.idx = -1; commit();
try { if (!localStorage.getItem('geometria:visto')) openHelp(); } catch (_) { openHelp(); }