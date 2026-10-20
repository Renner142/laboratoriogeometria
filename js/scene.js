/* ===== Cena 3D: renderizador, câmera livre, grade, setas/anéis e desenho das figuras ===== */
const stage = $('#stage');
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true, alpha:true}); }
catch (err) {
  stage.insertAdjacentHTML('beforeend', '<p style="position:relative;z-index:3;padding:24px">Não foi possível iniciar o 3D neste navegador. Verifique se a aceleração de hardware está ativada.</p>');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
stage.insertBefore(renderer.domElement, stage.firstChild);
const cv = renderer.domElement; cv.style.touchAction = 'none';
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, .1, 600);
camera.rotation.order = 'YXZ';
scene.fog = new THREE.Fog(new THREE.Color(css('--bg')), 45, 130);   // a grade some suavemente ao longe
scene.add(new THREE.HemisphereLight(0xffffff, 0x8794b8, .8));
const sun = new THREE.DirectionalLight(0xffffff, .55); sun.position.set(6, 12, 8); scene.add(sun);
new ResizeObserver(() => {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}).observe(stage);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => location.reload());

/* ----- Grade, eixos e escala ----- */
const world = new THREE.Group(), grid = new THREE.Group(), axes = new THREE.Group();
const mkGrid = (size, step, col, op) => { const g = new THREE.GridHelper(size, size / step, col, col); g.material.transparent = true; g.material.opacity = op; return g; };
function textSprite(t, color, pos, size) {
  const k = document.createElement('canvas'); k.width = k.height = 64;
  const x = k.getContext('2d'); x.fillStyle = color; x.font = 'bold ' + (t.length > 2 ? 28 : 40) + 'px sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(k), depthTest:false, transparent:true}));
  s.position.set(...pos); s.scale.set(size, size, 1); return s;
}
grid.add(mkGrid(60, 1, css('--line'), .6), mkGrid(60, 5, css('--mute'), .55));
grid.children[1].position.y = .002;
axes.add(new THREE.AxesHelper(12));
['X', 'Y', 'Z'].forEach((t, i) => { const p = [0, 0, 0]; p[i] = 13; axes.add(textSprite(t, AXC[i], p, 1.4)); });
[5, 10, -5, -10].forEach(v => { axes.add(textSprite(String(v), css('--mute'), [v, 0, .8], .9)); axes.add(textSprite(String(v), css('--mute'), [.8, 0, v], .9)); });
[5, 10].forEach(v => axes.add(textSprite(String(v), css('--mute'), [.8, v, 0], .9)));
scene.add(grid, axes, world);

/* ----- Câmera livre (WASD) ----- */
const cam = {pos:new THREE.Vector3(), yaw:0, pitch:0, vel:new THREE.Vector3()}, held = new Set();
const camDir = () => { const cp = Math.cos(cam.pitch); return new THREE.Vector3(-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp); };
function placeCam() { camera.position.copy(cam.pos); camera.rotation.set(cam.pitch, cam.yaw, 0); }
function resetCam() {
  cam.pos.set(10, 9, 14); cam.vel.set(0, 0, 0);
  cam.yaw = Math.atan2(cam.pos.x, cam.pos.z); cam.pitch = -Math.atan2(cam.pos.y, Math.hypot(cam.pos.x, cam.pos.z)); placeCam();
}
function fly(dt) {
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw); let dx = 0, dy = 0, dz = 0;
  if (held.has('w')) { dx -= sy; dz -= cy; }
  if (held.has('s')) { dx += sy; dz += cy; }
  if (held.has('d')) { dx += cy; dz -= sy; }
  if (held.has('a')) { dx -= cy; dz += sy; }
  if (held.has('e') || held.has(' ')) dy += 1;
  if (held.has('q') || held.has('c')) dy -= 1;
  const n = Math.hypot(dx, dy, dz), sp = held.has('shift') ? 24 : 8;
  const want = n ? new THREE.Vector3(dx, dy, dz).multiplyScalar(sp / n) : new THREE.Vector3();
  cam.vel.lerp(want, Math.min(1, dt * 10));              // aceleração suave
  if (!n && cam.vel.lengthSq() < 1e-3) { cam.vel.set(0, 0, 0); return; }
  cam.pos.addScaledVector(cam.vel, dt); placeCam();
}
function figCenter(f) {                                  // centro e raio da figura no espaço
  const W = f.verts.map(v => toWorld(f, v)), n = W.length || 1, c = new THREE.Vector3();
  W.forEach(w => c.add(w)); c.multiplyScalar(1 / n);
  let r = 1; W.forEach(w => { r = Math.max(r, w.distanceTo(c)); });
  return {c, r};
}
function focusSel() {
  if (!S.sel) return toast('Selecione uma figura primeiro');
  const {c, r} = figCenter(S.sel); cam.pos.copy(c).addScaledVector(camDir(), -Math.max(7, r * 3)); cam.vel.set(0, 0, 0); placeCam();
}
function setView(name) {                                 // vistas prontas: iso, frente, topo, lado
  const P = {iso:[.62, -.5], frente:[0, 0], topo:[0, -1.5], lado:[Math.PI / 2, 0]}[name]; if (!P) return;
  const fc = S.sel ? figCenter(S.sel) : {c:new THREE.Vector3(0, 3, 0), r:4};
  cam.yaw = P[0]; cam.pitch = P[1]; cam.vel.set(0, 0, 0);
  cam.pos.copy(fc.c).addScaledVector(camDir(), -Math.max(14, fc.r * 3.5)); placeCam();
}

