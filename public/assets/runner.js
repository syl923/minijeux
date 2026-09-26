// Rail Rush : course sans fin sur 3 voies, en fausse 3D (projection en perspective dessinée à la main).
// Monde : x = côté (voies en -2,4 / 0 / 2,4), y = hauteur, z = distance devant le joueur.
// Nouveautés : rampes pour courir sur le toit des trains, cycle jour/nuit, portiques, murets tagués.

const W = 540, H = 760;
const toile = document.getElementById("course");
const ctx = toile.getContext("2d");
const surcouche = document.getElementById("surcouche");

const VOIES = [-2.4, 0, 2.4];
const CAM_H = 3.6, CAM_D = 6.5, HORIZON = 240;
const VITESSE_DEPART = 13, VITESSE_MAX = 30;
const GRAVITE = 32, SAUT = 11, SUPER_SAUT = 16;
const H_TRAIN = 2.7;
const DUREES = { aimant: 10, jetpack: 7, double: 12, baskets: 12 };
const COULEURS_TRAINS = ["#f76707", "#1c7ed6", "#2f9e44", "#e03131", "#7048e8", "#0c8599"];

let jeu = null;
let camX = 0, focale = 470, roulis = 0;

function projeter(x, y, z) {
  const k = focale / (z + CAM_D);
  return [W / 2 + (x - camX) * k, HORIZON + (CAM_H - y) * k, k];
}

// ------------------------------------------------------------ ambiance : jour, coucher de soleil, nuit, aube
const AMBIANCES = [
  { haut: [74, 144, 226], bas: [170, 214, 255], sol: [120, 105, 90], nuit: 0 },
  { haut: [95, 61, 196], bas: [255, 146, 90], sol: [110, 88, 78], nuit: 0.35 },
  { haut: [12, 10, 40], bas: [52, 40, 110], sol: [55, 50, 62], nuit: 1 },
  { haut: [240, 101, 149], bas: [255, 212, 150], sol: [115, 96, 86], nuit: 0.2 },
];
function ambiance(distance) {
  const p = (distance / 700) % AMBIANCES.length;
  const i = Math.floor(p), f = Math.min(1, Math.max(0, (p - i - 0.7) / 0.3)); // transition sur la fin de chaque période
  const a = AMBIANCES[i], b = AMBIANCES[(i + 1) % AMBIANCES.length];
  const mix = (u, v) => u.map((c, k) => Math.round(c + (v[k] - c) * f));
  return { haut: mix(a.haut, b.haut), bas: mix(a.bas, b.bas), sol: mix(a.sol, b.sol), nuit: a.nuit + (b.nuit - a.nuit) * f };
}
const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

