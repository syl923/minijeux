// Pingu Glisse : le pingouin dévale des collines enneigées infinies.
// Monde en pixels, y vers le haut. Appuyer = plonger (gravité renforcée), relâcher en montée = s'envoler.

const W = 800, H = 500;
const toile = document.getElementById("pingouin");
const ctx = toile.getContext("2d");
const surcouche = document.getElementById("surcouche");

const G = 900, G_PLONGE = 2600, PAS = 1 / 120, V_MIN = 170, V_MAX = 2200, PX_PAR_METRE = 20;

let jeu = null;

// ------------------------------------------------------------ collines
function genererCollines(jusqua) {
  const c = jeu.collines;
  while (c[c.length - 1].x < jusqua) {
    const der = c[c.length - 1];
    const n = c.length;
    const ampleur = Math.min(1.8, 1 + der.x / 60000);  // les collines grandissent avec la distance
    const crete = n % 2 === 1;
    const dx = (650 + Math.random() * 450) * (0.8 + ampleur * 0.2);
    const y = crete ? (170 + Math.random() * 170) * ampleur : (-70 - Math.random() * 90) * ampleur;
    c.push({ x: der.x + dx, y, teinte: Math.floor(Math.random() * 3) });
    if (crete && Math.random() < 0.55) { // quelques poissons au-dessus des crêtes
      for (let k = 0; k < 3; k++) jeu.poissons.push({ x: der.x + dx * (0.85 + k * 0.12), y: y + 120 + k * 30 + Math.random() * 40, pris: false });
    }
  }
  while (c.length > 4 && c[2].x < jeu.x - 1500) c.shift();
}

function segment(x) {
  const c = jeu.collines;
  for (let i = 0; i < c.length - 1; i++) if (x >= c[i].x && x < c[i + 1].x) return i;
  return c.length - 2;
}

function hauteur(x) {
  const c = jeu.collines, i = segment(x);
  const a = c[i], b = c[i + 1], t = (x - a.x) / (b.x - a.x);
  return a.y + (b.y - a.y) * (1 - Math.cos(Math.PI * t)) / 2;
}

// dérivée seconde du relief (négative sur le haut des bosses)
function courbure(x) {
  const c = jeu.collines, i = segment(x);
  const a = c[i], b = c[i + 1], L = b.x - a.x, t = (x - a.x) / L;
  return (b.y - a.y) * (Math.PI / L) * (Math.PI / L) / 2 * Math.cos(Math.PI * t);
}

function pente(x) {
  const c = jeu.collines, i = segment(x);
  const a = c[i], b = c[i + 1], t = (x - a.x) / (b.x - a.x);
  return (b.y - a.y) * Math.PI / 2 * Math.sin(Math.PI * t) / (b.x - a.x);
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
    partie: r.partie, collines: [{ x: -600, y: 300, teinte: 0 }, { x: 0, y: 260, teinte: 1 }], poissons: [],
    x: 40, y: 0, s: 200, vx: 0, vy: 0, auSol: true, appui: false, temps: 0,
    tempete: -900, nbPoissons: 0, parfaits: 0, combo: 0, fini: false, cumul: 0, dernier: performance.now(),
    particules: [], textes: [], zoom: 1, camY: 0, secousse: 0, aile: 0,
  };
  genererCollines(4000);
  jeu.y = hauteur(jeu.x);
  flocons.length = 0;
  for (let i = 0; i < 90; i++) flocons.push({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 50, r: 1 + Math.random() * 2.5 });
  majCompteurs();
  surcouche.classList.add("cache");
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("banquise");
  requestAnimationFrame(boucle);
}

function majCompteurs() {
  document.getElementById("metres").textContent = Math.floor(jeu.x / PX_PAR_METRE) + " m";
  document.getElementById("poissons").textContent = jeu.nbPoissons;
  document.getElementById("parfaits").textContent = jeu.parfaits;
}

const appuyer = (v) => (e) => { if (jeu && !jeu.fini) { if (e) e.preventDefault(); jeu.appui = v; } };
document.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "ArrowDown") appuyer(true)(e); });
document.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "ArrowDown") appuyer(false)(e); });
toile.addEventListener("pointerdown", appuyer(true));
document.addEventListener("pointerup", () => jeu && (jeu.appui = false));

