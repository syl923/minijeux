// Moka Glisse : Nounours l'ours polaire envoie Moka (en doudoune) le plus loin possible d'un coup de batte.
// 1) on dose la puissance, 2) on choisit l'angle, 3) Moka vole puis glisse sur le ventre : on saute les obstacles.
// Monde en mètres : x vers la droite, y vers le haut.

const W = 800, H = 500;
const toile = document.getElementById("pingouin");
const ctx = toile.getContext("2d");
const surcouche = document.getElementById("surcouche");

const G = 14, PAS = 1 / 120;
const FROTTEMENT = 0.1, FROTTEMENT_GLACE = 0.012, TRAINEE = 0.0035, SAUT = 10;
const V_MIN = 18, V_MAX = 54;     // vitesse au départ selon la puissance (m/s)

let jeu = null;
let meilleur = 0;
try { meilleur = Number(localStorage.getItem("moka-glisse-record")) || 0; } catch (e) { /* stockage indisponible */ }

// ------------------------------------------------------------ terrain
// Plateforme de lancer (x < 6), grande descente, puis collines douces qui descendent lentement.
function sol(x) {
  if (x < 6) return 0;
  if (x < 46) { const t = (x - 6) / 40; return -26 * (1 - Math.cos(Math.PI * t)) / 2; }
  const d = x - 46;
  return -26 - d * 0.028 + 2.6 * Math.sin(d / 23) + 1.4 * Math.sin(d / 9.5 + 1.3) - 1.4 * Math.sin(1.3);
}
function pente(x) { return (sol(x + 0.05) - sol(x - 0.05)) / 0.1; }

// Obstacles, tremplins, plaques de glace et bananes, générés au fur et à mesure.
function generer(jusqua) {
  while (jeu.xGen < jusqua) {
    const x = jeu.xGen;
    const r = Math.random();
    const dist = x / 400;
    if (r < 0.2) jeu.objets.push({ type: "tremplin", x, long: 4, h: 1.3 });
    else if (r < 0.32) jeu.objets.push({ type: "glace", x, long: 18 + Math.random() * 14 });
    else if (r < 0.46) jeu.objets.push({ type: "pingouin", x, h: 0.9 });
    else {
      const type = ["bonhomme", "rocher", "sapin", "rocher", "bonhomme"][Math.floor(Math.random() * 5)];
      jeu.objets.push({ type, x, h: { bonhomme: 1.7, rocher: 0.9, sapin: 2.4 }[type] });
    }
    // bananes : en ligne au ras du sol, ou en arc dans les airs
    if (Math.random() < 0.6) {
      const bx = x + 8 + Math.random() * 10, enl = Math.random() < 0.5;
      for (let k = 0; k < 5; k++) {
        const xx = bx + k * 2.2;
        jeu.bananes.push({ x: xx, y: sol(xx) + (enl ? 3 + Math.sin(k / 4 * Math.PI) * 3 : 0.9) });
      }
    }
    jeu.xGen += Math.max(16, 42 - dist * 6) + Math.random() * 26;
  }
  // bananes en plein ciel sur la trajectoire du vol
  while (jeu.xCiel < jusqua) {
    const xx = jeu.xCiel;
    jeu.bananes.push({ x: xx, y: sol(xx) + 10 + Math.random() * 30, dore: Math.random() < 0.15 });
    jeu.xCiel += 18 + Math.random() * 30;
  }
  jeu.objets = jeu.objets.filter((o) => o.x + (o.long || 1) > jeu.x - 40);
  jeu.bananes = jeu.bananes.filter((b) => b.x > jeu.x - 40 && !b.pris);
}

// ------------------------------------------------------------ partie
document.getElementById("btn-jouer").onclick = () => exigerConnexion(lancer);

async function lancer() {
  let r;
  try {
    r = await api("/api/pingouin/debut", {});
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  jeu = {
    partie: r.partie, phase: "puissance", t: 0, puissance: 0, angle: 0,
    x: 0.6, y: 0, vx: 0, vy: 0, auSol: true, rot: 0, arret: 0, batte: 0,
    objets: [], bananes: [], anneaux: [], trace: [], xGen: 70, xCiel: 40, nbBananes: 0, sauts: 0, particules: [], textes: [],
    fini: false, secousse: 0, temps: 0, maxX: 0, dernier: performance.now(), cam: { x: 0, y: 0, zoom: 16 },
  };
  generer(400);
  surcouche.classList.add("cache");
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("banquise");
  majCompteurs();
  mokaDit("Clique quand la jauge est au max !", "malin", 2600);
  requestAnimationFrame(boucle);
}

// Un appui : pendant le lancer il valide la jauge, pendant la glisse il fait sauter Moka.
function appui() {
  if (!jeu || jeu.fini) return;
  if (jeu.phase === "puissance") {
    jeu.puissance = jaugePuissance();
    jeu.phase = "angle";
    jeu.t = 0;
    Sons.jouer("tic");
    if (jeu.puissance > 0.93) jeu.textes.push({ t: "PUISSANCE MAX !", vie: 1.2, x: W / 2, y: 120, c: "#ffd43b" });
  } else if (jeu.phase === "angle") {
    jeu.angle = jaugeAngle();
    jeu.phase = "frappe";
    jeu.t = 0;
    Sons.jouer("saut");
  } else if (jeu.phase === "vol" && jeu.auSol && jeu.temps - (jeu.dernierSaut ?? -1) > 0.3) {
    jeu.vy += SAUT;
    jeu.y += 0.05;
    jeu.auSol = false;
    jeu.dernierSaut = jeu.temps;
    jeu.salto = 0;          // petit salto pendant le saut (affichage seulement)
    jeu.ecrase = -1;        // étirement au décollage
    Sons.jouer("saut");
    for (let i = 0; i < 14; i++) jeu.particules.push({ x: jeu.x - .3, y: jeu.y, vx: -Math.random() * 6, vy: Math.random() * 4, vie: .5, c: "#fff", r: .22 });
  }
}
const jaugePuissance = () => Math.abs(Math.sin(jeu.t * 2.4));
const jaugeAngle = () => 40 + 33 * Math.sin(jeu.t * 2.1);

document.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "ArrowUp" || e.key === "Enter") && jeu && !jeu.fini) { e.preventDefault(); if (!e.repeat) appui(); }
});
toile.addEventListener("pointerdown", (e) => { e.preventDefault(); appui(); });

