// Moka Jet : vol entre les bambous. La simulation (pas fixes de 1/60 s) est identique à jeux/jet.py :
// le serveur rejoue les appuis pour valider le score. Ne pas modifier l'une sans l'autre.

const H = 720, W = 480, SOL = 650, X_JOUEUR = 140, RAYON = 17, GRAVITE = 0.45, POUSSEE = -8.2, CHUTE_MAX = 11;
const LARGEUR_BAMBOU = 84, ECART_BAMBOUS = 270, RAYON_BANANE = 16;
const toile = document.getElementById("jet");
const ctx = toile.getContext("2d");
const surcouche = document.getElementById("surcouche");

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const vitesse = (points) => 3.4 + Math.min(2.2, points * 0.05);
const ouverture = (points) => 190 - Math.min(50, points * 1.5);

function nouveauBambou(alea, x, points) {
  const haut = 90 + alea() * (SOL - 180 - ouverture(points));
  const banane = alea() < 0.45;
  const by = 120 + alea() * 420;
  return { x, haut, bas: haut + ouverture(points), passe: false, banane, bx: x + LARGEUR_BAMBOU + (ECART_BAMBOUS - LARGEUR_BAMBOU) / 2, by, prise: false };
}

function toucheRect(px, py, x1, y1, x2, y2) {
  const cx = Math.min(Math.max(px, x1), x2), cy = Math.min(Math.max(py, y1), y2);
  return (px - cx) * (px - cx) + (py - cy) * (py - cy) < RAYON * RAYON;
}

let jeu = null;

// Un pas de simulation : exactement le corps de la boucle de simuler() côté serveur.
function pas(appui) {
  const s = jeu.sim;
  if (appui) s.vy = POUSSEE;
  s.vy += GRAVITE;
  if (s.vy > CHUTE_MAX) s.vy = CHUTE_MAX;
  s.y += s.vy;
  s.dist += vitesse(s.points);
  while (s.bambous[s.bambous.length - 1].x < s.dist + 900) {
    s.bambous.push(nouveauBambou(s.alea, s.bambous[s.bambous.length - 1].x + ECART_BAMBOUS, s.points));
  }
  const px = s.dist + X_JOUEUR;
  let mort = s.y + RAYON >= SOL || s.y - RAYON <= 0;
  for (const b of s.bambous) {
    if (b.x > px + 200) break;
    if (!b.passe && b.x + LARGEUR_BAMBOU < px - RAYON) { b.passe = true; s.points++; Sons.jouer("mange"); }
    if (toucheRect(px, s.y, b.x, -1000, b.x + LARGEUR_BAMBOU, b.haut) || toucheRect(px, s.y, b.x, b.bas, b.x + LARGEUR_BAMBOU, SOL)) mort = true;
    if (b.banane && !b.prise) {
      const dx = px - b.bx, dy = s.y - b.by;
      if (dx * dx + dy * dy < (RAYON + RAYON_BANANE) * (RAYON + RAYON_BANANE)) {
        b.prise = true;
        s.bananes++;
        Sons.jouer("bonus_pris");
        etincelles(X_JOUEUR, s.y, "#ffe066", 14);
      }
    }
  }
  s.bambous = s.bambous.filter((b) => b.x + LARGEUR_BAMBOU > s.dist - 50);
  return mort;
}

// ------------------------------------------------------------ partie
document.getElementById("btn-jouer").onclick = () => exigerConnexion(lancer);

async function lancer() {
  let r;
  try {
    r = await api("/api/jet/debut", {});
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  const alea = mulberry32(r.graine);
  jeu = {
    partie: r.partie, demarre: false, fini: false, tick: 0, appuis: [], appuiEnAttente: false,
    sim: { alea, y: 360, vy: 0, dist: 0, points: 0, bananes: 0, bambous: [] },
    particules: [], cumul: 0, dernier: performance.now(), secousse: 0, flash: 0, flamme: 0,
  };
  jeu.sim.bambous.push(nouveauBambou(alea, 620, 0));
  majCompteurs();
  surcouche.classList.add("cache");
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("jungle");
  requestAnimationFrame(boucle);
}

function majCompteurs() {
  document.getElementById("bambous").textContent = jeu.sim.points;
  document.getElementById("bananes").textContent = jeu.sim.bananes;
}

function appuyer(e) {
  if (!jeu || jeu.fini) return;
  if (e) e.preventDefault();
  if (!jeu.demarre) { jeu.demarre = true; jeu.dernier = performance.now(); jeu.cumul = 0; }
  jeu.appuiEnAttente = true;
}
document.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "ArrowUp") && jeu && !e.repeat) appuyer(e); });
toile.addEventListener("pointerdown", appuyer);