// ------------------------------------------------------------ physique
function etape(dt) {
  jeu.temps += dt;
  const g = jeu.appui ? G_PLONGE : G;
  if (jeu.auSol) {
    const p = pente(jeu.x), th = Math.atan(p);
    jeu.s += -g * Math.sin(th) * dt;       // descente = accélération, montée = ralentissement
    jeu.s *= 1 - 0.04 * dt;                  // frottement de la neige
    jeu.s = Math.max(V_MIN, Math.min(V_MAX, jeu.s));
    const vx = jeu.s * Math.cos(th), vy = jeu.s * Math.sin(th);
    const nx = jeu.x + vx * dt;
    // sur le haut d'une bosse, si la vitesse est trop grande pour rester collé à la neige, on décolle
    const kappa = courbure(jeu.x) / Math.pow(1 + p * p, 1.5);
    if (!jeu.appui && kappa < 0 && jeu.s * jeu.s * -kappa > g * Math.cos(th) && jeu.s > 250) {
      jeu.auSol = false;
      jeu.vx = vx; jeu.vy = vy;
      jeu.x = nx; jeu.y = jeu.y + vy * dt + 0.5;
      if (vy > 250) Sons.jouer("saut");
    } else {
      jeu.x = nx;
      jeu.y = hauteur(nx);
      if (jeu.s > 700 && Math.random() < .5) jeu.particules.push({ x: jeu.x - 10, y: jeu.y + 4, vx: -jeu.s * .2 + Math.random() * 60, vy: 80 + Math.random() * 120, vie: .5, r: 3 });
    }
  } else {
    jeu.vy -= g * dt;
    jeu.x += jeu.vx * dt;
    jeu.y += jeu.vy * dt;
    const sol = hauteur(jeu.x);
    if (jeu.y <= sol) atterrir(sol);
  }
  // poissons
  for (const p of jeu.poissons) {
    if (!p.pris && Math.abs(p.x - jeu.x) < 34 && Math.abs(p.y - (jeu.y + 16)) < 38) {
      p.pris = true;
      jeu.nbPoissons++;
      Sons.jouer("mange");
      jeu.textes.push({ x: p.x, y: p.y, t: "+25", vie: 1, couleur: "#ffd43b" });
    }
  }
  // la tempête avance de plus en plus vite
  jeu.tempete += (240 + jeu.temps * 10) * dt;
  if (jeu.tempete > jeu.x - 30) return perdu();
  genererCollines(jeu.x + 3000);
}

function atterrir(sol) {
  const th = Math.atan(pente(jeu.x));
  const angleVol = Math.atan2(jeu.vy, jeu.vx);
  const ecart = Math.abs(angleVol - th);
  jeu.s = jeu.vx * Math.cos(th) + jeu.vy * Math.sin(th);
  jeu.y = sol;
  jeu.auSol = true;
  if (ecart < 0.42 && th < -0.05) { // atterrissage dans le sens de la pente : glissade parfaite
    jeu.s = jeu.s * 1.08 + 80;
    jeu.parfaits++;
    jeu.combo++;
    Sons.jouer(jeu.combo >= 3 ? "bonus" : "cible");
    jeu.textes.push({ x: jeu.x, y: jeu.y + 70, t: jeu.combo >= 3 ? `PARFAIT x${jeu.combo} !` : "Parfait !", vie: 1.3, couleur: "#3ee0e8", gros: true });
    for (let i = 0; i < 16; i++) jeu.particules.push({ x: jeu.x, y: jeu.y, vx: (Math.random() - .5) * 300, vy: Math.random() * 250, vie: .7, r: 3, couleur: "#a5f3fc" });
  } else if (ecart > 0.7 && th > 0.1) { // retombé en pleine montée : on perd de la vitesse
    jeu.s *= 0.7;
    jeu.combo = 0;
    jeu.secousse = 8;
    Sons.jouer("boing");
    jeu.textes.push({ x: jeu.x, y: jeu.y + 60, t: "Aïe !", vie: 1, couleur: "#ff8787" });
  } else {
    jeu.combo = 0;
  }
  jeu.s = Math.max(V_MIN, Math.min(V_MAX, jeu.s));
}