/* ----- Setas de movimento (gizmo) ----- */
const gizmo = new THREE.Group(), gizmoHits = [], gizmoArrows = [];
[0, 1, 2].forEach(i => {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({color:AXC[i], depthTest:false, transparent:true});
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1, 8).translate(0, .5, 0), mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(.11, .3, 12).translate(0, 1.15, 0), mat);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, 1.35, 6).translate(0, .7, 0), new THREE.MeshBasicMaterial({visible:false}));
  shaft.renderOrder = head.renderOrder = 999; hit.userData.axis = i;
  g.add(shaft, head, hit);
  if (i === 0) g.rotation.z = -Math.PI / 2;
  if (i === 2) g.rotation.x = Math.PI / 2;
  gizmo.add(g); gizmoHits.push(hit); gizmoArrows.push(g);
});
gizmo.visible = false; scene.add(gizmo);

/* ----- Anéis de rotação ----- */
const rotG = new THREE.Group(), rotHits = [], rotRings = [];
[0, 1, 2].forEach(i => {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({color:AXC[i], depthTest:false, transparent:true, opacity:.9});
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, .03, 8, 72), mat); ring.renderOrder = 999;
  const hit = new THREE.Mesh(new THREE.TorusGeometry(1.25, .13, 8, 40), new THREE.MeshBasicMaterial({visible:false})); hit.userData.axis = i;
  g.add(ring, hit);
  if (i === 0) g.rotation.y = Math.PI / 2;               // anel vermelho gira em torno de X
  if (i === 1) g.rotation.x = Math.PI / 2;               // anel verde gira em torno de Y
  rotG.add(g); rotHits.push(hit); rotRings.push(g);
});
rotG.visible = false; scene.add(rotG);

/* ----- Linha-guia do eixo durante o arraste ----- */
const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-80, 0, 0), new THREE.Vector3(80, 0, 0)]),
  new THREE.LineBasicMaterial({depthTest:false, transparent:true, opacity:.75}));
guide.visible = false; guide.renderOrder = 998; scene.add(guide);
function showGuide(ax, O) {
  guide.visible = ax !== null; if (ax === null) return;
  guide.material.color.set(AXC[ax]); guide.position.copy(O); guide.rotation.set(0, 0, 0);
  if (ax === 1) guide.rotation.z = Math.PI / 2;
  if (ax === 2) guide.rotation.y = -Math.PI / 2;
}
function gizmoHover(ax) {
  gizmoArrows.forEach((g, i) => g.scale.setScalar(i === ax ? 1.25 : 1));
  rotRings.forEach((g, i) => g.scale.setScalar(i === ax ? 1.08 : 1));
}
function gizmoTarget() {                                 // onde as setas/anéis aparecem (ou null)
  const f = S.sel; if (!f || f.hidden) return null;
  if (S.tool === 'mover' || S.tool === 'girar') return worldCenter(f);
  if (S.tool === 'vertice' && S.selV !== null && f.verts[S.selV]) return toWorld(f, f.verts[S.selV]);
  return null;
}

/* ----- Rótulos HTML (nomes de vértices e medidas) ----- */
const labelsEl = $('#labels'); let labelItems = [];
function setLabels(items) {
  labelsEl.innerHTML = '';
  labelItems = items.map(it => { const d = document.createElement('div'); d.className = it.cls; d.textContent = it.text; labelsEl.appendChild(d); return {el:d, p:it.p}; });
}
function placeLabels() {
  const w = stage.clientWidth, h = stage.clientHeight, v = new THREE.Vector3();
  labelItems.forEach(it => {
    v.copy(it.p).project(camera); const ok = v.z > -1 && v.z < 1;
    it.el.style.display = ok ? 'block' : 'none';
    if (ok) it.el.style.transform = `translate(${(v.x * .5 + .5) * w}px,${(-v.y * .5 + .5) * h}px) translate(-50%,-50%)`;
  });
}

