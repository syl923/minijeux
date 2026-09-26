// Rail Rush : course sans fin sur 3 voies, en fausse 3D (projection en perspective dessinée à la main).
// Monde : x = côté (voies en -2,2 / 0 / 2,2), y = hauteur, z = distance devant le joueur.

const W = 540, H = 760;
const toile = document.getElementById("course");
const ctx = toile.getContext("2d");
const surcouche = document.getElementById("surcouche");

const VOIES = [-2.2, 0, 2.2];
const CAM_H = 3.3, CAM_D = 6, FOCALE = 470, HORIZON = 250;
const VITESSE_DEPART = 13, VITESSE_MAX = 30;
const GRAVITE = 30, SAUT = 10.5, SUPER_SAUT = 15;
const DUREES = { aimant: 10, jetpack: 7, double: 12, baskets: 12 };

let jeu = null;
let camX = 0;

function projeter(x, y, z) {
  const k = FOCALE / (z + CAM_D);
  return [W / 2 + (x - camX) * k, HORIZON + (CAM_H - y) * k, k];
}

// ------------------------------------------------------------ génération du parcours
function hasard(a, b) { return a + Math.random() * (b - a); }
function choix(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

function genererJusqua(zMax) {
  while (jeu.zGen < zMax) {
    const z = jeu.zGen;
    const difficulte = Math.min(1, jeu.distance / 2500);
    const libre = Math.floor(Math.random() * 3);  // une voie toujours praticable
    const motif = Math.random();
    for (let v = 0; v < 3; v++) {
      if (v === libre) continue;
      const r = Math.random();
      if (r < 0.38 + difficulte * 0.2) {
        const long = choix([9, 13, 18]);
        const roule = Math.random() < difficulte * 0.4;
        jeu.objets.push({ type: "train", voie: v, z, long, h: 2.6, v: roule ? hasard(4, 8) : 0, couleur: choix(["#f76707", "#1c7ed6", "#2f9e44", "#e03131", "#7048e8"]) });
      } else if (r < 0.62) {
        jeu.objets.push({ type: motif < .5 ? "basse" : "haute", voie: v, z: z + hasard(0, 4), long: 0.4 });
      }
    }
    // la voie libre : pièces, parfois un obstacle franchissable, parfois un bonus
    const r = Math.random();
    if (r < 0.25) jeu.objets.push({ type: choix(["basse", "haute"]), voie: libre, z: z + 6, long: 0.4 });
    if (Math.random() < 0.09 && jeu.distance > 150) {
      jeu.objets.push({ type: "bonus", genre: choix(Object.keys(DUREES)), voie: libre, z: z + 10, long: 0.5, y: 1 });
    } else {
      const saut = r < 0.25;
      for (let k = 0; k < 6; k++) {
        const zz = z + 3 + k * 1.8;
        const y = saut ? 1 + Math.max(0, 2.2 - Math.abs(zz - (z + 6)) * 0.55) : 1;
        jeu.objets.push({ type: "piece", voie: libre, z: zz, long: 0.3, y });
      }
    }
    jeu.zGen += Math.max(12, 22 - difficulte * 8);
  }
}

// ------------------------------------------------------------ partie
document.getElementById("btn-jouer").onclick = () => exigerConnexion(lancer);

async function lancer() {
  let r;
  try {
    r = await api("/api/runner/debut", {});
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  jeu = {
    partie: r.partie, distance: 0, pieces: 0, score: 0, scoreDistance: 0, pointsPieces: 0, vitesse: VITESSE_DEPART,
    voie: 1, x: 0, y: 0, vy: 0, glisse: 0, bonus: {}, objets: [], zGen: 30, decor: [],
    particules: [], textes: [], fini: false, temps: 0, secousse: 0, flash: 0, compte: 3, dernier: performance.now(),
  };
  camX = 0;
  for (let z = 0; z < 160; z += 7) ajouterDecor(z);
  genererJusqua(160);
  surcouche.classList.add("cache");
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("course");
  for (const n of [3, 2, 1]) {
    jeu.compte = n;
    Sons.jouer("tic");
    dessiner(0);
    await new Promise((ok) => setTimeout(ok, 500));
  }
  jeu.compte = 0;
  Sons.jouer("bonus");
  jeu.dernier = performance.now();
  requestAnimationFrame(boucle);
}

function ajouterDecor(z) {
  for (const cote of [-1, 1]) {
    jeu.decor.push({
      cote, z: z + hasard(0, 3), larg: hasard(4, 7), haut: hasard(6, 18), prof: hasard(4, 6),
      couleur: choix(["#5f3dc4", "#862e9c", "#364fc7", "#c2255c", "#495057", "#0b7285"]),
      fenetres: Math.random() < .8,
    });
  }
}

// ------------------------------------------------------------ commandes
function commande(c) {
  if (!jeu || jeu.fini || jeu.compte) return;
  if (c === "gauche" && jeu.voie > 0) { jeu.voie--; Sons.jouer("deplace"); }
  if (c === "droite" && jeu.voie < 2) { jeu.voie++; Sons.jouer("deplace"); }
  if (c === "haut" && jeu.y <= 0.01 && !jeu.bonus.jetpack) {
    jeu.vy = jeu.bonus.baskets ? SUPER_SAUT : SAUT;
    jeu.glisse = 0;
    Sons.jouer("saut");
  }
  if (c === "bas" && !jeu.bonus.jetpack) {
    if (jeu.y > 0.01) jeu.vy = -22; // redescend vite
    jeu.glisse = 0.75;
    Sons.jouer("glisse");
  }
}
const TOUCHES = { ArrowLeft: "gauche", ArrowRight: "droite", ArrowUp: "haut", ArrowDown: "bas", q: "gauche", d: "droite", z: "haut", s: "bas", a: "gauche", w: "haut", " ": "haut" };
document.addEventListener("keydown", (e) => {
  const c = TOUCHES[e.key] || TOUCHES[e.key.toLowerCase()];
  if (c && jeu && !jeu.fini) { e.preventDefault(); if (!e.repeat) commande(c); }
});
let doigt = null;
toile.addEventListener("touchstart", (e) => { doigt = [e.touches[0].clientX, e.touches[0].clientY]; e.preventDefault(); }, { passive: false });
toile.addEventListener("touchmove", (e) => {
  if (!doigt) return;
  const dx = e.touches[0].clientX - doigt[0], dy = e.touches[0].clientY - doigt[1];
  if (Math.hypot(dx, dy) < 28) return;
  commande(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "droite" : "gauche") : (dy > 0 ? "bas" : "haut"));
  doigt = null;
  e.preventDefault();
}, { passive: false });

// ------------------------------------------------------------ mise à jour
function boucle(t) {
  if (!jeu) return;
  const dt = Math.min(0.05, (t - jeu.dernier) / 1000);
  jeu.dernier = t;
  if (!jeu.fini) avancer(dt);
  dessiner(dt);
  if (!jeu.fini || jeu.particules.length || jeu.secousse > 0) requestAnimationFrame(boucle);
}

function avancer(dt) {
  jeu.temps += dt;
  jeu.vitesse = Math.min(VITESSE_MAX, VITESSE_DEPART + jeu.temps * 0.22);
  const dz = jeu.vitesse * dt;
  jeu.distance += dz;
  const mult = jeu.bonus.double ? 2 : 1;
  jeu.scoreDistance += dz * mult;
  jeu.score = Math.floor(jeu.scoreDistance) + jeu.pointsPieces;

  // déplacement latéral, saut, glissade, jetpack
  jeu.x += (VOIES[jeu.voie] - jeu.x) * Math.min(1, dt * 14);
  camX += (jeu.x * 0.6 - camX) * Math.min(1, dt * 5);
  if (jeu.bonus.jetpack) {
    jeu.y += (5 - jeu.y) * Math.min(1, dt * 3);
    jeu.vy = 0;
    if (Math.random() < .6) jeu.particules.push({ x: jeu.x, y: jeu.y + 0.6, z: -0.3, vx: hasard(-1, 1), vy: -4, vz: -2, vie: .6, couleur: choix(["#ffd43b", "#ff922b", "#fff"]) });
  } else {
    jeu.vy -= GRAVITE * dt;
    jeu.y = Math.max(0, jeu.y + jeu.vy * dt);
    if (jeu.y === 0) jeu.vy = 0;
  }
  if (jeu.glisse > 0) jeu.glisse -= dt;
  for (const b of Object.keys(jeu.bonus)) {
    jeu.bonus[b] -= dt;
    if (jeu.bonus[b] <= 0) {
      delete jeu.bonus[b];
      if (b === "jetpack") jeu.vy = 0;
    }
  }

  // le monde avance vers le joueur
  for (const o of jeu.objets) o.z -= dz + (o.v || 0) * dt;
  for (const d of jeu.decor) d.z -= dz;
  jeu.zGen -= dz;
  jeu.objets = jeu.objets.filter((o) => o.z + (o.long || 0) > -6 && !o.pris);
  jeu.decor = jeu.decor.filter((d) => d.z + d.prof > -8);
  while (jeu.decor.length < 48) ajouterDecor(Math.max(...jeu.decor.map((d) => d.z), 100) + 7);
  genererJusqua(170);

  // collisions
  const voieJoueur = VOIES.reduce((m, v, i) => (Math.abs(jeu.x - v) < Math.abs(jeu.x - VOIES[m]) ? i : m), 0);
  for (const o of jeu.objets) {
    const devant = o.z < 0.6 && o.z + (o.long || 0) > -0.6;
    if (!devant) continue;
    if (o.type === "piece") {
      const proche = o.voie === voieJoueur || jeu.bonus.aimant;
      if (proche && (Math.abs(o.y - (jeu.y + 1)) < 1.6 || jeu.bonus.aimant || jeu.bonus.jetpack)) {
        o.pris = true;
        jeu.pieces++;
        jeu.pointsPieces += 10 * mult;
        Sons.jouer("piece");
        jeu.particules.push(...Array.from({ length: 5 }, () => ({ x: VOIES[o.voie], y: o.y, z: 0.5, vx: hasard(-2, 2), vy: hasard(2, 5), vz: hasard(-1, 1), vie: .5, couleur: "#ffd43b" })));
      }
      continue;
    }
    if (o.voie !== voieJoueur) continue;
    if (o.type === "bonus") {
      o.pris = true;
      jeu.bonus[o.genre] = DUREES[o.genre];
      Sons.jouer(o.genre === "jetpack" ? "jetpack" : "bonus_pris");
      jeu.textes.push({ t: { aimant: "AIMANT !", jetpack: "JETPACK !", double: "SCORE x2 !", baskets: "SUPER-BASKETS !" }[o.genre], vie: 1.5 });
      if (o.genre === "jetpack") jeu.objets.push(...Array.from({ length: 30 }, (_, k) => ({ type: "piece", voie: voieJoueur, z: 12 + k * 2.2, long: .3, y: 6 })));
      continue;
    }
    if (jeu.bonus.jetpack) continue;
    const touche = o.type === "train" ? jeu.y < o.h - 0.1
      : o.type === "basse" ? jeu.y < 0.9
      : o.type === "haute" ? !(jeu.glisse > 0 && jeu.y < 0.5) : false;
    if (touche) return crash(o);
  }
}

async function crash(o) {
  jeu.fini = true;
  jeu.secousse = 22;
  jeu.flash = 1;
  Sons.musique.arreter();
  Sons.jouer("crash");
  Sons.jouer("perte_bille");
  for (let i = 0; i < 30; i++) jeu.particules.push({ x: jeu.x, y: jeu.y + 1, z: 0.3, vx: hasard(-5, 5), vy: hasard(1, 8), vz: hasard(-2, 3), vie: 1, couleur: choix(["#fff", "#ffd43b", "#ff6b6b"]) });
  jeu.textes.push({ t: o.type === "train" ? "BOUM ! Un train !" : "AÏE ! La barrière !", vie: 2 });
  requestAnimationFrame(boucle);
  let r;
  try {
    r = await api("/api/runner/fin", { partie: jeu.partie, distance: Math.floor(jeu.distance), pieces: jeu.pieces, score: jeu.score });
  } catch (e) {
    alert(e.message);
    return surcouche.classList.remove("cache");
  }
  setTimeout(() => {
    surcouche.classList.remove("cache");
    afficherResultat({
      titre: "Fin de la course !",
      emoji: jeu.score >= 3000 ? "🏆" : "🛹",
      lignes: [`${Math.floor(jeu.distance)} m parcourus · ${jeu.pieces} pièces ramassées`],
      fin: r.fin,
      rejouer: lancer,
    });
  }, 1300);
}

// ------------------------------------------------------------ dessin
function polygone(points, couleur) {
  ctx.fillStyle = couleur;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

// Boîte en perspective (train, immeuble) : faces avant, côté visible et dessus.
function boite(x, largeur, hauteur, z0, z1, { avant, cote, dessus, details }) {
  z0 = Math.max(z0, -CAM_D + 0.8);
  if (z1 <= z0) return;
  const g = x - largeur / 2, d = x + largeur / 2;
  const A = (xx, yy, zz) => projeter(xx, yy, zz);
  const ag0 = A(g, 0, z0), ad0 = A(d, 0, z0), agh = A(g, hauteur, z0), adh = A(d, hauteur, z0);
  const ag1 = A(g, 0, z1), ad1 = A(d, 0, z1), agh1 = A(g, hauteur, z1), adh1 = A(d, hauteur, z1);
  polygone([agh, adh, adh1, agh1], dessus);
  if (x > camX) polygone([ag0, agh, agh1, ag1], cote);
  else polygone([ad0, adh, adh1, ad1], cote);
  polygone([ag0, ad0, adh, agh], avant);
  if (details) details(ag0, adh, agh, ad0);
}

function dessinerTrain(o) {
  const x = VOIES[o.voie];
  boite(x, 2, o.h, o.z, o.z + o.long, {
    avant: o.couleur, cote: assombrir(o.couleur, .65), dessus: "#adb5bd",
    details: (bg, hd, hg) => {
      if (o.z < -CAM_D + 1) return;
      const l = hd[0] - hg[0], h = bg[1] - hg[1];
      ctx.fillStyle = "#1b1340";
      ctx.fillRect(hg[0] + l * .12, hg[1] + h * .12, l * .76, h * .3); // pare-brise
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillRect(hg[0] + l * .16, hg[1] + h * .15, l * .25, h * .06);
      ctx.fillStyle = "#fff";
      ctx.fillRect(hg[0] + l * .08, hg[1] + h * .52, l * .84, h * .08); // bande
      ctx.fillStyle = "#ffe066";
      ctx.shadowColor = "#ffe066";
      ctx.shadowBlur = o.v ? 20 : 6;
      ctx.beginPath(); ctx.arc(hg[0] + l * .2, hg[1] + h * .78, l * .07, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hg[0] + l * .8, hg[1] + h * .78, l * .07, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    },
  });
}

function assombrir(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor((n >> 16) * k), g = Math.floor(((n >> 8) & 255) * k), b = Math.floor((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

function dessinerBarriere(o) {
  const x = VOIES[o.voie];
  const haute = o.type === "haute";
  const pg = projeter(x - 1, 0, o.z), pd = projeter(x + 1, 0, o.z);
  const k = pg[2];
  const bas = haute ? 1.3 : 0.25, haut = haute ? 2.3 : 0.95;
  const yb = projeter(x, bas, o.z)[1], yh = projeter(x, haut, o.z)[1];
  ctx.fillStyle = "#868e96";
  ctx.fillRect(pg[0], yh, k * .14, pg[1] - yh);
  ctx.fillRect(pd[0] - k * .14, yh, k * .14, pd[1] - yh);
  // planche rayée rouge et blanche
  ctx.save();
  ctx.beginPath();
  ctx.rect(pg[0], yh, pd[0] - pg[0], yb - yh);
  ctx.clip();
  for (let i = -2; i < 12; i++) {
    ctx.fillStyle = i % 2 ? "#fff" : "#e03131";
    const w = (pd[0] - pg[0]) / 8;
    ctx.beginPath();
    ctx.moveTo(pg[0] + i * w, yb); ctx.lineTo(pg[0] + (i + 1) * w, yb); ctx.lineTo(pg[0] + (i + 2) * w, yh); ctx.lineTo(pg[0] + (i + 1) * w, yh);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "#343a40";
  ctx.lineWidth = Math.max(1, k * .04);
  ctx.strokeRect(pg[0], yh, pd[0] - pg[0], yb - yh);
  if (haute && o.z > 2) {
    ctx.fillStyle = "#ffe066";
    ctx.font = `900 ${Math.max(8, k * .5)}px Arial Black, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("▼", (pg[0] + pd[0]) / 2, (yh + yb) / 2 + k * .18);
    ctx.textAlign = "start";
  }
}

function dessinerPiece(o, t) {
  const [sx, sy, k] = projeter(VOIES[o.voie], o.y, o.z);
  const r = k * .35;
  const l = Math.abs(Math.cos(t * 5 + o.z)) * r + 1;
  ctx.fillStyle = "#e8a200";
  ctx.beginPath(); ctx.ellipse(sx, sy, l, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd43b";
  ctx.beginPath(); ctx.ellipse(sx, sy, l * .78, r * .78, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.beginPath(); ctx.ellipse(sx - l * .25, sy - r * .3, l * .2, r * .15, 0, 0, Math.PI * 2); ctx.fill();
}

const ICONES = { aimant: ["🧲", "#e03131"], jetpack: ["🚀", "#1c7ed6"], double: ["x2", "#f08c00"], baskets: ["👟", "#2f9e44"] };
function dessinerBonus(o, t) {
  const [sx, sy, k] = projeter(VOIES[o.voie], o.y + Math.sin(t * 4) * .15, o.z);
  const r = k * .5;
  const [ic, c] = ICONES[o.genre];
  ctx.shadowColor = c; ctx.shadowBlur = 20;
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, k * .07);
  ctx.stroke();
  ctx.font = `900 ${r}px sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(ic, sx, sy + 1);
  ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
}

function dessinerJoueur(t) {
  const [sx, sy, k] = projeter(jeu.x, jeu.y, 0);
  const [, sol] = projeter(jeu.x, 0, 0);
  const u = k / 100; // 1 unité de dessin = 1 cm
  // ombre au sol
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath(); ctx.ellipse(sx, sol, 45 * u, 12 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(sx, sy);
  const glisse = jeu.glisse > 0 && jeu.y < 0.3;
  if (glisse) ctx.scale(1.1, .55);
  if (jeu.fini) ctx.rotate(1.2);
  const p = jeu.fini ? 0 : Math.sin(t * jeu.vitesse * .9);
  const enAir = jeu.y > 0.05;
  const membre = (x1, y1, a, long, larg, couleur) => {
    ctx.save(); ctx.translate(x1 * u, y1 * u); ctx.rotate(a);
    ctx.fillStyle = couleur; ctx.beginPath(); ctx.roundRect(-larg / 2 * u, 0, larg * u, long * u, larg / 2 * u); ctx.fill();
    ctx.restore();
  };
  // jambes
  membre(-10, -85, enAir ? .5 : p * .7, 48, 16, "#1864ab");
  membre(10, -85, enAir ? -.3 : -p * .7, 48, 16, "#1c7ed6");
  // corps (sweat à capuche)
  ctx.fillStyle = "#f03e3e";
  ctx.beginPath(); ctx.roundRect(-24 * u, -150 * u, 48 * u, 72 * u, 14 * u); ctx.fill();
  ctx.fillStyle = "#c92a2a";
  ctx.fillRect(-24 * u, -100 * u, 48 * u, 8 * u);
  // bras
  membre(-24, -142, enAir ? 2.6 : -p * .8 + .2, 44, 13, "#e03131");
  membre(24, -142, enAir ? -2.6 : p * .8 - .2, 44, 13, "#e03131");
  // sac à dos / jetpack
  if (jeu.bonus.jetpack) {
    ctx.fillStyle = "#adb5bd";
    ctx.fillRect(-30 * u, -145 * u, 16 * u, 50 * u);
    ctx.fillRect(14 * u, -145 * u, 16 * u, 50 * u);
  }
  // tête + casquette
  ctx.fillStyle = "#f3c89a";
  ctx.beginPath(); ctx.arc(0, -172 * u, 22 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd43b";
  ctx.beginPath(); ctx.arc(0, -180 * u, 23 * u, Math.PI, 0); ctx.fill();
  ctx.fillRect(-4 * u, -184 * u, 34 * u, 8 * u);
  ctx.restore();
  if (jeu.bonus.aimant) {
    ctx.strokeStyle = `rgba(255, 107, 107, ${.4 + .3 * Math.sin(t * 8)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy - 100 * u, 90 * u, 0, Math.PI * 2); ctx.stroke();
  }
}

function dessiner(dt) {
  const t = performance.now() / 1000;
  ctx.save();
  ctx.setTransform(toile.width / W, 0, 0, toile.height / H, 0, 0);
  if (jeu && jeu.secousse > 0) {
    ctx.translate((Math.random() - .5) * jeu.secousse, (Math.random() - .5) * jeu.secousse);
    jeu.secousse *= .9;
    if (jeu.secousse < .5) jeu.secousse = 0;
  }
  // ciel au crépuscule, soleil
  const ciel = ctx.createLinearGradient(0, 0, 0, HORIZON);
  ciel.addColorStop(0, "#5f3dc4");
  ciel.addColorStop(.6, "#f06595");
  ciel.addColorStop(1, "#ffa94d");
  ctx.fillStyle = ciel;
  ctx.fillRect(-20, -20, W + 40, HORIZON + 22);
  ctx.fillStyle = "#ffe066";
  ctx.shadowColor = "#ffe066"; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(W * .72 - camX * 4, HORIZON - 40, 46, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // ville lointaine (légère parallaxe)
  ctx.fillStyle = "#3b1f6e";
  for (let i = 0; i < 14; i++) {
    const bx = ((i * 57 - camX * 8) % (W + 80) + W + 80) % (W + 80) - 40, bh = 30 + (i * 37) % 70;
    ctx.fillRect(bx, HORIZON - bh, 44, bh);
  }
  // sol : ballast et bas-côtés
  const sol = ctx.createLinearGradient(0, HORIZON, 0, H);
  sol.addColorStop(0, "#6c5a4a");
  sol.addColorStop(1, "#3d2f24");
  ctx.fillStyle = sol;
  ctx.fillRect(-20, HORIZON, W + 40, H - HORIZON + 20);
  const dist = jeu ? jeu.distance : 0;
  for (const x of VOIES) {
    const a = projeter(x - 1.05, 0, -5), b = projeter(x + 1.05, 0, -5), c = projeter(x + 1.05, 0, 200), d = projeter(x - 1.05, 0, 200);
    polygone([a, b, c, d], "#8a7866");
    for (let z = -(dist % 1.4) - 4; z < 70; z += 1.4) { // traverses
      const p1 = projeter(x - .95, 0, z), p2 = projeter(x + .95, 0, z), p3 = projeter(x + .95, 0, z + .35), p4 = projeter(x - .95, 0, z + .35);
      polygone([p1, p2, p3, p4], z > 40 ? "rgba(74,52,36,.5)" : "#5c3d26");
    }
    ctx.strokeStyle = "#ced4da";
    for (const r of [-.55, .55]) {
      const p1 = projeter(x + r, .1, -5), p2 = projeter(x + r, .1, 200);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
  }
  if (!jeu) return ctx.restore();

  // tout ce qui a de la profondeur, du plus lointain au plus proche
  const scene = [
    ...jeu.decor.map((d) => ({ z: d.z, dessin: () => {
      const x = d.cote * (5.5 + d.larg / 2);
      boite(x, d.larg, d.haut, d.z, d.z + d.prof, { avant: d.couleur, cote: assombrir(d.couleur, .6), dessus: "#343a40",
        details: d.fenetres ? (bg, hd, hg) => {
          const l = hd[0] - hg[0], h = bg[1] - hg[1];
          ctx.fillStyle = "rgba(255, 224, 102, .75)";
          for (let i = 0; i < 3; i++) for (let j = 0; j < Math.floor(d.haut / 3); j++) {
            if ((i * 7 + j * 3) % 4 === 0) continue;
            ctx.fillRect(hg[0] + l * (.15 + i * .28), hg[1] + h * (.06 + j * (0.9 / Math.floor(d.haut / 3))), l * .14, h * .05);
          }
        } : null });
    } })),
    ...jeu.objets.filter((o) => o.type === "train" ? o.z + o.long > -CAM_D + 1 : o.z > -CAM_D + 1).map((o) => ({ z: o.z, dessin: () => {
      if (o.type === "train") dessinerTrain(o);
      else if (o.type === "piece") dessinerPiece(o, t);
      else if (o.type === "bonus") dessinerBonus(o, t);
      else dessinerBarriere(o);
    } })),
  ].filter((e) => e.z < 150).sort((a, b) => b.z - a.z);
  const joueurDessine = { z: 0.2, dessin: () => dessinerJoueur(t) };
  let place = false;
  for (const e of scene) {
    if (!place && e.z < joueurDessine.z) { joueurDessine.dessin(); place = true; }
    e.dessin();
  }
  if (!place) joueurDessine.dessin();

  // particules
  for (let i = jeu.particules.length - 1; i >= 0; i--) {
    const q = jeu.particules[i];
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy -= 12 * dt; q.vie -= dt;
    if (q.vie <= 0 || q.z < -CAM_D + 1) { jeu.particules.splice(i, 1); continue; }
    const [px, py, k] = projeter(q.x, q.y, q.z);
    ctx.globalAlpha = Math.min(1, q.vie * 2);
    ctx.fillStyle = q.couleur;
    ctx.fillRect(px - k * .06, py - k * .06, k * .12, k * .12);
  }
  ctx.globalAlpha = 1;

  // lignes de vitesse
  if (!jeu.fini && jeu.vitesse > 18) {
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, r1 = 200 + Math.random() * 100;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(a) * r1, HORIZON + 80 + Math.sin(a) * r1 * .6);
      ctx.lineTo(W / 2 + Math.cos(a) * (r1 + 60), HORIZON + 80 + Math.sin(a) * (r1 + 60) * .6);
      ctx.stroke();
    }
  }

  // interface : score, pièces, bonus actifs
  const texte = (s, x, y, taille, couleur = "#fff", aligne = "left") => {
    ctx.font = `900 ${taille}px Arial Black, sans-serif`;
    ctx.textAlign = aligne;
    ctx.lineWidth = 5; ctx.strokeStyle = "#1b1340"; ctx.strokeText(s, x, y);
    ctx.fillStyle = couleur; ctx.fillText(s, x, y);
    ctx.textAlign = "start";
  };
  texte(jeu.score.toLocaleString("fr-FR"), 18, 42, 30);
  texte(`${Math.floor(jeu.distance)} m`, 18, 70, 16, "#ffe066");
  texte(`🪙 ${jeu.pieces}`, W - 18, 42, 26, "#ffd43b", "right");
  if (jeu.bonus.double) texte("x2", W - 18, 74, 26, "#ff922b", "right");
  let yb = H - 24;
  for (const [b, reste] of Object.entries(jeu.bonus)) {
    const [ic, c] = ICONES[b];
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(14, yb - 16, 150, 22);
    ctx.fillStyle = c;
    ctx.fillRect(14, yb - 16, 150 * reste / DUREES[b], 22);
    texte(ic, 20, yb + 2, 15);
    yb -= 28;
  }
  for (let i = jeu.textes.length - 1; i >= 0; i--) {
    const x = jeu.textes[i];
    x.vie -= dt;
    if (x.vie <= 0) { jeu.textes.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, x.vie * 2);
    texte(x.t, W / 2, 180 - (1.5 - x.vie) * 20, 34, "#ffe066", "center");
    ctx.globalAlpha = 1;
  }
  if (jeu.compte) texte(String(jeu.compte), W / 2, 330, 120, "#fff", "center");
  if (jeu.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${jeu.flash})`;
    ctx.fillRect(0, 0, W, H);
    jeu.flash = Math.max(0, jeu.flash - dt * 3);
  }
  ctx.restore();
}

function ajusterToile() {
  const ratio = window.devicePixelRatio || 1;
  const hauteur = Math.max(420, Math.min(window.innerHeight - 40, H));
  const largeur = Math.min(hauteur * W / H, window.innerWidth - 40);
  toile.style.width = largeur + "px";
  toile.style.height = largeur * H / W + "px";
  toile.width = Math.round(largeur * ratio);
  toile.height = Math.round(largeur * H / W * ratio);
}
window.addEventListener("resize", () => { ajusterToile(); if (!jeu || jeu.fini) dessiner(0); });
ajusterToile();
dessiner(0);