function boucle(t) {
  if (!jeu) return;
  const dt = Math.min(100, t - jeu.dernier);
  jeu.dernier = t;
  if (jeu.demarre && !jeu.fini) {
    jeu.cumul += dt;
    while (jeu.cumul >= 1000 / 60 && !jeu.fini) {
      jeu.cumul -= 1000 / 60;
      const appui = jeu.appuiEnAttente;
      jeu.appuiEnAttente = false;
      if (appui) {
        jeu.appuis.push(jeu.tick);
        jeu.flamme = 1;
        Sons.jouer("saut");
        for (let i = 0; i < 5; i++) jeu.particules.push({ x: X_JOUEUR - 18, y: jeu.sim.y + 18, vx: -2 - Math.random() * 2, vy: 1 + Math.random() * 2, vie: .6, couleur: i % 2 ? "#ffd43b" : "#ff922b", r: 5 });
      }
      const mort = pas(appui);
      jeu.tick++;
      majCompteurs();
      if (mort) crash();
    }
  }
  dessiner(dt / 1000);
  if (!jeu.fini || jeu.particules.length || jeu.secousse > 0) requestAnimationFrame(boucle);
}

function etincelles(x, y, couleur, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 4;
    jeu.particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vie: 1, couleur, r: 3 });
  }
}

async function crash() {
  jeu.fini = true;
  jeu.secousse = 18;
  jeu.flash = 1;
  Sons.musique.arreter();
  Sons.jouer("crash");
  etincelles(X_JOUEUR, jeu.sim.y, "#ffffff", 30);
  let r;
  try {
    r = await api("/api/jet/fin", { partie: jeu.partie, appuis: jeu.appuis, ticks: jeu.tick });
  } catch (e) {
    alert(e.message);
    return surcouche.classList.remove("cache");
  }
  setTimeout(() => {
    surcouche.classList.remove("cache");
    afficherResultat({
      titre: jeu.sim.points ? `${jeu.sim.points} bambou${jeu.sim.points > 1 ? "s" : ""} passé${jeu.sim.points > 1 ? "s" : ""} !` : "Oups, trop tôt !",
      emoji: jeu.sim.points >= 30 ? "🏆" : "🐵",
      lignes: [`${jeu.sim.bananes} banane(s) attrapée(s)`],
      fin: r.fin,
      rejouer: lancer,
    });
  }, 1000);
}

// ------------------------------------------------------------ dessin
function ajusterToile() {
  const ratio = window.devicePixelRatio || 1;
  const hauteur = Math.max(420, Math.min(window.innerHeight - 40, H));
  const largeur = Math.min(hauteur * W / H, window.innerWidth - 40);
  toile.style.width = largeur + "px";
  toile.style.height = largeur * H / W + "px";
  toile.width = Math.round(largeur * ratio);
  toile.height = Math.round(largeur * H / W * ratio);
}

// décor pré-dessiné : montagnes, jungle lointaine et proche (répétés en boucle)
function couche(largeur, hauteur, dessin) {
  const c = document.createElement("canvas");
  c.width = largeur; c.height = hauteur;
  dessin(c.getContext("2d"), mulberry32(largeur + hauteur));
  return c;
}
const MONTAGNES = couche(960, 300, (d, a) => {
  d.fillStyle = "#6fb3a8";
  d.beginPath(); d.moveTo(0, 300);
  for (let x = 0; x <= 960; x += 60) d.lineTo(x, 120 + a() * 110);
  d.lineTo(960, 300); d.fill();
  d.fillStyle = "#4f9a8f";
  d.beginPath(); d.moveTo(0, 300);
  for (let x = 0; x <= 960; x += 40) d.lineTo(x, 190 + a() * 70);
  d.lineTo(960, 300); d.fill();
});
const JUNGLE = couche(960, 260, (d, a) => {
  for (let i = 0; i < 26; i++) { // arbres ronds
    const x = i * 38 + a() * 20, r = 30 + a() * 30, y = 120 + a() * 60;
    d.fillStyle = i % 2 ? "#2b8a3e" : "#237032";
    d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill();
  }
  d.fillStyle = "#237032";
  d.fillRect(0, 160, 960, 100);
  for (let i = 0; i < 10; i++) { // palmiers
    const x = i * 96 + a() * 40;
    d.strokeStyle = "#5c3d1e"; d.lineWidth = 7;
    d.beginPath(); d.moveTo(x, 260); d.quadraticCurveTo(x + 14, 160, x + 4, 70); d.stroke();
    d.fillStyle = "#37b24d";
    for (let k = 0; k < 5; k++) {
      d.save(); d.translate(x + 4, 70); d.rotate(-2.6 + k * 1.1);
      d.beginPath(); d.ellipse(28, 0, 32, 9, 0, 0, Math.PI * 2); d.fill();
      d.restore();
    }
  }
});

