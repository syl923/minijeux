// Blocomania : jeu de blocs qui tombent (10 x 20), sac de 7 pièces, fantôme, réserve, niveaux.

const L = 10, H = 20, T = 30;
const toile = document.getElementById("blocs");
const ctx = toile.getContext("2d");
const ctxSuiv = document.getElementById("suivantes").getContext("2d");
const ctxRes = document.getElementById("reserve").getContext("2d");
const surcouche = document.getElementById("surcouche");

const FORMES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};
const COULEURS = { I: "#22d3ee", O: "#facc15", T: "#a855f7", S: "#22c55e", Z: "#ef4444", J: "#3b82f6", L: "#f97316" };
const POINTS = [0, 100, 300, 500, 800];

let jeu = null;

function tourner(m, sens) {
  const n = m.length;
  return m.map((ligne, y) => ligne.map((_, x) => (sens > 0 ? m[n - 1 - x][y] : m[x][n - 1 - y])));
}

function sac() {
  const s = Object.keys(FORMES);
  for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
  return s;
}

function nouvellePiece(type) {
  const m = FORMES[type].map((l) => l.slice());
  return { type, m, x: Math.floor((L - m.length) / 2), y: type === "I" ? -1 : 0 };
}

function collision(m, px, py) {
  for (let y = 0; y < m.length; y++)
    for (let x = 0; x < m.length; x++) {
      if (!m[y][x]) continue;
      const gx = px + x, gy = py + y;
      if (gx < 0 || gx >= L || gy >= H) return true;
      if (gy >= 0 && jeu.grille[gy][gx]) return true;
    }
  return false;
}

document.getElementById("btn-jouer").onclick = () => exigerConnexion(lancer);

async function lancer() {
  let r;
  try {
    r = await api("/api/tetris/debut", {});
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  jeu = {
    partie: r.partie, grille: Array.from({ length: H }, () => Array(L).fill(null)),
    file: [...sac(), ...sac()], reserve: null, reserveUtilisee: false,
    score: 0, lignes: 0, niveau: 1, fini: false, pause: false,
    chute: 0, verrou: 0, deplacementsVerrou: 0, dernier: performance.now(),
    effaces: null, particules: [], textes: [], secousse: 0, touches: {},
  };
  jeu.piece = nouvellePiece(jeu.file.shift());
  majCompteurs();
  surcouche.classList.add("cache");
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("chiptune");
  requestAnimationFrame(boucle);
}

function intervalle() { return Math.max(50, 800 * Math.pow(0.82, jeu.niveau - 1)); }

function majCompteurs() {
  document.getElementById("score").textContent = jeu.score.toLocaleString("fr-FR");
  document.getElementById("lignes").textContent = jeu.lignes;
  document.getElementById("niveau").textContent = jeu.niveau;
}

// ------------------------------------------------------------ actions
function bouger(dx) {
  const p = jeu.piece;
  if (!collision(p.m, p.x + dx, p.y)) {
    p.x += dx;
    Sons.jouer("deplace");
    toucherVerrou();
  }
}

function tournerPiece(sens) {
  const p = jeu.piece;
  if (p.type === "O") return;
  const m = tourner(p.m, sens);
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]]) {
    if (!collision(m, p.x + dx, p.y + dy)) {
      p.m = m; p.x += dx; p.y += dy;
      Sons.jouer("rotation");
      toucherVerrou();
      return;
    }
  }
}

function toucherVerrou() {
  if (jeu.verrou > 0 && jeu.deplacementsVerrou < 15) { jeu.verrou = 0; jeu.deplacementsVerrou++; }
}

function descendre(manuel) {
  const p = jeu.piece;
  if (!collision(p.m, p.x, p.y + 1)) {
    p.y++;
    if (manuel) { jeu.score += 1; majCompteurs(); }
    return true;
  }
  return false;
}

function lacher() {
  let n = 0;
  while (descendre(false)) n++;
  jeu.score += n * 2;
  jeu.secousse = 6;
  poser();
}

function garder() {
  if (jeu.reserveUtilisee) return;
  const t = jeu.piece.type;
  jeu.piece = nouvellePiece(jeu.reserve || jeu.file.shift());
  jeu.reserve = t;
  jeu.reserveUtilisee = true;
  Sons.jouer("clic");
  remplirFile();
}

function remplirFile() { if (jeu.file.length < 7) jeu.file.push(...sac()); }

