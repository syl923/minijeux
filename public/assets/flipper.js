// Flipper néon : physique maison (pas de bibliothèque), musique rock et sons synthétisés.
// Unités : pixels et secondes, sur une table logique de 480 × 820.
// Bonus : combos, bille EN FEU (points x2), multibille, trou mystère, tir d'adresse, bille bonus.

const W = 480, H = 820;
const R_BILLE = 10;
const GRAVITE = 1500;
const PAS = 1 / 600;          // pas de simulation fixe
const VITESSE_MAX = 2300;
const DEPART_BILLE = [438, 771];
const FIEVRE_MAX = 14;        // coups de bumper pour mettre la bille en feu

const toile = document.getElementById("flipper");
const ctx = toile.getContext("2d");
const surcouche = document.getElementById("surcouche");

// ------------------------------------------------------------ géométrie de la table
const seg = (ax, ay, bx, by, opts = {}) => ({ type: "seg", a: [ax, ay], b: [bx, by], r: 3, e: 0.45, ...opts });

const murs = [];
// arc du haut (centre 240,240 ; rayon 216)
for (let deg = 180; deg < 360; deg += 6) {
  const a1 = deg * Math.PI / 180, a2 = (deg + 6) * Math.PI / 180;
  murs.push(seg(240 + 216 * Math.cos(a1), 240 + 216 * Math.sin(a1), 240 + 216 * Math.cos(a2), 240 + 216 * Math.sin(a2)));
}
murs.push(
  seg(24, 240, 24, 620),                        // mur gauche
  seg(456, 240, 456, 830),                      // mur droit (extérieur du couloir de lancement)
  seg(420, 300, 420, 830, { neon: "#ff2fd0" }), // paroi du couloir de lancement
  seg(24, 620, 132, 706, { neon: "#ff2fd0" }),  // guide gauche vers le flipper
  seg(420, 620, 312, 706, { neon: "#ff2fd0" }), // guide droit
  seg(420, 782, 456, 782, { lanceur: true }),   // plateau du lanceur
  // poteaux entre les couloirs du haut
  seg(170, 70, 170, 118, { r: 4 }), seg(215, 62, 215, 118, { r: 4 }), seg(260, 62, 260, 118, { r: 4 }), seg(305, 70, 305, 118, { r: 4 }),
);
const porte = seg(420, 300, 456, 262, { neon: "#3ee0e8" }); // portillon : empêche la bille de retomber dans le couloir

// slingshots (triangles), le côté intérieur renvoie la bille
function sling(pts, sens) {
  const [A, B, C] = pts;
  return [seg(...A, ...B, { r: 4 }), seg(...B, ...C, { r: 4 }), seg(...A, ...C, { r: 5, kick: 620, sling: sens })];
}
// (écartés d'au moins 35 px des guides : la bille de 20 px doit toujours pouvoir passer dessous)
const slingG = { pts: [[70, 540], [70, 610], [108, 642]], flash: 0 };
const slingD = { pts: [[374, 540], [374, 610], [336, 642]], flash: 0 };
murs.push(...sling(slingG.pts, slingG), ...sling(slingD.pts, slingD));

const bumpers = [
  { c: [160, 240], R: 26, flash: 0, couleur: "#ff5fa2" },
  { c: [300, 240], R: 26, flash: 0, couleur: "#3ee0e8" },
  { c: [230, 335], R: 26, flash: 0, couleur: "#ffc93c" },
];
const couloirs = [192, 237, 282].map((x) => ({ x, y: 100, allume: false, dedans: false }));
const cibles = [330, 372, 414].map((y) => ({ a: [36, y], b: [36, y + 34], debout: true, flash: 0 }));
const etoiles = [385, 435].map((y) => ({ a: [415, y], b: [415, y + 32], allume: false, flash: 0 }));
const trou = { c: [230, 172], R: 13, occupe: null, flash: 0 };  // trou mystère

function creerFlipper(pivot, repos, haut) {
  return { pivot, L: 68, phi: repos, repos, haut, omega: 0, actif: false };
}
const flipG = creerFlipper([140, 716], 0.5, -0.5);
const flipD = creerFlipper([304, 716], Math.PI - 0.5, Math.PI + 0.5);
const pointe = (f) => [f.pivot[0] + f.L * Math.cos(f.phi), f.pivot[1] + f.L * Math.sin(f.phi)];

// ------------------------------------------------------------ état de la partie
let jeu = null;
let texteFlash = null;
const particules = [];
const textes = [];
const eclairs = [];

// Types de billes : chaque nouvelle bille est tirée au hasard.
const TYPES_BILLES = {
  acier: { nom: "Bille d'acier", couleurs: ["#ffffff", "#d7dce4", "#6b7280"], trace: "#b99cff", poids: 1, rebond: 1, points: 1, poidsTirage: 40 },
  banane: { nom: "🍌 BILLE BANANE : +150 par bumper", couleurs: ["#fffbe6", "#ffd43b", "#c98a00"], trace: "#ffe066", poids: 1, rebond: 1, points: 1, poidsTirage: 20 },
  plomb: { nom: "⚫ BILLE DE PLOMB : POINTS x2", couleurs: ["#adb5bd", "#495057", "#141517"], trace: "#868e96", poids: 1.25, rebond: .8, points: 2, poidsTirage: 20 },
  rebond: { nom: "💗 SUPER-BALLE : ÇA REBONDIT !", couleurs: ["#fff0f6", "#f783ac", "#c2255c"], trace: "#faa2c1", poids: .9, rebond: 1.3, points: 1, poidsTirage: 20 },
};
function tirerType() {
  const total = Object.values(TYPES_BILLES).reduce((a, t) => a + t.poidsTirage, 0);
  let r = Math.random() * total;
  for (const [id, t] of Object.entries(TYPES_BILLES)) { r -= t.poidsTirage; if (r < 0) return id; }
  return "acier";
}
let billeActive = null;   // bille en train d'être calculée (pour le bonus de son type)