async function perdu() {
  jeu.fini = true;
  jeu.secousse = 14;
  Sons.musique.arreter();
  Sons.jouer("perdu");
  jeu.textes.push({ x: jeu.x, y: jeu.y + 90, t: "Rattrapé par la tempête !", vie: 3, couleur: "#fff", gros: true });
  const metres = Math.floor(jeu.x / PX_PAR_METRE);
  let r;
  try {
    r = await api("/api/pingouin/fin", { partie: jeu.partie, metres, poissons: jeu.nbPoissons, parfaits: jeu.parfaits });
  } catch (e) {
    alert(e.message);
    return surcouche.classList.remove("cache");
  }
  setTimeout(() => {
    surcouche.classList.remove("cache");
    afficherResultat({
      titre: `${metres} mètres !`,
      emoji: metres >= 2000 ? "🏆" : "🐧",
      lignes: [`${jeu.nbPoissons} poisson(s) · ${jeu.parfaits} glissade(s) parfaite(s)`],
      fin: r.fin,
      rejouer: lancer,
    });
  }, 1500);
}

function boucle(t) {
  if (!jeu) return;
  const dt = Math.min(0.05, (t - jeu.dernier) / 1000);
  jeu.dernier = t;
  if (!jeu.fini) {
    jeu.cumul += dt;
    while (jeu.cumul >= PAS && !jeu.fini) { etape(PAS); jeu.cumul -= PAS; }
    majCompteurs();
  }
  dessiner(dt);
  if (!jeu.fini || jeu.textes.length || jeu.secousse > 0) requestAnimationFrame(boucle);
}

// ------------------------------------------------------------ dessin
const flocons = [];
const TEINTES = [["#ffffff", "#d0ebff"], ["#f1f9ff", "#c5f6fa"], ["#f8f0ff", "#e5dbff"]];

function ajusterToile() {
  const ratio = window.devicePixelRatio || 1;
  const largeur = Math.min(W, window.innerWidth - 40);
  toile.style.width = largeur + "px";
  toile.style.height = largeur * H / W + "px";
  toile.width = Math.round(largeur * ratio);
  toile.height = Math.round(largeur * H / W * ratio);
}

