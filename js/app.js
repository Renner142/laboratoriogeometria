/* ===== Estado ===== */
const S = {figs:[], sel:null, selV:null, tool:'mover', pending:[], hidden:new Set(),
  view:{grade:true, eixos:true, faces:true, arestas:true, vertices:true, snap:true}};
const VIEWS = [['grade','Grade XYZ'],['eixos','Eixos'],['faces','Faces'],['arestas','Arestas'],['vertices','Vértices'],['snap','Encaixar na grade (0,5)']];
const TOOLS = [
  ['mover','✥ Mover','Clique numa figura e arraste uma seta colorida: vermelha = X, verde = Y (altura), azul = Z'],
  ['vertice','◉ Vértice','Clique num vértice e arraste uma seta colorida para movê-lo'],
  ['aresta','╱ Aresta','Clique em dois vértices da mesma figura'],
  ['face','▱ Face','Clique nos vértices em ordem e aperte Enter'],
  ['ponto','＋ Ponto','Clique no chão para criar um vértice']
];
const AXC = ['#e5484d', '#30a46c', '#3e63dd'];   // cores dos eixos X, Y, Z
let sig = '';
const $ = s => document.querySelector(s);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const snap = v => S.view.snap ? Math.round(v * 2) / 2 : v;

/* ===== Cena ===== */
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
stage.appendChild(renderer.domElement);
const cv = renderer.domElement; cv.style.touchAction = 'none';
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, .1, 500);
camera.rotation.order = 'YXZ';
scene.add(new THREE.AmbientLight(0xffffff, .7));
const sun = new THREE.DirectionalLight(0xffffff, .7); sun.position.set(5, 10, 7); scene.add(sun);

const world = new THREE.Group(), grid = new THREE.Group(), axes = new THREE.Group();
const mkGrid = (size, step, col, op) => { const g = new THREE.GridHelper(size, size/step, col, col); g.material.transparent = true; g.material.opacity = op; return g; };
function label(t, c, pos) {
  const k = document.createElement('canvas'); k.width = k.height = 64;
  const x = k.getContext('2d'); x.fillStyle = c; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(k), depthTest:false}));
  s.position.set(...pos); s.scale.set(1.2, 1.2, 1); return s;
}
grid.add(mkGrid(60, 1, css('--line'), .55), mkGrid(60, 5, css('--mute'), .6)); grid.children[1].position.y = .002;
axes.add(new THREE.AxesHelper(12));
['X','Y','Z'].forEach((t, i) => axes.add(label(t, AXC[i], [i===0?12.9:0, i===1?12.9:0, i===2?12.9:0])));
scene.add(grid, axes, world);

/* ===== Câmera livre (WASD) ===== */
const cam = {pos:new THREE.Vector3(), yaw:0, pitch:0}, held = new Set();
function placeCam() { camera.position.copy(cam.pos); camera.rotation.set(cam.pitch, cam.yaw, 0); }
function resetCam() {
  cam.pos.set(10, 9, 14); cam.yaw = Math.atan2(cam.pos.x, cam.pos.z); cam.pitch = -Math.atan2(cam.pos.y, Math.hypot(cam.pos.x, cam.pos.z)); placeCam();
}
function fly(dt) {
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw); let dx = 0, dy = 0, dz = 0;
  if (held.has('w')) { dx -= sy; dz -= cy; }
  if (held.has('s')) { dx += sy; dz += cy; }
  if (held.has('d')) { dx += cy; dz -= sy; }
  if (held.has('a')) { dx -= cy; dz += sy; }
  if (held.has('e') || held.has(' ')) dy += 1;
  if (held.has('q') || held.has('c')) dy -= 1;
  const n = Math.hypot(dx, dy, dz); if (!n) return;
  const v = (held.has('shift') ? 24 : 8) * dt / n;
  cam.pos.x += dx * v; cam.pos.y += dy * v; cam.pos.z += dz * v; placeCam();
}
new ResizeObserver(() => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h); camera.aspect = w/h; camera.updateProjectionMatrix(); }).observe(stage);

/* ===== Setas de movimento (gizmo) ===== */
const gizmo = new THREE.Group(), gizmoHits = [];
[0, 1, 2].forEach(i => {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({color:AXC[i], depthTest:false, transparent:true});
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1, 8).translate(0, .5, 0), mat);
  const head  = new THREE.Mesh(new THREE.ConeGeometry(.11, .3, 12).translate(0, 1.15, 0), mat);
  const hit   = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 1.35, 6).translate(0, .7, 0), new THREE.MeshBasicMaterial({visible:false}));
  shaft.renderOrder = head.renderOrder = 999; hit.userData.axis = i;
  g.add(shaft, head, hit);
  if (i === 0) g.rotation.z = -Math.PI/2;
  if (i === 2) g.rotation.x = Math.PI/2;
  gizmo.add(g); gizmoHits.push(hit);
});
gizmo.visible = false; scene.add(gizmo);