function creerBille(p = DEPART_BILLE.slice(), v = [0, 0], type = tirerType()) {
  return { p, v, trace: [], immobile: 0, horsCouloir: p[0] < 412, type };
}

function billeAuLanceur() {
  const b = creerBille();
  jeu.billes.push(b);
  jeu.saveDonne = false;
  if (b.type !== "acier") setTimeout(() => jeu && !jeu.fini && flash(TYPES_BILLES[b.type].nom, 1.8), 700);
  jeu.lanceurOccupe = true;
  jeu.puissance = 0;
  jeu.porteActive = false;
  jeu.adresse = { couloir: Math.floor(Math.random() * 3), jusqua: 0 };
}

document.getElementById("btn-jouer").onclick = () => exigerConnexion(lancer);

async function lancer() {
  let r;
  try {
    r = await api("/api/flipper/debut", {});
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  jeu = {
    partie: r.partie, score: 0, reserve: 3, numeroBille: 1, mult: 1, fini: false, charge: false, cumul: 0,
    dernier: performance.now(), billes: [], sauvetage: 0, combo: 0, dernierCoup: 0, fievre: 0, feu: 0,
    jackpots: 0, multibille: false, secousse: 0, eclat: 0, temps: 0, dernierFlip: 0, nova: 0, fievreNova: 0, saveDonne: false,
  };
  couloirs.forEach((c) => (c.allume = false));
  cibles.forEach((c) => (c.debout = true));
  etoiles.forEach((c) => (c.allume = false));
  trou.occupe = null;
  trou.recharge = 0;
  billeAuLanceur();
  majAfficheur();
  surcouche.classList.add("cache");
  document.querySelector(".cadre-flipper").scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("rock");
  Sons.jouer("riff");
  flash("ROCK'N'ROLL !");
  requestAnimationFrame(boucle);
}

function majAfficheur() {
  document.getElementById("score").textContent = jeu.score.toLocaleString("fr-FR");
  document.getElementById("billes").textContent = `${jeu.numeroBille}/${jeu.numeroBille + jeu.reserve - 1}`;
  document.getElementById("multi").textContent = "x" + jeu.mult * bonusFeu();
  document.getElementById("fievre").style.width = (jeu.nova > 0 ? 100 : jeu.feu > 0 ? 100 * jeu.fievreNova / NOVA_MAX : 100 * jeu.fievre / FIEVRE_MAX) + "%";
  document.getElementById("fievre").parentElement.classList.toggle("en-feu", jeu.feu > 0 && jeu.nova <= 0);
  document.getElementById("fievre").parentElement.classList.toggle("en-nova", jeu.nova > 0);
}

const NOVA_MAX = 10;        // coups de bumper en feu pour déclencher la MOKA MANIA
const SIESTE = 6;          // secondes sans toucher aux flippers : la bille est « en roue libre »
const bonusFeu = () => (jeu.nova > 0 ? 4 : jeu.feu > 0 ? 2 : 1);
const endormi = () => jeu.temps - jeu.dernierFlip > SIESTE;

// Tous les points passent par ici : multiplicateur, feu, MOKA MANIA, type de bille, combos.
// Si le joueur ne touche plus aux flippers, la bille « en roue libre » ne rapporte presque rien.
function marquer(points, x, y, couleur = "#fff") {
  const maintenant = jeu.temps;
  if (endormi()) {
    const p = Math.max(1, Math.round(points * .1));
    jeu.score += p;
    textes.push({ x, y, t: "+" + p + " 😴", vie: .8, couleur: "#adb5bd" });
    if (!jeu.alerteSieste) {
      jeu.alerteSieste = true;
      flash("😴 ROUE LIBRE : POINTS ÷10", 1.6);
      mokaDit("Hé ! On fait la sieste ? Touche les flippers, hi hi !", "taquin", 2400);
    }
    return;
  }
  jeu.alerteSieste = false;
  jeu.combo = maintenant - jeu.dernierCoup < 1.4 ? jeu.combo + 1 : 1;
  jeu.dernierCoup = maintenant;
  const typeBille = billeActive ? TYPES_BILLES[billeActive.type] : null;
  const p = points * jeu.mult * bonusFeu() * (typeBille ? typeBille.points : 1);
  jeu.score += p;
  textes.push({ x, y, t: "+" + p, vie: 1, couleur: jeu.nova > 0 ? `hsl(${(jeu.temps * 400) % 360},100%,70%)` : jeu.feu > 0 ? "#ffa94d" : couleur });
  if (jeu.combo > 0 && jeu.combo % 8 === 0) {
    const bonus = 250 * jeu.combo;
    jeu.score += bonus;
    flash(`COMBO x${jeu.combo} ! +${bonus}`);
    Sons.jouer("power");
  }
  majAfficheur();
}

function flash(t, duree = 1.6) { texteFlash = { t, vie: duree }; }

function etincelles(x, y, couleur, n = 12, force = 220) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * force;
    particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: 1, couleur, taille: 4 });
  }
}

function eclair() { // éclair qui traverse la table pour les grands moments
  const pts = [[Math.random() * W, 0]];
  while (pts[pts.length - 1][1] < H) pts.push([pts[pts.length - 1][0] + (Math.random() - .5) * 90, pts[pts.length - 1][1] + 40 + Math.random() * 40]);
  eclairs.push({ pts, vie: .35 });
}

function grandMoment(texte, son = "riff") {
  flash(texte, 2);
  const repliques = { cri: ["OU OU AAAAAH ! MOKA MANIA !!!", "etoiles"], feu: ["ÇA BRÛLE ! Rock'n'roll !", "etoiles"], extra: ["Une bille en plus, yeah !", "rire"], sirene: ["MULTIBILLE ! Faites du bruit !", "etoiles"] };
  const [dit, humeur] = repliques[son] || ["JACKPOT ! Encore, encore !", "etoiles"];
  mokaDit(dit, humeur, 2000);
  Sons.jouer(son);
  jeu.secousse = 14;
  jeu.eclat = 1;
  eclair(); eclair();
}

