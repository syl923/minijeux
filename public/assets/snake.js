// Snake : la page enregistre les changements de direction, le serveur rejoue la partie pour la valider.
// Le placement des fruits et la vitesse doivent rester identiques à jeux/snake.py.

const TAILLE = 15;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // haut, droite, bas, gauche
const toile = document.getElementById("toile");
const ctx = toile.getContext("2d");
const C = toile.width / TAILLE;
const surcouche = document.getElementById("surcouche");

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const intervalle = (fruits) => Math.max(55, 150 - fruits * 4);

let jeu = null;

function placerFruit(alea, corps) {
  const occ = new Set(corps.map(([x, y]) => x + "," + y));
  const libres = [];
  for (let y = 0; y < TAILLE; y++) for (let x = 0; x < TAILLE; x++) if (!occ.has(x + "," + y)) libres.push([x, y]);
  return libres[Math.floor(alea() * libres.length)];
}

document.getElementById("btn-jouer").onclick = () => exigerConnexion(lancer);

async function lancer() {
  let r;
  try {
    r = await api("/api/snake/debut", {});
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  const alea = mulberry32(r.graine);
  const corps = [[7, 7], [6, 7], [5, 7]];
  jeu = {
    partie: r.partie, alea, corps, avant: corps.map((c) => c.slice()),
    dir: 1, file: [], entrees: [], tick: 0, fruits: 0, score: 0,
    fruit: placerFruit(alea, corps), particules: [], secousse: 0,
    pause: false, fini: false, cumul: 0, dernier: 0,
  };
  majCompteurs();
  surcouche.classList.add("cache");
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  for (const n of [3, 2, 1]) {
    compteARebours = n;
    Sons.jouer("tic");
    dessiner(0);
    await new Promise((ok) => setTimeout(ok, 550));
  }
  compteARebours = 0;
  Sons.jouer("bonus");
  jeu.dernier = performance.now();
  requestAnimationFrame(boucle);
}
let compteARebours = 0;

// ------------------------------------------------------------ commandes
const TOUCHES = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, z: 0, d: 1, s: 2, q: 3, w: 0, a: 3 };
document.addEventListener("keydown", (e) => {
  if (!jeu || jeu.fini) return;
  if (e.key === " ") { jeu.pause = !jeu.pause; e.preventDefault(); if (!jeu.pause) { jeu.dernier = performance.now(); requestAnimationFrame(boucle); } return; }
  const d = TOUCHES[e.key] ?? TOUCHES[e.key.toLowerCase()];
  if (d === undefined) return;
  e.preventDefault();
  if (jeu.file.length < 3) jeu.file.push(d);
});
let depart = null;
toile.addEventListener("touchstart", (e) => { depart = [e.touches[0].clientX, e.touches[0].clientY]; e.preventDefault(); }, { passive: false });
toile.addEventListener("touchmove", (e) => {
  if (!depart || !jeu || jeu.fini) return;
  const dx = e.touches[0].clientX - depart[0], dy = e.touches[0].clientY - depart[1];
  if (Math.hypot(dx, dy) < 24) return;
  const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  if (jeu.file.length < 3) jeu.file.push(d);
  depart = [e.touches[0].clientX, e.touches[0].clientY];
  e.preventDefault();
}, { passive: false });

// ------------------------------------------------------------ déroulement
function boucle(t) {
  if (!jeu || jeu.fini || jeu.pause) return dessiner(1);
  jeu.cumul += t - jeu.dernier;
  jeu.dernier = t;
  let pas = intervalle(jeu.fruits);
  while (jeu.cumul >= pas && !jeu.fini) {
    jeu.cumul -= pas;
    avancer();
    pas = intervalle(jeu.fruits);
  }
  dessiner(Math.min(1, jeu.cumul / pas));
  if (!jeu.fini) requestAnimationFrame(boucle);
}

function avancer() {
  // un seul changement de direction par pas, et jamais de demi-tour
  while (jeu.file.length) {
    const d = jeu.file.shift();
    if (d !== jeu.dir && d !== (jeu.dir + 2) % 4) {
      jeu.dir = d;
      jeu.entrees.push([jeu.tick, d]);
      break;
    }
  }
  const [dx, dy] = DIRS[jeu.dir];
  const tete = [jeu.corps[0][0] + dx, jeu.corps[0][1] + dy];
  const mange = tete[0] === jeu.fruit[0] && tete[1] === jeu.fruit[1];
  const reste = mange ? jeu.corps : jeu.corps.slice(0, -1);
  jeu.tick++;
  if (tete[0] < 0 || tete[1] < 0 || tete[0] >= TAILLE || tete[1] >= TAILLE || reste.some(([x, y]) => x === tete[0] && y === tete[1])) {
    return mourir();
  }
  jeu.avant = jeu.corps.map((c) => c.slice());
  jeu.corps = [tete, ...reste];
  if (mange) {
    jeu.avant.push(jeu.avant[jeu.avant.length - 1]);
    jeu.fruits++;
    const dore = jeu.fruits % 5 === 0;
    jeu.score += dore ? 50 : 10;
    Sons.jouer(dore ? "manger_or" : "mange");
    exploser(jeu.fruit, dore ? "#ffd84d" : "#ff5b7a", dore ? 30 : 16);
    jeu.fruit = placerFruit(jeu.alea, jeu.corps);
    majCompteurs();
  }
}