function gizmoTarget() {                       // onde as setas aparecem (ou null)
  const f = S.sel; if (!f) return null;
  if (S.tool === 'mover') return new THREE.Vector3(...f.pos);
  if (S.tool === 'vertice' && S.selV !== null && f.verts[S.selV]) return new THREE.Vector3(...f.verts[S.selV]).add(new THREE.Vector3(...f.pos));
  return null;
}
let lastT = performance.now();
(function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now; fly(dt);
  const t = gizmoTarget(); gizmo.visible = !!t;
  if (t) { gizmo.position.copy(t); gizmo.scale.setScalar(Math.max(.4, camera.position.distanceTo(t) * .11)); }
  renderer.render(scene, camera);
})(performance.now());

/* ===== Desenho das figuras ===== */
let pickMeshes = [], pickHandles = [];
function build() {
  while (world.children.length) world.remove(world.children[0]);
  pickMeshes = []; pickHandles = [];
  grid.visible = S.view.grade; axes.visible = S.view.eixos;
  S.figs.forEach(f => {
    const g = new THREE.Group(); g.position.set(...f.pos);
    const col = new THREE.Color().setHSL(f.hue, .65, f === S.sel ? .52 : .68);
    if (f.faces.length) {
      const pos = [];
      f.faces.forEach(fc => { for (let i = 1; i < fc.length - 1; i++) [fc[0], fc[i], fc[i+1]].forEach(j => pos.push(...f.verts[j])); });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:col, side:THREE.DoubleSide, transparent:true, opacity:.7, visible:S.view.faces}));
      m.userData.fig = f; g.add(m); pickMeshes.push(m);
    }
    if (S.view.arestas) {
      const seg = [], seen = new Set();
      const add = (a, b) => { const k = a < b ? a+'-'+b : b+'-'+a; if (!seen.has(k)) { seen.add(k); seg.push(...f.verts[a], ...f.verts[b]); } };
      f.faces.forEach(fc => fc.forEach((a, i) => add(a, fc[(i+1) % fc.length])));
      f.extra.forEach(([a, b]) => add(a, b));
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({color:css(f === S.sel ? '--ink' : '--mute')})));
    }
    if (S.view.vertices || S.tool !== 'mover') f.verts.forEach((v, i) => {
      const pend = S.pending.some(p => p.f === f && p.i === i), chosen = f === S.sel && i === S.selV;
      const h = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), new THREE.MeshBasicMaterial({color:pend ? '#ff8a00' : chosen ? css('--accent') : css('--ink')}));
      if (chosen) h.scale.setScalar(1.5);
      h.position.set(...v); h.userData = {fig:f, i}; g.add(h); pickHandles.push(h);
    });
    world.add(g);
  });
  info();
}

/* ===== Figuras ===== */
function addFig(o) {
  const n = S.figs.length;
  const f = {nome:'Figura', type:null, params:null, hue:(.58 + n*.17) % 1, pos:[(n%3)*6 - 6, 0, Math.floor(n/3)*6], verts:[], faces:[], extra:[], edited:false, ...o};
  S.figs.push(f); select(f); return f;
}
function addShape(key) {
  const sh = SHAPES[key], p = {}; sh.params.forEach(q => p[q.k] = q.def);
  addFig({nome:sh.nome, type:key, params:p, ...sh.make(p)});
}
function select(f) { S.sel = f; S.selV = null; S.pending = []; sig = ''; renderParams(); build(); }
function removeSel() { S.figs = S.figs.filter(f => f !== S.sel); select(S.figs[S.figs.length-1] || null); }