// ------------------------------------------------------------ commandes
const TG = ["ArrowLeft", "q", "Q", "a", "A", "ShiftLeft"];
const TD = ["ArrowRight", "d", "D", "m", "M", "ShiftRight"];
const TL = [" ", "ArrowDown", "Enter"];
function touche(e, appui) {
  if (!jeu || jeu.fini) return;
  const k = e.key, code = e.code;
  if (TG.includes(k) || TG.includes(code)) { actionner(flipG, appui); e.preventDefault(); }
  else if (TD.includes(k) || TD.includes(code)) { actionner(flipD, appui); e.preventDefault(); }
  else if (TL.includes(k)) { lanceur(appui); e.preventDefault(); }
}
document.addEventListener("keydown", (e) => { if (!e.repeat) touche(e, true); else if (TL.includes(e.key)) e.preventDefault(); });
document.addEventListener("keyup", (e) => touche(e, false));

function actionner(f, appui) {
  if (appui) jeu.dernierFlip = jeu.temps;
  if (appui && !f.actif) Sons.jouer("flip");
  f.actif = appui;
}
function billeDuLanceur() {
  return jeu.billes.find((b) => b.p[0] > 420 && b.p[1] > 740 && Math.hypot(b.v[0], b.v[1]) < 40);
}
function lanceur(appui) {
  if (!jeu.lanceurOccupe) return;
  if (appui) { jeu.charge = true; jeu.puissance = 0; }
  else if (jeu.charge) {
    jeu.charge = false;
    const b = billeDuLanceur();
    if (b) b.v = [0, -(1000 + 1300 * jeu.puissance)];
    jeu.lanceurOccupe = false;
    jeu.dernierFlip = jeu.temps;
    jeu.adresse.jusqua = jeu.temps + 3;
    Sons.jouer("lancement");
  }
}
// tactile : moitié gauche / droite de la table, et bouton de lancement
toile.addEventListener("touchstart", (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const r = toile.getBoundingClientRect();
    actionner(t.clientX - r.left < r.width / 2 ? flipG : flipD, true);
  }
}, { passive: false });
toile.addEventListener("touchend", (e) => {
  e.preventDefault();
  const r = toile.getBoundingClientRect();
  for (const t of e.changedTouches) actionner(t.clientX - r.left < r.width / 2 ? flipG : flipD, false);
}, { passive: false });
for (const [id, f] of [["t-gauche", flipG], ["t-droite", flipD]]) {
  const b = document.getElementById(id);
  b.addEventListener("pointerdown", () => jeu && actionner(f, true));
  b.addEventListener("pointerup", () => jeu && actionner(f, false));
  b.addEventListener("pointerleave", () => jeu && actionner(f, false));
}
const bl = document.getElementById("t-lancer");
bl.addEventListener("pointerdown", () => jeu && lanceur(true));
bl.addEventListener("pointerup", () => jeu && lanceur(false));

// ------------------------------------------------------------ physique
function pointProche(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby)));
  return [a[0] + abx * t, a[1] + aby * t];
}

// Normale et pénétration si la bille touche le segment (épais de r)
function contact(p, a, b, r) {
  const q = pointProche(p, a, b);
  const dx = p[0] - q[0], dy = p[1] - q[1];
  const d = Math.hypot(dx, dy);
  if (d >= R_BILLE + r || d === 0) return null;
  return { n: [dx / d, dy / d], pen: R_BILLE + r - d, q };
}

function rebond(bille, n, e, vitesseSurface = [0, 0]) {
  e = Math.min(1.05, e * (TYPES_BILLES[bille.type] ? TYPES_BILLES[bille.type].rebond : 1));
  const vr = [bille.v[0] - vitesseSurface[0], bille.v[1] - vitesseSurface[1]];
  const vn = vr[0] * n[0] + vr[1] * n[1];
  if (vn >= 0) return 0;
  bille.v[0] = vitesseSurface[0] + vr[0] - (1 + e) * vn * n[0];
  bille.v[1] = vitesseSurface[1] + vr[1] - (1 + e) * vn * n[1];
  return -vn;
}

function pousser(bille, n, vitesse) {
  bille.v[0] += n[0] * vitesse;
  bille.v[1] += n[1] * vitesse;
}

function bougerFlipper(f, dt) {
  const vers = f.actif ? f.haut : f.repos;
  const vitesse = f.actif ? 26 : 14;
  const sens = Math.sign(vers - f.phi);
  const avant = f.phi;
  f.phi += sens * vitesse * dt;
  if ((sens > 0 && f.phi > vers) || (sens < 0 && f.phi < vers)) f.phi = vers;
  f.omega = (f.phi - avant) / dt;
}

function etape(dt) {
  jeu.temps += dt;
  bougerFlipper(flipG, dt);
  bougerFlipper(flipD, dt);
  if (jeu.charge) jeu.puissance = Math.min(1, jeu.puissance + dt);
  if (jeu.sauvetage > 0) jeu.sauvetage -= dt;
  if (jeu.nova > 0) {
    jeu.nova -= dt;
    if (jeu.nova <= 0) { jeu.fievreNova = 0; flash("Fin de la MOKA MANIA…", 1.4); mokaDit("Ouf… j'ai plus de voix !", "rire", 2000); majAfficheur(); }
    else if (Math.floor(jeu.nova * 10) % 40 === 0) mokaDit(["OU OU AAAH !", "MOKA MANIA !!!", "Plus fort ! PLUS FORT !"][Math.floor(Math.random() * 3)], "etoiles", 1500);
  }
  if (jeu.feu > 0) {
    jeu.feu -= dt;
    if (jeu.feu <= 0) { jeu.fievre = 0; jeu.fievreNova = 0; flash("La bille refroidit…", 1.2); majAfficheur(); }
  }
  // trou mystère : garde la bille un instant puis la recrache
  if (trou.occupe && jeu.temps > trou.occupe.jusqua) {
    const b = trou.occupe.bille;
    const cote = Math.random() < .5 ? -1 : 1; // éjectée sur le côté (pas droit sur le bumper du bas)
    b.p = [trou.c[0] + cote * 18, trou.c[1] + 8];
    b.v = [cote * (320 + Math.random() * 200), 260];
    trou.occupe = null;
    trou.recharge = jeu.temps + 2.5;
    Sons.jouer("boing");
  }
  for (const b of [...jeu.billes]) etapeBille(b, dt);
  // chocs entre billes (multibille)
  for (let i = 0; i < jeu.billes.length; i++)
    for (let j = i + 1; j < jeu.billes.length; j++) {
      const a = jeu.billes[i], c = jeu.billes[j];
      const dx = c.p[0] - a.p[0], dy = c.p[1] - a.p[1], d = Math.hypot(dx, dy);
      if (d > 0 && d < 2 * R_BILLE) {
        const n = [dx / d, dy / d], pen = (2 * R_BILLE - d) / 2;
        a.p[0] -= n[0] * pen; a.p[1] -= n[1] * pen; c.p[0] += n[0] * pen; c.p[1] += n[1] * pen;
        const vn = (c.v[0] - a.v[0]) * n[0] + (c.v[1] - a.v[1]) * n[1];
        if (vn < 0) { a.v[0] += vn * n[0]; a.v[1] += vn * n[1]; c.v[0] -= vn * n[0]; c.v[1] -= vn * n[1]; }
      }
    }
}

