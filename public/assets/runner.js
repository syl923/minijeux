// Safari Rush : Moka s'est échappé du zoo ! Course sans fin sur 3 chemins, en fausse 3D (perspective dessinée à la main).
// Monde : x = côté (chemins en -2,4 / 0 / 2,4), y = hauteur, z = distance devant le joueur.
// Moka peut se cogner une fois : il trébuche et le gardien du zoo le rattrape. Un second choc avant d'avoir semé
// le gardien, et c'est l'épuisette !

const W = 540, H = 760;
const toile = document.getElementById("course");
const ctx = toile.getContext("2d");
const surcouche = document.getElementById("surcouche");

const VOIES = [-2.4, 0, 2.4];
const CAM_H = 3.6, CAM_D = 6.5, HORIZON = 240;
const VITESSE_DEPART = 13, VITESSE_MAX = 30;
const GRAVITE = 32, SAUT = 11, SUPER_SAUT = 16;
const H_CAMION = 2.7, H_TRONC = 2.2;
const DUREES = { aimant: 10, jetpack: 7, double: 12, baskets: 12 };
const DUREE_TREBUCHE = 7;   // secondes pendant lesquelles le gardien reste sur les talons de Moka
const COULEURS_CAMIONS = ["#5c7a29", "#c98a1a", "#2f7d4f", "#d9480f", "#1c6e8c"];

let jeu = null;
let camX = 0, focale = 470, roulis = 0;

function projeter(x, y, z) {
  const k = focale / (z + CAM_D);
  return [W / 2 + (x - camX) * k, HORIZON + (CAM_H - y) * k, k];
}