/* ===== Mouse ===== */
const rc = new THREE.Raycaster();
function ray(e) {
  const r = cv.getBoundingClientRect();
  rc.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1, -(e.clientY-r.top)/r.height*2+1), camera);
  return rc.ray;
}
function pickGizmo(e) { if (!gizmo.visible) return null; ray(e); const h = rc.intersectObjects(gizmoHits)[0]; return h ? h.object.userData.axis : null; }
function pick(e) {
  ray(e);
  const h = rc.intersectObjects(pickHandles)[0]; if (h) return {fig:h.object.userData.fig, i:h.object.userData.i};
  const m = rc.intersectObjects(pickMeshes)[0]; return m ? {fig:m.object.userData.fig} : null;
}
function axisParam(e, O, ax) {                 // ponto do eixo mais próximo do raio do mouse
  const r = ray(e), D = new THREE.Vector3(); D.setComponent(ax, 1);
  const w = O.clone().sub(r.origin), b = D.dot(r.direction), dd = D.dot(w), ee = r.direction.dot(w), den = 1 - b*b;
  return den < 1e-4 ? 0 : (b*ee - dd) / den;
}
function addPoint(e) {
  const p = ray(e).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3()); if (!p) return;
  const f = S.sel || addFig({nome:'Figura livre', pos:[0, 0, 0]});
  f.verts.push([snap(p.x - f.pos[0]), 0, snap(p.z - f.pos[2])]); f.edited = true; build(); renderParams();
}
let drag = null;
cv.onpointerdown = e => {
  cv.setPointerCapture(e.pointerId);
  if (e.button !== 0) { drag = {look:true, x:e.clientX, y:e.clientY}; return; }
  const t = S.tool, ax = pickGizmo(e);
  if (ax !== null) {                           // começou a arrastar uma seta
    const f = S.sel, vert = t === 'vertice', O = gizmoTarget();
    drag = {ax, O, s0:axisParam(e, O, ax), f, vert, orig:vert ? [...f.verts[S.selV]] : [...f.pos]};
    return;
  }
  if (t === 'ponto') return addPoint(e);
  const hit = pick(e);
  if (hit && hit.i !== undefined && t === 'aresta') {
    const p = S.pending[0];
    if (!p || p.f !== hit.fig) { S.pending = [{f:hit.fig, i:hit.i}]; if (S.sel !== hit.fig) select(hit.fig); }
    else if (p.i !== hit.i) { hit.fig.extra.push([p.i, hit.i]); hit.fig.edited = true; S.pending = []; renderParams(); }
    return build();
  }
  if (hit && hit.i !== undefined && t === 'face') {
    if (S.pending.length && S.pending[0].f !== hit.fig) S.pending = [];
    S.pending.push({f:hit.fig, i:hit.i}); if (S.sel !== hit.fig) select(hit.fig);
    return build();
  }
  if (hit) {
    if (S.sel !== hit.fig) select(hit.fig);
    if (t === 'vertice') { S.selV = hit.i !== undefined ? hit.i : null; renderParams(); build(); }
    return;
  }
  drag = {look:true, x:e.clientX, y:e.clientY};   // clicou no vazio: olhar ao redor
};
cv.onpointermove = e => {
  if (!drag) {
    cv.style.cursor = pickGizmo(e) !== null ? 'pointer' : S.tool === 'ponto' ? 'crosshair' : pick(e) ? 'pointer' : 'default';
    return;
  }
  if (drag.look) {
    cam.yaw -= (e.clientX - drag.x) * .005;
    cam.pitch = Math.min(1.5, Math.max(-1.5, cam.pitch - (e.clientY - drag.y) * .005));
    drag.x = e.clientX; drag.y = e.clientY; return placeCam();
  }
  const n = snap(drag.orig[drag.ax] + axisParam(e, drag.O, drag.ax) - drag.s0);
  if (drag.vert) { drag.f.verts[S.selV][drag.ax] = n; drag.f.edited = true; } else drag.f.pos[drag.ax] = n;
  build(); syncPos();
};
cv.onpointerup = () => { drag = null; };
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const cp = Math.cos(cam.pitch), f = new THREE.Vector3(-Math.sin(cam.yaw)*cp, Math.sin(cam.pitch), -Math.cos(cam.yaw)*cp);
  cam.pos.addScaledVector(f, -e.deltaY * .02); placeCam();
}, {passive:false});
stage.oncontextmenu = e => e.preventDefault();   // sem menu do navegador

/* ===== Teclado ===== */
addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.ctrlKey || e.metaKey) return;
  const k = e.key.toLowerCase(); held.add(k);
  if (k === ' ') e.preventDefault();
  const ti = '12345'.indexOf(k); if (k.length === 1 && ti >= 0) document.querySelectorAll('#tools input')[ti].click();
  if (k === 'g') $('[data-v=grade]').click();
  if (k === 'f') resetCam();
  if (k === 'enter' && S.pending.length > 2) {
    const f = S.pending[0].f; f.faces.push(S.pending.map(p => p.i)); f.edited = true; S.pending = []; build(); renderParams();
  }
  if (k === 'escape') { S.pending = []; S.selV = null; build(); renderParams(); }
  if ((k === 'delete' || k === 'backspace') && S.sel) removeSel();
});
addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => held.clear());

/* ===== Painel: figura selecionada ===== */
const xyz = (kind, nome, a) => `<div class="row"><span>${nome}</span>` +
  [0, 1, 2].map(j => `<input type="number" style="min-width:0" step="0.5" data-t="${kind}" data-j="${j}" title="${'XYZ'[j]}" value="${a[j]}">`).join('') + '</div>';