function etapeBille(b, dt) {
  billeActive = b;
  if (trou.occupe && trou.occupe.bille === b) return;
  if (jeu.lanceurOccupe && b === billeDuLanceur() && b.p[1] > 760) { // posée sur le lanceur
    b.p = [DEPART_BILLE[0], DEPART_BILLE[1] + (jeu.charge ? jeu.puissance * 14 : 0)];
    b.v = [0, 0];
    return;
  }

  b.v[1] += GRAVITE * dt * TYPES_BILLES[b.type].poids;
  const vit = Math.hypot(b.v[0], b.v[1]);
  if (vit > VITESSE_MAX) { b.v[0] *= VITESSE_MAX / vit; b.v[1] *= VITESSE_MAX / vit; }
  b.p[0] += b.v[0] * dt;
  b.p[1] += b.v[1] * dt;

  // lancer trop faible : la bille retombe sur le lanceur, on peut relancer
  if (!b.horsCouloir && b.p[0] > 420 && b.p[1] > 740 && Math.hypot(b.v[0], b.v[1]) < 40 && !jeu.lanceurOccupe) {
    jeu.lanceurOccupe = true;
    jeu.puissance = 0;
    return;
  }
  if (!b.horsCouloir && b.p[0] < 412) {
    b.horsCouloir = true;
    jeu.porteActive = true;
    if (!jeu.multibille && !jeu.saveDonne) { jeu.sauvetage = Math.max(jeu.sauvetage, 7); jeu.saveDonne = true; } // « ball save » une fois par bille
  }

  // murs, slingshots, portillon
  const liste = jeu.porteActive || b.horsCouloir ? [...murs, porte] : murs;
  for (const m of liste) {
    if (m === porte && !b.horsCouloir) continue;
    const c = contact(b.p, m.a, m.b, m.r);
    if (!c) continue;
    b.p[0] += c.n[0] * c.pen;
    b.p[1] += c.n[1] * c.pen;
    const choc = rebond(b, c.n, m.e);
    if (m.kick && choc > 60) {
      pousser(b, c.n, m.kick);
      m.sling.flash = 1;
      marquer(30, c.q[0], c.q[1], "#ff8cf0");
      Sons.jouer("sling");
      etincelles(c.q[0], c.q[1], "#ff2fd0", 8);
    }
  }

  // bumpers : ils remplissent la jauge de fièvre
  for (const bu of bumpers) {
    const dx = b.p[0] - bu.c[0], dy = b.p[1] - bu.c[1];
    const d = Math.hypot(dx, dy);
    if (d < bu.R + R_BILLE && d > 0) {
      const n = [dx / d, dy / d];
      b.p = [bu.c[0] + n[0] * (bu.R + R_BILLE), bu.c[1] + n[1] * (bu.R + R_BILLE)];
      rebond(b, n, 0.6);
      pousser(b, n, 540);
      bu.flash = 1;
      marquer(100, bu.c[0], bu.c[1] - 30, bu.couleur);
      if (b.type === "banane" && !endormi()) { jeu.score += 150 * jeu.mult; textes.push({ x: bu.c[0] + 20, y: bu.c[1] - 50, t: "🍌+150", vie: 1, couleur: "#ffe066" }); }
      Sons.jouer("bumper");
      etincelles(b.p[0], b.p[1], bu.couleur);
      jeu.secousse = Math.max(jeu.secousse, 3);
      if (jeu.feu > 0 && jeu.nova <= 0 && !endormi()) { // en feu : on remplit la jauge de MOKA MANIA
        jeu.fievreNova++;
        if (jeu.fievreNova >= NOVA_MAX) lancerNova();
        majAfficheur();
      }
      if (jeu.feu <= 0 && !endormi()) {
        jeu.fievre++;
        if (jeu.fievre >= FIEVRE_MAX) {
          jeu.feu = 15;
          grandMoment("🔥 BILLE EN FEU ! POINTS x2 🔥", "feu");
          Sons.jouer("power");
        }
        majAfficheur();
      }
    }
  }

  // trou mystère
  if (!trou.occupe && jeu.temps > (trou.recharge || 0)) {
    const d = Math.hypot(b.p[0] - trou.c[0], b.p[1] - trou.c[1]);
    if (d < trou.R && Math.hypot(b.v[0], b.v[1]) < 1100) {
      trou.occupe = { bille: b, jusqua: jeu.temps + 1.3 };
      trou.flash = 1;
      b.p = trou.c.slice();
      b.v = [0, 0];
      mystere();
    }
  }

  // cibles tombantes : 3 à terre = jackpot ; 2 jackpots = multibille ; 3 jackpots = bille bonus
  for (const ci of cibles) {
    if (!ci.debout) continue;
    const c = contact(b.p, ci.a, ci.b, 5);
    if (!c) continue;
    b.p[0] += c.n[0] * c.pen;
    b.p[1] += c.n[1] * c.pen;
    rebond(b, c.n, 0.5);
    ci.debout = false;
    ci.flash = 1;
    marquer(500, 70, ci.a[1] + 17, "#ffa94d");
    Sons.jouer("cible");
    etincelles(40, ci.a[1] + 17, "#ff9a3c");
    if (cibles.every((x) => !x.debout)) {
      jeu.jackpots++;
      marquer(5000, 120, 380, "#ffe066");
      setTimeout(() => cibles.forEach((x) => (x.debout = true)), 1500);
      if (jeu.jackpots === 3) { // une seule bille bonus par partie
        jeu.reserve++;
        majAfficheur();
        grandMoment("EXTRA BALL !", "extra");
      } else if (jeu.jackpots % 2 === 0 && !jeu.multibille) {
        lancerMultibille();
      } else {
        grandMoment("JACKPOT !");
      }
    }
  }

  // étoiles (cibles fixes du couloir droit)
  for (const et of etoiles) {
    const c = contact(b.p, et.a, et.b, 5);
    if (!c) continue;
    b.p[0] += c.n[0] * c.pen;
    b.p[1] += c.n[1] * c.pen;
    if (rebond(b, c.n, 0.5) < 80) continue;
    et.flash = 1;
    if (!et.allume) {
      et.allume = true;
      marquer(750, 380, et.a[1] + 16, "#8ce99a");
      Sons.jouer("cible");
      if (etoiles.every((x) => x.allume)) {
        marquer(3000, 330, 420, "#8ce99a");
        grandMoment("SUPER ÉTOILES !", "power");
        setTimeout(() => etoiles.forEach((x) => (x.allume = false)), 1200);
      }
    }
  }

  // flippers (segments épais qui tournent)
  for (const f of [flipG, flipD]) {
    const c = contact(b.p, f.pivot, pointe(f), 9);
    if (!c) continue;
    b.p[0] += c.n[0] * c.pen;
    b.p[1] += c.n[1] * c.pen;
    const rx = c.q[0] - f.pivot[0], ry = c.q[1] - f.pivot[1];
    rebond(b, c.n, 0.3, [-f.omega * ry, f.omega * rx]);
  }

  // couloirs du haut (capteurs) + tir d'adresse
  couloirs.forEach((co, i) => {
    const dedans = Math.abs(b.p[0] - co.x) < 16 && Math.abs(b.p[1] - co.y) < 20;
    if (dedans && !co.dedans) {
      if (jeu.adresse && jeu.temps < jeu.adresse.jusqua && i === jeu.adresse.couloir) {
        jeu.adresse.jusqua = 0;
        marquer(5000, co.x, co.y + 60, "#3ee0e8");
        grandMoment("TIR D'ADRESSE ! +5000", "power");
      }
      if (!co.allume) {
        co.allume = true;
        marquer(250, co.x, co.y + 30, "#ffe066");
        Sons.jouer("cible");
        if (couloirs.every((x) => x.allume)) {
          if (jeu.mult < 5) jeu.mult++;
          grandMoment(`MULTIPLICATEUR x${jeu.mult} !`, "power");
          majAfficheur();
          setTimeout(() => couloirs.forEach((x) => (x.allume = false)), 900);
        }
      }
    }
    co.dedans = dedans;
  });

  // bille coincée quelque part (hors flippers) : petite pichenette au bout de 2 secondes
  if (Math.hypot(b.v[0], b.v[1]) < 25 && b.p[1] < 680 && b.horsCouloir) {
    b.immobile += dt;
    if (b.immobile > 2) { b.v = [(Math.random() - .5) * 400, -350]; b.immobile = 0; Sons.jouer("boing"); }
  } else {
    b.immobile = 0;
  }

  if (jeu.feu > 0 && Math.random() < .5) { // flammes qui s'échappent de la bille
    particules.push({ x: b.p[0] + (Math.random() - .5) * 8, y: b.p[1], vx: (Math.random() - .5) * 60, vy: -80 - Math.random() * 120, vie: .6, couleur: Math.random() < .5 ? "#ff922b" : "#ffd43b", taille: 6, feu: true });
  }

  if (b.p[1] > H + 20) perdreBille(b);
}