// ------------------------------------------------------------ ambiances : savane, forêt, coucher de soleil, nuit
const AMBIANCES = [
  { haut: [70, 150, 230], bas: [255, 228, 170], sol: [201, 170, 88], chemin: [184, 128, 74], nuit: 0, foret: 0 },
  { haut: [40, 120, 110], bas: [170, 225, 160], sol: [74, 138, 62], chemin: [125, 88, 55], nuit: 0.15, foret: 1 },
  { haut: [110, 55, 160], bas: [255, 145, 75], sol: [176, 124, 62], chemin: [155, 98, 58], nuit: 0.3, foret: 0 },
  { haut: [10, 14, 42], bas: [38, 52, 108], sol: [56, 70, 52], chemin: [78, 60, 48], nuit: 1, foret: 0.4 },
];
function ambiance(distance) {
  if (!Number.isFinite(distance) || distance < 0) distance = 0;
  const p = (distance / 700) % AMBIANCES.length;
  const i = Math.floor(p), f = Math.min(1, Math.max(0, (p - i - 0.7) / 0.3)); // transition sur la fin de chaque période
  const a = AMBIANCES[i], b = AMBIANCES[(i + 1) % AMBIANCES.length];
  const mix = (u, v) => u.map((c, k) => Math.round(c + (v[k] - c) * f));
  return { haut: mix(a.haut, b.haut), bas: mix(a.bas, b.bas), sol: mix(a.sol, b.sol), chemin: mix(a.chemin, b.chemin),
    nuit: a.nuit + (b.nuit - a.nuit) * f, foret: a.foret + (b.foret - a.foret) * f };
}
const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)},${a})`;

// ------------------------------------------------------------ génération du parcours
function hasard(a, b) { return a + Math.random() * (b - a); }
function choix(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

function genererJusqua(zMax) {
  while (jeu.zGen < zMax) {
    const z = jeu.zGen;
    const difficulte = Math.min(1, jeu.distance / 2500);
    const libre = Math.floor(Math.random() * 3);  // un chemin toujours praticable au sol
    const motif = Math.random();
    for (let v = 0; v < 3; v++) {
      if (v === libre) continue;
      const r = Math.random();
      if (r < 0.4 + difficulte * 0.2) {
        const tronc = Math.random() < 0.35;
        const long = tronc ? choix([8, 12]) : choix([10, 14, 20]);
        const roule = !tronc && Math.random() < difficulte * 0.4;
        const h = tronc ? H_TRONC : H_CAMION;
        jeu.objets.push({ type: tronc ? "tronc" : "camion", voie: v, z, long, h, v: roule ? hasard(4, 8) : 0,
          couleur: choix(COULEURS_CAMIONS), numero: 1 + Math.floor(Math.random() * 99), zebre: Math.random() < 0.5 });
        if (!roule && Math.random() < 0.45) { // rampe pour grimper dessus, avec des bananes là-haut
          jeu.objets.push({ type: "rampe", voie: v, z: z - 7, long: 7, h });
          for (let k = 0; k < Math.floor(long / 2.2); k++) jeu.objets.push({ type: "banane", voie: v, z: z + 1 + k * 2.2, long: .3, y: h + 1 });
        }
      } else if (r < 0.64) {
        jeu.objets.push({ type: motif < .5 ? "basse" : "haute", voie: v, z: z + hasard(0, 4), long: 0.4, style: Math.random() < .5 ? 0 : 1 });
      }
    }
    // le chemin libre : bananes, parfois un obstacle franchissable, parfois un bonus
    const r = Math.random();
    if (r < 0.25) jeu.objets.push({ type: choix(["basse", "haute"]), voie: libre, z: z + 6, long: 0.4, style: Math.random() < .5 ? 0 : 1 });
    if (Math.random() < 0.09 && jeu.distance > 150) {
      jeu.objets.push({ type: "bonus", genre: choix(Object.keys(DUREES)), voie: libre, z: z + 10, long: 0.5, y: 1 });
    } else {
      const saut = r < 0.25;
      for (let k = 0; k < 6; k++) {
        const zz = z + 3 + k * 1.8;
        const y = saut ? 1 + Math.max(0, 2.2 - Math.abs(zz - (z + 6)) * 0.55) : 1;
        jeu.objets.push({ type: "banane", voie: libre, z: zz, long: 0.3, y });
      }
    }
    jeu.zGen += Math.max(13, 24 - difficulte * 9);
  }
}

// Décor du bord du chemin : arbres, rochers, animaux… selon qu'on est en savane ou en forêt.
function ajouterDecor(z) {
  const amb = ambiance((jeu ? jeu.distance : 0) + z);
  for (const cote of [-1, 1]) {
    const foret = Math.random() < amb.foret;
    const type = foret
      ? choix(["jungle", "jungle", "jungle", "palmier", "fougere", "fougere", "buisson", "rocher"])
      : choix(["acacia", "acacia", "acacia", "buisson", "buisson", "rocher", "termitiere", "baobab", "girafe", "elephant", "palmier"]);
    const grand = ["acacia", "baobab", "jungle", "palmier", "girafe", "elephant"].includes(type);
    jeu.decor.push({ cote, z: z + hasard(0, 2.5), type, dx: grand ? hasard(6.5, 12) : hasard(4.9, 7), taille: hasard(.8, 1.25), graine: Math.random() * 100 });
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
    dernier: performance.now(), pas: 0, trebuche: 0, ralenti: 0, gardien: 1, attrape: 0, etourdi: 0,
  };
  camX = 0; roulis = 0;
  for (let z = 0; z < 170; z += 5) ajouterDecor(z);
  genererJusqua(170);
  surcouche.classList.add("cache");
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("jungle");
  mokaDit("Le gardien du zoo me poursuit ! Cours !", "choc", 2500);
  for (const n of [3, 2, 1, "GO !"]) {
    jeu.compte = n;
    Sons.jouer(n === "GO !" ? "bonus" : "tic");
    dessiner(0);
    await new Promise((ok) => setTimeout(ok, n === "GO !" ? 300 : 500));
  }
  jeu.compte = 0;
  jeu.textes.push({ t: "Reviens ici, Moka !", vie: 1.6, petit: true });
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
  else jeu.attrape = Math.min(1, jeu.attrape + dt * 2.5);
  dessiner(dt);
  if (!jeu.fini || jeu.particules.length || jeu.secousse > 0 || jeu.attrape < 1) requestAnimationFrame(boucle);
}

const voieDe = (x) => VOIES.reduce((m, v, i) => (Math.abs(x - v) < Math.abs(x - VOIES[m]) ? i : m), 0);
const estLong = (o) => o.type === "camion" || o.type === "tronc";

// Hauteur du sol sous le joueur : chemin, rampe ou dessus d'un camion / tronc (si on est déjà dessus).
function solSous(voie) {
  let sol = 0;
  for (const o of jeu.objets) {
    if (o.voie !== voie || o.z > 0.3 || o.z + o.long < -0.3) continue;
    if (o.type === "rampe") sol = Math.max(sol, o.h * Math.min(1, Math.max(0, -o.z / o.long)));
    else if (estLong(o) && jeu.y >= o.h - 0.45) sol = Math.max(sol, o.h);
  }
  return sol;
}

function avancer(dt) {
  jeu.temps += dt;
  const ralenti = jeu.ralenti > 0 ? 0.6 : 1;
  jeu.vitesse = Math.min(VITESSE_MAX, VITESSE_DEPART + jeu.temps * 0.22) * ralenti;
  if (jeu.ralenti > 0) jeu.ralenti -= dt;
  const dz = jeu.vitesse * dt;
  jeu.distance += dz;
  const mult = jeu.bonus.double ? 2 : 1;
  jeu.scoreDistance += dz * mult;
  jeu.score = Math.floor(jeu.scoreDistance) + jeu.pointsPieces;
  jeu.pas += dz;
  const palier = Math.floor(jeu.distance / 500);
  if (palier > (jeu.palier || 0)) {
    jeu.palier = palier;
    jeu.textes.push({ t: `${palier * 500} m ! PLUS VITE !`, vie: 1.6 });
    jeu.flash = .25;
    Sons.jouer("extra");
    mokaDit(["Hou hou ha ha ! Il ne m'aura jamais !", "Plus vite, plus vite !", "Adieu le zoo !"][palier % 3], palier % 2 ? "rire" : "etoiles", 1800);
  }

  // le gardien : sur les talons au départ et après un choc, puis semé
  if (jeu.trebuche > 0) {
    jeu.trebuche -= dt;
    if (jeu.trebuche <= 0) { jeu.textes.push({ t: "Ouf, semé !", vie: 1.4 }); mokaDit("Hé hé, trop lent le gardien !", "rire", 2200); }
  }
  if (jeu.etourdi > 0) jeu.etourdi -= dt;
  const cible = jeu.trebuche > 0 ? 1 : jeu.temps < 2.5 ? 0.9 : 0;
  jeu.gardien += (cible - jeu.gardien) * Math.min(1, dt * (cible > jeu.gardien ? 5 : 1.2));

  // déplacement latéral (la caméra suit et penche dans le virage)
  const avantX = jeu.x;
  jeu.x += (VOIES[jeu.voie] - jeu.x) * Math.min(1, dt * 14);
  const vise = Math.max(-0.12, Math.min(0.12, ((jeu.x - avantX) / Math.max(dt, 1e-3)) * -0.012));
  roulis += (vise - roulis) * Math.min(1, dt * 8);
  camX += (jeu.x * 0.6 - camX) * Math.min(1, dt * 5);
  focale += (470 + (jeu.vitesse - VITESSE_DEPART) * 5 - focale) * Math.min(1, dt * 2);

  // hauteur : jetpack, sinon gravité avec sol variable (rampes, camions, troncs)
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
      if (jeu.vy < -4) jeu.ecrase = Math.min(1, -jeu.vy / 18);
      jeu.y = jeu.sol;
      jeu.vy = 0;
    }
  }
  if (jeu.glisse > 0) jeu.glisse -= dt;
  if (jeu.ecrase) jeu.ecrase = jeu.ecrase < .02 ? 0 : jeu.ecrase * Math.pow(.02, dt);
  for (const b of Object.keys(jeu.bonus)) {
    jeu.bonus[b] -= dt;
    if (jeu.bonus[b] <= 0) {
      delete jeu.bonus[b];
      if (b === "jetpack") jeu.vy = 0;
    }
  }
  // poussière rouge de la piste sous les pieds
  if (jeu.y <= jeu.sol + 0.05 && Math.random() < .45) jeu.particules.push({ x: jeu.x + hasard(-.3, .3), y: jeu.y + .05, z: -.2, vx: hasard(-.6, .6), vy: hasard(.5, 1.6), vz: -jeu.vitesse * .3, vie: .4, couleur: jeu.sol > 0 ? "rgba(200,180,140,.7)" : "rgba(214,160,100,.8)" });

  // le monde avance vers le joueur ; l'aimant attire les bananes
  for (const o of jeu.objets) {
    o.z -= dz + (o.v || 0) * dt;
    if (jeu.bonus.aimant && o.type === "banane" && o.z < 16 && o.z > -1) {
      o.xAimant = (o.xAimant ?? VOIES[o.voie]) + (jeu.x - (o.xAimant ?? VOIES[o.voie])) * Math.min(1, dt * 6);
      o.y += (jeu.y + 1 - o.y) * Math.min(1, dt * 6);
    }
  }
  for (const d of jeu.decor) d.z -= dz;
  jeu.zGen -= dz;
  jeu.objets = jeu.objets.filter((o) => o.z + (o.long || 0) > -7 && !o.pris);
  jeu.decor = jeu.decor.filter((d) => d.z > -CAM_D);
  while (jeu.decor.length < 70) ajouterDecor(Math.max(...jeu.decor.map((d) => d.z), 100) + 5);
  genererJusqua(175);

  // collisions
  for (const o of jeu.objets) {
    const devant = o.z < 0.6 && o.z + (o.long || 0) > -0.6;
    if (!devant || o.touche) continue;
    if (o.type === "banane") {
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
      jeu.textes.push({ t: { aimant: "AIMANT !", jetpack: "JETPACK !", double: "SCORE x2 !", baskets: "SUPER-BOND !" }[o.genre], vie: 1.5 });
      if (o.genre === "jetpack") jeu.objets.push(...Array.from({ length: 30 }, (_, k) => ({ type: "banane", voie, z: 12 + k * 2.2, long: .3, y: 6.5 })));
      continue;
    }
    if (jeu.bonus.jetpack || o.type === "rampe") continue;
    const touche = estLong(o) ? jeu.y < o.h - 0.45
      : o.type === "basse" ? jeu.y < 0.9
      : o.type === "haute" ? !(jeu.glisse > 0 && jeu.y < 0.5) && jeu.y < 2.4 : false;
    if (touche) {
      if (jeu.trebuche > 0) return attrape(o);
      choc(o);
    }
  }
}

// Premier choc : Moka trébuche (il rebondit sur le camion ou renverse l'obstacle) et le gardien arrive.
function choc(o) {
  o.touche = true;
  jeu.trebuche = DUREE_TREBUCHE;
  jeu.ralenti = 0.7;
  jeu.etourdi = 1.2;
  jeu.secousse = 14;
  jeu.flash = .35;
  jeu.glisse = 0;
  Sons.jouer("boing");
  Sons.jouer("alerte");
  if (estLong(o)) { jeu.y = o.h + 0.05; jeu.vy = 6; } // rebond sur le capot, Moka finit sur le toit
  for (let i = 0; i < 16; i++) jeu.particules.push({ x: jeu.x, y: jeu.y + 1.2, z: 0.3, vx: hasard(-4, 4), vy: hasard(2, 6), vz: hasard(-1, 2), vie: .7, couleur: choix(["#ffd43b", "#fff", "#8ce99a"]) });
  jeu.textes = jeu.textes.filter((x) => x.petit);
  jeu.textes.push({ t: "OUILLE !", vie: 1.3 });
  mokaDit("Aïe ! Le gardien me rattrape… plus le droit à l'erreur !", "choc", 3000);
}

// Second choc pendant que le gardien est sur ses talons : capturé !
async function attrape(o) {
  jeu.fini = true;
  jeu.attrape = 0;
  jeu.gardien = 1;
  jeu.secousse = 24;
  jeu.flash = 1;
  Sons.musique.arreter();
  Sons.jouer("crash");
  Sons.jouer("perte_bille");
  for (let i = 0; i < 40; i++) jeu.particules.push({ x: jeu.x, y: jeu.y + 1, z: 0.3, vx: hasard(-6, 6), vy: hasard(1, 9), vz: hasard(-2, 3), vie: 1, couleur: choix(["#fff", "#ffd43b", "#ff6b6b", "#8ce99a"]) });
  jeu.textes = jeu.textes.filter((x) => x.petit);
  jeu.textes.push({ t: "ATTRAPÉ !", vie: 2.2 });
  mokaDit("Nooon ! Retour au zoo…", "ko", 3500);
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
      titre: "Moka s'est fait attraper !",
      emoji: jeu.score >= 3000 ? "🏆" : "🐒",
      lignes: [`${Math.floor(jeu.distance)} m de cavale · ${jeu.pieces} bananes ramassées`],
      fin: r.fin,
      rejouer: lancer,
    });
  }, 1500);
}

// ------------------------------------------------------------ dessin : outils
function polygone(points, couleur) {
  ctx.fillStyle = couleur;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function teinte(hex, amb, k = 1) {
  const n = parseInt(hex.slice(1), 16);
  const f = k * (1 - amb.nuit * .55);
  const bleu = amb.nuit * 25;
  return `rgb(${Math.floor((n >> 16) * f)},${Math.floor(((n >> 8) & 255) * f)},${Math.floor((n & 255) * f + bleu)})`;
}

// Point interpolé sur un quadrilatère projeté (u de gauche à droite, v de haut en bas).
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

// ------------------------------------------------------------ dessin : obstacles
function dessinerCamion(o, amb) {
  const x = VOIES[o.voie];
  const nuit = amb.nuit;
  const P = boite(x, 2.1, o.h, o.z, o.z + o.long, { avant: teinte(o.couleur, amb), cote: teinte(o.couleur, amb, .72), dessus: teinte("#d8c08a", amb) });
  if (!P) return;
  const [A, B, C, D] = P.coteGauche ? [P.agh1, P.agh, P.ag0, P.ag1] : [P.adh, P.adh1, P.ad1, P.ad0];
  const sens = P.coteGauche ? (u) => 1 - u : (u) => u; // u = 0 à l'avant du camion
  // flanc : rayures de zèbre ou cage à barreaux, lettrage ZOO
  if (o.zebre) {
    for (let i = 0; i < o.long * 1.2; i++) {
      const u0 = sens(.18 + i / (o.long * 1.2) * .8), u1 = sens(.18 + (i + .45) / (o.long * 1.2) * .8);
      polygone([surFace(A, B, C, D, Math.min(u0, u1), .08), surFace(A, B, C, D, Math.max(u0, u1), .08),
        surFace(A, B, C, D, Math.max(u0, u1) - .03, .8), surFace(A, B, C, D, Math.min(u0, u1) - .03, .8)], teinte("#1a1a1a", amb));
    }
  } else {
    rectSurFace(A, B, C, D, Math.min(sens(.25), sens(.95)), Math.max(sens(.25), sens(.95)), .1, .78, teinte("#2b2b2b", amb, .9));
    const nb = Math.floor(o.long * 1.5);
    for (let i = 0; i <= nb; i++) {
      const u = sens(.25 + i / nb * .7);
      rectSurFace(A, B, C, D, u - .006, u + .006, .1, .78, teinte("#adb5bd", amb));
    }
  }
  const [cx, cy] = surFace(A, B, C, D, sens(.12), .45);
  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = `900 ${Math.max(6, Math.abs(B[1] - C[1]) * .28)}px Arial Black, sans-serif`; ctx.textAlign = "center";
  ctx.fillText("ZOO", cx, cy); ctx.textAlign = "start";
  rectSurFace(A, B, C, D, 0, 1, .86, 1, "#212529"); // châssis
  // roues : placées à leur vraie position 3D (et cachées dès qu'elles passent derrière la caméra)
  const cote = P.coteGauche ? x - 1.05 : x + 1.05;
  for (const zr of [o.z + 1.4, o.z + o.long - 1.6]) {
    if (zr < -CAM_D + 2.2 || zr > 90) continue;
    const [rx, ry, k] = projeter(cote, .42, zr);
    const r = k * .42;
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.ellipse(rx, ry, r * .55, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#868e96"; ctx.beginPath(); ctx.ellipse(rx, ry, r * .25, r * .45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#495057"; ctx.lineWidth = Math.max(1, r * .08);
    const rot = performance.now() / 60 * (o.v ? 2 : 1);
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(rot) * r * .25, ry + Math.sin(rot) * r * .45); ctx.stroke();
  }
  // face avant : pare-brise, calandre, phares, plaque
  const F = [P.agh, P.adh, P.ad0, P.ag0];
  if (o.z < -CAM_D + 1.2) return;
  rectSurFace(...F, .08, .92, .08, .4, "#10223a");
  rectSurFace(...F, .12, .32, .12, .2, "rgba(255,255,255,.35)");
  rectSurFace(...F, .26, .74, .55, .8, "#343a40");
  for (let i = 0; i < 5; i++) rectSurFace(...F, .28 + i * .095, .31 + i * .095, .58, .77, "#868e96");
  rectSurFace(...F, .05, .95, .84, .93, "#adb5bd");
  const [nx, ny] = surFace(...F, .5, .5), l = P.adh[0] - P.agh[0];
  ctx.fillStyle = "#fff"; ctx.fillRect(nx - l * .14, ny - l * .05, l * .28, l * .09);
  ctx.fillStyle = "#212529"; ctx.font = `900 ${Math.max(5, l * .07)}px Arial Black, sans-serif`; ctx.textAlign = "center";
  ctx.fillText("ZOO " + o.numero, nx, ny + l * .025); ctx.textAlign = "start";
  for (const u of [.13, .87]) {
    const [px, py] = surFace(...F, u, .66);
    ctx.fillStyle = "#fff9db";
    ctx.shadowColor = "#ffe066"; ctx.shadowBlur = (o.v ? 25 : 8) + nuit * 25;
    ctx.beginPath(); ctx.arc(px, py, l * .07, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (o.v && nuit > .3 && o.z > 2) { // faisceau des phares la nuit
    const g = ctx.createLinearGradient(0, P.ag0[1], 0, H);
    g.addColorStop(0, `rgba(255, 240, 180, ${.35 * nuit})`); g.addColorStop(1, "rgba(255, 240, 180, 0)");
    polygone([P.ag0, P.ad0, projeter(x + 1.6, 0, Math.max(-CAM_D + 1, o.z - 12)), projeter(x - 1.6, 0, Math.max(-CAM_D + 1, o.z - 12))], g);
  }
  if (o.v && o.z > 1 && o.z < 40) { // gyrophare orange sur les camions qui roulent
    const [gx, gy] = projeter(x, o.h + .25, o.z + .5);
    const on = Math.sin(performance.now() / 90) > 0;
    ctx.fillStyle = on ? "#ff922b" : "#a64b00"; ctx.shadowColor = "#ff922b"; ctx.shadowBlur = on ? 20 : 0;
    ctx.beginPath(); ctx.arc(gx, gy, Math.max(2, l * .06), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
}

function dessinerTronc(o, amb) {
  const x = VOIES[o.voie];
  const P = boite(x, 2, o.h, o.z, o.z + o.long, { avant: teinte("#8a5a32", amb), cote: teinte("#6b4226", amb), dessus: teinte("#5a7a2a", amb) });
  if (!P) return;
  const [A, B, C, D] = P.coteGauche ? [P.agh1, P.agh, P.ag0, P.ag1] : [P.adh, P.adh1, P.ad1, P.ad0];
  for (let i = 1; i < 7; i++) rectSurFace(A, B, C, D, 0, 1, i / 7 - .015, i / 7 + .015, teinte("#4a2e18", amb)); // écorce
  for (let i = 0; i < o.long / 3; i++) { // champignons et mousse sur le dessus
    const [mx, my, k] = projeter(x + ((i * 37) % 10 - 5) / 8, o.h, o.z + 1.5 + i * 3);
    if (o.z + 1.5 + i * 3 < -CAM_D + 1) continue;
    ctx.fillStyle = teinte("#e03131", amb); ctx.beginPath(); ctx.ellipse(mx, my - k * .12, k * .16, k * .1, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(mx - k * .03, my - k * .12, k * .06, k * .12);
  }
  if (o.z < -CAM_D + 1.2) return;
  // face avant : cernes du bois
  const [cx, cy] = surFace(P.agh, P.adh, P.ad0, P.ag0, .5, .5);
  const r = (P.adh[0] - P.agh[0]) * .46;
  ctx.fillStyle = teinte("#e0b27a", amb); ctx.beginPath(); ctx.ellipse(cx, cy, r, r * .95, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = teinte("#a8743f", amb); ctx.lineWidth = Math.max(1, r * .05);
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.ellipse(cx, cy, r * i / 5, r * .95 * i / 5, 0, 0, Math.PI * 2); ctx.stroke(); }
}

function dessinerRampe(o, amb) {
  const x = VOIES[o.voie];
  const z0 = Math.max(o.z, -CAM_D + 0.9), z1 = o.z + o.long;
  if (z1 <= z0) return;
  const hz = (z) => o.h * Math.min(1, Math.max(0, (z - o.z) / o.long));
  const a = projeter(x - 1, hz(z0), z0), b = projeter(x + 1, hz(z0), z0), c = projeter(x + 1, o.h, z1), d = projeter(x - 1, o.h, z1);
  const cote = x > camX ? [projeter(x - 1, 0, z0), a, d, projeter(x - 1, 0, z1)] : [projeter(x + 1, 0, z0), b, c, projeter(x + 1, 0, z1)];
  polygone(cote, teinte("#5c3d22", amb));
  polygone([a, b, c, d], teinte("#b07a45", amb));
  // planches
  for (let i = 1; i < 9; i++) {
    const p = surFace(d, c, b, a, 0, i / 9), q = surFace(d, c, b, a, 1, i / 9);
    ctx.strokeStyle = teinte("#6b4226", amb); ctx.lineWidth = Math.max(1, a[2] * .05);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
  for (const u of [.12, .88]) { // clous / cordes
    const p = surFace(d, c, b, a, u, 0), q = surFace(d, c, b, a, u, 1);
    ctx.strokeStyle = teinte("#d8c08a", amb); ctx.lineWidth = Math.max(1, a[2] * .04);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
}

// Obstacle bas (à sauter) : tronc couché ou barrière du zoo. Obstacle haut (à glisser dessous) : branche et lianes.
function dessinerObstacle(o, amb, t) {
  const x = VOIES[o.voie];
  const pg = projeter(x - 1.05, 0, o.z), pd = projeter(x + 1.05, 0, o.z);
  const k = pg[2];
  if (o.touche) { ctx.globalAlpha = .45; }
  if (o.type === "basse") {
    const yb = projeter(x, .1, o.z)[1], yh = projeter(x, .85, o.z)[1];
    if (o.style === 0) { // tronc couché
      const hh = yb - yh;
      ctx.fillStyle = teinte("#7a4a24", amb);
      ctx.beginPath(); ctx.roundRect(pg[0] - k * .1, yh, pd[0] - pg[0] + k * .2, hh, hh / 2); ctx.fill();
      ctx.strokeStyle = teinte("#4a2e18", amb); ctx.lineWidth = Math.max(1, k * .03);
      for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(pg[0], yh + hh * i / 3); ctx.lineTo(pd[0], yh + hh * i / 3); ctx.stroke(); }
      ctx.fillStyle = teinte("#e0b27a", amb);
      ctx.beginPath(); ctx.ellipse(pd[0] + k * .05, yh + hh / 2, hh * .28, hh / 2 * .95, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = teinte("#51cf66", amb); // petite pousse
      ctx.beginPath(); ctx.ellipse((pg[0] + pd[0]) / 2, yh - k * .06, k * .1, k * .05, -.5, 0, Math.PI * 2); ctx.fill();
    } else { // barrière du zoo en bois, avec panneau
      ctx.fillStyle = teinte("#8d5a2b", amb);
      for (const px of [pg[0], (pg[0] + pd[0]) / 2, pd[0]]) ctx.fillRect(px - k * .06, yh - k * .15, k * .12, yb - yh + k * .15);
      ctx.fillStyle = teinte("#c08040", amb);
      ctx.fillRect(pg[0], yh, pd[0] - pg[0], (yb - yh) * .3);
      ctx.fillRect(pg[0], yh + (yb - yh) * .55, pd[0] - pg[0], (yb - yh) * .3);
      if (o.z > 1.5) {
        ctx.fillStyle = "#ffd43b"; ctx.fillRect((pg[0] + pd[0]) / 2 - k * .35, yh - k * .42, k * .7, k * .3);
        ctx.fillStyle = "#212529"; ctx.font = `900 ${Math.max(5, k * .18)}px Arial Black, sans-serif`; ctx.textAlign = "center";
        ctx.fillText("ZOO", (pg[0] + pd[0]) / 2, yh - k * .21); ctx.textAlign = "start";
      }
    }
  } else { // branche basse avec lianes et feuilles : il faut glisser
    const yb = projeter(x, 1.35, o.z)[1], yh = projeter(x, 2.2, o.z)[1];
    const hh = yb - yh;
    ctx.fillStyle = teinte("#6b4226", amb); // poteaux-arbres de chaque côté
    ctx.fillRect(pg[0] - k * .12, yh - k * .3, k * .18, pg[1] - yh + k * .3);
    ctx.fillRect(pd[0] - k * .06, yh - k * .3, k * .18, pd[1] - yh + k * .3);
    ctx.fillStyle = teinte("#7a4a24", amb);
    ctx.beginPath(); ctx.roundRect(pg[0] - k * .1, yh, pd[0] - pg[0] + k * .2, hh * .45, hh * .2); ctx.fill();
    for (let i = 0; i < 7; i++) { // lianes qui pendent
      const lx = pg[0] + (pd[0] - pg[0]) * (i + .5) / 7;
      const bal = Math.sin(t * 3 + i) * k * .05;
      ctx.strokeStyle = teinte("#2b8a3e", amb); ctx.lineWidth = Math.max(1, k * .04);
      ctx.beginPath(); ctx.moveTo(lx, yh + hh * .3); ctx.quadraticCurveTo(lx + bal, yb - hh * .1, lx + bal * 2, yb + (i % 2) * k * .1); ctx.stroke();
      ctx.fillStyle = teinte(i % 2 ? "#40c057" : "#69db7c", amb);
      ctx.beginPath(); ctx.ellipse(lx + bal * 2, yb + (i % 2) * k * .1, k * .09, k * .05, .6, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 5; i++) { // feuillage sur la branche
      ctx.fillStyle = teinte(["#2f9e44", "#37b24d", "#2b8a3e"][i % 3], amb);
      ctx.beginPath(); ctx.ellipse(pg[0] + (pd[0] - pg[0]) * (i + .5) / 5, yh, k * .22, k * .12, (i - 2) * .3, 0, Math.PI * 2); ctx.fill();
    }
    if (o.z > 2) {
      ctx.fillStyle = "#ffe066"; ctx.font = `900 ${Math.max(8, k * .5)}px Arial Black, sans-serif`; ctx.textAlign = "center";
      ctx.fillText("▼", (pg[0] + pd[0]) / 2, yb + k * .55); ctx.textAlign = "start";
    }
  }
  ctx.globalAlpha = 1;
}

function dessinerBanane(o, t) {
  const [sx, sy, k] = projeter(o.xAimant ?? VOIES[o.voie], o.y, o.z);
  const r = k * .42;
  const l = Math.cos(t * 4 + o.z); // la banane tourne sur elle-même
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(Math.max(.25, Math.abs(l)) * Math.sign(l || 1), 1);
  ctx.rotate(-.5);
  ctx.shadowColor = "#ffd43b"; ctx.shadowBlur = 12;
  ctx.fillStyle = "#f0b400";
  ctx.beginPath(); ctx.moveTo(-r, -r * .2); ctx.quadraticCurveTo(0, r * 1.2, r, -r * .2); ctx.quadraticCurveTo(0, r * .5, -r, -r * .2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffe14d";
  ctx.beginPath(); ctx.moveTo(-r * .85, -r * .12); ctx.quadraticCurveTo(0, r * .95, r * .85, -r * .12); ctx.quadraticCurveTo(0, r * .62, -r * .85, -r * .12); ctx.fill();
  ctx.fillStyle = "#6b4a00";
  ctx.beginPath(); ctx.arc(-r, -r * .2, r * .1, 0, Math.PI * 2); ctx.arc(r, -r * .2, r * .08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
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

// Portique en bois au-dessus des chemins, avec panneau et lianes (lanternes la nuit).
function dessinerPortique(z, amb, t, n) {
  const g1 = projeter(-4.3, 0, z), g2 = projeter(-4.3, 6, z), d1 = projeter(4.3, 0, z), d2 = projeter(4.3, 6, z);
  const k = g1[2];
  ctx.fillStyle = teinte("#6b4226", amb);
  ctx.fillRect(g1[0] - k * .18, g2[1], k * .36, g1[1] - g2[1]);
  ctx.fillRect(d1[0] - k * .18, d2[1], k * .36, d1[1] - d2[1]);
  ctx.fillStyle = teinte("#8d5a2b", amb);
  ctx.fillRect(g2[0] - k * .4, g2[1] - k * .1, d2[0] - g2[0] + k * .8, k * .38);
  ctx.fillStyle = teinte("#5c3d22", amb);
  for (const [px, py] of [[g2[0], g2[1]], [d2[0], d2[1]]]) { ctx.beginPath(); ctx.moveTo(px - k * .3, py - k * .1); ctx.lineTo(px, py - k * .5); ctx.lineTo(px + k * .3, py - k * .1); ctx.fill(); }
  // panneau
  const [px, py] = projeter(0, 6.35, z);
  const textes = ["SAFARI", "SORTIE", "BANANES →", "SAVANE", "NE PAS NOURRIR"];
  const txt = textes[((n % textes.length) + textes.length) % textes.length];
  ctx.font = `900 ${Math.max(6, k * .42)}px Arial Black, sans-serif`;
  const lw = ctx.measureText(txt).width + k * .5;
  ctx.fillStyle = teinte("#f2d49b", amb); ctx.fillRect(px - lw / 2, py - k * .42, lw, k * .6);
  ctx.strokeStyle = teinte("#5c3d22", amb); ctx.lineWidth = Math.max(1, k * .06); ctx.strokeRect(px - lw / 2, py - k * .42, lw, k * .6);
  ctx.fillStyle = teinte("#5c3d22", amb); ctx.textAlign = "center"; ctx.fillText(txt, px, py + k * .05); ctx.textAlign = "start";
  // lianes
  for (let i = 0; i < 9; i++) {
    const lx = g2[0] + (d2[0] - g2[0]) * (i + .5) / 9;
    const long = k * (.6 + ((i * 7) % 5) * .25);
    ctx.strokeStyle = teinte("#2b8a3e", amb); ctx.lineWidth = Math.max(1, k * .05);
    ctx.beginPath(); ctx.moveTo(lx, g2[1] + k * .25); ctx.quadraticCurveTo(lx + Math.sin(t * 2 + i) * k * .1, g2[1] + long * .6, lx, g2[1] + long); ctx.stroke();
    ctx.fillStyle = teinte("#51cf66", amb); ctx.beginPath(); ctx.ellipse(lx, g2[1] + long, k * .09, k * .05, .5, 0, Math.PI * 2); ctx.fill();
  }
  if (amb.nuit > .4) { // lanternes
    for (const [lx, ly] of [projeter(-4.3, 4.8, z), projeter(4.3, 4.8, z)]) {
      ctx.fillStyle = "#ffe066"; ctx.shadowColor = "#ffa94d"; ctx.shadowBlur = 30 * amb.nuit;
      ctx.beginPath(); ctx.arc(lx, ly, k * .16, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }
}

// ------------------------------------------------------------ dessin : décor (arbres, animaux, rochers)
function dessinerDecor(d, amb, t) {
  const [sx, sy, k] = projeter(d.cote * d.dx, 0, d.z);
  if (sx < -300 || sx > W + 300) return;
  const u = k * d.taille;
  const c = (hex, f = 1) => teinte(hex, amb, f);
  ctx.save();
  ctx.translate(sx, sy);
  if (d.cote > 0) ctx.scale(-1, 1); // dessins en miroir de l'autre côté
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath(); ctx.ellipse(0, 0, u * 1.2, u * .2, 0, 0, Math.PI * 2); ctx.fill();
  switch (d.type) {
    case "acacia": {
      // tronc tordu et branches en éventail
      ctx.strokeStyle = c("#4a2e18"); ctx.lineCap = "round";
      ctx.lineWidth = u * .34; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(u * .3, -u * 1.8, -u * .1, -u * 3.3); ctx.stroke();
      ctx.strokeStyle = c("#6b4226"); ctx.lineWidth = u * .16; ctx.beginPath(); ctx.moveTo(u * .06, -u * .2); ctx.quadraticCurveTo(u * .34, -u * 1.8, 0, -u * 3.2); ctx.stroke();
      ctx.strokeStyle = c("#4a2e18"); ctx.lineWidth = u * .13;
      for (const [bx, by] of [[-1.6, -4.1], [-.7, -4.4], [.5, -4.5], [1.5, -4.2]]) { ctx.beginPath(); ctx.moveTo(0, -u * 3.1); ctx.quadraticCurveTo(bx * u * .4, -u * 3.8, bx * u, by * u); ctx.stroke(); }
      // canopée plate en trois couches (ombre dessous, lumière dessus)
      const vent = Math.sin(t * 1.3 + d.graine) * u * .08;
      ctx.fillStyle = c("#3f5a1c"); ctx.beginPath(); ctx.ellipse(vent, -u * 4.05, u * 3, u * .6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c("#5c7a29"); ctx.beginPath(); ctx.ellipse(vent - u * .2, -u * 4.3, u * 2.7, u * .5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c("#86a83a");
      ctx.beginPath(); ctx.ellipse(vent - u * .8, -u * 4.55, u * 1.5, u * .32, 0, 0, Math.PI * 2); ctx.ellipse(vent + u * 1.1, -u * 4.45, u * 1.1, u * .28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c("#a9c64f"); ctx.beginPath(); ctx.ellipse(vent - u * 1.1, -u * 4.68, u * .6, u * .13, 0, 0, Math.PI * 2); ctx.fill();
      if (d.graine > 70) { // un oiseau posé sur une branche
        ctx.fillStyle = c("#212529"); ctx.beginPath(); ctx.ellipse(u * 1.3, -u * 4.75, u * .18, u * .1, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case "baobab": {
      ctx.fillStyle = c("#8d6e4a");
      ctx.beginPath(); ctx.moveTo(-u * 1, 0); ctx.bezierCurveTo(-u * 1.3, -u * 1.5, -u * .6, -u * 3, -u * .5, -u * 3.4);
      ctx.lineTo(u * .5, -u * 3.4); ctx.bezierCurveTo(u * .6, -u * 3, u * 1.3, -u * 1.5, u * 1, 0); ctx.fill();
      ctx.strokeStyle = c("#8d6e4a"); ctx.lineWidth = u * .16; ctx.lineCap = "round";
      for (const [bx, by] of [[-1.2, -4.2], [-.4, -4.5], [.5, -4.4], [1.3, -4]]) { ctx.beginPath(); ctx.moveTo(bx * .3 * u, -u * 3.3); ctx.lineTo(bx * u, by * u); ctx.stroke(); }
      ctx.fillStyle = c("#6b8e23");
      for (const [bx, by] of [[-1.2, -4.3], [-.4, -4.6], [.5, -4.5], [1.3, -4.1]]) { ctx.beginPath(); ctx.arc(bx * u, by * u, u * .45, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case "palmier": {
      ctx.strokeStyle = c("#8d6e4a"); ctx.lineWidth = u * .22; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(u * .8, -u * 2.5, u * .3, -u * 4.6); ctx.stroke();
      ctx.fillStyle = c("#2f9e44");
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * .5;
        ctx.save(); ctx.translate(u * .3, -u * 4.6); ctx.rotate(a + Math.sin(t * 1.5 + i) * .04);
        ctx.beginPath(); ctx.ellipse(u * 1.1, 0, u * 1.2, u * .22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = c("#7a4a24"); ctx.beginPath(); ctx.arc(u * .2, -u * 4.4, u * .18, 0, Math.PI * 2); ctx.arc(u * .45, -u * 4.35, u * .18, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "jungle": {
      ctx.fillStyle = c("#4a3020"); ctx.fillRect(-u * .28, -u * 5.5, u * .56, u * 5.5);
      ctx.fillStyle = c("#5c3d22"); ctx.fillRect(-u * .1, -u * 5.5, u * .14, u * 5.5);
      ctx.strokeStyle = c("#2b1a0e"); ctx.lineWidth = Math.max(1, u * .04);
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-u * .28, -u * i); ctx.lineTo(u * .28, -u * (i - .15)); ctx.stroke(); }
      ctx.fillStyle = c("#3a2515"); ctx.beginPath(); ctx.moveTo(-u * .28, 0); ctx.lineTo(-u * .9, 0); ctx.lineTo(-u * .28, -u * .9); ctx.fill();
      for (const [bx, by, r, col] of [[-1.2, -5.6, 1.5, "#1f6b33"], [1.2, -5.9, 1.4, "#237a3a"], [0, -6.8, 1.6, "#2b8a3e"], [-.3, -5.3, 1.1, "#2f9e44"]]) {
        ctx.fillStyle = c(col); ctx.beginPath(); ctx.arc(bx * u, by * u, r * u, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = c("#2b8a3e"); ctx.lineWidth = Math.max(1, u * .06);
      for (const lx of [-1.4, .9]) { ctx.beginPath(); ctx.moveTo(lx * u, -u * 5); ctx.quadraticCurveTo((lx + .2) * u, -u * 3, lx * u, -u * 2); ctx.stroke(); }
      ctx.fillStyle = c("#ff6b9d"); ctx.beginPath(); ctx.arc(u * .9, -u * 6.4, u * .15, 0, Math.PI * 2); ctx.arc(-u * 1.1, -u * 6.1, u * .12, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "fougere": {
      for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate(-1.2 + i * .48 + Math.sin(t * 2 + d.graine + i) * .03);
        ctx.fillStyle = c(i % 2 ? "#2f9e44" : "#40c057");
        ctx.beginPath(); ctx.ellipse(0, -u * .8, u * .22, u * .85, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      break;
    }
    case "buisson": {
      const col = amb.foret > .5 ? ["#2b8a3e", "#37b24d"] : ["#8a9a3b", "#a3b04a"];
      ctx.fillStyle = c(col[0]); ctx.beginPath(); ctx.arc(-u * .5, -u * .4, u * .55, 0, Math.PI * 2); ctx.arc(u * .4, -u * .45, u * .6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c(col[1]); ctx.beginPath(); ctx.arc(0, -u * .75, u * .55, 0, Math.PI * 2); ctx.fill();
      if (d.graine > 60) { ctx.fillStyle = c("#e03131"); ctx.beginPath(); ctx.arc(u * .2, -u * .9, u * .08, 0, Math.PI * 2); ctx.arc(-u * .4, -u * .6, u * .07, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case "rocher": {
      ctx.fillStyle = c("#868e96");
      ctx.beginPath(); ctx.moveTo(-u * 1, 0); ctx.quadraticCurveTo(-u * 1.1, -u * .9, -u * .2, -u * 1.1); ctx.quadraticCurveTo(u * 1, -u * 1, u * 1, 0); ctx.fill();
      ctx.fillStyle = c("#adb5bd"); ctx.beginPath(); ctx.ellipse(-u * .3, -u * .8, u * .35, u * .15, -.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "termitiere": {
      ctx.fillStyle = c("#c0763a");
      ctx.beginPath(); ctx.moveTo(-u * .7, 0); ctx.quadraticCurveTo(-u * .5, -u * 1.5, -u * .1, -u * 2.6); ctx.quadraticCurveTo(u * .1, -u * 2.8, u * .2, -u * 2.3);
      ctx.quadraticCurveTo(u * .5, -u * 1.4, u * .7, 0); ctx.fill();
      ctx.fillStyle = c("#a0602c"); ctx.beginPath(); ctx.moveTo(u * .15, -u * 1.6); ctx.quadraticCurveTo(u * .6, -u * 1.9, u * .55, -u * 1.3); ctx.fill();
      break;
    }
    case "girafe": {
      const bob = Math.sin(t * 1.3 + d.graine) * u * .08;
      ctx.strokeStyle = c("#d9a441"); ctx.lineWidth = u * .16; ctx.lineCap = "round";
      for (const lx of [-.6, -.35, .45, .7]) { ctx.beginPath(); ctx.moveTo(lx * u, -u * 1.9); ctx.lineTo(lx * u, 0); ctx.stroke(); }
      ctx.fillStyle = c("#e8b04b"); ctx.beginPath(); ctx.ellipse(0, -u * 2.1, u * .95, u * .45, -.12, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = u * .3; ctx.beginPath(); ctx.moveTo(-u * .6, -u * 2.3); ctx.lineTo(-u * 1.3, -u * 4 + bob); ctx.stroke();
      ctx.fillStyle = c("#e8b04b"); ctx.beginPath(); ctx.ellipse(-u * 1.5, -u * 4.1 + bob, u * .38, u * .2, -.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c("#8d5a2b");
      for (const [px, py] of [[-.2, -2.2], [.4, -2.1], [-.5, -2], [.1, -1.95], [-.85, -2.9], [-1.05, -3.4]]) { ctx.beginPath(); ctx.arc(px * u, py * u + (py < -2.5 ? bob * (py + 2.3) / -1.7 : 0), u * .1, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = c("#8d5a2b"); ctx.lineWidth = u * .06;
      ctx.beginPath(); ctx.moveTo(-u * 1.35, -u * 4.25 + bob); ctx.lineTo(-u * 1.3, -u * 4.55 + bob); ctx.moveTo(-u * 1.5, -u * 4.25 + bob); ctx.lineTo(-u * 1.5, -u * 4.55 + bob); ctx.stroke();
      break;
    }
    case "elephant": {
      const bat = Math.sin(t * 2 + d.graine) * .15;
      ctx.fillStyle = c("#8a8f98");
      for (const lx of [-.8, -.35, .35, .8]) ctx.fillRect(lx * u - u * .17, -u * 1, u * .34, u * 1);
      ctx.beginPath(); ctx.ellipse(0, -u * 1.35, u * 1.25, u * .75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-u * 1.25, -u * 1.55, u * .5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c("#8a8f98"); ctx.lineWidth = u * .2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-u * 1.6, -u * 1.4); ctx.quadraticCurveTo(-u * 1.9, -u * .8, -u * 1.7, -u * .4 + bat * u); ctx.stroke();
      ctx.fillStyle = c("#727780"); ctx.beginPath(); ctx.ellipse(-u * .95, -u * 1.55, u * .35, u * .45, bat, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-u * 1.45, -u * 1.25); ctx.lineTo(-u * 1.75, -u * 1.05); ctx.lineTo(-u * 1.5, -u * 1.15); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// Visage de Moka qui se retourne pour regarder le gardien (dessin officiel de singes.js)
let imgFuite = null;
function teteMokaFuite() {
  if (!imgFuite) imgFuite = imageSVG(singe({ chapeau: "casquette", yeux: "choc", sourcils: "haut", bouche: "o", habit: "aucun", extras: ["goutte"] }), "tete-fuite");
  return imgFuite;
}

// ------------------------------------------------------------ dessin : Moka vu de dos
function dessinerMoka(t) {
  const [sx, sy, k] = projeter(jeu.x, jeu.y, 0);
  const [, ombreY, ko] = projeter(jeu.x, jeu.sol, 0);
  const u = k / 100; // 1 unité de dessin = 1 cm
  const haut = jeu.y - jeu.sol;
  ctx.fillStyle = `rgba(0,0,0,${.35 / (1 + haut * .4)})`;
  ctx.beginPath(); ctx.ellipse(sx, ombreY, 44 * ko / 100 / (1 + haut * .15), 12 * ko / 100, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate((VOIES[jeu.voie] - jeu.x) * -0.12 + (jeu.etourdi > 0 ? Math.sin(t * 20) * .12 : 0));
  const glisse = jeu.glisse > 0 && haut < 0.3;
  const enAir = haut > 0.05 && !jeu.bonus.jetpack;
  const p = jeu.fini ? 0 : Math.sin(jeu.pas * 1.6);
  const FOUR = "#9c6433", FOUR2 = "#7a4a1f", PEAU = "#f3c89a";
  const membre = (x1, y1, a, long, larg, couleur, main) => {
    ctx.save(); ctx.translate(x1 * u, y1 * u); ctx.rotate(a);
    ctx.fillStyle = couleur; ctx.beginPath(); ctx.roundRect(-larg / 2 * u, 0, larg * u, long * u, larg / 2 * u); ctx.fill();
    if (main) { ctx.fillStyle = main; ctx.beginPath(); ctx.arc(0, long * u, larg * .7 * u, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  const queue = (base, amp) => {
    ctx.strokeStyle = FOUR2; ctx.lineWidth = 9 * u; ctx.lineCap = "round";
    const q = Math.sin(t * 6) * amp;
    ctx.beginPath(); ctx.moveTo(0, base * u);
    ctx.bezierCurveTo((30 + q) * u, (base + 10) * u, (55 + q) * u, (base - 30) * u, (38 + q * 1.4) * u, (base - 55) * u);
    ctx.bezierCurveTo((30 + q) * u, (base - 68) * u, (18 + q) * u, (base - 58) * u, (24 + q) * u, (base - 50) * u);
    ctx.stroke();
  };
  if (glisse) { // roulé-boulé : boule de poils qui tourne
    ctx.translate(0, -38 * u);
    ctx.save(); ctx.rotate(jeu.pas * 3);
    ctx.fillStyle = FOUR; ctx.beginPath(); ctx.arc(0, 0, 38 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = FOUR2; ctx.beginPath(); ctx.arc(0, 0, 38 * u, 0, Math.PI * .6); ctx.fill();
    ctx.fillStyle = "#2f9e44"; ctx.beginPath(); ctx.arc(0, 0, 26 * u, Math.PI, Math.PI * 1.8); ctx.lineTo(0, 0); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.arc(0, -30 * u, 20 * u, Math.PI, 0); ctx.fill();
    ctx.restore();
    return [sx, sy - 40 * u];
  }
  const foulee = jeu.pas * 1.6;
  const rebond = enAir ? 0 : Math.abs(Math.sin(foulee)) * 9;
  // écrasement à l'atterrissage, étirement dans les airs
  const e = jeu.ecrase || 0;
  const etire = enAir ? Math.min(.12, Math.abs(jeu.vy) * .008) : 0;
  ctx.translate(0, -rebond * u);
  ctx.scale(1 + e * .18 - etire * .5, 1 - e * .2 + etire);
  ctx.rotate(Math.min(.12, jeu.vitesse * .004));   // penché en avant quand ça va vite
  const TRAIT = "#3d2208";
  const segment = (x1, y1, x2, y2, larg, couleur) => {
    ctx.lineCap = "round";
    ctx.strokeStyle = TRAIT; ctx.lineWidth = (larg + 4) * u; ctx.beginPath(); ctx.moveTo(x1 * u, y1 * u); ctx.lineTo(x2 * u, y2 * u); ctx.stroke();
    ctx.strokeStyle = couleur; ctx.lineWidth = larg * u; ctx.beginPath(); ctx.moveTo(x1 * u, y1 * u); ctx.lineTo(x2 * u, y2 * u); ctx.stroke();
  };
  // jambes en deux morceaux : cuisse, genou qui plie, pied de singe
  const jambe = (hx, phase) => {
    const a = enAir ? (hx < 0 ? .9 : -.5) : Math.sin(foulee + phase) * .9;
    const plie = enAir ? 1.3 : Math.max(0, -Math.cos(foulee + phase)) * 1.4 + .2;
    const gx = hx + Math.sin(a) * -22, gy = -62 + Math.cos(a) * 22;
    const px = gx + Math.sin(a - plie) * -22, py = gy + Math.cos(a - plie) * 22;
    segment(hx, -62, gx, gy, 14, FOUR);
    segment(gx, gy, px, py, 12, FOUR);
    ctx.fillStyle = jeu.bonus.baskets ? "#51cf66" : PEAU; ctx.strokeStyle = TRAIT; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.ellipse(px * u, py * u, 13 * u, 7 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  };
  jambe(-13, 0);
  jambe(13, Math.PI);
  if (!enAir && Math.abs(Math.sin(foulee)) < .12 && Math.random() < .5) { // poussière à chaque foulée
    for (let i = 0; i < 3; i++) jeu.particules.push({ x: jeu.x + (Math.random() - .5) * .5, y: jeu.sol + .05, z: -.2, vx: (Math.random() - .5) * 1.5, vy: 1 + Math.random(), vz: -jeu.vitesse * .25, vie: .35, couleur: "rgba(214,160,100,.8)" });
  }
  // queue qui fouette
  queue(-60, enAir ? 16 : 9 + jeu.vitesse * .3);
  // jetpack
  if (jeu.bonus.jetpack) {
    ctx.fillStyle = "#adb5bd"; ctx.beginPath(); ctx.roundRect(-26 * u, -128 * u, 52 * u, 50 * u, 10 * u); ctx.fill();
    ctx.fillStyle = "#ff922b";
    for (const bx of [-15, 15]) { ctx.beginPath(); ctx.moveTo((bx - 7) * u, -78 * u); ctx.lineTo(bx * u, (-78 + 30 + Math.random() * 18) * u); ctx.lineTo((bx + 7) * u, -78 * u); ctx.fill(); }
  }
  // corps : poils + débardeur vert n° 7, avec contour
  ctx.fillStyle = FOUR; ctx.strokeStyle = TRAIT; ctx.lineWidth = 3 * u;
  ctx.beginPath(); ctx.ellipse(0, -96 * u, 30 * u, 40 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#2f9e44"; ctx.beginPath(); ctx.roundRect(-24 * u, -126 * u, 48 * u, 56 * u, 14 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#237a37"; ctx.fillRect(-24 * u, -80 * u, 48 * u, 6 * u);
  ctx.fillStyle = "#fff"; ctx.font = `900 ${26 * u}px Arial Black, sans-serif`; ctx.textAlign = "center"; ctx.fillText("7", 0, -88 * u); ctx.textAlign = "start";
  // longs bras de singe avec coudes, qui moulinent dans les airs
  const bras = (sx, sens, phase) => {
    const a = enAir ? sens * (2.5 + Math.sin(t * 18) * .3) : Math.sin(foulee + phase) * 1.1 + sens * .25;
    const cx = sx + Math.sin(a) * -28, cy = -118 + Math.cos(a) * 28;
    const b = a - sens * .6;
    const mx = cx + Math.sin(b) * -26, my = cy + Math.cos(b) * 26;
    segment(sx, -118, cx, cy, 12, FOUR);
    segment(cx, cy, mx, my, 11, FOUR);
    ctx.fillStyle = PEAU; ctx.strokeStyle = TRAIT; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.arc(mx * u, my * u, 8 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  };
  bras(-24, -1, Math.PI);
  bras(24, 1, 0);
  // tête : il jette un œil derrière lui quand le gardien est tout près
  const regarde = jeu.gardien > .55 && !jeu.fini && Math.sin(t * 2.3) > .2;
  const hoche = Math.sin(foulee * 2) * 3;
  ctx.translate(0, hoche * u);
  const oreille = Math.sin(t * 14) * 3;
  ctx.fillStyle = FOUR; ctx.strokeStyle = TRAIT; ctx.lineWidth = 2.5 * u;
  for (const ox of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(ox * 27 * u, (-150 + oreille * ox) * u, 11 * u, 12 * u, ox * .3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f3b894"; ctx.beginPath(); ctx.arc(ox * 28 * u, (-150 + oreille * ox) * u, 6 * u, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = FOUR;
  }
  if (regarde) {
    const img = teteMokaFuite();
    if (img.complete) ctx.drawImage(img, -36 * u, -190 * u, 72 * u, 72 * u);
    if (Math.random() < .08) jeu.particules.push({ x: jeu.x + .4, y: jeu.y + 1.9, z: 0, vx: 1.5, vy: 1, vz: 0, vie: .5, couleur: "#74c0fc" });
  } else {
    ctx.fillStyle = FOUR; ctx.beginPath(); ctx.arc(0, -152 * u, 26 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = FOUR2; ctx.beginPath(); ctx.arc(0, -146 * u, 18 * u, .2, Math.PI - .2); ctx.fill();
    ctx.strokeStyle = FOUR2; ctx.lineWidth = 2 * u;   // épis de poils
    ctx.beginPath(); ctx.moveTo(-8 * u, -130 * u); ctx.lineTo(-4 * u, -138 * u); ctx.moveTo(6 * u, -130 * u); ctx.lineTo(3 * u, -139 * u); ctx.stroke();
    ctx.fillStyle = "#e03131"; ctx.strokeStyle = TRAIT; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.arc(0, -160 * u, 26 * u, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#c92a2a"; ctx.fillRect(-12 * u, -162 * u, 24 * u, 5 * u);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -186 * u, 4 * u, 0, Math.PI * 2); ctx.fill();
  }
  // étoiles qui tournent après un choc
  if (jeu.etourdi > 0) {
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + i * 2.1;
      ctx.fillStyle = "#ffd43b"; ctx.font = `${18 * u}px sans-serif`; ctx.textAlign = "center";
      ctx.fillText("★", Math.cos(a) * 34 * u, -190 * u + Math.sin(a) * 8 * u);
    }
    ctx.textAlign = "start";
  }
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
  return [sx, sy - 100 * u];
}

// ------------------------------------------------------------ dessin : le gardien du zoo (vu de dos, en bas de l'écran)
let gardienX = W / 2 + 120;
const CRIS_GARDIEN = ["Reviens ici, Moka !", "Arrête-toi !", "Mes bananes !", "Je vais t'attraper !", "Au voleur de bananes !"];
function dessinerGardien(t, cibleMoka) {
  const p = jeu.gardien;
  if (p < 0.02) return;
  // toujours sur le côté de Moka, pour ne jamais le cacher
  const vise = Math.min(W - 60, Math.max(60, cibleMoka[0] + (cibleMoka[0] < W / 2 ? 165 : -165) + Math.sin(t * 1.7) * 20));
  gardienX += (vise - gardienX) * .1;
  const attrape = jeu.fini ? jeu.attrape : 0;
  const s = .8;
  const enChasse = !jeu.fini;
  const rythme = t * (jeu.trebuche > 0 ? 15 : 12);
  const course = enChasse ? Math.sin(rythme) : 0;
  const rebond = enChasse ? Math.abs(Math.sin(rythme)) * 14 : 0;
  const pieds = H + 290 - 300 * Math.min(1, p) - attrape * 40;
  ctx.save();
  ctx.translate(gardienX, pieds - rebond);
  ctx.scale(s, s);
  ctx.rotate(enChasse ? -.07 + course * .03 : 0); // penché en avant, épaules qui roulent
  // poussière sous les bottes
  if (enChasse && Math.random() < .5) jeu.particules.push({ x: jeu.x + 1.4, y: .05, z: -1.8, vx: (Math.random() - .5) * 2, vy: 1 + Math.random(), vz: -3, vie: .4, couleur: "rgba(214,160,100,.7)" });
  // jambes en deux morceaux (cuisse + mollet), genoux qui plient
  for (const [lx, phase] of [[-18, 0], [18, Math.PI]]) {
    const a = enChasse ? Math.sin(rythme + phase) : 0;
    ctx.save(); ctx.translate(lx, -120); ctx.rotate(a * .55);
    ctx.fillStyle = "#8d6e3a"; ctx.beginPath(); ctx.roundRect(-12, -6, 24, 34, 8); ctx.fill();
    ctx.fillStyle = "#f3c89a"; ctx.fillRect(-9, 26, 18, 16);
    ctx.translate(0, 40); ctx.rotate(Math.max(0, -a) * .9);
    ctx.fillStyle = "#f3c89a"; ctx.fillRect(-9, 0, 18, 30);
    ctx.fillStyle = "#fff"; ctx.fillRect(-10, 24, 20, 16);
    ctx.fillStyle = "#4a2e18"; ctx.beginPath(); ctx.roundRect(-13, 38, 26, 30, 6); ctx.fill();
    ctx.fillStyle = "#2b1a0e"; ctx.fillRect(-13, 62, 26, 6);
    ctx.restore();
  }
  ctx.fillStyle = "#8d6e3a"; ctx.beginPath(); ctx.roundRect(-40, -154, 80, 48, 10); ctx.fill(); // short
  // chemise kaki avec plis et tache de sueur
  ctx.fillStyle = "#c2a878"; ctx.strokeStyle = "#8a7448"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-46, -272, 92, 128, 22); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(120,95,50,.35)"; ctx.beginPath(); ctx.ellipse(0, -230, 22, 18 + Math.abs(course) * 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#a88f5c"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-30, -250); ctx.quadraticCurveTo(-20, -220, -28, -190); ctx.moveTo(30, -250); ctx.quadraticCurveTo(20, -220, 28, -190); ctx.stroke();
  ctx.fillStyle = "#6b4226"; ctx.fillRect(-46, -160, 92, 10); // ceinture
  ctx.fillStyle = "#ffd43b"; ctx.fillRect(-8, -161, 16, 12);
  ctx.fillStyle = "#1c7ed6"; ctx.font = "900 15px Arial Black, sans-serif"; ctx.textAlign = "center"; ctx.fillText("ZOO", 0, -205);
  // bras gauche qui pompe (et qui gesticule de rage quand Moka vient de trébucher)
  const rage = jeu.trebuche > 0 && enChasse;
  ctx.save(); ctx.translate(-44, -258); ctx.rotate(rage ? 2.6 + Math.sin(t * 16) * .5 : .2 + course * .9);
  ctx.fillStyle = "#c2a878"; ctx.fillRect(-11, 0, 22, 36); ctx.fillStyle = "#f3c89a"; ctx.fillRect(-9, 36, 18, 42);
  ctx.beginPath(); ctx.arc(0, 80, 11, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // épuisette : il essaie d'attraper Moka en balayant l'air, et la rabat sur lui à la capture
  const [mx, my] = cibleMoka;
  const coup = jeu.trebuche > 0 ? Math.sin(t * 7) : Math.sin(t * 3.2) * .6;
  const hx0 = -150 + coup * 40, hy0 = -410 + coup * 30 + course * 8;
  const hx = hx0 + ((mx - gardienX) / s - hx0) * attrape;
  const hy = hy0 + ((my - pieds) / s + 10 - hy0) * attrape;
  ctx.strokeStyle = "#8d5a2b"; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(40, -240); ctx.lineTo(hx + 30, hy + 30); ctx.stroke();
  ctx.fillStyle = "#f3c89a"; ctx.beginPath(); ctx.arc(40, -245, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.strokeStyle = "#e9ecef"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(hx, hy, 58, 40, -.4 + coup * .3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(hx + i * 15 - 20, hy - 30); ctx.lineTo(hx + i * 15 + 20, hy + 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + i * 15 + 20, hy - 30); ctx.lineTo(hx + i * 15 - 20, hy + 30); ctx.stroke();
  }
  if (enChasse && jeu.trebuche > 0) { // traits de mouvement de l'épuisette
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(hx, hy, 70 + i * 10, -1.2 - coup, -.6 - coup); ctx.stroke(); }
  }
  // tête qui dodeline, chapeau qui saute un peu en retard, gouttes de sueur
  const tete = enChasse ? Math.sin(rythme * 2) * 3 : 0;
  ctx.translate(tete, -Math.abs(course) * 4);
  ctx.fillStyle = "#f3c89a"; ctx.fillRect(-12, -292, 24, 26);
  ctx.fillStyle = "#6b4226"; ctx.beginPath(); ctx.arc(0, -308, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f3c89a"; ctx.beginPath(); ctx.ellipse(-30, -304, 7, 11, 0, 0, Math.PI * 2); ctx.ellipse(30, -304, 7, 11, 0, 0, Math.PI * 2); ctx.fill();
  const saut = enChasse ? Math.max(0, Math.sin(rythme - .6)) * 10 : 0;
  ctx.fillStyle = "#d8c08a"; ctx.strokeStyle = "#a88f5c"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, -322 - saut, 62, 14, Math.sin(rythme) * .06, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -326 - saut, 32, Math.PI, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#8d6e3a"; ctx.fillRect(-32, -334 - saut, 64, 8);
  if (enChasse) { // souffle court, marques de colère
    for (let i = 0; i < 3; i++) {
      const g = (t * 2.2 + i / 3) % 1;
      ctx.fillStyle = `rgba(255,255,255,${.5 * (1 - g)})`;
      ctx.beginPath(); ctx.arc(-44 - g * 40, -300 - g * 20, 6 + g * 10, 0, Math.PI * 2); ctx.fill();
    }
    if (rage) {
      ctx.strokeStyle = "#e03131"; ctx.lineWidth = 5; ctx.lineCap = "round";
      const r = 1 + Math.sin(t * 12) * .15;
      ctx.save(); ctx.translate(40, -360); ctx.scale(r, r);
      ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-3, -4); ctx.lineTo(-3, -11); ctx.moveTo(10, -4); ctx.lineTo(3, -4); ctx.lineTo(3, -11);
      ctx.moveTo(-10, 4); ctx.lineTo(-3, 4); ctx.lineTo(-3, 11); ctx.moveTo(10, 4); ctx.lineTo(3, 4); ctx.lineTo(3, 11); ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 2; i++) {
      const g = (t * 1.6 + i * .5) % 1;
      ctx.fillStyle = `rgba(116,192,252,${1 - g})`;
      ctx.beginPath(); ctx.ellipse((i ? 36 : -38) + (i ? 8 : -8) * g, -318 + g * 40, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  // il crie quand il est tout près
  if (enChasse && p > .6) {
    const cri = CRIS_GARDIEN[Math.floor(t / 2.2) % CRIS_GARDIEN.length];
    const bx = Math.min(W - 90, gardienX + 30), by = pieds - 330 * s - 30;
    ctx.font = "900 15px Arial Black, sans-serif";
    const lw = ctx.measureText(cri).width + 20;
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#3b2308"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(bx - lw / 2, by - 22, lw, 30, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - 10, by + 8); ctx.lineTo(bx - 18, by + 20); ctx.lineTo(bx, by + 8); ctx.fill();
    ctx.fillStyle = "#c92a2a"; ctx.textAlign = "center"; ctx.fillText(cri, bx, by - 1); ctx.textAlign = "start";
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
    for (let i = 0; i < 60; i++) ctx.fillRect((i * 97) % W, (i * 53) % (HORIZON - 40), 2, 2);
  }
  // soleil (énorme et orangé en savane) ou lune
  const lune = amb.nuit > .6;
  ctx.fillStyle = lune ? "#f1f3f5" : amb.nuit > .2 ? "#ff922b" : "#ffe066";
  ctx.shadowColor = lune ? "#fff" : "#ffd43b"; ctx.shadowBlur = 50;
  ctx.beginPath(); ctx.arc(W * .7 - camX * 4, HORIZON - 60, lune ? 30 : 62, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // nuages allongés
  ctx.fillStyle = `rgba(255,255,255,${.6 - amb.nuit * .45})`;
  for (let i = 0; i < 4; i++) {
    const x = ((i * 160 - dist * .6 - camX * 6) % (W + 200) + W + 200) % (W + 200) - 100, y = 36 + i * 28;
    ctx.beginPath(); ctx.ellipse(x, y, 60, 10, 0, 0, Math.PI * 2); ctx.ellipse(x + 34, y - 6, 36, 10, 0, 0, Math.PI * 2); ctx.fill();
  }
  // vol d'oiseaux
  ctx.strokeStyle = `rgba(30,20,20,${.55 - amb.nuit * .4})`; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const bx = ((W + 60 - (t * 22 + i * 26) % (W + 120)) + W) % (W + 120) - 60, by = 70 + i * 9 + Math.sin(t * 2 + i) * 4;
    const ail = Math.sin(t * 8 + i) * 4;
    ctx.beginPath(); ctx.moveTo(bx - 7, by - ail); ctx.lineTo(bx, by); ctx.lineTo(bx + 7, by - ail); ctx.stroke();
  }
  // montagne au loin avec neige au sommet
  ctx.fillStyle = rgb(amb.haut, .75, .9);
  ctx.beginPath(); ctx.moveTo(-40 - camX * 3, HORIZON); ctx.lineTo(150 - camX * 3, HORIZON - 120); ctx.lineTo(190 - camX * 3, HORIZON - 128); ctx.lineTo(360 - camX * 3, HORIZON); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${.85 - amb.nuit * .5})`;
  ctx.beginPath(); ctx.moveTo(122 - camX * 3, HORIZON - 90); ctx.lineTo(150 - camX * 3, HORIZON - 120); ctx.lineTo(190 - camX * 3, HORIZON - 128); ctx.lineTo(222 - camX * 3, HORIZON - 96);
  ctx.lineTo(200 - camX * 3, HORIZON - 102); ctx.lineTo(180 - camX * 3, HORIZON - 92); ctx.lineTo(158 - camX * 3, HORIZON - 104); ctx.fill();
  // collines : acacias en savane, canopée en forêt
  const plan = rgb(amb.sol, .55 - amb.nuit * .2);
  ctx.fillStyle = plan;
  ctx.beginPath(); ctx.moveTo(-60, HORIZON);
  for (let x = -60; x <= W + 60; x += 20) ctx.lineTo(x, HORIZON - 18 - Math.sin((x + camX * 8) * .02) * 10 - amb.foret * (18 + Math.abs(Math.sin((x + camX * 8) * .05)) * 30));
  ctx.lineTo(W + 60, HORIZON); ctx.fill();
  if (amb.foret < .9) {
    ctx.globalAlpha = 1 - amb.foret;
    ctx.fillStyle = rgb(amb.sol, .38 - amb.nuit * .15);
    for (let i = 0; i < 7; i++) {
      const ax = ((i * 91 - camX * 10) % (W + 120) + W + 120) % (W + 120) - 60, ah = 22 + (i * 13) % 16;
      ctx.fillRect(ax - 1.5, HORIZON - 18 - ah, 3, ah);
      ctx.beginPath(); ctx.ellipse(ax, HORIZON - 18 - ah, 18 + (i % 3) * 5, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // silhouettes de girafes au loin
    for (let i = 0; i < 2; i++) {
      const gx = ((i * 260 + 120 - camX * 10 - t * 3) % (W + 120) + W + 120) % (W + 120) - 60, gy = HORIZON - 20;
      ctx.fillRect(gx - 8, gy - 10, 3, 10); ctx.fillRect(gx + 5, gy - 10, 3, 10);
      ctx.beginPath(); ctx.ellipse(gx, gy - 12, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(gx - 7, gy - 14); ctx.rotate(-.35); ctx.fillRect(-1.5, -20, 3, 20); ctx.fillRect(-4, -23, 8, 4); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  // sol : herbe de la savane / de la forêt
  const sol = ctx.createLinearGradient(0, HORIZON, 0, H);
  sol.addColorStop(0, rgb(amb.sol, .8)); sol.addColorStop(1, rgb(amb.sol, .55));
  ctx.fillStyle = sol;
  ctx.fillRect(-60, HORIZON, W + 120, H - HORIZON + 60);
  // brume de chaleur à l'horizon
  const brume = ctx.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 40);
  brume.addColorStop(0, "rgba(255,255,255,0)"); brume.addColorStop(.5, `rgba(${amb.bas.join(",")},.55)`); brume.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = brume; ctx.fillRect(-60, HORIZON - 30, W + 120, 70);

  // la piste de terre rouge et ses trois chemins
  polygone([projeter(-3.75, 0, -6), projeter(3.75, 0, -6), projeter(3.75, 0, 220), projeter(-3.75, 0, 220)], rgb(amb.chemin));
  for (const x of VOIES) {
    for (const r of [-.55, .55]) { // ornières
      polygone([projeter(x + r - .13, 0, -6), projeter(x + r + .13, 0, -6), projeter(x + r + .13, 0, 220), projeter(x + r - .13, 0, 220)], rgb(amb.chemin, .8));
    }
    for (let z = -(dist % 1.6) - 3.5; z < 70; z += 1.6) { // cailloux qui défilent
      const idx = Math.floor((z + dist) / 1.6) + x * 7;
      const ox = ((idx * 37) % 17) / 17 * 1.6 - .8;
      const [cx, cy, k] = projeter(x + ox, 0, z);
      ctx.fillStyle = rgb(amb.chemin, (idx % 3) ? .72 : 1.18, Math.min(1, (70 - z) / 25));
      ctx.beginPath(); ctx.ellipse(cx, cy, k * .09, k * .04, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const x of [-1.2, 1.2]) { // bandes d'herbe entre les chemins
    polygone([projeter(x - .08, 0, -6), projeter(x + .08, 0, -6), projeter(x + .08, 0, 220), projeter(x - .08, 0, 220)], rgb(amb.sol, .75));
  }
  // hautes herbes au bord de la piste
  for (const cote of [-1, 1]) {
    for (let z = -(dist % 1.5) - 3.5; z < 65; z += 1.5) {
      const idx = Math.floor((z + dist) / 1.5);
      const [hx, hy, k] = projeter(cote * (4 + ((idx * 13) % 7) / 10), 0, z);
      const hh = k * (.45 + ((idx * 7) % 5) / 12);
      ctx.strokeStyle = rgb(amb.sol, (idx % 2) ? .6 : .85); ctx.lineWidth = Math.max(1, k * .05);
      ctx.beginPath();
      for (const a of [-.35, 0, .35]) { ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + a * hh * .3, hy - hh * .6, hx + a * hh * .8 + Math.sin(t * 3 + idx) * k * .04, hy - hh); }
      ctx.stroke();
    }
  }
  if (!jeu) return ctx.restore();

  // tout ce qui a de la profondeur, du plus lointain au plus proche
  const scene = [
    ...jeu.decor.filter((d) => d.z > -CAM_D + 1).map((d) => ({ z: d.z, dessin: () => dessinerDecor(d, amb, t) })),
    ...Array.from({ length: 5 }, (_, i) => { const z = i * 30 - (dist % 30) + 4; const n = Math.floor((dist + z) / 30); return { z, dessin: () => dessinerPortique(z, amb, t, n) }; }).filter((e) => e.z > -CAM_D + 1.5),
    // un camion, un tronc ou une rampe qui passe sous Moka (commencé derrière lui) est dessiné AVANT lui,
    // sinon il le recouvre quand il grimpe ou court sur le toit
    ...jeu.objets.filter((o) => (estLong(o) || o.type === "rampe") ? o.z + o.long > -CAM_D + 1 : o.z > -CAM_D + 1).map((o) => ({
      z: (estLong(o) || o.type === "rampe") && o.z < 0.2 && o.z + o.long > -0.5 ? 0.3 + Math.min(o.z + o.long, 50) * 1e-3 : o.z, dessin: () => {
      if (o.type === "camion") dessinerCamion(o, amb);
      else if (o.type === "tronc") dessinerTronc(o, amb);
      else if (o.type === "rampe") dessinerRampe(o, amb);
      else if (o.type === "banane") dessinerBanane(o, t);
      else if (o.type === "bonus") dessinerBonus(o, t);
      else dessinerObstacle(o, amb, t);
    } })),
  ].filter((e) => e.z < 160).sort((a, b) => b.z - a.z);
  let place = false, moka = [W / 2, H / 2];
  for (const e of scene) {
    if (!place && e.z < 0.2) { moka = dessinerMoka(t); place = true; }
    e.dessin();
  }
  if (!place) moka = dessinerMoka(t);

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
  dessinerGardien(t, moka);

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
  // vignette rouge quand le gardien est sur les talons
  if (jeu.trebuche > 0 && !jeu.fini) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .75);
    g.addColorStop(0, "rgba(255,0,0,0)"); g.addColorStop(1, `rgba(220,30,30,${.25 + .12 * Math.sin(t * 8)})`);
    ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, H + 120);
  }
  ctx.restore();

  // ------------------------------------------------------------ interface (hors caméra)
  ctx.save();
  ctx.setTransform(toile.width / W, 0, 0, toile.height / H, 0, 0);
  const texte = (s, x, y, taille, couleur = "#fff", aligne = "left") => {
    ctx.font = `900 ${taille}px Arial Black, sans-serif`; ctx.textAlign = aligne;
    ctx.lineWidth = 5; ctx.strokeStyle = "#3b2308"; ctx.strokeText(s, x, y);
    ctx.fillStyle = couleur; ctx.fillText(s, x, y); ctx.textAlign = "start";
  };
  const panneau = (x, y, w, h) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(110, 60, 20, .85)"); g.addColorStop(1, "rgba(60, 30, 8, .85)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = "rgba(255,220,150,.7)"; ctx.lineWidth = 2; ctx.stroke();
  };
  const bananeHud = (x, y, r) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.5);
    ctx.fillStyle = "#ffd43b"; ctx.strokeStyle = "#8a6400"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r, -r * .2); ctx.quadraticCurveTo(0, r * 1.2, r, -r * .2); ctx.quadraticCurveTo(0, r * .5, -r, -r * .2); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  panneau(10, 10, 170, 66);
  if (jeu.bonus.double) { ctx.shadowColor = "#ff922b"; ctx.shadowBlur = 20; }
  texte(jeu.score.toLocaleString("fr-FR"), 22, 46, 28, jeu.bonus.double ? "#ffc078" : "#fff");
  ctx.shadowBlur = 0;
  texte(`${Math.floor(jeu.distance)} m`, 22, 68, 15, "#ffe066");
  panneau(W - 130, 10, 120, 46);
  bananeHud(W - 106, 30, 14);
  texte(String(jeu.pieces), W - 20, 43, 24, "#ffd43b", "right");
  if (jeu.bonus.double) texte("x2", W - 20, 82, 24, "#ff922b", "right");
  // bananes qui s'envolent vers le compteur
  for (let i = jeu.pieceHud.length - 1; i >= 0; i--) {
    const p = jeu.pieceHud[i];
    p.t += dt * 2.5;
    if (p.t >= 1) { jeu.pieceHud.splice(i, 1); continue; }
    bananeHud(p.x + (W - 106 - p.x) * p.t, p.y + (30 - p.y) * p.t - Math.sin(p.t * Math.PI) * 60, 11 * (1 - p.t * .4));
  }
  // alerte gardien
  if (jeu.trebuche > 0 && !jeu.fini) {
    panneau(W / 2 - 110, 86, 220, 34);
    ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.roundRect(W / 2 - 104, 108, 208 * jeu.trebuche / DUREE_TREBUCHE, 6, 3); ctx.fill();
    texte("⚠ GARDIEN AUX TROUSSES", W / 2, 104, 14, "#ffe3e3", "center");
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
    ctx.save(); ctx.translate(W / 2, x.petit ? 560 : 170); ctx.scale(echelle, echelle);
    texte(x.t, 0, 0, x.petit ? 24 : 34, x.petit ? "#fff" : "#ffe066", "center");
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