function majCompteurs() {
  document.getElementById("score").textContent = jeu.score;
  document.getElementById("fruits").textContent = jeu.fruits;
  document.getElementById("vitesse").textContent = Math.round((150 - intervalle(jeu.fruits)) / 4) + 1;
}

async function mourir() {
  jeu.fini = true;
  jeu.secousse = 14;
  Sons.jouer("crash");
  exploser(jeu.corps[0], "#5be37d", 40);
  const animer = () => { dessiner(1); if (jeu.secousse > 0 || jeu.particules.length) requestAnimationFrame(animer); };
  animer();
  let r;
  try {
    r = await api("/api/snake/fin", { partie: jeu.partie, entrees: jeu.entrees, ticks: jeu.tick });
  } catch (e) {
    alert(e.message);
    surcouche.classList.remove("cache");
    return;
  }
  setTimeout(() => {
    surcouche.classList.remove("cache");
    afficherResultat({
      titre: jeu.fruits ? `${jeu.fruits} fruit${jeu.fruits > 1 ? "s" : ""} croqué${jeu.fruits > 1 ? "s" : ""} !` : "Aïe, trop vite !",
      emoji: jeu.score >= 150 ? "🏆" : "🐍",
      lignes: [`Longueur finale : ${jeu.corps.length} anneaux`],
      fin: r.fin,
      rejouer: lancer,
    });
  }, 900);
}

// ------------------------------------------------------------ dessin
// Décor de prairie dessiné une fois pour toutes : herbe en damier, touffes, fleurs et cailloux.
const decor = document.createElement("canvas");
decor.width = toile.width;
decor.height = toile.height;
(() => {
  const d = decor.getContext("2d");
  const alea = mulberry32(2027);
  for (let y = 0; y < TAILLE; y++)
    for (let x = 0; x < TAILLE; x++) {
      d.fillStyle = (x + y) % 2 ? "#7cc653" : "#86d05c";
      d.fillRect(x * C, y * C, C, C);
    }
  for (let i = 0; i < 260; i++) { // brins d'herbe
    const x = alea() * decor.width, y = alea() * decor.height;
    d.strokeStyle = alea() < .5 ? "#5fa83a" : "#9bdc70";
    d.lineWidth = 2;
    d.beginPath();
    d.moveTo(x, y);
    d.quadraticCurveTo(x + 2, y - 5, x + (alea() - .5) * 6, y - 9);
    d.stroke();
  }
  const couleurs = ["#ffffff", "#ffe066", "#ff8fab", "#b197fc"];
  for (let i = 0; i < 26; i++) { // petites fleurs
    const x = alea() * decor.width, y = alea() * decor.height, c = couleurs[Math.floor(alea() * 4)];
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 2 / 5;
      d.fillStyle = c;
      d.beginPath(); d.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 0, Math.PI * 2); d.fill();
    }
    d.fillStyle = "#f59f00";
    d.beginPath(); d.arc(x, y, 2.5, 0, Math.PI * 2); d.fill();
  }
  for (let i = 0; i < 10; i++) { // cailloux
    const x = alea() * decor.width, y = alea() * decor.height;
    d.fillStyle = "#adb5bd";
    d.beginPath(); d.ellipse(x, y, 7, 5, alea(), 0, Math.PI * 2); d.fill();
    d.fillStyle = "rgba(255,255,255,.5)";
    d.beginPath(); d.ellipse(x - 2, y - 2, 3, 2, 0, 0, Math.PI * 2); d.fill();
  }
  // ombre douce sur les bords
  const g = d.createRadialGradient(decor.width / 2, decor.height / 2, decor.width * .35, decor.width / 2, decor.height / 2, decor.width * .75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(20,60,10,.35)");
  d.fillStyle = g;
  d.fillRect(0, 0, decor.width, decor.height);
})();
function exploser([x, y], couleur, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 4;
    jeu.particules.push({ x: (x + .5) * C, y: (y + .5) * C, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: 1, couleur });
  }
}