// Trou mystère : une récompense au hasard
function mystere() {
  const lots = [
    ["MYSTÈRE : +10 000 !", () => marquer(10000, 230, 150, "#ffe066")],
    ["MYSTÈRE : FIÈVRE MAX !", () => { jeu.fievre = FIEVRE_MAX - 1; majAfficheur(); }],
    ["MYSTÈRE : BILLE SAUVÉE 15 s", () => (jeu.sauvetage = 15)],
    ["MYSTÈRE : MULTIPLICATEUR +1", () => { jeu.mult = Math.min(5, jeu.mult + 1); majAfficheur(); }],
    ["MYSTÈRE : CIBLES À TERRE !", () => cibles.forEach((c) => (c.debout = false)) || setTimeout(() => cibles.forEach((c) => (c.debout = true)), 1500)],
  ];
  const [texte, effet] = lots[Math.floor(Math.random() * lots.length)];
  marquer(2000, 230, 150, "#b197fc");
  effet();
  grandMoment(texte, "bonus_pris");
}

// MOKA MANIA : le niveau au-dessus de la bille en feu (points x4, table arc-en-ciel, Moka géant qui hurle)
function lancerNova() {
  jeu.nova = 12;
  jeu.feu = Math.max(jeu.feu, 12);
  grandMoment("🐒 MOKA MANIA ! POINTS x4 🐒", "cri");
  Sons.jouer("sirene");
  Sons.jouer("riff");
  jeu.secousse = 22;
  for (let i = 0; i < 6; i++) setTimeout(() => jeu && eclair(), i * 150);
  majAfficheur();
}

