/* ===== Mouse e teclado ===== */
const rc = new THREE.Raycaster();
function ray(e) {
  const r = cv.getBoundingClientRect();
  rc.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
  return rc.ray;
}
function pickGizmo(e) {                                  // qual seta/anel está sob o mouse (0, 1, 2 ou null)
  const rot = S.tool === 'girar';
  if (!(rot ? rotG : gizmo).visible) return null;
  ray(e); const h = rc.intersectObjects(rot ? rotHits : gizmoHits)[0];
  return h ? h.object.userData.axis : null;
}
function pick(e) {
  ray(e);
  const h = rc.intersectObjects(pickHandles)[0]; if (h) return {fig:h.object.userData.fig, i:h.object.userData.i};
  const m = rc.intersectObjects(pickMeshes)[0]; return m ? {fig:m.object.userData.fig} : null;
}
function axisParam(e, O, ax) {                           // posição ao longo do eixo mais próxima do raio do mouse
  const r = ray(e), D = new THREE.Vector3(); D.setComponent(ax, 1);
  const w = O.clone().sub(r.origin), b = D.dot(r.direction), dd = D.dot(w), ee = r.direction.dot(w), den = 1 - b * b;
  return den < 1e-4 ? 0 : (b * ee - dd) / den;
}
function setHover(h) {
  const a = S.hover, same = (!a && !h) || (a && h && a.fig === h.fig && a.i === h.i);
  if (!same) { S.hover = h; build(); }
}
function addPoint(e) {
  const p = ray(e).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (!p) return toast('Aponte para o chão');
  p.x = snap(p.x); p.z = snap(p.z); p.y = 0;
  const f = S.sel || addFig({nome:'Figura livre', pos:[0, 0, 0]});
  f.verts.push(toLocal(f, p).toArray().map(r3));
  f.edited = true; commit(); renderParams(); build();
}
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

