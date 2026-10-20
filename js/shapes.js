/* =====================================================================
   CATÁLOGO DE FORMAS  (é aqui que você adiciona figuras novas)
   Cada forma devolve { verts:[[x,y,z],...], faces:[[i,j,k,...],...] }.
   Figuras planas ficam no plano XZ (y = 0), em cima da grade.
   ===================================================================== */
const PI = Math.PI, range = n => [...Array(n).keys()];
const P = (k, label, def, min, max, step = 0.1) => ({k, label, def, min, max, step});
const regR  = (n, l) => l / (2 * Math.sin(PI / n));
const ring  = (n, R, y) => range(n).map(i => [R*Math.cos(2*PI*i/n), y, R*Math.sin(2*PI*i/n)]);
const pN = P('n', 'Lados da base', 5, 3, 12, 1);
const box = (a, b, c) => ({
  verts: range(8).map(i => [(i&1?.5:-.5)*a, (i>>1&1?.5:-.5)*b + b/2, (i>>2&1?.5:-.5)*c]),
  faces: [[0,1,3,2],[4,5,7,6],[0,1,5,4],[2,3,7,6],[0,2,6,4],[1,3,7,5]]
});

const SHAPES = {
  triangulo:  {nome:'Triângulo (2D)', params:[P('a','Lado a',4,.5,12),P('b','Lado b',5,.5,12),P('c','Lado c',6,.5,12)],
    make:p=>{const x=(p.b*p.b+p.c*p.c-p.a*p.a)/(2*p.c), z=Math.sqrt(Math.max(0,p.b*p.b-x*x));
      return {verts:[[0,0,0],[p.c,0,0],[x,0,z]], faces:[[0,1,2]]}}},
  retangulo:  {nome:'Retângulo (2D)', params:[P('b','Base',5,.5,12),P('h','Altura',3,.5,12)],
    make:p=>({verts:[[0,0,0],[p.b,0,0],[p.b,0,p.h],[0,0,p.h]], faces:[[0,1,2,3]]})},
  regular:    {nome:'Polígono regular (2D)', params:[pN,P('l','Lado',3,.5,8)],
    make:p=>({verts:ring(p.n,regR(p.n,p.l),0), faces:[range(p.n)]})},
  cubo:       {nome:'Cubo (3D)', params:[P('a','Aresta',3,.5,8)], make:p=>box(p.a,p.a,p.a)},
  paralelepipedo:{nome:'Paralelepípedo (3D)', params:[P('a','Comprimento',5,.5,8),P('b','Altura',3,.5,8),P('c','Largura',2.5,.5,8)],
    make:p=>box(p.a,p.b,p.c)},
  prisma:     {nome:'Prisma regular (3D)', params:[pN,P('l','Lado da base',2.5,.5,6),P('h','Altura',4,.5,8)],
    make:p=>{const n=p.n,R=regR(n,p.l);
      return {verts:[...ring(n,R,0),...ring(n,R,p.h)],
        faces:[range(n),range(n).map(i=>i+n),...range(n).map(i=>[i,(i+1)%n,n+(i+1)%n,n+i])]}}},
  piramide:   {nome:'Pirâmide regular (3D)', params:[pN,P('l','Lado da base',3,.5,6),P('h','Altura',4,.5,8)],
    make:p=>{const n=p.n; return {verts:[...ring(n,regR(n,p.l),0),[0,p.h,0]],
      faces:[range(n),...range(n).map(i=>[i,(i+1)%n,n])]}}},
  tetraedro:  {nome:'Tetraedro regular (3D)', params:[P('a','Aresta',3,.5,8)],
    make:p=>{const s=p.a/(2*Math.SQRT2); return {verts:[[s,s+s,s],[s,0,-s],[-s,s+s,-s],[-s,0,s]].map(v=>v),
      faces:[[0,1,2],[0,3,1],[0,2,3],[1,3,2]]}}},
  octaedro:   {nome:'Octaedro regular (3D)', params:[P('a','Aresta',3,.5,8)],
    make:p=>{const r=p.a/Math.SQRT2, f=[]; [0,1].forEach(x=>[2,3].forEach(y=>[4,5].forEach(z=>f.push([x,y,z]))));
      return {verts:[[r,r,0],[-r,r,0],[0,2*r,0],[0,0,0],[0,r,r],[0,r,-r]], faces:f}}}
};

/* Informações que podem aparecer: chave → [rótulo, unidade] */
const INFO = {
  area:['Área','u²'], perimetro:['Perímetro','u'], areaTotal:['Área total','u²'], volume:['Volume','u³'],
  comprimento:['Soma das arestas','u'], vertices:['Vértices',''], arestas:['Arestas',''], faces:['Faces',''],
  euler:['V − A + F (Euler)','']
};