function lancerMultibille() {
  jeu.multibille = true;
  jeu.sauvetage = 10;
  grandMoment("⚡ MULTIBILLE ! ⚡", "sirene");
  Sons.jouer("riff");
  for (let k = 0; k < 2; k++) {
    setTimeout(() => {
      if (!jeu || jeu.fini) return;
      const b = creerBille([230 + (k ? 60 : -60), 60], [(k ? 1 : -1) * 150, 200]);
      b.horsCouloir = true;
      jeu.billes.push(b);
      etincelles(b.p[0], b.p[1], "#3ee0e8", 20, 300);
    }, 400 + k * 500);
  }
}

function perdreBille(b) {
  jeu.billes = jeu.billes.filter((x) => x !== b);
  if (jeu.sauvetage > 0 && !jeu.multibille && !endormi()) {
    flash("BILLE SAUVÉE !");
    Sons.jouer("boing");
    if (!jeu.lanceurOccupe) billeAuLanceur(); else jeu.billes.push(creerBille([230, 60], [0, 200]));
    return;
  }
  if (jeu.billes.length > 0) { // il en reste en jeu
    if (jeu.sauvetage > 0) { // sauvetage du multibille : la bille revient par le haut
      const nb = creerBille([230, 60], [(Math.random() - .5) * 300, 150]);
      nb.horsCouloir = true;
      jeu.billes.push(nb);
      return;
    }
    Sons.jouer("perte_bille");
    if (jeu.billes.length === 1) { jeu.multibille = false; flash("Fin du multibille", 1.2); }
    return;
  }
  jeu.multibille = false;
  jeu.reserve--;
  jeu.fievre = 0;
  jeu.feu = 0;
  jeu.nova = 0;
  jeu.fievreNova = 0;
  jeu.combo = 0;
  Sons.jouer("perte_bille");
  if (jeu.reserve > 0) mokaDit(["Nooon, la bille ! Allez, on se reprend !", "Le public attend un rappel !"][Math.floor(Math.random() * 2)], "triste", 1800);
  if (jeu.reserve <= 0) return finDePartie();
  jeu.numeroBille++;
  majAfficheur();
  flash(`BILLE ${jeu.numeroBille}`);
  billeAuLanceur();
}

async function finDePartie() {
  jeu.fini = true;
  majAfficheur();
  Sons.musique.arreter();
  Sons.jouer("perdu");
  flash("GAME OVER", 3);
  let r;
  try {
    r = await api("/api/flipper/fin", { partie: jeu.partie, score: jeu.score });
  } catch (e) {
    alert(e.message);
    surcouche.classList.remove("cache");
    return;
  }
  setTimeout(() => {
    surcouche.classList.remove("cache");
    afficherResultat({
      titre: "Game over !",
      emoji: jeu.score >= 100000 ? "🏆" : "🎸",
      lignes: [`${jeu.score.toLocaleString("fr-FR")} points · multiplicateur x${jeu.mult} · ${jeu.jackpots} jackpot(s)`],
      fin: r.fin,
      rejouer: lancer,
    });
  }, 1400);
}

// ------------------------------------------------------------ boucle et dessin
function boucle(t) {
  if (!jeu) return;
  const ecoule = Math.min(0.05, (t - jeu.dernier) / 1000);
  jeu.dernier = t;
  if (!jeu.fini) {
    jeu.cumul += ecoule;
    while (jeu.cumul >= PAS) {
      etape(PAS);
      jeu.cumul -= PAS;
      if (jeu.fini) break;
    }
  }
  for (const b of jeu.billes) {
    b.trace.push([b.p[0], b.p[1]]);
    if (b.trace.length > (jeu.feu > 0 ? 16 : 10)) b.trace.shift();
  }
  dessiner(ecoule);
  if (!jeu.fini || particules.length || (texteFlash && texteFlash.vie > 0)) requestAnimationFrame(boucle);
}

function ajusterToile() {
  const ratio = window.devicePixelRatio || 1;
  const hauteur = Math.max(480, Math.min(window.innerHeight - 110, 820));
  const largeur = Math.min(hauteur * W / H, window.innerWidth - 32);
  toile.style.width = largeur + "px";
  toile.style.height = largeur * H / W + "px";
  toile.width = Math.round(largeur * ratio);
  toile.height = Math.round(largeur * H / W * ratio);
}
window.addEventListener("resize", () => { ajusterToile(); if (!jeu) dessiner(0); });

function neon(couleur, largeur, flou = 12) {
  ctx.strokeStyle = couleur;
  ctx.lineWidth = largeur;
  ctx.shadowColor = couleur;
  ctx.shadowBlur = flou;
}