function dessiner(alpha) {
  ctx.save();
  if (jeu && jeu.secousse > 0) {
    ctx.translate((Math.random() - .5) * jeu.secousse, (Math.random() - .5) * jeu.secousse);
    jeu.secousse *= .85;
    if (jeu.secousse < .5) jeu.secousse = 0;
  }
  ctx.drawImage(decor, 0, 0);
  if (!jeu) return ctx.restore();

  // fruit
  const t = performance.now() / 1000;
  const [fx, fy] = jeu.fruit;
  const dore = (jeu.fruits + 1) % 5 === 0;
  const pulse = 1 + Math.sin(t * 6) * .08;
  ctx.save();
  ctx.translate((fx + .5) * C, (fy + .5) * C);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = dore ? "#ffd84d" : "#ff4d6d";
  ctx.shadowBlur = 18;
  ctx.fillStyle = dore ? "#ffd84d" : "#ff3b5c";
  ctx.beginPath();
  ctx.arc(0, 2, C * .36, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.arc(-C * .12, -C * .06, C * .1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5be37d";
  ctx.beginPath();
  ctx.ellipse(C * .1, -C * .34, C * .14, C * .07, -.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // serpent (positions interpolées entre deux pas pour un mouvement fluide)
  const n = jeu.corps.length;
  const pos = jeu.corps.map((c, i) => {
    const a = jeu.fini ? c : (jeu.avant[i] || c);
    const k = jeu.fini ? 1 : alpha;
    return [(a[0] + (c[0] - a[0]) * k + .5) * C, (a[1] + (c[1] - a[1]) * k + .5) * C];
  });
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // ombre portée sur l'herbe
  ctx.strokeStyle = "rgba(20, 50, 10, .35)";
  ctx.lineWidth = C * .7;
  ctx.beginPath();
  pos.forEach(([x, y], i) => (i ? ctx.lineTo(x + 4, y + 6) : ctx.moveTo(x + 4, y + 6)));
  ctx.stroke();
  for (let i = n - 1; i > 0; i--) {
    const k = i / n;
    ctx.strokeStyle = `hsl(${42 - k * 18}, 95%, ${58 - k * 12}%)`;
    ctx.lineWidth = C * (.8 - k * .25);
    ctx.beginPath();
    ctx.moveTo(pos[i][0], pos[i][1]);
    ctx.lineTo(pos[i - 1][0], pos[i - 1][1]);
    ctx.stroke();
    if (i % 2 === 0) { // taches du python
      ctx.fillStyle = "rgba(110, 50, 10, .55)";
      ctx.beginPath();
      ctx.arc(pos[i][0], pos[i][1], C * (.2 - k * .06), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // tête et yeux
  const [hx, hy] = pos[0];
  const [dx, dy] = DIRS[jeu.dir];
  if (!jeu.fini && Math.sin(t * 9) > .3) { // langue qui sort
    ctx.strokeStyle = "#e0314f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx + dx * C * .4, hy + dy * C * .4);
    ctx.lineTo(hx + dx * C * .75, hy + dy * C * .75);
    ctx.stroke();
  }
  const gt = ctx.createRadialGradient(hx - 4, hy - 4, 2, hx, hy, C * .5);
  gt.addColorStop(0, "#ffd66b");
  gt.addColorStop(1, "#f08c00");
  ctx.fillStyle = gt;
  ctx.beginPath();
  ctx.arc(hx, hy, C * .47, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    const ex = hx + dx * C * .15 + dy * s * C * .2, ey = hy + dy * C * .15 - dx * s * C * .2;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(ex, ey, C * .14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(ex + dx * C * .05, ey + dy * C * .05, C * .07, 0, Math.PI * 2); ctx.fill();
  }
  if (jeu.fini) { // croix dans les yeux… et une petite étoile
    ctx.fillStyle = "#fff";
    ctx.font = `${C}px sans-serif`;
    ctx.fillText("💫", hx - C / 2, hy - C * .4);
  }

  // particules
  jeu.particules = jeu.particules.filter((p) => p.vie > 0);
  for (const p of jeu.particules) {
    p.x += p.vx; p.y += p.vy; p.vy += .08; p.vie -= .025;
    ctx.globalAlpha = Math.max(0, p.vie);
    ctx.fillStyle = p.couleur;
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;

  if (compteARebours) {
    ctx.fillStyle = "rgba(0,0,0,.4)";
    ctx.fillRect(0, 0, toile.width, toile.height);
    ctx.fillStyle = "#fff";
    ctx.font = "900 140px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(compteARebours, toile.width / 2, toile.height / 2);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
  if (jeu.pause) {
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillRect(0, 0, toile.width, toile.height);
    ctx.fillStyle = "#fff";
    ctx.font = "900 60px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAUSE", toile.width / 2, toile.height / 2);
    ctx.textAlign = "start";
  }
  ctx.restore();
}

dessiner(0);