function dessinerBambou(x, y1, y2, haut) {
  // tige
  const g = ctx.createLinearGradient(x, 0, x + LARGEUR_BAMBOU, 0);
  g.addColorStop(0, "#5c940d"); g.addColorStop(.35, "#94d82d"); g.addColorStop(.6, "#74b816"); g.addColorStop(1, "#3f6b08");
  ctx.fillStyle = g;
  ctx.fillRect(x + 6, y1, LARGEUR_BAMBOU - 12, y2 - y1);
  // nœuds du bambou
  ctx.fillStyle = "#3f6b08";
  const debut = haut ? y2 - 22 : y1 + 22;
  for (let y = debut; haut ? y > y1 : y < y2; y += haut ? -70 : 70) {
    ctx.fillRect(x + 2, y - 5, LARGEUR_BAMBOU - 4, 10);
    ctx.fillStyle = "#a9e34b"; ctx.fillRect(x + 8, y - 5, LARGEUR_BAMBOU - 16, 3); ctx.fillStyle = "#3f6b08";
  }
  // embout
  const ye = haut ? y2 - 16 : y1;
  ctx.fillStyle = "#2b5a06";
  ctx.beginPath(); ctx.roundRect(x - 4, ye, LARGEUR_BAMBOU + 8, 16, 6); ctx.fill();
  // feuille
  ctx.fillStyle = "#51cf66";
  ctx.save();
  ctx.translate(x + LARGEUR_BAMBOU - 8, haut ? y2 - 60 : y1 + 60);
  ctx.rotate(haut ? .5 : -.5);
  ctx.beginPath(); ctx.ellipse(22, 0, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function dessinerBanane(x, y, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 4 + x) * 4);
  ctx.rotate(-.4);
  ctx.shadowColor = "#ffe066"; ctx.shadowBlur = 14;
  ctx.fillStyle = "#ffd43b";
  ctx.beginPath(); ctx.arc(0, 0, 16, .2, Math.PI - .2); ctx.arc(0, -8, 14, Math.PI - .3, .3, true); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#5c3d1e"; ctx.fillRect(12, -4, 4, 5);
  ctx.restore();
}