function ligne(a, b) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function dessiner(dt) {
  const k = toile.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (jeu && jeu.secousse > 0) {
    ctx.translate((Math.random() - .5) * jeu.secousse, (Math.random() - .5) * jeu.secousse);
    jeu.secousse = Math.max(0, jeu.secousse - dt * 40);
  }
  const t = performance.now() / 1000;
  const feu = jeu && jeu.feu > 0;
  const nova = jeu && jeu.nova > 0;

  // fond : dégradé (rougeoyant quand la bille est en feu), grille rétro, étoiles
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, feu ? "#3d0a0a" : "#1a0b3d");
  g.addColorStop(.6, feu ? "#5c1a05" : "#2b0f55");
  g.addColorStop(1, "#0b0520");
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = feu ? "rgba(255, 146, 43, .14)" : "rgba(255, 47, 208, .09)";
  ctx.lineWidth = 1;
  for (let y = 460; y < H; y += 28) ligne([24, y], [420, y]);
  for (let x = 24; x <= 420; x += 33) ligne([x, 460], [x, H]);
  ctx.fillStyle = "rgba(255,255,255,.5)";
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = .3 + .3 * Math.sin(t * 2 + i);
    ctx.fillRect((i * 97) % 390 + 30, (i * 53) % 400 + 40, 2, 2);
  }
  ctx.globalAlpha = 1;
  // lumières de la table qui clignotent en chenillard
  for (let i = 0; i < 14; i++) {
    const allume = jeu && (jeu.multibille || feu) ? (Math.floor(t * 12) + i) % 3 === 0 : (Math.floor(t * 3) + i) % 7 === 0;
    ctx.fillStyle = allume ? (feu ? "#ff922b" : "#ff2fd0") : "rgba(255,255,255,.08)";
    ctx.beginPath(); ctx.arc(44 + i * 27, 500, 4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.save();
  ctx.font = "900 44px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = feu ? "rgba(255, 146, 43, .18)" : "rgba(255, 201, 60, .12)";
  ctx.fillText(feu ? "EN FEU !" : "MOKA ROCK", 222, 470);
  ctx.restore();
  // Moka la rockstar peinte sur la table (géant et hurlant pendant la MOKA MANIA)
  if (nova) {
    ctx.fillStyle = `hsla(${(t * 120) % 360},90%,55%,.18)`; ctx.fillRect(0, 0, W, H);
    const moka = imageTenue("flipper", "etoiles");
    const taille = 220 + Math.sin(t * 9) * 18;
    if (moka.complete) {
      ctx.save(); ctx.translate(222, 380); ctx.rotate(Math.sin(t * 6) * .15);
      ctx.globalAlpha = .55; ctx.drawImage(moka, -taille / 2, -taille / 2, taille, taille); ctx.restore(); ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.font = "900 34px Trebuchet MS, sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = `hsl(${(t * 300) % 360},100%,65%)`; ctx.globalAlpha = .75;
    ctx.fillText("MOKA MANIA", 222, 520 + Math.sin(t * 8) * 6); ctx.restore(); ctx.globalAlpha = 1;
  } else {
    const moka = imageTenue("flipper", feu ? "etoiles" : "");
    if (moka.complete) { ctx.globalAlpha = feu ? .35 : .22; ctx.drawImage(moka, 157, 300, 130, 130); ctx.globalAlpha = 1; }
  }

  // murs néon
  ctx.lineCap = "round";
  for (const m of murs) {
    if (m.kick) continue;
    neon(m.neon || (feu ? "#ff922b" : "#3ee0e8"), m.lanceur ? 6 : 4);
    ligne(m.a, m.b);
  }
  if (jeu && jeu.porteActive) { neon("#3ee0e8", 3); ligne(porte.a, porte.b); }

  // slingshots
  for (const s of [slingG, slingD]) {
    const [A, B, C] = s.pts;
    ctx.shadowBlur = 0;
    ctx.fillStyle = s.flash > 0 ? "#ffffff" : "rgba(255, 47, 208, .35)";
    ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.lineTo(...C); ctx.closePath(); ctx.fill();
    neon("#ff2fd0", 5, s.flash > 0 ? 30 : 14);
    ctx.stroke();
    s.flash = Math.max(0, s.flash - dt * 5);
  }

  // couloirs du haut (le couloir du tir d'adresse clignote)
  couloirs.forEach((co, i) => {
    const adresse = jeu && jeu.adresse && i === jeu.adresse.couloir && (jeu.lanceurOccupe || jeu.temps < jeu.adresse.jusqua);
    const allume = co.allume || (adresse && Math.sin(t * 16) > 0);
    ctx.shadowColor = adresse ? "#3ee0e8" : "#ffc93c";
    ctx.shadowBlur = allume ? 22 : 0;
    ctx.fillStyle = allume ? (adresse && !co.allume ? "#3ee0e8" : "#ffe07a") : "rgba(255, 201, 60, .2)";
    ctx.beginPath(); ctx.arc(co.x, co.y + 32, 8, 0, Math.PI * 2); ctx.fill();
  });
  ctx.shadowBlur = 0;
  ctx.font = "bold 13px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffc93c";
  ctx.fillText(`x${Math.min(5, jeu ? jeu.mult + 1 : 2)}`, 237, 153);

  // trou mystère
  ctx.fillStyle = "#05020f";
  ctx.shadowColor = "#b197fc";
  ctx.shadowBlur = 10 + trou.flash * 30 + Math.sin(t * 5) * 5;
  ctx.beginPath(); ctx.arc(...trou.c, trou.R + 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#b197fc"; ctx.lineWidth = 3; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#b197fc"; ctx.font = "bold 10px Trebuchet MS, sans-serif";
  ctx.fillText("?", trou.c[0], trou.c[1] + 4);
  trou.flash = Math.max(0, trou.flash - dt * 2);

  // bumpers
  for (const bu of bumpers) {
    const s = 1 + bu.flash * .15;
    ctx.save();
    ctx.translate(...bu.c);
    ctx.scale(s, s);
    const couleur = feu ? "#ff922b" : bu.couleur;
    ctx.shadowColor = couleur;
    ctx.shadowBlur = 20 + bu.flash * 30;
    ctx.fillStyle = bu.flash > .3 ? "#fff" : couleur;
    ctx.beginPath(); ctx.arc(0, 0, bu.R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#1a0b3d";
    ctx.beginPath(); ctx.arc(0, 0, bu.R * .62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = couleur;
    ctx.beginPath(); ctx.arc(0, 0, bu.R * .35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.beginPath(); ctx.arc(-6, -7, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    bu.flash = Math.max(0, bu.flash - dt * 4);
  }

  // cibles tombantes et étoiles
  for (const ci of cibles) {
    if (ci.debout) { neon(ci.flash > 0 ? "#fff" : "#ff9a3c", 9, 16); ligne(ci.a, ci.b); }
    else { ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,154,60,.25)"; ctx.lineWidth = 3; ligne(ci.a, ci.b); }
    ci.flash = Math.max(0, ci.flash - dt * 4);
  }
  for (const et of etoiles) {
    neon(et.allume ? "#5be37d" : "rgba(91,227,125,.35)", 8, et.allume ? 20 : 4);
    ligne(et.a, et.b);
    ctx.shadowBlur = 0;
    ctx.fillStyle = et.allume ? "#5be37d" : "rgba(91,227,125,.4)";
    ctx.font = "16px sans-serif";
    ctx.fillText("★", 395, et.a[1] + 21);
  }

  // flippers
  for (const f of [flipG, flipD]) {
    const p = pointe(f);
    ctx.shadowColor = feu ? "#ff922b" : "#ff5fa2";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = feu ? "#ff922b" : "#ff5fa2";
    ctx.lineWidth = 20;
    ligne(f.pivot, p);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffd0e4";
    ctx.lineWidth = 8;
    ligne(f.pivot, p);
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(...f.pivot, 5, 0, Math.PI * 2); ctx.fill();
  }

  // lanceur (ressort)
  const comp = jeu && jeu.lanceurOccupe && jeu.charge ? jeu.puissance : 0;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffc93c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) ctx.lineTo(i % 2 ? 446 : 430, 784 + comp * 14 + i * (30 - comp * 14) / 8);
  ctx.stroke();

  // particules (derrière les billes)
  for (let i = particules.length - 1; i >= 0; i--) {
    const p = particules[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.feu ? -60 : 400) * dt; p.vie -= dt * 1.8;
    if (p.vie <= 0) { particules.splice(i, 1); continue; }
    ctx.globalAlpha = p.vie;
    ctx.fillStyle = p.couleur;
    if (p.feu) { ctx.beginPath(); ctx.arc(p.x, p.y, p.taille * p.vie + 1, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // billes (avec traînée, en feu si fièvre)
  if (jeu) {
    for (const b of jeu.billes) {
      const ty = TYPES_BILLES[b.type];
      b.trace.forEach((pt, i) => {
        ctx.globalAlpha = i / b.trace.length * (nova ? .9 : feu ? .7 : .4);
        ctx.fillStyle = nova ? `hsl(${(i * 30 + t * 500) % 360},100%,60%)` : feu ? (i % 2 ? "#ff6b00" : "#ffd43b") : ty.trace;
        ctx.beginPath(); ctx.arc(pt[0], pt[1], R_BILLE * (i / b.trace.length) * (nova ? 1.6 : feu ? 1.3 : 1), 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const gb = ctx.createRadialGradient(b.p[0] - 3, b.p[1] - 4, 1, b.p[0], b.p[1], R_BILLE);
      gb.addColorStop(0, "#ffffff");
      gb.addColorStop(.4, nova ? `hsl(${(t * 500) % 360},100%,65%)` : feu ? "#ffd43b" : ty.couleurs[1]);
      gb.addColorStop(1, nova ? `hsl(${(t * 500 + 120) % 360},100%,45%)` : feu ? "#e8590c" : ty.couleurs[2]);
      ctx.shadowColor = nova ? "#fff" : feu ? "#ff6b00" : ty.couleurs[1];
      ctx.shadowBlur = nova ? 36 : feu ? 26 : 10;
      ctx.fillStyle = gb;
      ctx.beginPath(); ctx.arc(b.p[0], b.p[1], R_BILLE, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (b.type === "banane") { ctx.fillStyle = "#6b4a00"; ctx.font = "9px sans-serif"; ctx.fillText("🍌", b.p[0] - 6, b.p[1] + 3); }
    }
    if (jeu.lanceurOccupe && jeu.charge) {
      ctx.fillStyle = jeu.puissance > .85 ? "#ff5b5b" : "#ffc93c";
      ctx.fillRect(462, 800 - jeu.puissance * 80, 10, jeu.puissance * 80);
    }
    if (jeu.sauvetage > 0 && !jeu.fini && Math.sin(t * 10) > 0) {
      ctx.fillStyle = "#5be37d";
      ctx.font = "bold 12px Trebuchet MS, sans-serif";
      ctx.fillText("BALL SAVE", 222, 800);
    }
    if (jeu.combo >= 3 && jeu.temps - jeu.dernierCoup < 1.4) {
      ctx.font = "900 18px Trebuchet MS, sans-serif";
      ctx.fillStyle = "#3ee0e8";
      ctx.fillText(`COMBO x${jeu.combo}`, 222, 620);
    }
  }

  // éclairs
  for (let i = eclairs.length - 1; i >= 0; i--) {
    const e = eclairs[i];
    e.vie -= dt;
    if (e.vie <= 0) { eclairs.splice(i, 1); continue; }
    ctx.globalAlpha = e.vie / .35;
    neon("#e5f6ff", 3, 25);
    ctx.beginPath();
    e.pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;

  // points qui s'envolent
  ctx.font = "bold 15px Trebuchet MS, sans-serif";
  for (let i = textes.length - 1; i >= 0; i--) {
    const x = textes[i];
    x.y -= 40 * dt; x.vie -= dt;
    if (x.vie <= 0) { textes.splice(i, 1); continue; }
    ctx.globalAlpha = x.vie;
    ctx.fillStyle = x.couleur || "#fff";
    ctx.fillText(x.t, x.x, x.y);
  }
  ctx.globalAlpha = 1;

  if (jeu && jeu.eclat > 0) { // flash blanc des grands moments
    ctx.fillStyle = `rgba(255,255,255,${jeu.eclat * .35})`;
    ctx.fillRect(0, 0, W, H);
    jeu.eclat = Math.max(0, jeu.eclat - dt * 2.5);
  }

  if (texteFlash && texteFlash.vie > 0) {
    texteFlash.vie -= dt;
    ctx.save();
    const taille = texteFlash.t.length > 18 ? 24 : 32;
    ctx.font = `900 ${taille}px Trebuchet MS, sans-serif`;
    ctx.textAlign = "center";
    ctx.shadowColor = feu ? "#ff6b00" : "#ff2fd0";
    ctx.shadowBlur = 20;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#1a0b3d";
    const echelle = 1 + Math.max(0, texteFlash.vie - 1.3) * 1.5;
    ctx.translate(222, 560);
    ctx.scale(echelle, echelle);
    ctx.strokeText(texteFlash.t, 0, 0);
    ctx.fillStyle = Math.sin(t * 14) > -0.3 ? "#fff" : "#ffc93c";
    ctx.fillText(texteFlash.t, 0, 0);
    ctx.restore();
  }
}

ajusterToile();
dessiner(0);