function poser() {
  const p = jeu.piece;
  let dehors = false;
  p.m.forEach((l, y) => l.forEach((v, x) => {
    if (!v) return;
    if (p.y + y < 0) dehors = true;
    else jeu.grille[p.y + y][p.x + x] = p.type;
  }));
  Sons.jouer("pose");
  if (dehors) return perdu();
  const pleines = [];
  for (let y = 0; y < H; y++) if (jeu.grille[y].every(Boolean)) pleines.push(y);
  if (pleines.length) {
    jeu.effaces = { lignes: pleines, t: 0 };
    const n = pleines.length;
    const gain = POINTS[n] * jeu.niveau;
    jeu.score += gain;
    jeu.lignes += n;
    Sons.jouer("ligne", n);
    if (n === 4) { Sons.jouer("bonus"); jeu.secousse = 16; }
    jeu.textes.push({ t: n === 4 ? "BLOCOMANIA !" : ["", "Simple", "Double !", "Triple !!"][n], s: "+" + gain, vie: 1.4, gros: n === 4 });
    pleines.forEach((y) => { for (let x = 0; x < L; x++) etincelles(x, y, COULEURS[jeu.grille[y][x]]); });
    const niveau = 1 + Math.floor(jeu.lignes / 10);
    if (niveau > jeu.niveau) {
      jeu.niveau = niveau;
      setTimeout(() => { Sons.jouer("extra"); jeu.textes.push({ t: `NIVEAU ${niveau} !`, s: "", vie: 1.6, gros: true }); }, 300);
    }
    majCompteurs();
  }
  jeu.piece = nouvellePiece(jeu.file.shift());
  remplirFile();
  jeu.reserveUtilisee = false;
  jeu.verrou = 0;
  jeu.deplacementsVerrou = 0;
  if (collision(jeu.piece.m, jeu.piece.x, jeu.piece.y)) perdu();
  majCompteurs();
}

function etincelles(x, y, couleur) {
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 200;
    jeu.particules.push({ x: (x + .5) * T, y: (y + .5) * T, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, vie: 1, couleur });
  }
}

async function perdu() {
  if (jeu.fini) return;
  jeu.fini = true;
  Sons.musique.arreter();
  Sons.jouer("crash");
  // les blocs deviennent gris ligne par ligne
  for (let y = H - 1; y >= 0; y--) {
    jeu.grille[y] = jeu.grille[y].map((v) => (v ? "gris" : null));
    dessiner();
    await new Promise((ok) => setTimeout(ok, 30));
  }
  let r;
  try {
    r = await api("/api/tetris/fin", { partie: jeu.partie, score: jeu.score, lignes: jeu.lignes });
  } catch (e) {
    alert(e.message);
    return surcouche.classList.remove("cache");
  }
  surcouche.classList.remove("cache");
  afficherResultat({
    titre: "Game over !",
    emoji: jeu.lignes >= 40 ? "🏆" : "🧱",
    lignes: [`${jeu.lignes} lignes · niveau ${jeu.niveau}`],
    fin: r.fin,
    rejouer: lancer,
  });
}

// ------------------------------------------------------------ clavier (avec répétition quand on reste appuyé)
const COMMANDES = {
  ArrowLeft: "gauche", ArrowRight: "droite", ArrowDown: "bas", ArrowUp: "tourner", x: "tourner", X: "tourner",
  w: "anti", W: "anti", z: "anti", Z: "anti", " ": "lacher", c: "reserve", C: "reserve", Shift: "reserve", p: "pause", P: "pause",
};
function action(a) {
  if (!jeu || jeu.fini) return;
  if (a === "pause") { jeu.pause = !jeu.pause; if (!jeu.pause) { jeu.dernier = performance.now(); requestAnimationFrame(boucle); } return; }
  if (jeu.pause || jeu.effaces) return;
  if (a === "gauche") bouger(-1);
  else if (a === "droite") bouger(1);
  else if (a === "bas") descendre(true);
  else if (a === "tourner") tournerPiece(1);
  else if (a === "anti") tournerPiece(-1);
  else if (a === "lacher") lacher();
  else if (a === "reserve") garder();
}
document.addEventListener("keydown", (e) => {
  const a = COMMANDES[e.key];
  if (!a || !jeu) return;
  e.preventDefault();
  if (e.repeat) return;
  action(a);
  if (["gauche", "droite", "bas"].includes(a)) jeu.touches[a] = { depuis: performance.now(), dernier: performance.now() };
});
document.addEventListener("keyup", (e) => { const a = COMMANDES[e.key]; if (a && jeu) delete jeu.touches[a]; });
document.querySelectorAll(".commandes-blocs button").forEach((b) => {
  const a = b.dataset.t;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    action(a);
    if (jeu && ["gauche", "droite", "bas"].includes(a)) jeu.touches[a] = { depuis: performance.now(), dernier: performance.now() };
  });
  const lever = () => jeu && delete jeu.touches[a];
  b.addEventListener("pointerup", lever);
  b.addEventListener("pointerleave", lever);
});

