/* ===== Estado, utilidades e matemática de posição/rotação das figuras ===== */
const S = {
  figs:[], sel:null, selV:null, hover:null, tool:'mover', pending:[], hidden:new Set(),
  view:{grade:true, eixos:true, faces:true, arestas:true, vertices:true, sombra:true, nomes:false, medidas:false, snap:true, apoiar:true}
};
const VIEWS = [
  ['grade','Grade XYZ (G)'], ['eixos','Eixos e escala'], ['faces','Faces'], ['arestas','Arestas'], ['vertices','Vértices'],
  ['sombra','Sombra no chão'], ['nomes','Nomes dos vértices (N)'], ['medidas','Medidas das arestas (M)'],
  ['snap','Encaixar na grade (0,5) e giro (15°)'], ['apoiar','Apoiar no chão depois de girar']
];
const TOOLS = [
  ['mover','✥ Mover','Clique numa figura e arraste uma seta: vermelha = X · verde = Y (altura) · azul = Z'],
  ['girar','⟳ Girar','Clique numa figura e arraste um anel: vermelho gira em torno de X · verde em torno de Y · azul em torno de Z'],
  ['vertice','◉ Vértice','Clique num vértice e arraste uma seta colorida para movê-lo'],
  ['aresta','╱ Aresta','Clique em dois vértices da mesma figura para ligar'],
  ['face','▱ Face','Clique nos vértices em ordem e aperte Enter para fechar a face'],
  ['ponto','＋ Ponto','Clique no chão para criar um vértice']
];
const AXC = ['#e5484d', '#30a46c', '#3e63dd'];          // cores dos eixos X, Y, Z
let infoSig = '';                                       // controla quando refazer os checkboxes de informação

const $ = s => document.querySelector(s);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const snap = v => S.view.snap ? Math.round(v * 2) / 2 : v;
const r3 = v => Math.round(v * 1000) / 1000;
const D2R = Math.PI / 180, deg = r => r / D2R;
const vname = i => String.fromCharCode(65 + i % 26) + (i >= 26 ? Math.floor(i / 26) : '');

/* Cria uma figura com todos os campos padrão (usado ao adicionar e ao carregar projetos) */
function mkFig(o, n) {
  return {nome:'Figura', type:null, params:null, hue:(.58 + n * .17) % 1, pos:[(n % 3) * 6 - 6, 0, Math.floor(n / 3) * 6],
    rot:[0, 0, 0], verts:[], faces:[], extra:[], edited:false, hidden:false, ...o};
}

function edgesOf(f) {                                   // arestas únicas: das faces + as criadas à mão
  const seen = new Set(), out = [];
  const add = (a, b) => { const k = a < b ? a + '-' + b : b + '-' + a; if (!seen.has(k)) { seen.add(k); out.push([a, b]); } };
  f.faces.forEach(fc => fc.forEach((a, i) => add(a, fc[(i + 1) % fc.length])));
  f.extra.forEach(([a, b]) => add(a, b));
  return out;
}

/* ----- Posição e rotação no espaço (rotação em graus, ordem XYZ, em torno do centro da figura) ----- */
const figQuat = f => new THREE.Quaternion().setFromEuler(new THREE.Euler(f.rot[0] * D2R, f.rot[1] * D2R, f.rot[2] * D2R, 'XYZ'));
function localC(f) {                                    // centro (média dos vértices) em coordenadas locais
  const n = f.verts.length || 1;
  return new THREE.Vector3(...[0, 1, 2].map(j => f.verts.reduce((s, v) => s + v[j], 0) / n));
}
const toWorld = (f, v) => new THREE.Vector3(...v).applyQuaternion(figQuat(f)).add(new THREE.Vector3(...f.pos));
const toLocal = (f, w) => w.clone().sub(new THREE.Vector3(...f.pos)).applyQuaternion(figQuat(f).invert());
const worldCenter = f => toWorld(f, localC(f).toArray());
function setRot(f, rot) {                               // muda a rotação mantendo o centro da figura parado
  const O = worldCenter(f); f.rot = rot.map(r3);
  f.pos = O.sub(localC(f).applyQuaternion(figQuat(f))).toArray().map(r3);
}
function rotateWorld(f, ax, ang) {                      // gira em torno de um eixo do mundo (0=X, 1=Y, 2=Z)
  const A = new THREE.Vector3(); A.setComponent(ax, 1);
  const q = new THREE.Quaternion().setFromAxisAngle(A, ang).multiply(figQuat(f));
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ'); setRot(f, [e.x, e.y, e.z].map(deg));
}
function restOnGround(f) {                              // encosta o ponto mais baixo no chão (y = 0)
  if (!f.verts.length) return;
  let m = Infinity; f.verts.forEach(v => { m = Math.min(m, toWorld(f, v).y); });
  f.pos[1] = r3(f.pos[1] - m);
}

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1800);
}