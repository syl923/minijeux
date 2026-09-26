// Flipper néon : physique maison (pas de bibliothèque), musique et sons synthétisés.
// Unités : pixels et secondes, sur une table logique de 480 × 820.

const W = 480, H = 820;
const R_BILLE = 10;
const GRAVITE = 1500;
const PAS = 1 / 600;          // pas de simulation fixe
const VITESSE_MAX = 2300;

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
  seg(24, 240, 24, 620),                 // mur gauche
  seg(456, 240, 456, 830),               // mur droit (extérieur du couloir de lancement)
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
  return [
    seg(...A, ...B, { r: 4 }),
    seg(...B, ...C, { r: 4 }),
    seg(...A, ...C, { r: 5, kick: 620, sling: sens }),
  ];
}
// (écartés d'au moins 35 px des guides : la bille de 20 px doit toujours pouvoir passer dessous)
const slingG = { pts: [[70, 540], [70, 610], [108, 642]], flash: 0 };
const slingD = { pts: [[374, 540], [374, 610], [336, 642]], flash: 0 };
murs.push(...sling(slingG.pts, slingG), ...sling(slingD.pts, slingD));

const bumpers = [
  { c: [160, 235], R: 26, flash: 0, couleur: "#ff5fa2" },
  { c: [300, 235], R: 26, flash: 0, couleur: "#3ee0e8" },
  { c: [230, 330], R: 26, flash: 0, couleur: "#ffc93c" },
];
const couloirs = [192, 237, 282].map((x) => ({ x, y: 100, allume: false, dedans: false }));
const cibles = [330, 372, 414].map((y) => ({ a: [36, y], b: [36, y + 34], debout: true, flash: 0 }));
const etoiles = [385, 435].map((y) => ({ a: [415, y], b: [415, y + 32], allume: false, flash: 0 }));

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

function nouvelleBille() {
  jeu.bille = { p: [438, 771], v: [0, 0], trace: [] };
  jeu.dansCouloir = true;
  jeu.porteActive = false;
  jeu.sauvetage = 0;
  jeu.puissance = 0;
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
  jeu = { partie: r.partie, score: 0, billes: 3, mult: 1, fini: false, charge: false, cumul: 0, dernier: performance.now() };
  couloirs.forEach((c) => (c.allume = false));
  cibles.forEach((c) => (c.debout = true));
  etoiles.forEach((c) => (c.allume = false));
  nouvelleBille();
  majAfficheur();
  surcouche.classList.add("cache");
  document.querySelector(".cadre-flipper").scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("synthwave");
  flash("LANCE LA BILLE !");
  requestAnimationFrame(boucle);
}

function majAfficheur() {
  document.getElementById("score").textContent = jeu.score.toLocaleString("fr-FR");
  document.getElementById("billes").textContent = jeu.billes;
  document.getElementById("multi").textContent = "x" + jeu.mult;
}

function marquer(points, x, y) {
  const p = points * jeu.mult;
  jeu.score += p;
  textes.push({ x, y, t: "+" + p, vie: 1 });
  majAfficheur();
}

function flash(t, duree = 1.6) { texteFlash = { t, vie: duree }; }

