/* Cálculos genéricos: funcionam para qualquer figura, inclusive as editadas à mão. */
const sub   = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot   = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len   = a => Math.hypot(a[0], a[1], a[2]);
const fmt   = n => Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', {maximumFractionDigits: 3});

function measures(f) {
  const V = f.verts, F = f.faces, count = {}, key = (a, b) => a < b ? a+'-'+b : b+'-'+a;
  F.forEach(fc => fc.forEach((a, i) => { const k = key(a, fc[(i+1) % fc.length]); count[k] = (count[k]||0) + 1; }));
  (f.extra||[]).forEach(([a, b]) => { const k = key(a, b); count[k] = count[k] || 0; });
  const edges = Object.keys(count), closed = F.length > 0 && edges.every(k => count[k] === 2);
  const cen = V.length ? [0,1,2].map(j => V.reduce((s, v) => s + v[j], 0) / V.length) : [0,0,0];

  let area = 0, vol = 0;
  F.forEach(fc => {
    let n = [0,0,0];
    for (let i = 1; i < fc.length - 1; i++) {
      const c = cross(sub(V[fc[i]], V[fc[0]]), sub(V[fc[i+1]], V[fc[0]]));
      n = n.map((x, j) => x + c[j]);
    }
    area += len(n) / 2;
    vol  += Math.abs(dot(n, sub(V[fc[0]], cen))) / 6;   // vale para sólidos convexos
  });
  const comp = edges.reduce((s, k) => { const [a, b] = k.split('-'); return s + len(sub(V[a], V[b])); }, 0);

  const m = {};
  if (F.length === 1) { m.area = area; m.perimetro = comp; }
  else if (F.length > 1) { m.areaTotal = area; if (closed) m.volume = vol; }
  if (edges.length) m.comprimento = comp;
  m.vertices = V.length; m.arestas = edges.length;
  if (F.length) { m.faces = F.length; if (closed) m.euler = V.length - edges.length + F.length; }
  return m;
}