/* ----- Desenho das figuras ----- */
let pickMeshes = [], pickHandles = [];
const mkGeo = p => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g; };
function tris(faces, verts, y) {                         // triangula as faces (y opcional = achatar nesse nível)
  const p = [];
  faces.forEach(fc => { for (let i = 1; i < fc.length - 1; i++) [fc[0], fc[i], fc[i + 1]].forEach(j => { const v = verts[j]; p.push(v[0], y === undefined ? v[1] : y, v[2]); }); });
  return p;
}
const dispose = o => o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });

function build() {
  while (world.children.length) { const c = world.children[0]; world.remove(c); dispose(c); }
  pickMeshes = []; pickHandles = [];
  grid.visible = S.view.grade; axes.visible = S.view.eixos;
  const labs = [];
  S.figs.forEach(f => {
    if (f.hidden) return;
    const isSel = f === S.sel, hov = !!S.hover && S.hover.fig === f;
    const g = new THREE.Group(); g.position.set(...f.pos); g.quaternion.copy(figQuat(f));
    if (f.faces.length) {
      const col = new THREE.Color().setHSL(f.hue, .65, isSel ? .5 : hov ? .6 : .68), geo = mkGeo(tris(f.faces, f.verts)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:col, side:THREE.DoubleSide, transparent:true, opacity:isSel ? .78 : .55, visible:S.view.faces}));
      m.userData.fig = f; g.add(m); pickMeshes.push(m);
      if (S.view.sombra) {                               // sombra projetada no chão, já levando a rotação em conta
        const W = f.verts.map(v => toWorld(f, v).toArray());
        world.add(new THREE.Mesh(mkGeo(tris(f.faces, W, .004)),
          new THREE.MeshBasicMaterial({color:css('--ink'), transparent:true, opacity:.12, depthWrite:false, side:THREE.DoubleSide})));
      }
    }
    const E = edgesOf(f);
    if (S.view.arestas && E.length) {
      const seg = []; E.forEach(([a, b]) => seg.push(...f.verts[a], ...f.verts[b]));
      g.add(new THREE.LineSegments(mkGeo(seg), new THREE.LineBasicMaterial({color:css(isSel ? '--ink' : '--mute')})));
    }
    if (S.view.vertices || S.tool !== 'mover') f.verts.forEach((v, i) => {
      const pend = S.pending.some(p => p.f === f && p.i === i), chosen = isSel && i === S.selV, hv = hov && S.hover.i === i;
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10),
        new THREE.MeshBasicMaterial({color:pend ? '#ff8a00' : (chosen || hv) ? css('--accent') : css(isSel ? '--ink' : '--mute')}));
      h.position.set(...v); h.userData = {fig:f, i, big:chosen || pend || hv}; g.add(h); pickHandles.push(h);
    });
    if (isSel && S.view.nomes) f.verts.forEach((v, i) => labs.push({p:toWorld(f, v), text:vname(i), cls:'lbl vn'}));
    if (isSel && S.view.medidas) E.forEach(([a, b]) => labs.push({
      p:toWorld(f, f.verts[a]).add(toWorld(f, f.verts[b])).multiplyScalar(.5),
      text:fmt(len(sub(f.verts[a], f.verts[b]))), cls:'lbl ln'}));
    world.add(g);
  });
  setLabels(labs); refreshInfo();
}

/* ----- Loop de animação ----- */
let lastT = performance.now(); const tmpV = new THREE.Vector3();
(function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now; fly(dt);
  const t = gizmoTarget(), rot = S.tool === 'girar';
  gizmo.visible = !!t && !rot; rotG.visible = !!t && rot;
  if (t) { const G = rot ? rotG : gizmo; G.position.copy(t); G.scale.setScalar(Math.max(.4, camera.position.distanceTo(t) * .11)); }
  pickHandles.forEach(h => {                             // vértices mantêm tamanho legível a qualquer distância
    h.getWorldPosition(tmpV);
    h.scale.setScalar(Math.min(.55, Math.max(.07, camera.position.distanceTo(tmpV) * .011)) * (h.userData.big ? 1.6 : 1));
  });
  renderer.render(scene, camera); placeLabels();
})(performance.now());