function etincelles(x, y, couleur, n = 12) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 220;
    particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: 1, couleur });
  }
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
  if (appui && !f.actif) Sons.jouer("flip");
  f.actif = appui;
}
function lanceur(appui) {
  if (!jeu.dansCouloir) return;
  if (appui) { jeu.charge = true; jeu.puissance = 0; }
  else if (jeu.charge) {
    jeu.charge = false;
    jeu.bille.v = [0, -(1000 + 1300 * jeu.puissance)];
    jeu.dansCouloir = false;
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

// Renvoie la normale et la pénétration si la bille touche le segment (épais de r)
function contact(p, a, b, r) {
  const q = pointProche(p, a, b);
  const dx = p[0] - q[0], dy = p[1] - q[1];
  const d = Math.hypot(dx, dy);
  if (d >= R_BILLE + r || d === 0) return null;
  return { n: [dx / d, dy / d], pen: R_BILLE + r - d, q };
}

function rebond(bille, n, e, vitesseSurface = [0, 0]) {
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
  const b = jeu.bille;
  bougerFlipper(flipG, dt);
  bougerFlipper(flipD, dt);

  if (jeu.dansCouloir) { // bille posée sur le lanceur
    b.p = [438, 771 + jeu.puissance * 14];
    b.v = [0, 0];
    if (jeu.charge) jeu.puissance = Math.min(1, jeu.puissance + dt);
    return;
  }

  b.v[1] += GRAVITE * dt;
  const vit = Math.hypot(b.v[0], b.v[1]);
  if (vit > VITESSE_MAX) { b.v[0] *= VITESSE_MAX / vit; b.v[1] *= VITESSE_MAX / vit; }
  b.p[0] += b.v[0] * dt;
  b.p[1] += b.v[1] * dt;

  // lancer trop faible : la bille retombe sur le lanceur, on peut relancer
  if (!jeu.porteActive && b.p[0] > 420 && b.p[1] > 740 && Math.hypot(b.v[0], b.v[1]) < 40) {
    jeu.dansCouloir = true;
    jeu.puissance = 0;
    return;
  }
  if (!jeu.porteActive && b.p[0] < 412) {
    jeu.porteActive = true;
    jeu.sauvetage = 7; // 7 secondes de « ball save » une fois la bille en jeu
  }

  // murs, slingshots, portillon
  const liste = jeu.porteActive ? [...murs, porte] : murs;
  for (const m of liste) {
    const c = contact(b.p, m.a, m.b, m.r);
    if (!c) continue;
    b.p[0] += c.n[0] * c.pen;
    b.p[1] += c.n[1] * c.pen;
    const choc = rebond(b, c.n, m.e);
    if (m.kick && choc > 60) {
      pousser(b, c.n, m.kick);
      m.sling.flash = 1;
      marquer(30, c.q[0], c.q[1]);
      Sons.jouer("sling");
      etincelles(c.q[0], c.q[1], "#ff2fd0", 8);
    }
  }

  // bumpers
  for (const bu of bumpers) {
    const dx = b.p[0] - bu.c[0], dy = b.p[1] - bu.c[1];
    const d = Math.hypot(dx, dy);
    if (d < bu.R + R_BILLE && d > 0) {
      const n = [dx / d, dy / d];
      b.p = [bu.c[0] + n[0] * (bu.R + R_BILLE), bu.c[1] + n[1] * (bu.R + R_BILLE)];
      rebond(b, n, 0.6);
      pousser(b, n, 520);
      bu.flash = 1;
      marquer(100, bu.c[0], bu.c[1] - 30);
      Sons.jouer("bumper");
      etincelles(b.p[0], b.p[1], bu.couleur);
    }
  }

  // cibles tombantes
  for (const ci of cibles) {
    if (!ci.debout) continue;
    const c = contact(b.p, ci.a, ci.b, 5);
    if (!c) continue;
    b.p[0] += c.n[0] * c.pen;
    b.p[1] += c.n[1] * c.pen;
    rebond(b, c.n, 0.5);
    ci.debout = false;
    ci.flash = 1;
    marquer(500, 70, ci.a[1] + 17);
    Sons.jouer("cible");
    etincelles(40, ci.a[1] + 17, "#ff9a3c");
    if (cibles.every((x) => !x.debout)) {
      marquer(5000, 120, 380);
      flash("JACKPOT !");
      Sons.jouer("bonus");
      setTimeout(() => cibles.forEach((x) => (x.debout = true)), 1500);
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
      marquer(750, 380, et.a[1] + 16);
      Sons.jouer("cible");
      if (etoiles.every((x) => x.allume)) {
        marquer(3000, 330, 420);
        flash("SUPER ÉTOILES !");
        Sons.jouer("bonus");
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

  // couloirs du haut (capteurs)
  for (const co of couloirs) {
    const dedans = Math.abs(b.p[0] - co.x) < 16 && Math.abs(b.p[1] - co.y) < 20;
    if (dedans && !co.dedans && !co.allume) {
      co.allume = true;
      marquer(250, co.x, co.y + 30);
      Sons.jouer("cible");
      if (couloirs.every((x) => x.allume)) {
        if (jeu.mult < 5) jeu.mult++;
        flash(`MULTIPLICATEUR x${jeu.mult} !`);
        Sons.jouer("bonus");
        majAfficheur();
        setTimeout(() => couloirs.forEach((x) => (x.allume = false)), 900);
      }
    }
    co.dedans = dedans;
  }

  // bille coincée quelque part (hors flippers) : petite pichenette au bout de 2 secondes
  if (Math.hypot(b.v[0], b.v[1]) < 25 && b.p[1] < 680) {
    jeu.immobile = (jeu.immobile || 0) + dt;
    if (jeu.immobile > 2) {
      b.v = [(Math.random() - .5) * 400, -350];
      jeu.immobile = 0;
      Sons.jouer("boing");
    }
  } else {
    jeu.immobile = 0;
  }

  // bille perdue
  if (b.p[1] > H + 20) perdreBille();
}

function perdreBille() {
  if (jeu.sauvetage > 0) {
    flash("BILLE SAUVÉE !");
    Sons.jouer("boing");
    nouvelleBille();
    return;
  }
  jeu.billes--;
  majAfficheur();
  Sons.jouer("perte_bille");
  if (jeu.billes <= 0) return finDePartie();
  flash(`BILLE ${4 - jeu.billes} / 3`);
  nouvelleBille();
}

async function finDePartie() {
  jeu.fini = true;
  Sons.musique.arreter();
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
      emoji: jeu.score >= 50000 ? "🏆" : "🪩",
      lignes: [`${jeu.score.toLocaleString("fr-FR")} points · multiplicateur max x${jeu.mult}`],
      fin: r.fin,
      rejouer: lancer,
    });
  }, 1200);
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
    if (jeu.sauvetage > 0 && !jeu.dansCouloir) jeu.sauvetage -= ecoule;
  }
  const b = jeu.bille;
  b.trace.push([b.p[0], b.p[1]]);
  if (b.trace.length > 10) b.trace.shift();
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
  const t = performance.now() / 1000;

  // fond : dégradé, grille rétro, étoiles
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a0b3d");
  g.addColorStop(.6, "#2b0f55");
  g.addColorStop(1, "#0b0520");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 47, 208, .09)";
  ctx.lineWidth = 1;
  for (let y = 460; y < H; y += 28) ligne([24, y], [420, y]);
  for (let x = 24; x <= 420; x += 33) ligne([x, 460], [x, H]);
  ctx.fillStyle = "rgba(255,255,255,.5)";
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97) % 390 + 30, sy = (i * 53) % 400 + 40;
    ctx.globalAlpha = .3 + .3 * Math.sin(t * 2 + i);
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  // logo au centre
  ctx.save();
  ctx.font = "900 44px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 201, 60, .12)";
  ctx.fillText("MINIJEUX", 222, 480);
  ctx.restore();

  // murs néon
  ctx.lineCap = "round";
  for (const m of murs) {
    if (m.kick) continue;
    neon(m.neon || "#3ee0e8", m.lanceur ? 6 : 4);
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

  // couloirs du haut
  for (const co of couloirs) {
    ctx.shadowColor = "#ffc93c";
    ctx.shadowBlur = co.allume ? 22 : 0;
    ctx.fillStyle = co.allume ? "#ffe07a" : "rgba(255, 201, 60, .2)";
    ctx.beginPath(); ctx.arc(co.x, co.y + 32, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.font = "bold 13px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffc93c";
  ctx.fillText(`x${Math.min(5, jeu ? jeu.mult + 1 : 2)}`, 237, 160);

  // bumpers
  for (const bu of bumpers) {
    const s = 1 + bu.flash * .15;
    ctx.save();
    ctx.translate(...bu.c);
    ctx.scale(s, s);
    ctx.shadowColor = bu.couleur;
    ctx.shadowBlur = 20 + bu.flash * 30;
    ctx.fillStyle = bu.flash > .3 ? "#fff" : bu.couleur;
    ctx.beginPath(); ctx.arc(0, 0, bu.R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#1a0b3d";
    ctx.beginPath(); ctx.arc(0, 0, bu.R * .62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bu.couleur;
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
    ctx.shadowColor = "#ff5fa2";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = "#ff5fa2";
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
  const comp = jeu && jeu.dansCouloir ? jeu.puissance : 0;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffc93c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) ctx.lineTo(i % 2 ? 446 : 430, 784 + comp * 14 + i * (30 - comp * 14) / 8);
  ctx.stroke();

  // bille (avec traînée)
  if (jeu) {
    const b = jeu.bille;
    b.trace.forEach((pt, i) => {
      ctx.globalAlpha = i / b.trace.length * .35;
      ctx.fillStyle = "#b99cff";
      ctx.beginPath(); ctx.arc(pt[0], pt[1], R_BILLE * (i / b.trace.length), 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    const gb = ctx.createRadialGradient(b.p[0] - 3, b.p[1] - 4, 1, b.p[0], b.p[1], R_BILLE);
    gb.addColorStop(0, "#ffffff");
    gb.addColorStop(.4, "#d7dce4");
    gb.addColorStop(1, "#6b7280");
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 10;
    ctx.fillStyle = gb;
    ctx.beginPath(); ctx.arc(b.p[0], b.p[1], R_BILLE, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (jeu.dansCouloir && jeu.charge) {
      ctx.fillStyle = "#ffc93c";
      ctx.fillRect(462, 800 - jeu.puissance * 80, 10, jeu.puissance * 80);
    }
    if (jeu.sauvetage > 0 && !jeu.dansCouloir && Math.sin(t * 10) > 0) {
      ctx.fillStyle = "#5be37d";
      ctx.font = "bold 12px Trebuchet MS, sans-serif";
      ctx.fillText("BALL SAVE", 222, 800);
    }
  }

  // particules et points
  for (let i = particules.length - 1; i >= 0; i--) {
    const p = particules[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.vie -= dt * 1.8;
    if (p.vie <= 0) { particules.splice(i, 1); continue; }
    ctx.globalAlpha = p.vie;
    ctx.fillStyle = p.couleur;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.font = "bold 15px Trebuchet MS, sans-serif";
  for (let i = textes.length - 1; i >= 0; i--) {
    const x = textes[i];
    x.y -= 40 * dt; x.vie -= dt;
    if (x.vie <= 0) { textes.splice(i, 1); continue; }
    ctx.globalAlpha = x.vie;
    ctx.fillStyle = "#fff";
    ctx.fillText(x.t, x.x, x.y);
  }
  ctx.globalAlpha = 1;

  if (texteFlash && texteFlash.vie > 0) {
    texteFlash.vie -= dt;
    ctx.save();
    ctx.font = "900 34px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff2fd0";
    ctx.shadowBlur = 20;
    ctx.fillStyle = Math.sin(t * 14) > -0.3 ? "#fff" : "#ffc93c";
    ctx.fillText(texteFlash.t, 222, 560);
    ctx.restore();
  }
}

ajusterToile();
dessiner(0);