function dessinerPingouin(t) {
  const th = jeu.auSol ? Math.atan(pente(jeu.x)) : Math.atan2(jeu.vy, jeu.vx) * 0.6;
  ctx.save();
  ctx.translate(jeu.x, jeu.y);
  ctx.rotate(th);
  const plonge = jeu.appui;
  if (jeu.auSol) { // à plat ventre
    ctx.fillStyle = "#1b1b2f";
    ctx.beginPath(); ctx.ellipse(0, 14, 30, plonge ? 12 : 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f8f9fa";
    ctx.beginPath(); ctx.ellipse(2, 8, 24, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1b1b2f";
    ctx.beginPath(); ctx.arc(26, 18, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(30, 21, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(31, 21, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff922b";
    ctx.beginPath(); ctx.moveTo(36, 17); ctx.lineTo(46, 15); ctx.lineTo(36, 13); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-30, 12, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#e03131"; ctx.lineWidth = 4; // écharpe au vent
    ctx.beginPath(); ctx.moveTo(18, 20); ctx.quadraticCurveTo(0, 30 + Math.sin(t * 20) * 4, -16, 26 + Math.sin(t * 20 + 1) * 6); ctx.stroke();
  } else { // en vol, ailes déployées qui battent
    jeu.aile += 0.4;
    ctx.fillStyle = "#1b1b2f";
    ctx.beginPath(); ctx.ellipse(0, 16, 26, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(-4, 20); ctx.rotate(-1.4 + Math.sin(jeu.aile) * .6);
    ctx.beginPath(); ctx.ellipse(0, 14, 7, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#f8f9fa";
    ctx.beginPath(); ctx.ellipse(4, 12, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1b1b2f";
    ctx.beginPath(); ctx.arc(22, 24, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(26, 27, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(27, 27, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff922b";
    ctx.beginPath(); ctx.moveTo(32, 23); ctx.lineTo(42, 21); ctx.lineTo(32, 19); ctx.fill();
    ctx.strokeStyle = "#e03131"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(14, 26); ctx.quadraticCurveTo(-4, 40, -22, 34 + Math.sin(t * 25) * 6); ctx.stroke();
  }
  ctx.restore();
}

function dessiner(dt) {
  const t = performance.now() / 1000;
  const k = toile.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);

  // ciel d'hiver qui s'assombrit quand la tempête approche
  const proche = jeu ? Math.max(0, Math.min(1, 1 - (jeu.x - jeu.tempete) / 1600)) : 0;
  const ciel = ctx.createLinearGradient(0, 0, 0, H);
  ciel.addColorStop(0, proche > .5 ? "#1b1340" : "#1c3d73");
  ciel.addColorStop(.6, "#4dabf7");
  ciel.addColorStop(1, "#d0ebff");
  ctx.fillStyle = ciel;
  ctx.fillRect(0, 0, W, H);
  // aurore boréale
  for (let b = 0; b < 3; b++) {
    ctx.strokeStyle = ["rgba(81, 207, 102, .22)", "rgba(62, 224, 232, .18)", "rgba(177, 151, 252, .16)"][b];
    ctx.lineWidth = 26 - b * 6;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 70 + b * 22 + Math.sin(x / 90 + t * .6 + b) * 20);
    ctx.stroke();
  }
  // montagnes lointaines (parallaxe)
  const cx = jeu ? jeu.x : t * 200;
  ctx.fillStyle = "rgba(208, 235, 255, .8)";
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 10) { const wx = x + cx * .1; ctx.lineTo(x, 260 - 70 * Math.abs(Math.sin(wx / 160)) - 30 * Math.sin(wx / 53)); }
  ctx.lineTo(W, H); ctx.fill();
  ctx.fillStyle = "rgba(165, 216, 255, .85)"; // sapins lointains
  for (let i = 0; i < 18; i++) {
    const x = ((i * 67 - cx * .25) % (W + 80) + W + 80) % (W + 80) - 40, h = 36 + (i * 13) % 24;
    ctx.beginPath(); ctx.moveTo(x, 330 - h); ctx.lineTo(x - 14, 330); ctx.lineTo(x + 14, 330); ctx.fill();
  }

  if (!jeu) return;
  // caméra : suit le pingouin, dézoome quand il vole haut
  const altitude = jeu.y - hauteur(jeu.x);
  const zoomVise = Math.max(0.42, Math.min(1, 320 / (altitude + 320)));
  jeu.zoom += (zoomVise - jeu.zoom) * Math.min(1, dt * 3);
  jeu.camY += (jeu.y - jeu.camY) * Math.min(1, dt * 4);
  const z = jeu.zoom;
  ctx.save();
  if (jeu.secousse > 0) { ctx.translate((Math.random() - .5) * jeu.secousse, (Math.random() - .5) * jeu.secousse); jeu.secousse = Math.max(0, jeu.secousse - dt * 30); }
  ctx.translate(180, H * 0.62);
  ctx.scale(z, -z);
  ctx.translate(-jeu.x, -Math.max(jeu.camY - altitude * .5, jeu.camY - 200));

  // collines : bandes colorées par segment + calotte de neige
  const gauche = jeu.x - 180 / z - 20, droite = jeu.x + (W - 180) / z + 20;
  const c = jeu.collines;
  for (let i = 0; i < c.length - 1; i++) {
    if (c[i + 1].x < gauche || c[i].x > droite) continue;
    const [clair, fonce] = TEINTES[c[i].teinte];
    const g = ctx.createLinearGradient(0, c[i].y + 200, 0, c[i].y - 400);
    g.addColorStop(0, clair); g.addColorStop(1, fonce);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c[i].x, -2000);
    for (let x = c[i].x; x <= c[i + 1].x; x += 12 / z) ctx.lineTo(x, hauteur(Math.min(x, c[i + 1].x - 0.01)));
    ctx.lineTo(c[i + 1].x, hauteur(c[i + 1].x - 0.01));
    ctx.lineTo(c[i + 1].x, -2000);
    ctx.fill();
    // rayures en biais dans la neige (on voit mieux les pentes et la vitesse)
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = ["rgba(116, 192, 252, .28)", "rgba(102, 217, 232, .28)", "rgba(151, 117, 250, .22)"][c[i].teinte];
    ctx.lineWidth = 26;
    const haut = Math.max(c[i].y, c[i + 1].y) + 40;
    for (let x = c[i].x - 600; x < c[i + 1].x + 600; x += 90) {
      ctx.beginPath(); ctx.moveTo(x, haut); ctx.lineTo(x + 500, haut - 700); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8 / z;
  ctx.beginPath();
  for (let x = gauche; x <= droite; x += 10 / z) ctx.lineTo(x, hauteur(x));
  ctx.stroke();

  // poissons
  for (const p of jeu.poissons) {
    if (p.pris || p.x < gauche || p.x > droite) continue;
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(t * 4 + p.x) * 6);
    ctx.scale(1, -1);
    ctx.fillStyle = "#339af0";
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-24, -9); ctx.lineTo(-24, 9); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(8, -2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // particules de neige soulevée
  for (let i = jeu.particules.length - 1; i >= 0; i--) {
    const p = jeu.particules[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 600 * dt; p.vie -= dt;
    if (p.vie <= 0) { jeu.particules.splice(i, 1); continue; }
    ctx.globalAlpha = p.vie * 1.5;
    ctx.fillStyle = p.couleur || "#ffffff";
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  dessinerPingouin(t);

  // textes dans le monde
  ctx.scale(1, -1);
  ctx.textAlign = "center";
  for (let i = jeu.textes.length - 1; i >= 0; i--) {
    const x = jeu.textes[i];
    x.vie -= dt; x.y += 50 * dt;
    if (x.vie <= 0) { jeu.textes.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, x.vie * 2);
    ctx.font = `900 ${(x.gros ? 30 : 22) / Math.max(.6, z)}px Arial Black, sans-serif`;
    ctx.lineWidth = 6; ctx.strokeStyle = "#1b1340";
    ctx.strokeText(x.t, x.x, -x.y); ctx.fillStyle = x.couleur; ctx.fillText(x.t, x.x, -x.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "start";
  ctx.restore();

  // la tempête : mur sombre tourbillonnant à gauche de l'écran
  const bord = 180 + (jeu.tempete - jeu.x) * z;
  if (bord > -200) {
    const g = ctx.createLinearGradient(bord - 200, 0, bord + 60, 0);
    g.addColorStop(0, "rgba(40, 30, 70, .95)"); g.addColorStop(.75, "rgba(80, 90, 130, .75)"); g.addColorStop(1, "rgba(80, 90, 130, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Math.max(0, bord + 60), H);
    ctx.fillStyle = "rgba(255,255,255,.8)";
    for (let i = 0; i < 40; i++) {
      const fx = bord - ((i * 37 + t * 400) % 260), fy = (i * 53 + t * 180 * (1 + i % 3)) % H;
      if (fx > 0) ctx.fillRect(fx, fy, 3, 3);
    }
  }
  // flocons qui tombent
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (const f of flocons) {
    f.y += f.v * dt; f.x -= (jeu.s * .05 + 10) * dt;
    if (f.y > H) f.y = -5;
    if (f.x < 0) f.x = W;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  }

  // interface : distance, vitesse, tempête
  const texte = (s, x, y, taille, couleur = "#fff", aligne = "left") => {
    ctx.font = `900 ${taille}px Arial Black, sans-serif`; ctx.textAlign = aligne;
    ctx.lineWidth = 5; ctx.strokeStyle = "#1b1340"; ctx.strokeText(s, x, y);
    ctx.fillStyle = couleur; ctx.fillText(s, x, y); ctx.textAlign = "start";
  };
  texte(`${Math.floor(jeu.x / PX_PAR_METRE)} m`, 18, 40, 30);
  texte(`${Math.round(jeu.s / PX_PAR_METRE * 3.6)} km/h`, 18, 66, 16, "#a5f3fc");
  const ecartTempete = Math.max(0, Math.floor((jeu.x - jeu.tempete) / PX_PAR_METRE));
  texte(`🌨️ Tempête : ${ecartTempete} m`, W - 18, 40, 18, ecartTempete < 25 ? "#ff8787" : "#fff", "right");
  if (jeu.appui && !jeu.fini) texte("⬇ PLONGE", W - 18, H - 20, 16, "#ffd43b", "right");
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