function frapper() {
  const parfait = jeu.puissance > 0.93;
  const bonAngle = Math.abs(jeu.angle - 40) < 6;
  let v = V_MIN + (V_MAX - V_MIN) * jeu.puissance;
  if (parfait) v *= 1.08;
  if (bonAngle) v *= 1.05;
  const a = jeu.angle * Math.PI / 180;
  jeu.vx = v * Math.cos(a);
  jeu.vy = v * Math.sin(a);
  jeu.y = 1;
  jeu.auSol = false;
  jeu.phase = "vol";
  jeu.secousse = 10 + jeu.puissance * 12;
  Sons.jouer("kaboom");
  Sons.jouer("boing");
  for (let i = 0; i < 26; i++) jeu.particules.push({ x: jeu.x, y: 1, vx: Math.random() * 14 - 4, vy: Math.random() * 10 - 2, vie: .7, c: i % 2 ? "#fff" : "#ffe066", r: .18 });
  const qualite = parfait && bonAngle ? "HOME RUN !!!" : parfait ? "COUP PARFAIT !" : bonAngle ? "BEL ANGLE !" : jeu.puissance > .6 ? "BIEN FRAPPÉ !" : "Un peu mou…";
  jeu.textes.push({ t: qualite, vie: 1.8, x: W / 2, y: 110, c: parfait ? "#ffd43b" : "#fff", grand: true });
  mokaDit(parfait && bonAngle ? "WOUHOUUU ! Je vole !" : jeu.puissance > .6 ? "Waaah, c'est parti !" : "Euh… c'est tout ?", parfait ? "etoiles" : jeu.puissance > .6 ? "content" : "triste", 2200);
}

// ------------------------------------------------------------ physique
function etape(dt) {
  jeu.temps += dt;
  const avantSol = jeu.auSol;
  jeu.vy -= G * dt;
  const s = Math.hypot(jeu.vx, jeu.vy);
  if (!jeu.auSol) { // un peu de freinage de l'air
    jeu.vx -= jeu.vx * s * TRAINEE * 0.35 * dt;
    jeu.vy -= jeu.vy * s * TRAINEE * 0.35 * dt;
  }
  jeu.x += jeu.vx * dt;
  jeu.y += jeu.vy * dt;
  const ys = sol(jeu.x);
  const p = pente(jeu.x);
  const glace = jeu.objets.some((o) => o.type === "glace" && jeu.x > o.x && jeu.x < o.x + o.long);
  if (jeu.y <= ys) {
    // contact : on garde la vitesse le long de la pente, on retire la composante qui s'enfonce
    const n = [-p / Math.hypot(1, p), 1 / Math.hypot(1, p)];
    const vn = jeu.vx * n[0] + jeu.vy * n[1];
    jeu.y = ys;
    if (vn < 0) {
      jeu.vx -= vn * n[0]; jeu.vy -= vn * n[1];
      if (!avantSol) atterrir(-vn);
    }
    jeu.auSol = true;
  } else if (jeu.y > ys + 0.12) {
    jeu.auSol = false;
  }
  if (jeu.auSol) {
    // frottement de la doudoune sur la neige (presque rien sur la glace) et freinage de l'air
    const v = Math.hypot(jeu.vx, jeu.vy);
    const cos = 1 / Math.hypot(1, p);
    const frein = (glace ? FROTTEMENT_GLACE : FROTTEMENT) * G * cos + TRAINEE * v * v;
    const nv = Math.max(0, v - frein * dt);
    if (v > 0) { jeu.vx *= nv / v; jeu.vy *= nv / v; }
    if (jeu.vx < 0) { jeu.vx = 0; jeu.vy = 0; }
    if (glace && Math.random() < .3) jeu.particules.push({ x: jeu.x, y: jeu.y + .1, vx: -2, vy: 1, vie: .3, c: "#c5f6fa", r: .12 });
    else if (Math.random() < .5) jeu.particules.push({ x: jeu.x - .5, y: jeu.y + .1, vx: -jeu.vx * .2 + Math.random() * 2, vy: 1 + Math.random() * 2.5, vie: .45, c: "#fff", r: .16 });
  }
  jeu.rot = jeu.auSol ? Math.atan(p) : jeu.rot + dt * (6 + Math.hypot(jeu.vx, jeu.vy) * .08);

  // objets
  for (const o of jeu.objets) {
    if (o.touche || o.passe || o.type === "glace") continue;
    if (o.type === "tremplin") {
      if (jeu.auSol && jeu.x > o.x && jeu.x < o.x + o.long) {
        o.passe = true;
        const v = Math.hypot(jeu.vx, jeu.vy);
        jeu.vx = v * Math.cos(.6) + 2; jeu.vy = v * Math.sin(.6) + 4; jeu.y += .2; jeu.auSol = false;
        Sons.jouer("boing");
        jeu.textes.push({ t: "TREMPLIN !", vie: 1.1, monde: true, x: jeu.x, y: jeu.y + 3, c: "#74c0fc" });
      }
      continue;
    }
    const haut = jeu.y - sol(o.x);
    if (Math.abs(jeu.x - o.x) < 0.8) {
      if (o.type === "pingouin" && haut < o.h + 0.6 && jeu.vy < 0 && haut > o.h * 0.5) { // rebond sur le ventre du pingouin
        o.touche = true;
        jeu.vy = 13; jeu.vx += 3; jeu.y = sol(jeu.x) + o.h + .1; jeu.auSol = false;
        Sons.jouer("boing"); jeu.sauts++;
        jeu.textes.push({ t: "PINGOUIN-TRAMPOLINE !", vie: 1.3, monde: true, x: jeu.x, y: jeu.y + 3, c: "#ffd43b" });
        majCompteurs();
      } else if (haut < o.h) {
        heurter(o);
      }
    } else if (jeu.x > o.x + 0.8) {
      o.passe = true;
      if ((jeu.y - sol(o.x)) > 0.2 && jeu.temps - (jeu.dernierSaut ?? -9) < 1.5) { // sauté (le grand vol ne compte pas)
        jeu.sauts++;
        jeu.combo = (jeu.combo || 0) + 1;
        jeu.textes.push({ t: jeu.combo > 1 ? `COMBO x${jeu.combo} !` : "+10 SAUT !", vie: 1, monde: true, x: o.x, y: sol(o.x) + o.h + 2, c: jeu.combo > 2 ? "#ffd43b" : "#b2f2bb" });
        if (jeu.combo === 3) mokaDit("Triple saut ! Je suis un kangourou !", "etoiles", 1800);
        else if (jeu.combo >= 5 && jeu.combo % 5 === 0) mokaDit(`COMBO x${jeu.combo} ! Personne ne m'arrête !`, "etoiles", 2000);
        majCompteurs();
      }
    }
  }
  // bananes
  for (const b of jeu.bananes) {
    if (!b.pris && Math.hypot(b.x - jeu.x, b.y - (jeu.y + .6)) < 1.4) {
      b.pris = true;
      jeu.nbBananes += b.dore ? 3 : 1;
      Sons.jouer(b.dore ? "bonus" : "piece");
      if (b.dore) jeu.textes.push({ t: "BANANE D'OR x3 !", vie: 1, monde: true, x: b.x, y: b.y + 2, c: "#ffd43b" });
      majCompteurs();
    }
  }
  jeu.maxX = Math.max(jeu.maxX, jeu.x);
  generer(jeu.x + 260);
  // arrêt : Moka s'immobilise au sol
  if (jeu.auSol && Math.hypot(jeu.vx, jeu.vy) < 0.8) jeu.arret += dt; else jeu.arret = 0;
  if (jeu.arret > 0.5 || jeu.temps > 120) terminer();
}