// ------------------------------------------------------------ boucle
function boucle(t) {
  if (!jeu || jeu.fini || jeu.pause) { if (jeu) dessiner(); return; }
  const dt = Math.min(100, t - jeu.dernier);
  jeu.dernier = t;

  for (const [a, k] of Object.entries(jeu.touches)) { // répétition automatique
    if (t - k.depuis > 160 && t - k.dernier > (a === "bas" ? 35 : 45)) { action(a); k.dernier = t; }
  }

  if (jeu.effaces) { // animation des lignes complètes
    jeu.effaces.t += dt;
    if (jeu.effaces.t > 260) {
      for (const y of jeu.effaces.lignes) { jeu.grille.splice(y, 1); jeu.grille.unshift(Array(L).fill(null)); }
      jeu.effaces = null;
    }
  } else {
    jeu.chute += dt;
    if (jeu.chute >= intervalle()) {
      jeu.chute = 0;
      descendre(false);
    }
    if (collision(jeu.piece.m, jeu.piece.x, jeu.piece.y + 1)) {
      jeu.verrou += dt;
      if (jeu.verrou > 500) poser();
    } else {
      jeu.verrou = 0;
    }
  }
  dessiner(dt / 1000);
  requestAnimationFrame(boucle);
}

// ------------------------------------------------------------ dessin
function bloc(c, x, y, taille, couleur, alpha = 1) {
  c.globalAlpha = alpha;
  const g = c.createLinearGradient(x, y, x + taille, y + taille);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(.18, couleur);
  g.addColorStop(1, couleur);
  c.fillStyle = g;
  c.fillRect(x + 1, y + 1, taille - 2, taille - 2);
  c.fillStyle = "rgba(0,0,0,.28)"; // biseau sombre en bas à droite
  c.beginPath(); c.moveTo(x + taille - 1, y + 1); c.lineTo(x + taille - 1, y + taille - 1); c.lineTo(x + 1, y + taille - 1);
  c.lineTo(x + 5, y + taille - 5); c.lineTo(x + taille - 5, y + taille - 5); c.lineTo(x + taille - 5, y + 5); c.fill();
  c.fillStyle = "rgba(255,255,255,.35)"; // reflet
  c.fillRect(x + 5, y + 4, taille * .35, taille * .15);
  c.globalAlpha = 1;
}

function dessinerPiece(c, type, cx, cy, taille) {
  const m = FORMES[type];
  const cells = [];
  m.forEach((l, y) => l.forEach((v, x) => v && cells.push([x, y])));
  const minx = Math.min(...cells.map((p) => p[0])), maxx = Math.max(...cells.map((p) => p[0]));
  const miny = Math.min(...cells.map((p) => p[1])), maxy = Math.max(...cells.map((p) => p[1]));
  const ox = cx - (maxx - minx + 1) * taille / 2, oy = cy - (maxy - miny + 1) * taille / 2;
  cells.forEach(([x, y]) => bloc(c, ox + (x - minx) * taille, oy + (y - miny) * taille, taille, COULEURS[type]));
}