let drag = null;
function startGizmo(e, ax) {
  const f = S.sel, O = gizmoTarget();
  if (S.tool === 'girar') {
    const A = new THREE.Vector3(); A.setComponent(ax, 1);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(A, O);
    const hv = Math.abs(A.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = hv.sub(A.clone().multiplyScalar(hv.dot(A))).normalize(), v = A.clone().cross(u);
    const p = ray(e).intersectPlane(plane, new THREE.Vector3()); if (!p) return;
    const d = p.sub(O);
    drag = {rot:true, ax, O, A, plane, u, v, last:Math.atan2(d.dot(v), d.dot(u)), tot:0, f, q0:figQuat(f), c:localC(f)};
  } else {
    const vert = S.tool === 'vertice';
    drag = {ax, O, s0:axisParam(e, O, ax), f, vert, orig:[...f.pos], w0:vert ? toWorld(f, f.verts[S.selV]) : null};
  }
  showGuide(ax, O);
}
cv.onpointerdown = e => {
  cv.setPointerCapture(e.pointerId);
  if (e.button !== 0) { drag = {look:true, x:e.clientX, y:e.clientY}; return; }
  const t = S.tool, ax = pickGizmo(e);
  if (ax !== null) return startGizmo(e, ax);
  if (t === 'ponto') return addPoint(e);
  const hit = pick(e);
  if (hit && hit.i !== undefined && t === 'aresta') {
    if (S.sel !== hit.fig) select(hit.fig);
    const p = S.pending[0];
    if (!p) S.pending = [{f:hit.fig, i:hit.i}];
    else if (p.i !== hit.i) {
      if (edgesOf(hit.fig).some(([a, b]) => (a === p.i && b === hit.i) || (a === hit.i && b === p.i))) { S.pending = []; toast('Essa aresta já existe'); }
      else { hit.fig.extra.push([p.i, hit.i]); hit.fig.edited = true; S.pending = []; commit(); renderParams(); toast('Aresta criada'); }
    }
    return build();
  }
  if (hit && hit.i !== undefined && t === 'face') {
    if (S.sel !== hit.fig) select(hit.fig);
    const k = S.pending.findIndex(p => p.i === hit.i);
    if (k >= 0) S.pending.splice(k, 1); else S.pending.push({f:hit.fig, i:hit.i});   // clicar de novo tira da seleção
    return build();
  }
  if (hit) {
    if (S.sel !== hit.fig) select(hit.fig);
    if (t === 'vertice') { S.selV = hit.i !== undefined ? hit.i : null; renderParams(); build(); }
    return;
  }
  drag = {look:true, x:e.clientX, y:e.clientY};          // clicou no vazio: olhar ao redor
};
cv.onpointermove = e => {
  if (!drag) {
    const ax = pickGizmo(e); gizmoHover(ax);
    if (ax !== null) { cv.style.cursor = 'grab'; return; }
    const h = S.tool === 'ponto' ? null : pick(e);
    setHover(h ? {fig:h.fig, i:h.i} : null);
    cv.style.cursor = S.tool === 'ponto' ? 'crosshair' : h ? 'pointer' : 'default';
    return;
  }
  if (drag.look) {
    cam.yaw -= (e.clientX - drag.x) * .005;
    cam.pitch = Math.min(1.5, Math.max(-1.5, cam.pitch - (e.clientY - drag.y) * .005));
    drag.x = e.clientX; drag.y = e.clientY; return placeCam();
  }
  if (drag.rot) {                                        // girando em torno de um eixo do mundo
    const p = ray(e).intersectPlane(drag.plane, new THREE.Vector3()); if (!p) return;
    const d = p.sub(drag.O), cur = Math.atan2(d.dot(drag.v), d.dot(drag.u));
    drag.tot += wrap(cur - drag.last); drag.last = cur;
    const a = S.view.snap ? Math.round(drag.tot / (Math.PI / 12)) * (Math.PI / 12) : drag.tot;
    const q = new THREE.Quaternion().setFromAxisAngle(drag.A, a).multiply(drag.q0);
    const eu = new THREE.Euler().setFromQuaternion(q, 'XYZ');
    drag.f.rot = [eu.x, eu.y, eu.z].map(x => r3(deg(x)));
    drag.f.pos = drag.O.clone().sub(drag.c.clone().applyQuaternion(figQuat(drag.f))).toArray().map(r3);   // centro fica parado
    build(); syncPos(); $('#hint').textContent = `Girando em torno de ${'XYZ'[drag.ax]}: ${fmt(r3(deg(a)))}°`;
    return;
  }
  const t = axisParam(e, drag.O, drag.ax) - drag.s0;
  if (drag.vert) {
    const w = drag.w0.clone(); w.setComponent(drag.ax, snap(w.getComponent(drag.ax) + t));
    drag.f.verts[S.selV] = toLocal(drag.f, w).toArray().map(r3); drag.f.edited = true;
    $('#hint').textContent = `Movendo no eixo ${'XYZ'[drag.ax]}: ${fmt(r3(w.getComponent(drag.ax)))}`;
  } else {
    drag.f.pos[drag.ax] = r3(snap(drag.orig[drag.ax] + t));
    $('#hint').textContent = `Movendo no eixo ${'XYZ'[drag.ax]}: ${fmt(drag.f.pos[drag.ax])}`;
  }
  build(); syncPos();
};
function endDrag() {
  if (!drag) return; const d = drag; drag = null;
  if (d.ax !== undefined) {
    showGuide(null);
    if (d.rot && S.view.apoiar) restOnGround(d.f);
    commit(); renderParams(); build(); hintReset();
  }
}
cv.onpointerup = cv.onpointercancel = cv.onlostpointercapture = endDrag;
cv.ondblclick = e => { const h = pick(e); if (h) { if (S.sel !== h.fig) select(h.fig); focusSel(); } };
cv.addEventListener('wheel', e => { e.preventDefault(); cam.pos.addScaledVector(camDir(), -e.deltaY * .02); placeCam(); }, {passive:false});
stage.oncontextmenu = e => e.preventDefault();           // sem menu do navegador

/* ----- Teclado ----- */
addEventListener('keydown', e => {
  const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName), k = e.key.toLowerCase();
  if (k === 'escape' && !$('#help').hidden) return closeHelp();
  if ((e.ctrlKey || e.metaKey) && !typing) {
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === 'y') { e.preventDefault(); redo(); }
    else if (k === 'd') { e.preventDefault(); duplicateSel(); }
    else if (k === 's') { e.preventDefault(); saveFile(); }
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  held.add(k);
  if (k === ' ') e.preventDefault();
  const ti = '123456'.indexOf(k); if (k.length === 1 && ti >= 0) document.querySelectorAll('#tools input')[ti].click();
  if (k === 'g') $('[data-v=grade]').click();
  if (k === 'n') $('[data-v=nomes]').click();
  if (k === 'm') $('[data-v=medidas]').click();
  if (k === 'f') focusSel();
  if (k === 'r') resetCam();
  if (k === 'h' || k === '?') toggleHelp();
  if (k === 'enter') {
    if (S.pending.length > 2) {
      const f = S.pending[0].f; f.faces.push(S.pending.map(p => p.i)); f.edited = true; S.pending = [];
      commit(); renderParams(); build(); toast('Face criada');
    } else if (S.tool === 'face') toast('Escolha pelo menos 3 vértices');
  }
  if (k === 'escape') { S.pending = []; S.selV = null; build(); renderParams(); }
  if ((k === 'delete' || k === 'backspace') && S.sel) removeSel();
});
addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => held.clear());