function renderParams() {
  const box = $('#params'), f = S.sel;
  if (!f) { box.innerHTML = '<p class="mute">Nenhuma figura selecionada. Adicione uma ou clique em uma.</p>'; return; }
  let h = `<b>${f.nome}</b>` + xyz('pos', 'Posição X Y Z', f.pos);
  if (S.selV !== null && f.verts[S.selV]) h += xyz('v', `Vértice ${S.selV + 1}`, f.verts[S.selV]);
  if (f.type && !f.edited) h += SHAPES[f.type].params.map(q => `<label class="row"><span>${q.label}</span>
    <input type="number" data-k="${q.k}" min="${q.min}" max="${q.max}" step="${q.step}" value="${f.params[q.k]}"></label>`).join('');
  else h += '<p class="mute">Figura editada à mão: os parâmetros automáticos não se aplicam mais.</p>';
  if (f.faces.length === 1) h += '<label class="row"><span>Altura</span><input id="exh" type="number" value="3" step="0.5"></label><button id="ext">Extrudar em prisma</button>';
  h += '<button id="del">Excluir figura</button>';
  box.innerHTML = h;
  box.querySelectorAll('[data-k]').forEach(i => i.oninput = () => {
    const v = parseFloat(i.value); if (!(v > 0)) return;
    f.params[i.dataset.k] = v; Object.assign(f, SHAPES[f.type].make(f.params)); f.extra = []; build();
  });
  box.querySelectorAll('[data-t]').forEach(i => i.oninput = () => {
    const v = parseFloat(i.value); if (isNaN(v)) return; const j = +i.dataset.j;
    if (i.dataset.t === 'pos') f.pos[j] = v; else { f.verts[S.selV][j] = v; f.edited = true; }
    build();
  });
  $('#del').onclick = removeSel;
  if ($('#ext')) $('#ext').onclick = () => {
    const hh = parseFloat($('#exh').value) || 3, fc = f.faces[0], V = f.verts, n = V.length;
    const nn = cross(sub(V[fc[1]], V[fc[0]]), sub(V[fc[2]], V[fc[0]])), l = len(nn), o = nn.map(x => x / l * hh);
    f.verts = [...V, ...V.map(v => v.map((x, j) => x + o[j]))];
    f.faces = [fc, fc.map(i => i + n), ...fc.map((a, i) => { const b = fc[(i+1) % fc.length]; return [a, b, b+n, a+n]; })];
    f.edited = true; build(); renderParams();
  };
}
function syncPos() {                           // atualiza os campos X Y Z enquanto arrasta
  const f = S.sel; if (!f) return;
  document.querySelectorAll('#params [data-t]').forEach(i => {
    const a = i.dataset.t === 'pos' ? f.pos : f.verts[S.selV];
    if (a && document.activeElement !== i) i.value = a[+i.dataset.j];
  });
}

/* ===== Painel: informações calculadas ===== */
function info() {
  const f = S.sel, out = $('#infoOut'), chk = $('#infoChk');
  if (!f) { chk.innerHTML = out.innerHTML = ''; return; }
  const m = measures(f), keys = Object.keys(m), s = keys.join();
  if (s !== sig) {
    sig = s;
    chk.innerHTML = keys.map(k => `<label><input type="checkbox" data-i="${k}" ${S.hidden.has(k) ? '' : 'checked'}>${INFO[k][0]}</label>`).join('');
  }
  out.innerHTML = keys.filter(k => !S.hidden.has(k)).map(k => `<div><dt>${INFO[k][0]}</dt><dd>${fmt(m[k])} <small>${INFO[k][1]}</small></dd></div>`).join('');
}
$('#infoChk').onchange = e => { e.target.checked ? S.hidden.delete(e.target.dataset.i) : S.hidden.add(e.target.dataset.i); info(); };

/* ===== Montagem da interface ===== */
$('#shapeSel').innerHTML = Object.entries(SHAPES).map(([k, s]) => `<option value="${k}">${s.nome}</option>`).join('');
$('#addBtn').onclick = () => addShape($('#shapeSel').value);
$('#tools').innerHTML = TOOLS.map(([id, nome], i) => `<label><input type="radio" name="tool" value="${id}" ${i ? '' : 'checked'}>${nome}</label>`).join('');
$('#tools').onchange = e => { S.tool = e.target.value; S.pending = []; $('#hint').textContent = TOOLS.find(t => t[0] === S.tool)[2]; build(); };
$('#hint').textContent = TOOLS[0][2];
$('#nav').textContent = 'W A S D: andar · Q / E: descer / subir · Shift: correr · Arraste no vazio: olhar · Scroll: avançar · F: início · G: grade';
$('#views').innerHTML = VIEWS.map(([id, nome]) => `<label><input type="checkbox" data-v="${id}" ${S.view[id] ? 'checked' : ''}>${nome}</label>`).join('');
$('#views').onchange = e => { S.view[e.target.dataset.v] = e.target.checked; build(); };
$('#home').onclick = resetCam;

resetCam();
addShape('prisma'); addShape('retangulo');
select(S.figs[0]);