// ------------------------------------------------------------ génération du parcours
function hasard(a, b) { return a + Math.random() * (b - a); }
function choix(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

function genererJusqua(zMax) {
  while (jeu.zGen < zMax) {
    const z = jeu.zGen;
    const difficulte = Math.min(1, jeu.distance / 2500);
    const libre = Math.floor(Math.random() * 3);  // une voie toujours praticable au sol
    const motif = Math.random();
    for (let v = 0; v < 3; v++) {
      if (v === libre) continue;
      const r = Math.random();
      if (r < 0.4 + difficulte * 0.2) {
        const long = choix([10, 14, 20]);
        const roule = Math.random() < difficulte * 0.4;
        const train = { type: "train", voie: v, z, long, h: H_TRAIN, v: roule ? hasard(4, 8) : 0, couleur: choix(COULEURS_TRAINS), numero: 100 + Math.floor(Math.random() * 900) };
        jeu.objets.push(train);
        if (!roule && Math.random() < 0.45) { // rampe pour monter sur le toit, avec des pièces là-haut
          jeu.objets.push({ type: "rampe", voie: v, z: z - 7, long: 7, h: H_TRAIN });
          for (let k = 0; k < Math.floor(long / 2.2); k++) jeu.objets.push({ type: "piece", voie: v, z: z + 1 + k * 2.2, long: .3, y: H_TRAIN + 1 });
        }
      } else if (r < 0.64) {
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
    jeu.zGen += Math.max(13, 24 - difficulte * 9);
  }
}

function ajouterDecor(z) {
  for (const cote of [-1, 1]) {
    const haut = hasard(7, 20);
    jeu.decor.push({
      cote, z: z + hasard(0, 2), larg: hasard(4, 7), haut, prof: hasard(5, 8),
      couleur: choix(["#5f3dc4", "#862e9c", "#364fc7", "#c2255c", "#495057", "#0b7285", "#e8590c", "#2b8a3e"]),
      fenetres: Array.from({ length: 3 * Math.floor(haut / 2.5) }, () => Math.random() < 0.55),
      enseigne: Math.random() < 0.25 ? choix(["#ff2fd0", "#3ee0e8", "#ffd43b", "#51cf66"]) : null,
    });
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
    voie: 1, x: 0, y: 0, vy: 0, sol: 0, glisse: 0, bonus: {}, objets: [], zGen: 30, decor: [],
    particules: [], pieceHud: [], textes: [], fini: false, temps: 0, secousse: 0, flash: 0, compte: 3,
    dernier: performance.now(), pas: 0, horsSol: 0,
  };
  camX = 0; roulis = 0;
  for (let z = 0; z < 170; z += 7.5) ajouterDecor(z);
  genererJusqua(170);
  surcouche.classList.add("cache");
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("course");
  for (const n of [3, 2, 1, "GO !"]) {
    jeu.compte = n;
    Sons.jouer(n === "GO !" ? "bonus" : "tic");
    dessiner(0);
    await new Promise((ok) => setTimeout(ok, n === "GO !" ? 300 : 500));
  }
  jeu.compte = 0;
  jeu.dernier = performance.now();
  requestAnimationFrame(boucle);
}

// ------------------------------------------------------------ commandes
function commande(c) {
  if (!jeu || jeu.fini || jeu.compte) return;
  if (c === "gauche" && jeu.voie > 0) { jeu.voie--; Sons.jouer("deplace"); }
  if (c === "droite" && jeu.voie < 2) { jeu.voie++; Sons.jouer("deplace"); }
  if (c === "haut" && jeu.y <= jeu.sol + 0.05 && !jeu.bonus.jetpack) {
    jeu.vy = jeu.bonus.baskets ? SUPER_SAUT : SAUT;
    jeu.glisse = 0;
    Sons.jouer("saut");
    if (jeu.bonus.baskets) for (let i = 0; i < 12; i++) jeu.particules.push({ x: jeu.x, y: jeu.y, z: 0, vx: hasard(-3, 3), vy: hasard(0, 3), vz: hasard(-2, 1), vie: .6, couleur: "#8ce99a" });
  }
  if (c === "bas" && !jeu.bonus.jetpack) {
    if (jeu.y > jeu.sol + 0.05) jeu.vy = -24; // redescend vite
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

const voieDe = (x) => VOIES.reduce((m, v, i) => (Math.abs(x - v) < Math.abs(x - VOIES[m]) ? i : m), 0);

// Hauteur du sol sous le joueur : rails, rampe ou toit d'un train (si on est déjà dessus).
function solSous(voie) {
  let sol = 0;
  for (const o of jeu.objets) {
    if (o.voie !== voie || o.z > 0.3 || o.z + o.long < -0.3) continue;
    if (o.type === "rampe") sol = Math.max(sol, o.h * Math.min(1, Math.max(0, -o.z / o.long)));
    else if (o.type === "train" && jeu.y >= o.h - 0.45) sol = Math.max(sol, o.h);
  }
  return sol;
}

function avancer(dt) {
  jeu.temps += dt;
  jeu.vitesse = Math.min(VITESSE_MAX, VITESSE_DEPART + jeu.temps * 0.22);
  const dz = jeu.vitesse * dt;
  jeu.distance += dz;
  const mult = jeu.bonus.double ? 2 : 1;
  jeu.scoreDistance += dz * mult;
  jeu.score = Math.floor(jeu.scoreDistance) + jeu.pointsPieces;
  jeu.pas += dz;

  // déplacement latéral (la caméra suit et penche dans le virage)
  const avantX = jeu.x;
  jeu.x += (VOIES[jeu.voie] - jeu.x) * Math.min(1, dt * 14);
  const vise = Math.max(-0.12, Math.min(0.12, ((jeu.x - avantX) / Math.max(dt, 1e-3)) * -0.012));
  roulis += (vise - roulis) * Math.min(1, dt * 8);
  camX += (jeu.x * 0.6 - camX) * Math.min(1, dt * 5);
  focale += (470 + (jeu.vitesse - VITESSE_DEPART) * 5 - focale) * Math.min(1, dt * 2);

  // hauteur : jetpack, sinon gravité avec sol variable (rampes et toits)
  const voie = voieDe(jeu.x);
  jeu.sol = solSous(voie);
  if (jeu.bonus.jetpack) {
    jeu.y += (5.5 - jeu.y) * Math.min(1, dt * 3);
    jeu.vy = 0;
    for (let i = 0; i < 2; i++) jeu.particules.push({ x: jeu.x + hasard(-.3, .3), y: jeu.y + 0.7, z: -0.4, vx: hasard(-1, 1), vy: -5, vz: -3, vie: .5, couleur: choix(["#ffd43b", "#ff922b", "#fff", "#adb5bd"]) });
  } else {
    const avantY = jeu.y;
    jeu.vy -= GRAVITE * dt;
    jeu.y += jeu.vy * dt;
    if (jeu.y <= jeu.sol + 0.02 || (jeu.vy <= 0 && jeu.y - jeu.sol < 0.6 && avantY >= jeu.sol - 0.6)) {
      if (jeu.vy < -14) { jeu.secousse = 6; Sons.jouer("pose"); } // atterrissage lourd
      jeu.y = jeu.sol;
      jeu.vy = 0;
    }
  }
  if (jeu.glisse > 0) jeu.glisse -= dt;
  for (const b of Object.keys(jeu.bonus)) {
    jeu.bonus[b] -= dt;
    if (jeu.bonus[b] <= 0) {
      delete jeu.bonus[b];
      if (b === "jetpack") jeu.vy = 0;
    }
  }
  // poussière sous les pieds
  if (jeu.y <= jeu.sol + 0.05 && Math.random() < .35) jeu.particules.push({ x: jeu.x + hasard(-.3, .3), y: jeu.y + .05, z: -.2, vx: hasard(-.5, .5), vy: hasard(.5, 1.5), vz: -jeu.vitesse * .3, vie: .35, couleur: "rgba(220,200,170,.8)" });

  // le monde avance vers le joueur ; l'aimant attire les pièces
  for (const o of jeu.objets) {
    o.z -= dz + (o.v || 0) * dt;
    if (jeu.bonus.aimant && o.type === "piece" && o.z < 16 && o.z > -1) {
      o.xAimant = (o.xAimant ?? VOIES[o.voie]) + (jeu.x - (o.xAimant ?? VOIES[o.voie])) * Math.min(1, dt * 6);
      o.y += (jeu.y + 1 - o.y) * Math.min(1, dt * 6);
    }
  }
  for (const d of jeu.decor) d.z -= dz;
  jeu.zGen -= dz;
  jeu.objets = jeu.objets.filter((o) => o.z + (o.long || 0) > -7 && !o.pris);
  jeu.decor = jeu.decor.filter((d) => d.z + d.prof > -9);
  while (jeu.decor.length < 50) ajouterDecor(Math.max(...jeu.decor.map((d) => d.z), 100) + 7.5);
  genererJusqua(175);

  // collisions
  for (const o of jeu.objets) {
    const devant = o.z < 0.6 && o.z + (o.long || 0) > -0.6;
    if (!devant) continue;
    if (o.type === "piece") {
      const px = o.xAimant ?? VOIES[o.voie];
      const proche = Math.abs(px - jeu.x) < 1.1 || jeu.bonus.aimant;
      if (proche && (Math.abs(o.y - (jeu.y + 1)) < 1.6 || jeu.bonus.aimant || jeu.bonus.jetpack)) {
        o.pris = true;
        jeu.pieces++;
        jeu.pointsPieces += 10 * mult;
        Sons.jouer("piece");
        const [sx, sy] = projeter(px, o.y, 0.5);
        jeu.pieceHud.push({ x: sx, y: sy, t: 0 });
      }
      continue;
    }
    if (o.voie !== voie) continue;
    if (o.type === "bonus") {
      o.pris = true;
      jeu.bonus[o.genre] = DUREES[o.genre];
      Sons.jouer(o.genre === "jetpack" ? "jetpack" : "bonus_pris");
      jeu.flash = .5;
      jeu.textes.push({ t: { aimant: "AIMANT !", jetpack: "JETPACK !", double: "SCORE x2 !", baskets: "SUPER-BASKETS !" }[o.genre], vie: 1.5 });
      if (o.genre === "jetpack") jeu.objets.push(...Array.from({ length: 30 }, (_, k) => ({ type: "piece", voie, z: 12 + k * 2.2, long: .3, y: 6.5 })));
      continue;
    }
    if (jeu.bonus.jetpack || o.type === "rampe") continue;
    const touche = o.type === "train" ? jeu.y < o.h - 0.45
      : o.type === "basse" ? jeu.y < 0.9
      : o.type === "haute" ? !(jeu.glisse > 0 && jeu.y < 0.5) && jeu.y < 2.4 : false;
    if (touche) return crash(o);
  }
}

async function crash(o) {
  jeu.fini = true;
  jeu.secousse = 24;
  jeu.flash = 1;
  Sons.musique.arreter();
  Sons.jouer("crash");
  Sons.jouer("perte_bille");
  for (let i = 0; i < 40; i++) jeu.particules.push({ x: jeu.x, y: jeu.y + 1, z: 0.3, vx: hasard(-6, 6), vy: hasard(1, 9), vz: hasard(-2, 3), vie: 1, couleur: choix(["#fff", "#ffd43b", "#ff6b6b", "#74c0fc"]) });
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

// ------------------------------------------------------------ dessin : outils
function polygone(points, couleur) {
  ctx.fillStyle = couleur;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function assombrir(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.floor((n >> 16) * k)},${Math.floor(((n >> 8) & 255) * k)},${Math.floor((n & 255) * k)})`;
}

// Point interpolé sur un quadrilatère projeté (u de gauche à droite, v de haut en bas) : pour poser fenêtres et portes.
function surFace(A, B, C, D, u, v) {
  const hx = A[0] + (B[0] - A[0]) * u, hy = A[1] + (B[1] - A[1]) * u;
  const bx = D[0] + (C[0] - D[0]) * u, by = D[1] + (C[1] - D[1]) * u;
  return [hx + (bx - hx) * v, hy + (by - hy) * v];
}
function rectSurFace(A, B, C, D, u0, u1, v0, v1, couleur) {
  polygone([surFace(A, B, C, D, u0, v0), surFace(A, B, C, D, u1, v0), surFace(A, B, C, D, u1, v1), surFace(A, B, C, D, u0, v1)], couleur);
}

// Boîte en perspective : renvoie les coins projetés pour y ajouter des détails.
function boite(x, largeur, hauteur, z0, z1, couleurs, base = 0) {
  z0 = Math.max(z0, -CAM_D + 0.9);
  if (z1 <= z0) return null;
  const g = x - largeur / 2, d = x + largeur / 2;
  const P = { ag0: projeter(g, base, z0), ad0: projeter(d, base, z0), agh: projeter(g, base + hauteur, z0), adh: projeter(d, base + hauteur, z0),
    ag1: projeter(g, base, z1), ad1: projeter(d, base, z1), agh1: projeter(g, base + hauteur, z1), adh1: projeter(d, base + hauteur, z1) };
  if (couleurs.dessus) polygone([P.agh, P.adh, P.adh1, P.agh1], couleurs.dessus);
  P.coteGauche = x > camX;
  if (P.coteGauche) polygone([P.agh1, P.agh, P.ag0, P.ag1], couleurs.cote);
  else polygone([P.adh, P.adh1, P.ad1, P.ad0], couleurs.cote);
  polygone([P.agh, P.adh, P.ad0, P.ag0], couleurs.avant);
  return P;
}

// ------------------------------------------------------------ dessin : objets
function dessinerTrain(o, amb) {
  const x = VOIES[o.voie];
  const nuit = amb.nuit;
  const P = boite(x, 2.1, o.h, o.z, o.z + o.long, { avant: o.couleur, cote: assombrir(o.couleur, .7), dessus: "#ced4da" });
  if (!P) return;
  // côté : bande, fenêtres éclairées la nuit, portes
  const [A, B, C, D] = P.coteGauche ? [P.agh1, P.agh, P.ag0, P.ag1] : [P.adh, P.adh1, P.ad1, P.ad0];
  const sens = P.coteGauche ? (u) => 1 - u : (u) => u; // u = 0 à l'avant du train
  rectSurFace(A, B, C, D, 0, 1, .58, .66, "rgba(255,255,255,.85)");
  const nb = Math.floor(o.long / 2.2);
  for (let i = 0; i < nb; i++) {
    const u0 = sens((i + .2) / nb), u1 = sens((i + .75) / nb);
    rectSurFace(A, B, C, D, Math.min(u0, u1), Math.max(u0, u1), .18, .45, nuit > .4 ? "rgba(255, 224, 130, .9)" : "#1b1340");
  }
  rectSurFace(A, B, C, D, 0, 1, .9, 1, "#212529"); // châssis
  // toit : climatiseurs
  if (o.z > -3) {
    for (let k = 1; k < o.long / 5; k++) boite(x, .9, .35, o.z + k * 5, o.z + k * 5 + 1.4, { avant: "#adb5bd", cote: "#868e96", dessus: "#dee2e6" }, o.h);
  }
  // face avant : pare-brise en deux parties, phares, numéro
  const F = [P.agh, P.adh, P.ad0, P.ag0];
  if (o.z < -CAM_D + 1.2) return;
  rectSurFace(...F, .08, .47, .1, .42, "#1b1340");
  rectSurFace(...F, .53, .92, .1, .42, "#1b1340");
  rectSurFace(...F, .12, .3, .14, .2, "rgba(255,255,255,.35)");
  rectSurFace(...F, .1, .9, .55, .62, "#fff");
  rectSurFace(...F, .38, .62, .66, .78, "#212529");
  const [nx, ny] = surFace(...F, .5, .74), l = P.adh[0] - P.agh[0];
  ctx.fillStyle = "#ffe066"; ctx.font = `900 ${Math.max(6, l * .09)}px Arial Black, sans-serif`; ctx.textAlign = "center";
  ctx.fillText(o.numero, nx, ny); ctx.textAlign = "start";
  for (const u of [.18, .82]) {
    const [px, py] = surFace(...F, u, .82);
    ctx.fillStyle = "#fff9db";
    ctx.shadowColor = "#ffe066"; ctx.shadowBlur = (o.v ? 25 : 8) + nuit * 25;
    ctx.beginPath(); ctx.arc(px, py, l * .06, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (o.v && nuit > .3 && o.z > 2) { // faisceau des phares la nuit
    const g = ctx.createLinearGradient(0, P.ag0[1], 0, H);
    g.addColorStop(0, `rgba(255, 240, 180, ${.35 * nuit})`); g.addColorStop(1, "rgba(255, 240, 180, 0)");
    polygone([P.ag0, P.ad0, projeter(x + 1.6, 0, Math.max(-CAM_D + 1, o.z - 12)), projeter(x - 1.6, 0, Math.max(-CAM_D + 1, o.z - 12))], g);
  }
}

function dessinerRampe(o) {
  const x = VOIES[o.voie];
  const z0 = Math.max(o.z, -CAM_D + 0.9), z1 = o.z + o.long;
  if (z1 <= z0) return;
  const hz = (z) => o.h * Math.min(1, Math.max(0, (z - o.z) / o.long));
  const a = projeter(x - 1, hz(z0), z0), b = projeter(x + 1, hz(z0), z0), c = projeter(x + 1, o.h, z1), d = projeter(x - 1, o.h, z1);
  const cote = x > camX ? [projeter(x - 1, 0, z0), a, d, projeter(x - 1, 0, z1)] : [projeter(x + 1, 0, z0), b, c, projeter(x + 1, 0, z1)];
  polygone(cote, "#5c5f66");
  polygone([a, b, c, d], "#fab005");
  ctx.save(); // bandes noires en biais
  ctx.beginPath(); [a, b, c, d].forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.clip();
  for (let i = 0; i < 8; i++) {
    const p = surFace(d, c, b, a, 0, (i + .3) / 8), q = surFace(d, c, b, a, 1, (i + .55) / 8);
    ctx.strokeStyle = "#212529"; ctx.lineWidth = Math.max(1, a[2] * .12);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
  ctx.restore();
}

function dessinerBarriere(o, t) {
  const x = VOIES[o.voie];
  const haute = o.type === "haute";
  const pg = projeter(x - 1.05, 0, o.z), pd = projeter(x + 1.05, 0, o.z);
  const k = pg[2];
  const bas = haute ? 1.35 : 0.25, haut = haute ? 2.35 : 0.95;
  const yb = projeter(x, bas, o.z)[1], yh = projeter(x, haut, o.z)[1];
  ctx.fillStyle = "#adb5bd";
  ctx.fillRect(pg[0], yh, k * .13, pg[1] - yh);
  ctx.fillRect(pd[0] - k * .13, yh, k * .13, pd[1] - yh);
  ctx.save();
  ctx.beginPath(); ctx.rect(pg[0], yh, pd[0] - pg[0], yb - yh); ctx.clip();
  const w = (pd[0] - pg[0]) / 8;
  for (let i = -2; i < 12; i++) {
    ctx.fillStyle = i % 2 ? "#fff" : "#e03131";
    ctx.beginPath(); ctx.moveTo(pg[0] + i * w, yb); ctx.lineTo(pg[0] + (i + 1) * w, yb); ctx.lineTo(pg[0] + (i + 2) * w, yh); ctx.lineTo(pg[0] + (i + 1) * w, yh); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "#343a40"; ctx.lineWidth = Math.max(1, k * .04);
  ctx.strokeRect(pg[0], yh, pd[0] - pg[0], yb - yh);
  // feux clignotants
  const allume = Math.sin(t * 10 + o.z) > 0;
  for (const px of [pg[0] + k * .07, pd[0] - k * .07]) {
    ctx.fillStyle = allume ? "#ffd43b" : "#7a5c00";
    ctx.shadowColor = "#ffd43b"; ctx.shadowBlur = allume ? 14 : 0;
    ctx.beginPath(); ctx.arc(px, yh - k * .08, k * .08, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (haute && o.z > 2) {
    ctx.fillStyle = "#ffe066";
    ctx.font = `900 ${Math.max(8, k * .5)}px Arial Black, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("▼", (pg[0] + pd[0]) / 2, (yh + yb) / 2 + k * .18);
    ctx.textAlign = "start";
  }
}

function dessinerPiece(o, t) {
  const [sx, sy, k] = projeter(o.xAimant ?? VOIES[o.voie], o.y, o.z);
  const r = k * .36;
  const l = Math.abs(Math.cos(t * 5 + o.z)) * r + 1;
  ctx.shadowColor = "#ffd43b"; ctx.shadowBlur = 10;
  ctx.fillStyle = "#e8a200";
  ctx.beginPath(); ctx.ellipse(sx, sy, l, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffd43b";
  ctx.beginPath(); ctx.ellipse(sx, sy, l * .78, r * .78, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.beginPath(); ctx.ellipse(sx - l * .25, sy - r * .3, l * .2, r * .15, 0, 0, Math.PI * 2); ctx.fill();
}

const ICONES = { aimant: ["🧲", "#e03131"], jetpack: ["🚀", "#1c7ed6"], double: ["x2", "#f08c00"], baskets: ["👟", "#2f9e44"] };
function dessinerBonus(o, t) {
  const [sx, sy, k] = projeter(VOIES[o.voie], o.y + Math.sin(t * 4) * .15, o.z);
  const r = k * .55;
  const [ic, c] = ICONES[o.genre];
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.sin(t * 3) * .2);
  ctx.shadowColor = c; ctx.shadowBlur = 25;
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, k * .08); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.beginPath(); ctx.ellipse(-r * .25, -r * .4, r * .45, r * .22, -.4, 0, Math.PI * 2); ctx.fill();
  ctx.font = `900 ${r}px sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff"; ctx.fillText(ic, 0, 1);
  ctx.restore();
}

function dessinerPortique(z, amb, t) { // portique électrique au-dessus des voies
  const g1 = projeter(-4.1, 0, z), g2 = projeter(-4.1, 6.2, z), d1 = projeter(4.1, 0, z), d2 = projeter(4.1, 6.2, z);
  const k = g1[2];
  ctx.strokeStyle = "#495057"; ctx.lineWidth = Math.max(1, k * .18);
  ctx.beginPath(); ctx.moveTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.lineTo(d2[0], d2[1]); ctx.lineTo(d1[0], d1[1]); ctx.stroke();
  ctx.lineWidth = Math.max(1, k * .04);
  ctx.strokeStyle = "#868e96";
  const f1 = projeter(-4.1, 5.6, z), f2 = projeter(4.1, 5.6, z);
  ctx.beginPath(); ctx.moveTo(f1[0], f1[1]); ctx.lineTo(f2[0], f2[1]); ctx.stroke();
  // feux de signalisation
  const [sx, sy] = projeter(-3.6, 5.4, z);
  ctx.fillStyle = "#212529"; ctx.fillRect(sx - k * .15, sy - k * .1, k * .3, k * .6);
  const vert = Math.floor(t + z) % 3 !== 0;
  ctx.fillStyle = vert ? "#51cf66" : "#ff6b6b";
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10 + amb.nuit * 20;
  ctx.beginPath(); ctx.arc(sx, sy + (vert ? k * .35 : k * .08), k * .09, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

function dessinerImmeuble(d, amb) {
  const x = d.cote * (6.4 + d.larg / 2);
  const P = boite(x, d.larg, d.haut, d.z, d.z + d.prof, { avant: rgbMix(d.couleur, amb), cote: rgbMix(d.couleur, amb, .65), dessus: amb.nuit > .5 ? "#212529" : "#495057" });
  if (!P) return;
  const F = [P.agh, P.adh, P.ad0, P.ag0];
  const lignes = Math.floor(d.haut / 2.5);
  for (let j = 0; j < lignes; j++) for (let i = 0; i < 3; i++) {
    const allume = d.fenetres[j * 3 + i];
    const couleur = allume ? `rgba(255, 224, 130, ${.35 + amb.nuit * .6})` : `rgba(20, 20, 50, ${.4 + amb.nuit * .3})`;
    rectSurFace(...F, .12 + i * .28, .3 + i * .28, .05 + j / lignes * .9, .05 + j / lignes * .9 + .45 / lignes, couleur);
  }
  if (d.enseigne) { // enseigne lumineuse
    rectSurFace(...F, .1, .9, .9, .96, d.enseigne);
  }
}

function rgbMix(hex, amb, k = 1) {
  const n = parseInt(hex.slice(1), 16);
  const f = k * (1 - amb.nuit * .55);
  return `rgb(${Math.floor((n >> 16) * f)},${Math.floor(((n >> 8) & 255) * f)},${Math.floor((n & 255) * f)})`;
}

// ------------------------------------------------------------ dessin : le coureur
function dessinerJoueur(t) {
  const [sx, sy, k] = projeter(jeu.x, jeu.y, 0);
  const [, ombreY, ko] = projeter(jeu.x, jeu.sol, 0);
  const u = k / 100; // 1 unité de dessin = 1 cm
  const haut = jeu.y - jeu.sol;
  ctx.fillStyle = `rgba(0,0,0,${.35 / (1 + haut * .4)})`;
  ctx.beginPath(); ctx.ellipse(sx, ombreY, 48 * ko / 100 / (1 + haut * .15), 13 * ko / 100, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate((VOIES[jeu.voie] - jeu.x) * -0.12);
  const glisse = jeu.glisse > 0 && haut < 0.3;
  const enAir = haut > 0.05 && !jeu.bonus.jetpack;
  const p = jeu.fini ? 0 : Math.sin(jeu.pas * 1.6);
  if (jeu.fini) ctx.rotate(1.2);
  const membre = (x1, y1, a, long, larg, couleur) => {
    ctx.save(); ctx.translate(x1 * u, y1 * u); ctx.rotate(a);
    ctx.fillStyle = couleur; ctx.beginPath(); ctx.roundRect(-larg / 2 * u, 0, larg * u, long * u, larg / 2 * u); ctx.fill();
    ctx.restore();
  };
  const basket = jeu.bonus.baskets ? "#51cf66" : "#f8f9fa";
  if (glisse) { // roulade : boule qui tourne
    ctx.translate(0, -40 * u);
    ctx.rotate(jeu.pas * 3);
    ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.arc(0, 0, 40 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1864ab"; ctx.beginPath(); ctx.arc(0, 0, 40 * u, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.arc(14 * u, -14 * u, 14 * u, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const rebond = enAir ? 0 : Math.abs(Math.sin(jeu.pas * 1.6)) * 6;
  ctx.translate(0, -rebond * u);
  // jambes et baskets
  const jambe = (x, a, couleur) => {
    membre(x, -88, a, 50, 17, couleur);
    ctx.save(); ctx.translate(x * u + Math.sin(a) * -48 * u, -88 * u + Math.cos(a) * 48 * u);
    ctx.fillStyle = basket; ctx.beginPath(); ctx.roundRect(-10 * u, -4 * u, 26 * u, 12 * u, 5 * u); ctx.fill();
    ctx.fillStyle = "#e03131"; ctx.fillRect(-10 * u, 4 * u, 26 * u, 4 * u);
    ctx.restore();
  };
  jambe(-10, enAir ? .9 : p * .75, "#1864ab");
  jambe(10, enAir ? -.2 : -p * .75, "#1c7ed6");
  // sac à dos (ou jetpack)
  ctx.fillStyle = jeu.bonus.jetpack ? "#adb5bd" : "#1098ad";
  ctx.beginPath(); ctx.roundRect(-30 * u, -150 * u, 60 * u, 52 * u, 12 * u); ctx.fill();
  if (jeu.bonus.jetpack) {
    ctx.fillStyle = "#ff922b";
    for (const bx of [-18, 18]) { ctx.beginPath(); ctx.moveTo((bx - 7) * u, -98 * u); ctx.lineTo(bx * u, (-98 + 30 + Math.random() * 18) * u); ctx.lineTo((bx + 7) * u, -98 * u); ctx.fill(); }
  }
  // corps : sweat à capuche
  const g = ctx.createLinearGradient(0, -160 * u, 0, -84 * u);
  g.addColorStop(0, "#ff6b6b"); g.addColorStop(1, "#c92a2a");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-25 * u, -156 * u, 50 * u, 74 * u, 16 * u); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillRect(-4 * u, -140 * u, 8 * u, 30 * u);
  // bras
  membre(-25, -148, enAir ? 2.6 : -p * .9 + .2, 46, 14, "#e03131");
  membre(25, -148, enAir ? -2.6 : p * .9 - .2, 46, 14, "#e03131");
  // tête : capuche, visage (vu de dos : nuque), casquette à l'envers, casque audio
  ctx.fillStyle = "#c92a2a"; ctx.beginPath(); ctx.arc(0, -160 * u, 26 * u, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "#f3c89a"; ctx.beginPath(); ctx.arc(0, -178 * u, 22 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5c3d1e"; ctx.beginPath(); ctx.arc(0, -182 * u, 22 * u, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.arc(0, -186 * u, 23 * u, Math.PI, 0); ctx.fill();
  ctx.fillRect(-16 * u, -190 * u, 32 * u, 7 * u);
  ctx.fillStyle = "#212529";
  ctx.beginPath(); ctx.arc(-22 * u, -178 * u, 6 * u, 0, Math.PI * 2); ctx.arc(22 * u, -178 * u, 6 * u, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (jeu.bonus.aimant) {
    ctx.strokeStyle = `rgba(255, 107, 107, ${.45 + .3 * Math.sin(t * 8)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy - 100 * u, (85 + Math.sin(t * 8) * 8) * u, 0, Math.PI * 2); ctx.stroke();
  }
  if (jeu.bonus.double) {
    ctx.fillStyle = "rgba(255, 146, 43, .25)";
    ctx.beginPath(); ctx.arc(sx, sy - 100 * u, 70 * u, 0, Math.PI * 2); ctx.fill();
  }
}

// ------------------------------------------------------------ dessin : scène complète
function dessiner(dt) {
  const t = performance.now() / 1000;
  const dist = jeu ? jeu.distance : t * 8;
  const amb = ambiance(dist);
  ctx.save();
  ctx.setTransform(toile.width / W, 0, 0, toile.height / H, 0, 0);
  if (jeu && jeu.secousse > 0) {
    ctx.translate((Math.random() - .5) * jeu.secousse, (Math.random() - .5) * jeu.secousse);
    jeu.secousse *= .9;
    if (jeu.secousse < .5) jeu.secousse = 0;
  }
  ctx.translate(W / 2, H / 2); ctx.rotate(roulis); ctx.translate(-W / 2, -H / 2); // la caméra penche

  // ciel
  const ciel = ctx.createLinearGradient(0, 0, 0, HORIZON);
  ciel.addColorStop(0, rgb(amb.haut)); ciel.addColorStop(1, rgb(amb.bas));
  ctx.fillStyle = ciel;
  ctx.fillRect(-60, -60, W + 120, HORIZON + 62);
  if (amb.nuit > .3) { // étoiles
    ctx.fillStyle = `rgba(255,255,255,${(amb.nuit - .3) * 1.3})`;
    for (let i = 0; i < 50; i++) ctx.fillRect((i * 97) % W, (i * 53) % (HORIZON - 40), 2, 2);
  }
  // soleil ou lune
  const astre = amb.nuit > .6;
  ctx.fillStyle = astre ? "#f1f3f5" : "#ffe066";
  ctx.shadowColor = astre ? "#fff" : "#ffd43b"; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(W * .74 - camX * 4, HORIZON - 70, astre ? 30 : 46, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // nuages
  ctx.fillStyle = `rgba(255,255,255,${.7 - amb.nuit * .5})`;
  for (let i = 0; i < 4; i++) {
    const x = ((i * 160 - dist * .6 - camX * 6) % (W + 200) + W + 200) % (W + 200) - 100, y = 40 + i * 30;
    ctx.beginPath(); ctx.ellipse(x, y, 50, 14, 0, 0, Math.PI * 2); ctx.ellipse(x + 30, y - 8, 36, 14, 0, 0, Math.PI * 2); ctx.fill();
  }
  // ville lointaine en deux plans
  for (const [plan, couleur, vit, hmax] of [[0, amb.nuit > .5 ? "#1b1340" : "#5f4b8b", 8, 90], [1, amb.nuit > .5 ? "#251a55" : "#4a3a78", 14, 60]]) {
    ctx.fillStyle = couleur;
    for (let i = 0; i < 16; i++) {
      const bx = ((i * 53 + plan * 25 - camX * vit) % (W + 100) + W + 100) % (W + 100) - 50, bh = 25 + (i * 37 + plan * 11) % hmax;
      ctx.fillRect(bx, HORIZON - bh, 42, bh);
      if (amb.nuit > .4) {
        ctx.fillStyle = "rgba(255, 224, 130, .7)";
        for (let w = 0; w < 4; w++) if ((i + w) % 3) ctx.fillRect(bx + 6 + (w % 2) * 18, HORIZON - bh + 8 + Math.floor(w / 2) * 14, 5, 5);
        ctx.fillStyle = couleur;
      }
    }
  }
  // sol
  const sol = ctx.createLinearGradient(0, HORIZON, 0, H);
  sol.addColorStop(0, rgb(amb.sol, .85)); sol.addColorStop(1, rgb(amb.sol, .5));
  ctx.fillStyle = sol;
  ctx.fillRect(-60, HORIZON, W + 120, H - HORIZON + 60);
  // brume à l'horizon
  const brume = ctx.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 40);
  brume.addColorStop(0, "rgba(255,255,255,0)"); brume.addColorStop(.5, `rgba(${amb.bas.join(",")},.55)`); brume.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = brume; ctx.fillRect(-60, HORIZON - 30, W + 120, 70);

  // murets tagués le long des voies
  for (const cote of [-1, 1]) {
    const x = cote * 4.3;
    for (let z = -(dist % 6) - 6; z < 90; z += 6) {
      const idx = Math.floor((z + dist) / 6);
      const c = ["#e64980", "#15aabf", "#fab005", "#7950f2", "#40c057"][((idx % 5) + 5) % 5];
      const z0 = Math.max(z, -CAM_D + 1);
      const a = projeter(x, 0, z0), b = projeter(x, 1.2, z0), cc = projeter(x, 1.2, z + 6), d = projeter(x, 0, z + 6);
      polygone([a, b, cc, d], rgbMix("#868e96", amb));
      if (z > -2 && z < 60) { // tag coloré
        const p1 = surFace(b, cc, d, a, .15, .25), p2 = surFace(b, cc, d, a, .85, .75);
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, a[2] * .12); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.quadraticCurveTo((p1[0] + p2[0]) / 2, p1[1] - a[2] * .5, p2[0], p2[1]); ctx.stroke();
      }
    }
  }

  // voies : ballast, traverses en bois, rails brillants
  for (const x of VOIES) {
    const a = projeter(x - 1.15, 0, -6), b = projeter(x + 1.15, 0, -6), c = projeter(x + 1.15, 0, 220), d = projeter(x - 1.15, 0, 220);
    polygone([a, b, c, d], rgbMix("#8a7866", amb));
    for (let z = -(dist % 1.4) - 5; z < 75; z += 1.4) {
      const p1 = projeter(x - 1, 0, z), p2 = projeter(x + 1, 0, z), p3 = projeter(x + 1, 0, z + .38), p4 = projeter(x - 1, 0, z + .38);
      polygone([p1, p2, p3, p4], z > 45 ? `rgba(92,61,38,${Math.max(0, 1 - (z - 45) / 30)})` : rgbMix("#6b4a2b", amb));
    }
    for (const r of [-.58, .58]) {
      const p1 = projeter(x + r, .12, -6), p2 = projeter(x + r, .12, 220);
      ctx.strokeStyle = "#495057"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      ctx.strokeStyle = amb.nuit > .5 ? "#adb5bd" : "#e9ecef"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p1[0], p1[1] - 2); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    }
  }
  if (!jeu) return ctx.restore();

  // tout ce qui a de la profondeur, du plus lointain au plus proche
  const scene = [
    ...jeu.decor.map((d) => ({ z: d.z, dessin: () => dessinerImmeuble(d, amb) })),
    ...Array.from({ length: 5 }, (_, i) => { const z = i * 24 - (dist % 24) + 4; return { z, dessin: () => dessinerPortique(z, amb, t) }; }).filter((e) => e.z > -CAM_D + 1.5),
    ...jeu.objets.filter((o) => (o.type === "train" || o.type === "rampe") ? o.z + o.long > -CAM_D + 1 : o.z > -CAM_D + 1).map((o) => ({ z: o.z, dessin: () => {
      if (o.type === "train") dessinerTrain(o, amb);
      else if (o.type === "rampe") dessinerRampe(o);
      else if (o.type === "piece") dessinerPiece(o, t);
      else if (o.type === "bonus") dessinerBonus(o, t);
      else dessinerBarriere(o, t);
    } })),
  ].filter((e) => e.z < 160).sort((a, b) => b.z - a.z);
  let place = false;
  for (const e of scene) {
    if (!place && e.z < 0.2) { dessinerJoueur(t); place = true; }
    e.dessin();
  }
  if (!place) dessinerJoueur(t);

  // particules
  for (let i = jeu.particules.length - 1; i >= 0; i--) {
    const q = jeu.particules[i];
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vy -= 12 * dt; q.vie -= dt;
    if (q.vie <= 0 || q.z < -CAM_D + 1) { jeu.particules.splice(i, 1); continue; }
    const [px, py, k] = projeter(q.x, q.y, q.z);
    ctx.globalAlpha = Math.min(1, q.vie * 2);
    ctx.fillStyle = q.couleur;
    ctx.beginPath(); ctx.arc(px, py, k * .07, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // lignes de vitesse
  if (!jeu.fini && jeu.vitesse > 17) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(.4, (jeu.vitesse - 17) / 30)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, r1 = 180 + Math.random() * 140;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(a) * r1, HORIZON + 90 + Math.sin(a) * r1 * .6);
      ctx.lineTo(W / 2 + Math.cos(a) * (r1 + 80), HORIZON + 90 + Math.sin(a) * (r1 + 80) * .6);
      ctx.stroke();
    }
  }
  ctx.restore();

  // ------------------------------------------------------------ interface (hors caméra)
  ctx.save();
  ctx.setTransform(toile.width / W, 0, 0, toile.height / H, 0, 0);
  const texte = (s, x, y, taille, couleur = "#fff", aligne = "left") => {
    ctx.font = `900 ${taille}px Arial Black, sans-serif`; ctx.textAlign = aligne;
    ctx.lineWidth = 5; ctx.strokeStyle = "#1b1340"; ctx.strokeText(s, x, y);
    ctx.fillStyle = couleur; ctx.fillText(s, x, y); ctx.textAlign = "start";
  };
  const panneau = (x, y, w, h) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(40, 20, 90, .8)"); g.addColorStop(1, "rgba(20, 10, 50, .8)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 2; ctx.stroke();
  };
  panneau(10, 10, 170, 66);
  if (jeu.bonus.double) { ctx.shadowColor = "#ff922b"; ctx.shadowBlur = 20; }
  texte(jeu.score.toLocaleString("fr-FR"), 22, 46, 28, jeu.bonus.double ? "#ffc078" : "#fff");
  ctx.shadowBlur = 0;
  texte(`${Math.floor(jeu.distance)} m`, 22, 68, 15, "#ffe066");
  panneau(W - 130, 10, 120, 46);
  ctx.fillStyle = "#e8a200"; ctx.beginPath(); ctx.arc(W - 106, 33, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.arc(W - 106, 33, 10, 0, Math.PI * 2); ctx.fill();
  texte(String(jeu.pieces), W - 20, 43, 24, "#ffd43b", "right");
  if (jeu.bonus.double) texte("x2", W - 20, 82, 24, "#ff922b", "right");
  // pièces qui s'envolent vers le compteur
  for (let i = jeu.pieceHud.length - 1; i >= 0; i--) {
    const p = jeu.pieceHud[i];
    p.t += dt * 2.5;
    if (p.t >= 1) { jeu.pieceHud.splice(i, 1); continue; }
    const x = p.x + (W - 106 - p.x) * p.t, y = p.y + (33 - p.y) * p.t - Math.sin(p.t * Math.PI) * 60;
    ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.arc(x, y, 9 * (1 - p.t * .4), 0, Math.PI * 2); ctx.fill();
  }
  let yb = H - 24;
  for (const [b, reste] of Object.entries(jeu.bonus)) {
    const [ic, c] = ICONES[b];
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.beginPath(); ctx.roundRect(14, yb - 18, 170, 24, 12); ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.roundRect(14, yb - 18, Math.max(24, 170 * reste / DUREES[b]), 24, 12); ctx.fill();
    texte(ic, 22, yb + 1, 15);
    yb -= 32;
  }
  for (let i = jeu.textes.length - 1; i >= 0; i--) {
    const x = jeu.textes[i];
    x.vie -= dt;
    if (x.vie <= 0) { jeu.textes.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, x.vie * 2);
    const echelle = 1 + Math.max(0, x.vie - 1.2) * 1.5;
    ctx.save(); ctx.translate(W / 2, 170); ctx.scale(echelle, echelle);
    texte(x.t, 0, 0, 34, "#ffe066", "center");
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (jeu.compte) texte(String(jeu.compte), W / 2, 330, jeu.compte === "GO !" ? 90 : 120, jeu.compte === "GO !" ? "#51cf66" : "#fff", "center");
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
(function attente() { if (!jeu) { dessiner(0.016); requestAnimationFrame(attente); } })();