function atterrir(vn) {
  const v = Math.hypot(jeu.vx, jeu.vy);
  jeu.ecrase = Math.min(1, .35 + vn / 20);   // écrasement à l'atterrissage (affichage)
  jeu.salto = null;
  jeu.anneaux.push({ x: jeu.x, y: jeu.y, r: .5, vie: 1 });
  if (vn > 16) {
    jeu.vx *= 0.8; jeu.vy *= 0.8;
    jeu.secousse = 12;
    Sons.jouer("plouf");
    jeu.textes.push({ t: "PLOUF !", vie: 1, monde: true, x: jeu.x, y: jeu.y + 3, c: "#fff" });
    for (let i = 0; i < 30; i++) jeu.particules.push({ x: jeu.x, y: jeu.y, vx: Math.random() * 12 - 4, vy: Math.random() * 9, vie: .8, c: "#fff", r: .25 });
  } else if (vn < 7 && v > 8) { // atterrissage en douceur dans la pente : petit coup de vitesse
    jeu.vx *= 1.06; jeu.vy *= 1.06;
    Sons.jouer("glisse");
    jeu.textes.push({ t: "Atterrissage parfait !", vie: 1, monde: true, x: jeu.x, y: jeu.y + 3, c: "#b2f2bb" });
  } else {
    Sons.jouer("pose");
    for (let i = 0; i < 12; i++) jeu.particules.push({ x: jeu.x, y: jeu.y, vx: Math.random() * 8 - 2, vy: Math.random() * 5, vie: .6, c: "#fff", r: .2 });
  }
}

function heurter(o) {
  o.touche = true;
  jeu.combo = 0;
  const perte = { bonhomme: 0.5, rocher: 0.35, sapin: 0.3, pingouin: 0.7 }[o.type];
  jeu.vx *= perte; jeu.vy = Math.max(jeu.vy, 0) + (o.type === "rocher" ? 4 : 1.5);
  jeu.auSol = false; jeu.y += .1;
  jeu.secousse = 16;
  Sons.jouer(o.type === "pingouin" ? "boing" : "crash");
  const noms = { bonhomme: "BOUM ! Le bonhomme de neige !", rocher: "AÏE ! Un rocher !", sapin: "OUCH ! Le sapin !", pingouin: "Pardon monsieur le pingouin !" };
  jeu.textes.push({ t: noms[o.type], vie: 1.3, monde: true, x: jeu.x, y: jeu.y + 3.5, c: "#ff8787" });
  for (let i = 0; i < 28; i++) jeu.particules.push({ x: o.x, y: sol(o.x) + o.h * Math.random(), vx: Math.random() * 10 - 2, vy: Math.random() * 8, vie: .9, c: o.type === "sapin" ? (i % 2 ? "#2b8a3e" : "#fff") : o.type === "rocher" ? "#868e96" : "#fff", r: .22 });
  mokaDit(o.type === "pingouin" ? "Oups, désolé !" : "Aïeuh ! Il faut sauter !", "choc", 1600);
}

function metres() { return Math.max(0, Math.floor(jeu.maxX)); }

function majCompteurs() {
  document.getElementById("metres").textContent = `${metres()} m`;
  document.getElementById("bananes").textContent = jeu.nbBananes;
  document.getElementById("sauts").textContent = jeu.sauts;
}

async function terminer() {
  if (jeu.fini) return;
  jeu.fini = true;
  Sons.musique.arreter();
  const m = metres();
  const record = m > meilleur;
  if (record) { meilleur = m; try { localStorage.setItem("moka-glisse-record", String(m)); } catch (e) { /* rien */ } }
  jeu.textes.push({ t: `${m} m !`, vie: 3, x: W / 2, y: 150, c: "#ffd43b", grand: true });
  mokaDit(m > 600 ? "Record de glisse ! Je suis un champion !" : "Brrr… on remet ça ?", m > 600 ? "etoiles" : "content", 3000);
  let r;
  try {
    r = await api("/api/pingouin/fin", { partie: jeu.partie, metres: m, bananes: jeu.nbBananes, sauts: jeu.sauts });
  } catch (e) {
    alert(e.message);
    return surcouche.classList.remove("cache");
  }
  setTimeout(() => {
    surcouche.classList.remove("cache");
    afficherResultat({
      titre: record ? "Nouvelle meilleure distance !" : "Moka s'est arrêté !",
      emoji: m > 600 ? "🏆" : "🐒",
      lignes: [`${m} m · ${jeu.nbBananes} bananes · ${jeu.sauts} sauts`],
      fin: r.fin,
      rejouer: lancer,
    });
  }, 1400);
}