function dessinerMoka(y, vy, t) {
  ctx.save();
  ctx.translate(X_JOUEUR, y);
  ctx.rotate(Math.max(-.5, Math.min(1.1, vy * .07)));
  // jetpack et flamme
  ctx.fillStyle = "#adb5bd"; ctx.beginPath(); ctx.roundRect(-26, -10, 12, 26, 4); ctx.fill();
  const f = jeu && jeu.flamme > 0 ? jeu.flamme : .25 + Math.random() * .15;
  ctx.fillStyle = "#ff922b";
  ctx.beginPath(); ctx.moveTo(-26, 16); ctx.lineTo(-20, 16 + 28 * f + Math.random() * 6); ctx.lineTo(-14, 16); ctx.fill();
  ctx.fillStyle = "#ffe066";
  ctx.beginPath(); ctx.moveTo(-23, 16); ctx.lineTo(-20, 16 + 16 * f); ctx.lineTo(-17, 16); ctx.fill();
  // corps
  ctx.fillStyle = "#8b5a2b"; ctx.beginPath(); ctx.ellipse(0, 10, 14, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f3d3a6"; ctx.beginPath(); ctx.ellipse(2, 12, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
  // oreilles, tête
  ctx.fillStyle = "#8b5a2b";
  ctx.beginPath(); ctx.arc(-14, -12, 7, 0, Math.PI * 2); ctx.arc(14, -12, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9c6433"; ctx.beginPath(); ctx.arc(0, -10, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f3d3a6"; ctx.beginPath(); ctx.ellipse(3, -6, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  // lunettes d'aviateur
  ctx.fillStyle = "#1864ab";
  ctx.beginPath(); ctx.arc(-1, -13, 6, 0, Math.PI * 2); ctx.arc(10, -13, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#a5d8ff";
  ctx.beginPath(); ctx.arc(-1, -13, 4, 0, Math.PI * 2); ctx.arc(10, -13, 4, 0, Math.PI * 2); ctx.fill();
  // casquette
  ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.arc(0, -18, 15, Math.PI, 0); ctx.fill(); ctx.fillRect(4, -20, 18, 5);
  // sourire
  ctx.strokeStyle = "#6b3d17"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(5, -3, 5, .2, Math.PI - .2); ctx.stroke();
  ctx.restore();
}

function dessiner(dt) {
  const k = toile.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const t = performance.now() / 1000;
  const s = jeu ? jeu.sim : { y: 360 + Math.sin(t * 2) * 12, vy: 0, dist: t * 60, bambous: [] };
  const yMoka = jeu && !jeu.demarre ? 360 + Math.sin(t * 3) * 10 : s.y; // flotte en attendant le premier appui (affichage seulement)
  if (jeu && jeu.secousse > 0) {
    ctx.translate((Math.random() - .5) * jeu.secousse, (Math.random() - .5) * jeu.secousse);
    jeu.secousse = Math.max(0, jeu.secousse - dt * 40);
  }
  // ciel tropical, soleil
  const ciel = ctx.createLinearGradient(0, 0, 0, H);
  ciel.addColorStop(0, "#4dabf7"); ciel.addColorStop(.55, "#a5e1f7"); ciel.addColorStop(1, "#fff3bf");
  ctx.fillStyle = ciel;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.fillStyle = "rgba(255, 244, 180, .9)";
  ctx.shadowColor = "#fff3bf"; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(360, 120, 48, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // nuages
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 4; i++) {
    const x = ((i * 190 - s.dist * .15) % (W + 200) + W + 200) % (W + 200) - 100, y = 70 + i * 45;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.arc(x + 26, y - 10, 28, 0, Math.PI * 2); ctx.arc(x + 54, y, 20, 0, Math.PI * 2); ctx.fill();
  }
  // parallaxe : montagnes puis jungle
  const dm = (s.dist * .25) % 960;
  ctx.drawImage(MONTAGNES, -dm, 250); ctx.drawImage(MONTAGNES, 960 - dm, 250);
  const dj = (s.dist * .55) % 960;
  ctx.drawImage(JUNGLE, -dj, 400); ctx.drawImage(JUNGLE, 960 - dj, 400);

  // bambous et bananes
  for (const b of s.bambous) {
    const x = b.x - s.dist;
    if (x > W + 20 || x < -LARGEUR_BAMBOU - 20) continue;
    dessinerBambou(x, -10, b.haut, true);
    dessinerBambou(x, b.bas, SOL, false);
    if (b.banane && !b.prise) dessinerBanane(b.bx - s.dist, b.by, t);
  }

  // sol : herbe et terre qui défilent
  ctx.fillStyle = "#8c5a2b";
  ctx.fillRect(0, SOL, W, H - SOL);
  ctx.fillStyle = "#6b4420";
  for (let x = -((s.dist) % 40); x < W; x += 40) ctx.fillRect(x, SOL + 30, 20, 8);
  ctx.fillStyle = "#51cf66";
  ctx.fillRect(0, SOL, W, 14);
  ctx.fillStyle = "#37b24d";
  for (let x = -((s.dist) % 24); x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, SOL + 14); ctx.lineTo(x + 12, SOL); ctx.lineTo(x + 24, SOL + 14); ctx.fill(); }

  dessinerMoka(yMoka, s.vy, t);
  if (jeu) jeu.flamme = Math.max(0, jeu.flamme - dt * 4);

  // particules
  if (jeu) {
    for (let i = jeu.particules.length - 1; i >= 0; i--) {
      const p = jeu.particules[i];
      p.x += p.vx; p.y += p.vy; p.vie -= dt * 1.5;
      if (p.vie <= 0) { jeu.particules.splice(i, 1); continue; }
      ctx.globalAlpha = p.vie;
      ctx.fillStyle = p.couleur;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.vie + 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // score au centre
  const score = jeu ? s.points : 0;
  ctx.font = "900 64px Arial Black, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 8; ctx.strokeStyle = "#1b1340";
  ctx.strokeText(score, W / 2, 110);
  ctx.fillStyle = "#fff"; ctx.fillText(score, W / 2, 110);
  if (jeu && !jeu.demarre && !jeu.fini) {
    ctx.font = "900 26px Arial Black, sans-serif";
    ctx.strokeText("Tape pour décoller !", W / 2, 470);
    ctx.fillStyle = "#ffe066"; ctx.fillText("Tape pour décoller !", W / 2, 470);
  }
  ctx.textAlign = "start";
  if (jeu && jeu.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${jeu.flash})`;
    ctx.fillRect(0, 0, W, H);
    jeu.flash = Math.max(0, jeu.flash - dt * 3);
  }
}

window.addEventListener("resize", () => { ajusterToile(); if (!jeu || jeu.fini) dessiner(0); });
ajusterToile();
(function attente() { if (!jeu) { dessiner(0.016); requestAnimationFrame(attente); } })();