function dessiner(dt = 0) {
  ctx.save();
  if (jeu && jeu.secousse > 0) {
    ctx.translate(0, (Math.random() - .3) * jeu.secousse);
    jeu.secousse *= .85;
    if (jeu.secousse < .5) jeu.secousse = 0;
  }
  const g = ctx.createLinearGradient(0, 0, 0, toile.height);
  g.addColorStop(0, "#140a38");
  g.addColorStop(1, "#05020f");
  ctx.fillStyle = g;
  ctx.fillRect(-10, -20, toile.width + 20, toile.height + 40);
  // fond animé : aurore néon et étoiles qui défilent lentement
  const tf = performance.now() / 1000;
  for (let b = 0; b < 3; b++) {
    ctx.strokeStyle = ["rgba(168, 85, 247, .16)", "rgba(34, 211, 238, .12)", "rgba(34, 197, 94, .1)"][b];
    ctx.lineWidth = 40 - b * 10;
    ctx.beginPath();
    for (let x = -10; x <= toile.width + 10; x += 15) ctx.lineTo(x, 140 + b * 90 + Math.sin(x / 50 + tf * .7 + b * 2) * 30);
    ctx.stroke();
  }
  for (let i = 0; i < 45; i++) {
    const sx = (i * 67) % toile.width, sy = ((i * 131) + tf * (8 + i % 3 * 6)) % toile.height;
    ctx.fillStyle = `rgba(255,255,255,${.25 + .35 * Math.abs(Math.sin(tf * 2 + i))})`;
    ctx.fillRect(sx, sy, i % 4 ? 1.5 : 2.5, i % 4 ? 1.5 : 2.5);
  }
  ctx.strokeStyle = "rgba(120, 100, 255, .12)";
  ctx.lineWidth = 1;
  for (let x = 1; x < L; x++) { ctx.beginPath(); ctx.moveTo(x * T, 0); ctx.lineTo(x * T, toile.height); ctx.stroke(); }
  for (let y = 1; y < H; y++) { ctx.beginPath(); ctx.moveTo(0, y * T); ctx.lineTo(toile.width, y * T); ctx.stroke(); }
  if (!jeu) return ctx.restore();

  for (let y = 0; y < H; y++)
    for (let x = 0; x < L; x++) {
      const v = jeu.grille[y][x];
      if (!v) continue;
      if (jeu.effaces && jeu.effaces.lignes.includes(y)) {
        const k = jeu.effaces.t / 260;
        ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
        ctx.fillRect(x * T, y * T, T, T);
      } else {
        bloc(ctx, x * T, y * T, T, v === "gris" ? "#555a66" : COULEURS[v]);
      }
    }

  if (!jeu.fini && !jeu.effaces) {
    const p = jeu.piece;
    let gy = p.y;
    while (!collision(p.m, p.x, gy + 1)) gy++;
    p.m.forEach((l, y) => l.forEach((v, x) => { // fantôme
      if (!v || gy + y < 0) return;
      ctx.strokeStyle = COULEURS[p.type];
      ctx.globalAlpha = .45;
      ctx.lineWidth = 2;
      ctx.strokeRect((p.x + x) * T + 3, (gy + y) * T + 3, T - 6, T - 6);
      ctx.globalAlpha = 1;
    }));
    ctx.shadowColor = COULEURS[p.type];
    ctx.shadowBlur = 14;
    p.m.forEach((l, y) => l.forEach((v, x) => v && p.y + y >= 0 && bloc(ctx, (p.x + x) * T, (p.y + y) * T, T, COULEURS[p.type])));
    ctx.shadowBlur = 0;
  }

  for (let i = jeu.particules.length - 1; i >= 0; i--) {
    const q = jeu.particules[i];
    q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 500 * dt; q.vie -= dt * 1.5;
    if (q.vie <= 0) { jeu.particules.splice(i, 1); continue; }
    ctx.globalAlpha = q.vie;
    ctx.fillStyle = q.couleur;
    ctx.fillRect(q.x - 3, q.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  for (let i = jeu.textes.length - 1; i >= 0; i--) {
    const x = jeu.textes[i];
    x.vie -= dt;
    if (x.vie <= 0) { jeu.textes.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, x.vie);
    ctx.font = `900 ${x.gros ? 34 : 26}px Arial Black, sans-serif`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#1b1340";
    ctx.fillStyle = x.gros ? "#ffe066" : "#fff";
    const yy = 250 - (1.4 - x.vie) * 40;
    ctx.strokeText(x.t, 150, yy); ctx.fillText(x.t, 150, yy);
    if (x.s) { ctx.font = "900 22px Arial Black, sans-serif"; ctx.strokeText(x.s, 150, yy + 32); ctx.fillText(x.s, 150, yy + 32); }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "start";
  if (jeu.pause) {
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(0, 0, toile.width, toile.height);
    ctx.fillStyle = "#fff"; ctx.font = "900 40px Arial Black, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("PAUSE", 150, 300); ctx.textAlign = "start";
  }
  ctx.restore();

  ctxSuiv.clearRect(0, 0, 120, 230);
  jeu.file.slice(0, 3).forEach((t, i) => dessinerPiece(ctxSuiv, t, 60, 40 + i * 75, i ? 18 : 22));
  ctxRes.clearRect(0, 0, 120, 80);
  if (jeu.reserve) {
    ctxRes.globalAlpha = jeu.reserveUtilisee ? .4 : 1;
    dessinerPiece(ctxRes, jeu.reserve, 60, 40, 20);
    ctxRes.globalAlpha = 1;
  }
}

(function attente() { if (!jeu) { dessiner(); requestAnimationFrame(attente); } })();