// ------------------------------------------------------------ boucle
function boucle(t) {
  if (!jeu) return;
  const dt = Math.min(0.05, (t - jeu.dernier) / 1000);
  jeu.dernier = t;
  if (!jeu.fini) {
    if (jeu.phase === "puissance" || jeu.phase === "angle") jeu.t += dt;
    if (jeu.phase === "frappe") {
      jeu.t += dt;
      jeu.batte = Math.min(1, jeu.t / 0.22);
      if (jeu.t >= 0.22) frapper();
    }
    if (jeu.phase === "vol") {
      let reste = dt;
      while (reste > 0 && !jeu.fini) { const pas = Math.min(PAS, reste); etape(pas); reste -= pas; }
      if (!jeu.fini) { const m = metres(); if (m !== jeu.dernierM) { jeu.dernierM = m; document.getElementById("metres").textContent = `${m} m`; } }
    }
  }
  dessiner(dt);
  if (!jeu.fini || jeu.textes.length || jeu.particules.length) requestAnimationFrame(boucle);
}

// ------------------------------------------------------------ dessin
const tetesMoka = {};
function teteMoka(humeur) {
  if (!tetesMoka[humeur]) {
    const h = HUMEURS[humeur] || {};
    tetesMoka[humeur] = imageSVG(singe({ chapeau: "bonnet", yeux: "content", bouche: "grand", ...h, habit: "aucun", extras: h.extras || [] }), "tete-glisse-" + humeur);
  }
  return tetesMoka[humeur];
}
const flocons = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 40, r: 1 + Math.random() * 2.5 }));

function ajusterToile() {
  const ratio = window.devicePixelRatio || 1;
  const largeur = Math.min(W, window.innerWidth - 40);
  toile.style.width = largeur + "px";
  toile.style.height = largeur * H / W + "px";
  toile.width = Math.round(largeur * ratio);
  toile.height = Math.round(largeur * H / W * ratio);
}

// caméra : suit Moka, dézoome quand il monte haut
const camAccueil = { x: 0, y: 0, zoom: 16 };
function camera(dt) {
  const c = jeu ? jeu.cam : camAccueil;
  const x = jeu ? jeu.x : 0.6, y = jeu ? jeu.y : 0;
  const haut = y - sol(x);
  const zoom = Math.max(4.5, Math.min(16, 16 * 20 / Math.max(20, haut + 12)));
  const vol = jeu && jeu.phase === "vol";
  c.zoom += (zoom - c.zoom) * (vol ? Math.min(1, dt * 3) : 1);
  c.x = x - 250 / c.zoom;
  const yCible = Math.max(sol(x) - 90 / c.zoom, y - (H - 150) / c.zoom);
  c.y += (yCible - c.y) * (vol ? Math.min(1, dt * 5) : 1);
  return c;
}

function dessiner(dt) {
  const t = performance.now() / 1000;
  const cam = camera(dt);
  const Z = cam.zoom;
  const ecran = (x, y) => [(x - cam.x) * Z, H - (y - cam.y) * Z];
  ctx.save();
  ctx.setTransform(toile.width / W, 0, 0, toile.height / H, 0, 0);
  if (jeu && jeu.secousse > 0) { ctx.translate((Math.random() - .5) * jeu.secousse, (Math.random() - .5) * jeu.secousse); jeu.secousse *= .88; if (jeu.secousse < .4) jeu.secousse = 0; }

  // ciel d'hiver, aurore boréale qui apparaît avec la distance
  const loin = jeu ? Math.min(1, jeu.x / 500) : 0;
  const ciel = ctx.createLinearGradient(0, 0, 0, H);
  ciel.addColorStop(0, `rgb(${40 - loin * 25},${110 - loin * 70},${200 - loin * 90})`);
  ciel.addColorStop(1, `rgb(${255 - loin * 60},${214 - loin * 60},${230 - loin * 30})`);
  ctx.fillStyle = ciel; ctx.fillRect(-20, -20, W + 40, H + 40);
  if (loin > .2) {
    ctx.globalAlpha = (loin - .2) * .8;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = ["#63e6be", "#74c0fc", "#b197fc"][i]; ctx.lineWidth = 20 - i * 5;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 70 + i * 22 + Math.sin(x / 90 + t * .6 + i) * 18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // soleil pâle
  ctx.fillStyle = "rgba(255,244,214,.8)"; ctx.shadowColor = "#fff3bf"; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(640, 90, 34, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  // montagnes en parallaxe
  for (const [vit, coul, hmax, pas] of [[.08, "#b8c7e0", 170, 210], [.18, "#9fb4d6", 120, 150]]) {
    const dec = ((cam.x * Z * vit) % pas + pas) % pas;
    const pic = (x) => hmax * (.55 + (((Math.round((x + cam.x * Z * vit) / pas) * 37) % 10 + 10) % 10) / 22);
    ctx.fillStyle = coul;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = -pas - dec; x <= W + pas; x += pas) {
      const h = pic(x);
      ctx.lineTo(x, H - 110 - h * .2); ctx.lineTo(x + pas / 2, H - 110 - h); ctx.lineTo(x + pas, H - 110 - h * .2);
    }
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (let x = -pas - dec; x <= W + pas; x += pas) {
      const h = pic(x);
      ctx.beginPath(); ctx.moveTo(x + pas / 2, H - 110 - h); ctx.lineTo(x + pas / 2 - 22, H - 110 - h + 30); ctx.lineTo(x + pas / 2 + 22, H - 110 - h + 30); ctx.fill();
    }
  }
  // sapins lointains
  ctx.fillStyle = "#6d8bb5";
  const dec = ((cam.x * Z * .35) % 60 + 60) % 60;
  for (let x = -60 - dec; x < W + 60; x += 60) {
    const idx = Math.round((x + cam.x * Z * .35) / 60);
    const h = 30 + ((idx * 13) % 25 + 25) % 25;
    ctx.beginPath(); ctx.moveTo(x, H - 90); ctx.lineTo(x + 12, H - 90 - h); ctx.lineTo(x + 24, H - 90); ctx.fill();
  }

  // neige du terrain
  const x0 = cam.x - 2, x1 = cam.x + W / Z + 2;
  const pasSol = Math.max(.5, 6 / Z);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#d0e7ff");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(...ecran(x0, cam.y - 400));
  for (let x = x0; x <= x1; x += pasSol) ctx.lineTo(...ecran(x, sol(x)));
  ctx.lineTo(...ecran(x1, cam.y - 400)); ctx.fill();
  // ombre bleutée dans les descentes, lumière sur les bosses
  for (let x = Math.floor(x0); x <= x1; x += 1) {
    const p = pente(x);
    if (Math.abs(p) < .05) continue;
    const [ax, ay] = ecran(x, sol(x)), [bx, by] = ecran(x + 1, sol(x + 1));
    ctx.fillStyle = p < 0 ? `rgba(116,160,230,${Math.min(.28, -p * .5)})` : `rgba(255,255,255,${Math.min(.5, p)})`;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by + 60); ctx.lineTo(ax, ay + 60); ctx.fill();
  }
  // congères et reflets qui scintillent
  for (let x = Math.floor(x0 / 7) * 7; x <= x1; x += 7) {
    const [cx, cy] = ecran(x + 3, sol(x + 3));
    ctx.fillStyle = "rgba(208,231,255,.8)";
    ctx.beginPath(); ctx.ellipse(cx, cy + 22, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
    const scintille = Math.sin(performance.now() / 180 + x) > .7;
    if (scintille) { ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.fillText("✦", cx - 8, cy + 14); }
  }
  ctx.strokeStyle = "#a5d8ff"; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += pasSol) ctx.lineTo(...ecran(x, sol(x)));
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += pasSol) { const [a, b] = ecran(x, sol(x)); ctx.lineTo(a, b - 2); }
  ctx.stroke();
  // trace laissée par Moka dans la neige
  if (jeu && jeu.trace.length > 1) {
    ctx.strokeStyle = "rgba(120,160,210,.55)"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath();
    let leve = true;
    for (const [tx, ty, posee] of jeu.trace) {
      if (!posee) { leve = true; continue; }
      const [a, b] = ecran(tx, ty);
      if (leve) { ctx.moveTo(a, b + 1); leve = false; } else ctx.lineTo(a, b + 1);
    }
    ctx.stroke();
  }
  // panneaux de distance tous les 50 m et drapeau du record
  for (let m = Math.ceil(x0 / 50) * 50; m <= x1; m += 50) {
    if (m < 50) continue;
    const [px, py] = ecran(m, sol(m));
    ctx.fillStyle = "#8d5a2b"; ctx.fillRect(px - 2, py - 34, 4, 34);
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1c7ed6"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(px - 24, py - 52, 48, 20, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#1c7ed6"; ctx.font = "900 12px Arial Black, sans-serif"; ctx.textAlign = "center"; ctx.fillText(`${m} m`, px, py - 37); ctx.textAlign = "start";
  }
  if (meilleur > 50 && meilleur > x0 && meilleur < x1) {
    const [px, py] = ecran(meilleur, sol(meilleur));
    ctx.fillStyle = "#495057"; ctx.fillRect(px - 2, py - 70, 4, 70);
    ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.moveTo(px + 2, py - 70); ctx.lineTo(px + 44, py - 60); ctx.lineTo(px + 2, py - 50); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "900 9px Arial Black, sans-serif"; ctx.fillText("RECORD", px + 5, py - 57);
  }

  // plateforme de départ et Nounours l'ours polaire
  if (x0 < 12) dessinerDepart(ecran, Z, t);

  if (jeu) {
    for (const o of jeu.objets) if (o.x > x0 - 40 && o.x < x1 + 5) dessinerObjet(o, ecran, Z, t);
    for (const b of jeu.bananes) if (!b.pris && b.x > x0 && b.x < x1) dessinerBanane(b, ecran, Z, t);
    dessinerMoka(ecran, Z, t);
    if (jeu.phase === "vol" && !jeu.fini) {
      jeu.trace.push([jeu.x, jeu.y, jeu.auSol]);
      if (jeu.trace.length > 400) jeu.trace.shift();
    }
    for (let i = jeu.anneaux.length - 1; i >= 0; i--) { // onde de choc à l'atterrissage
      const a = jeu.anneaux[i];
      a.r += dt * 9; a.vie -= dt * 2.5;
      if (a.vie <= 0) { jeu.anneaux.splice(i, 1); continue; }
      const [ax, ay] = ecran(a.x, a.y);
      ctx.strokeStyle = `rgba(255,255,255,${a.vie})`; ctx.lineWidth = 4 * a.vie;
      ctx.beginPath(); ctx.ellipse(ax, ay, a.r * Z, a.r * Z * .3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = jeu.particules.length - 1; i >= 0; i--) {
      const q = jeu.particules[i];
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 12 * dt; q.vie -= dt;
      if (q.vie <= 0) { jeu.particules.splice(i, 1); continue; }
      const [px, py] = ecran(q.x, q.y);
      ctx.globalAlpha = Math.min(1, q.vie * 2); ctx.fillStyle = q.c;
      ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, q.r * Z), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    dessinerMokaAccueil(ecran, Z, t);
  }
  // flocons qui tombent
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (const f of flocons) {
    f.y += f.v * dt; f.x -= (jeu && jeu.phase === "vol" ? Math.min(300, jeu.vx * 6) : 10) * dt;
    if (f.y > H) f.y = -5;
    if (f.x < -5) f.x = W + 5;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (jeu) interfaceJeu(dt, ecran);
}

function dessinerDepart(ecran, Z, t) {
  // plateforme de glace
  const [ax, ay] = ecran(-14, 0), [bx] = ecran(6, 0);
  ctx.fillStyle = "#e7f5ff"; ctx.fillRect(ax, ay, bx - ax, 8 * Z);
  ctx.fillStyle = "#a5d8ff"; ctx.fillRect(ax, ay, bx - ax, .3 * Z);
  // Nounours l'ours polaire, casquette de baseball et batte
  const [ox, oy] = ecran(-2.4, 0);
  const u = Z / 12;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(u, u);
  ctx.fillStyle = "#f8f9fa"; ctx.strokeStyle = "#ced4da"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(-8, -8, 12, 8, 0, 0, Math.PI * 2); ctx.ellipse(14, -8, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3, -44, 28, 36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e9ecef"; ctx.beginPath(); ctx.ellipse(8, -40, 16, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f8f9fa";
  ctx.beginPath(); ctx.arc(-9, -104, 8, 0, Math.PI * 2); ctx.arc(19, -104, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(6, -88, 21, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e9ecef"; ctx.beginPath(); ctx.ellipse(19, -83, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#212529"; ctx.beginPath(); ctx.arc(27, -86, 4, 0, Math.PI * 2); ctx.arc(5, -94, 2.8, 0, Math.PI * 2); ctx.arc(16, -94, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#212529"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, -78); ctx.quadraticCurveTo(20, -74, 25, -78); ctx.stroke();
  ctx.fillStyle = "#1c7ed6"; ctx.beginPath(); ctx.arc(6, -100, 19, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.fillRect(12, -103, 22, 5);
  // batte : levée derrière la tête, puis frappe
  const b = jeu ? (jeu.phase === "puissance" || jeu.phase === "angle" ? Math.sin(t * 4) * .05 : jeu.phase === "frappe" ? jeu.batte : 1) : Math.sin(t * 2) * .08;
  const a = -2.5 + b * 3;
  ctx.save(); ctx.translate(22, -54); ctx.rotate(a);
  ctx.fillStyle = "#c08040"; ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(58, -8); ctx.quadraticCurveTo(66, 0, 58, 8); ctx.lineTo(0, 3.5); ctx.fill();
  ctx.fillStyle = "#6b4226"; ctx.fillRect(-4, -5, 14, 10);
  ctx.restore();
  ctx.fillStyle = "#f8f9fa"; ctx.strokeStyle = "#ced4da"; ctx.beginPath(); ctx.ellipse(22, -54, 9, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  if (jeu && jeu.phase === "frappe" && jeu.batte > .7) { // éclair du choc
    const [mx, my] = ecran(jeu.x, 1);
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const r = i % 2 ? 14 : 34; const a2 = i / 16 * Math.PI * 2; ctx.lineTo(mx + Math.cos(a2) * r * u, my + Math.sin(a2) * r * u); }
    ctx.fill();
  }
}

function dessinerObjet(o, ecran, Z, t) {
  const [px, py] = ecran(o.x, sol(o.x));
  const u = Z / 12;
  if (o.type === "glace") {
    ctx.strokeStyle = "rgba(116, 192, 252, .9)"; ctx.lineWidth = Math.max(3, 6 * u); ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = o.x; x <= o.x + o.long; x += .5) ctx.lineTo(...ecran(x, sol(x) + .05));
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(1, 2 * u);
    for (let x = o.x + 2; x < o.x + o.long; x += 4) { const [a, b] = ecran(x, sol(x) + .12); ctx.beginPath(); ctx.moveTo(a - 5 * u, b); ctx.lineTo(a + 5 * u, b - 2 * u); ctx.stroke(); }
    return;
  }
  if (o.type === "tremplin") {
    const [qx, qy] = ecran(o.x + o.long, sol(o.x + o.long) + o.h);
    const [, by] = ecran(o.x + o.long, sol(o.x + o.long));
    ctx.fillStyle = "#74c0fc";
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.lineTo(qx, by); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke();
    ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx, qy - 26 * u); ctx.lineTo(qx + 16 * u, qy - 20 * u); ctx.lineTo(qx, qy - 14 * u); ctx.fill();
    return;
  }
  ctx.save(); ctx.translate(px, py); ctx.scale(u, u);
  if (o.touche && o.type !== "pingouin") ctx.globalAlpha = .35;
  switch (o.type) {
    case "bonhomme": {
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#ced4da"; ctx.lineWidth = 2;
      for (const [y, r] of [[-9, 10], [-24, 8], [-36, 6]]) { ctx.beginPath(); ctx.arc(0, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = "#212529"; ctx.fillRect(-6, -48, 12, 8); ctx.fillRect(-8, -41, 16, 2);
      ctx.beginPath(); ctx.arc(-2, -37, 1.2, 0, Math.PI * 2); ctx.arc(2.5, -37, 1.2, 0, Math.PI * 2); ctx.arc(0, -24, 1.4, 0, Math.PI * 2); ctx.arc(0, -19, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff922b"; ctx.beginPath(); ctx.moveTo(-1, -34); ctx.lineTo(-10, -33); ctx.lineTo(-1, -32); ctx.fill();
      ctx.strokeStyle = "#e03131"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(6, -30); ctx.lineTo(8, -22); ctx.stroke();
      break;
    }
    case "rocher": {
      ctx.fillStyle = "#868e96";
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-12, -12, -2, -12); ctx.quadraticCurveTo(10, -13, 11, 0); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(-1, -11, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "sapin": {
      ctx.fillStyle = "#6b4226"; ctx.fillRect(-2.5, -6, 5, 6);
      ctx.fillStyle = "#2b8a3e";
      for (const [y, l] of [[-6, 13], [-15, 10], [-23, 7]]) { ctx.beginPath(); ctx.moveTo(-l, y); ctx.lineTo(0, y - 14); ctx.lineTo(l, y); ctx.fill(); }
      ctx.fillStyle = "#fff";
      for (const [y, l] of [[-15, 5], [-23, 4], [-31, 3]]) { ctx.beginPath(); ctx.moveTo(-l, y); ctx.lineTo(0, y - 6); ctx.lineTo(l, y); ctx.fill(); }
      break;
    }
    case "pingouin": { // pingouin qui fait coucou (on peut rebondir sur son ventre)
      ctx.scale(1, o.touche ? .6 : 1);
      ctx.fillStyle = "#1b1b2f"; ctx.beginPath(); ctx.ellipse(0, -8, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(1, -7, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1b1b2f"; ctx.beginPath(); ctx.arc(0, -17, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(1.5, -17.5, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(2, -17.5, .8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff922b"; ctx.beginPath(); ctx.moveTo(4, -16.5); ctx.lineTo(8, -16); ctx.lineTo(4, -15); ctx.fill();
      ctx.save(); ctx.translate(-5, -11); ctx.rotate(-.8 + Math.sin(t * 8 + o.x) * .5);
      ctx.fillStyle = "#1b1b2f"; ctx.beginPath(); ctx.ellipse(0, -4, 1.8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#ff922b"; ctx.fillRect(-4, -1, 3, 1.5); ctx.fillRect(1, -1, 3, 1.5);
      break;
    }
  }
  ctx.restore();
}

function dessinerBanane(b, ecran, Z, t) {
  const [px, py] = ecran(b.x, b.y);
  const r = Math.max(5, .55 * Z) * (b.dore ? 1.3 : 1);
  ctx.save(); ctx.translate(px, py + Math.sin(t * 3 + b.x) * 2); ctx.rotate(-.5 + Math.sin(t * 2 + b.x) * .2);
  ctx.shadowColor = b.dore ? "#fff3bf" : "#ffd43b"; ctx.shadowBlur = b.dore ? 18 : 8;
  ctx.fillStyle = b.dore ? "#f59f00" : "#f0b400";
  ctx.beginPath(); ctx.moveTo(-r, -r * .2); ctx.quadraticCurveTo(0, r * 1.2, r, -r * .2); ctx.quadraticCurveTo(0, r * .5, -r, -r * .2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = b.dore ? "#ffe066" : "#ffe14d";
  ctx.beginPath(); ctx.moveTo(-r * .8, -r * .1); ctx.quadraticCurveTo(0, r * .9, r * .8, -r * .1); ctx.quadraticCurveTo(0, r * .6, -r * .8, -r * .1); ctx.fill();
  ctx.restore();
}

// Moka debout en doudoune (avant le lancer, et à l'arrivée)
function mokaDebout(tete, bras) {
  ctx.fillStyle = "#9c6433"; ctx.fillRect(-7, -12, 5, 12); ctx.fillRect(2, -12, 5, 12);
  ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.ellipse(0, -22, 13, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#b02525"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-12, -24); ctx.lineTo(12, -24); ctx.moveTo(-11, -17); ctx.lineTo(11, -17); ctx.stroke();
  ctx.fillStyle = "#339af0"; ctx.fillRect(-9, -34, 18, 5);
  if (bras) { ctx.strokeStyle = "#e03131"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-10, -28); ctx.lineTo(-20, -44); ctx.moveTo(10, -28); ctx.lineTo(20, -44); ctx.stroke(); }
  if (tete.complete) ctx.drawImage(tete, -24, -74, 48, 48);
}

function dessinerMokaAccueil(ecran, Z) {
  const [px, py] = ecran(0.6, 0);
  ctx.save(); ctx.translate(px, py); ctx.scale(Z / 12, Z / 12);
  mokaDebout(teteMoka("malin"), false);
  ctx.restore();
}

// Doudoune rouge rebondie (segments bombés avec ombre et reflet)
function doudoune(rx, ry) {
  const g = ctx.createRadialGradient(-rx * .3, -ry * .5, 1, 0, 0, Math.max(rx, ry));
  g.addColorStop(0, "#ff8787"); g.addColorStop(.55, "#e03131"); g.addColorStop(1, "#a51111");
  ctx.fillStyle = g; ctx.strokeStyle = "#5c0f0f"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(120,10,10,.55)"; ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(i * rx * .45, 0, rx * .12, ry * .92, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(-rx * .35, -ry * .45, rx * .35, ry * .18, -.3, 0, Math.PI * 2); ctx.fill();
}

// Moka en doudoune : boule qui tourne en vol, glissade sur le ventre, salto quand il saute, debout avant le lancer.
function dessinerMoka(ecran, Z, t) {
  const [px, py] = ecran(jeu.x, jeu.y);
  const u = Math.max(Z / 12, .8);  // Moka reste bien visible même quand la caméra dézoome
  const hauteur = jeu.y - sol(jeu.x);
  const petitSaut = jeu.phase === "vol" && !jeu.auSol && jeu.salto !== null && jeu.salto !== undefined;
  let humeur = "content";
  if (jeu.phase === "vol" && !jeu.auSol) humeur = petitSaut ? "etoiles" : jeu.vy > 0 ? "etoiles" : "choc";
  if (jeu.phase === "vol" && jeu.auSol && Math.hypot(jeu.vx, jeu.vy) > 25) humeur = "rire";
  if (jeu.phase === "puissance" || jeu.phase === "angle") humeur = "malin";
  if (jeu.phase === "frappe") humeur = "choc";
  if (jeu.fini) humeur = "rire";
  const tete = teteMoka(humeur);
  // ombre au sol : on voit tout de suite que Moka est en l'air
  if (jeu.phase === "vol" && hauteur > .15) {
    const [sx, sy] = ecran(jeu.x, sol(jeu.x));
    const k = 1 / (1 + hauteur * .25);
    ctx.fillStyle = `rgba(40,60,110,${.35 * k})`;
    ctx.beginPath(); ctx.ellipse(sx, sy + 2, 22 * u * k + 4, 5 * u * k + 1, 0, 0, Math.PI * 2); ctx.fill();
  }
  // écrasement / étirement (squash & stretch)
  if (jeu.ecrase) jeu.ecrase *= .85;
  if (jeu.ecrase && Math.abs(jeu.ecrase) < .02) jeu.ecrase = 0;
  const e = jeu.ecrase || 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(u, u);
  if (jeu.phase !== "vol" || jeu.fini) {
    mokaDebout(tete, jeu.fini);
  } else if (jeu.auSol || petitSaut) {
    // glissade sur le ventre (et salto quand il saute par-dessus un obstacle)
    ctx.rotate(-Math.atan(pente(jeu.x)));
    if (petitSaut) {
      jeu.salto += .016 * 13;
      ctx.translate(0, -10); ctx.rotate(-Math.min(jeu.salto, Math.PI * 2)); ctx.translate(0, 10);
    }
    ctx.scale(1 + e * .3, 1 - e * .3);
    const vib = jeu.auSol ? Math.sin(t * 40) * .6 : 0;
    ctx.translate(0, vib);
    // queue et jambes qui battent
    ctx.strokeStyle = "#7a4a1f"; ctx.lineWidth = 3.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-20, -12); ctx.bezierCurveTo(-30, -22, -34 + Math.sin(t * 9) * 3, -30, -24, -32); ctx.stroke();
    ctx.strokeStyle = "#9c6433"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-18, -6); ctx.lineTo(-30, -3 + Math.sin(t * 22) * 3); ctx.moveTo(-18, -10); ctx.lineTo(-31, -10 - Math.sin(t * 22) * 3); ctx.stroke();
    ctx.save(); ctx.translate(-3, -8); doudoune(17, 9.5); ctx.restore();
    // bras tendus devant façon super-héros
    ctx.strokeStyle = "#5c0f0f"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(8, -11); ctx.lineTo(27, -10); ctx.stroke();
    ctx.strokeStyle = "#e03131"; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(8, -11); ctx.lineTo(27, -10); ctx.stroke();
    ctx.fillStyle = "#f3d3a6"; ctx.strokeStyle = "#3d2208"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(29, -10, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // écharpe qui claque au vent
    const w1 = Math.sin(t * 16), w2 = Math.sin(t * 16 + 1.3);
    ctx.fillStyle = "#339af0"; ctx.strokeStyle = "#1864ab"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(6, -16); ctx.quadraticCurveTo(-8, -24 + w1 * 3, -24, -22 + w2 * 5); ctx.lineTo(-22, -16 + w2 * 5); ctx.quadraticCurveTo(-8, -18 + w1 * 3, 6, -12); ctx.fill(); ctx.stroke();
    if (tete.complete) ctx.drawImage(tete, 2, -40, 36, 36);
  } else {
    // grand vol : Moka tourne comme une boule de doudoune
    ctx.rotate(jeu.rot);
    ctx.strokeStyle = "#9c6433"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(-19, 7); ctx.moveTo(10, -2); ctx.lineTo(19, 7); ctx.stroke();
    ctx.strokeStyle = "#e03131"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-12, -16); ctx.lineTo(-23, -27); ctx.moveTo(12, -16); ctx.lineTo(23, -27); ctx.stroke();
    ctx.save(); ctx.translate(0, -10); doudoune(14, 14); ctx.restore();
    if (tete.complete) ctx.drawImage(tete, -19, -46, 38, 38);
  }
  ctx.restore();
  // traînée de vitesse
  const v = Math.hypot(jeu.vx, jeu.vy);
  if (jeu.phase === "vol" && v > 22 && !jeu.fini) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(.8, (v - 22) / 25)})`; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const dy = -6 - i * 7 + Math.sin(t * 30 + i) * 2;
      ctx.beginPath(); ctx.moveTo(px - 24 - i * 3, py + dy); ctx.lineTo(px - 70 - i * 14 - v, py + dy + jeu.vy * .6); ctx.stroke();
    }
  }
}

function interfaceJeu(dt, ecran) {
  ctx.save();
  ctx.setTransform(toile.width / W, 0, 0, toile.height / H, 0, 0);
  const texte = (s, x, y, taille, couleur = "#fff", aligne = "left") => {
    ctx.font = `900 ${taille}px Arial Black, sans-serif`; ctx.textAlign = aligne;
    ctx.lineWidth = 5; ctx.strokeStyle = "#1b1340"; ctx.strokeText(s, x, y);
    ctx.fillStyle = couleur; ctx.fillText(s, x, y); ctx.textAlign = "start";
  };
  if (jeu.phase !== "vol") {
    // jauge de puissance verticale
    const p = jeu.phase === "puissance" ? jaugePuissance() : jeu.puissance;
    const gx = W - 70, gy = 110, gh = 260;
    ctx.fillStyle = "rgba(20,20,50,.7)"; ctx.beginPath(); ctx.roundRect(gx - 8, gy - 30, 56, gh + 60, 14); ctx.fill();
    const grad = ctx.createLinearGradient(0, gy + gh, 0, gy);
    grad.addColorStop(0, "#51cf66"); grad.addColorStop(.6, "#fcc419"); grad.addColorStop(.9, "#ff6b6b"); grad.addColorStop(.93, "#fff"); grad.addColorStop(1, "#ffd43b");
    ctx.fillStyle = "#343a40"; ctx.fillRect(gx, gy, 40, gh);
    ctx.fillStyle = grad; ctx.fillRect(gx, gy + gh * (1 - p), 40, gh * p);
    ctx.strokeStyle = "#ffd43b"; ctx.lineWidth = 2; ctx.strokeRect(gx, gy, 40, gh * .07);
    texte("MAX", gx + 20, gy - 10, 13, "#ffd43b", "center");
    texte("💪", gx + 20, gy + gh + 24, 18, "#fff", "center");
    if (jeu.phase === "puissance") texte("Clique pour doser la puissance !", W / 2, 50, 22, "#fff", "center");
    else {
      // flèche d'angle depuis Moka
      const a = (jeu.phase === "angle" ? jaugeAngle() : jeu.angle) * Math.PI / 180;
      const [mx, my] = ecran(jeu.x, 1.2);
      ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(mx, my, 110, -73 * Math.PI / 180, -7 * Math.PI / 180); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "#51cf66"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(mx, my, 110, -46 * Math.PI / 180, -34 * Math.PI / 180); ctx.stroke();
      ctx.save(); ctx.translate(mx, my); ctx.rotate(-a);
      ctx.fillStyle = "#ffd43b"; ctx.strokeStyle = "#8a5a00"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(100, -4); ctx.lineTo(100, -12); ctx.lineTo(124, 0); ctx.lineTo(100, 12); ctx.lineTo(100, 4); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      texte(`${Math.round(a * 180 / Math.PI)}°`, mx + 132, my - 74, 18, "#ffd43b");
      if (jeu.phase === "angle") texte("Clique pour choisir l'angle ! (idéal : 40°)", W / 2, 50, 22, "#fff", "center");
    }
  } else {
    const v = Math.hypot(jeu.vx, jeu.vy);
    texte(`${metres()} m`, 18, 40, 30);
    texte(`${Math.round(v * 3.6)} km/h`, 18, 66, 16, "#a5f3fc");
    texte(`🍌 ${jeu.nbBananes}`, W - 18, 40, 22, "#ffd43b", "right");
    if (!jeu.fini && jeu.auSol) texte("ESPACE / CLIC : sauter", W - 18, H - 18, 14, "#fff", "right");
    const haut = jeu.y - sol(jeu.x);
    if (!jeu.auSol && haut > 12) texte(`↑ ${Math.round(haut)} m`, 18, 92, 16, "#ffe066");
  }
  for (let i = jeu.textes.length - 1; i >= 0; i--) {
    const x = jeu.textes[i];
    x.vie -= dt;
    if (x.vie <= 0) { jeu.textes.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, x.vie * 2);
    let [tx, ty] = x.monde ? ecran(x.x, x.y) : [x.x, x.y];
    if (x.monde) ty -= (1.3 - x.vie) * 30;
    texte(x.t, tx, ty, x.grand ? 40 : 20, x.c || "#fff", "center");
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// écran d'accueil animé derrière la présentation
function attente() {
  if (jeu) return;
  dessiner(0.016);
  requestAnimationFrame(attente);
}
window.addEventListener("resize", ajusterToile);
ajusterToile();
attente();
