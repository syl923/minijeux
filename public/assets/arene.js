// Stickman Arena : affichage, commandes, robots (solo) et duel en ligne (le serveur arbitre, la page prédit).
// Le moteur (arene-sim.js) est le même que celui du serveur.

const toile = document.getElementById("arene");
const ctx = toile.getContext("2d");
const surcouche = document.getElementById("surcouche");
const W = AR.W, H = AR.H;
const DUEL = new URLSearchParams(location.search).get("duel");
const COULEURS = ["#ffd43b", "#ff6b6b", "#4dabf7", "#63e6be"];
const NOMS_ARMES = { poings: "Poings", pistolet: "Pistolet", pompe: "Fusil à pompe", mitraillette: "Mitraillette", bazooka: "Lance-bananes", canon_or: "Canon en or", soin: "Banane dorée" };
const ROBOTS = ["Bananator", "Kiki la Terreur", "Babouin Boum", "Capitaine Coco", "Gorille Gégé"];

let mode = null;            // "solo" ou "duel"
let sim = null;             // état affiché
let partie = null;
let moi = 0;                // index de mon combattant
let visages = [];           // images des têtes (avatars)
let finie = false;
const entree = { g: 0, d: 0, b: 0, t: 0, saut: 0, ax: 1000, ay: 0 };
const souris = { x: W / 2, y: H / 2, dedans: false };
const particules = [], textes = [];
const vus = new Set();
let secousse = 0, dernierMessage = -1, mokaVol = null, dernierAie = 0;

// ------------------------------------------------------------ commandes : WASD / ZQSD (même position de touches) + souris
const TOUCHES = { KeyA: "g", ArrowLeft: "g", KeyD: "d", ArrowRight: "d", KeyS: "b", ArrowDown: "b" };
const SAUTS = ["KeyW", "ArrowUp", "Space"];
function enJeu() { return sim && !finie && mode; }
document.addEventListener("keydown", (e) => {
  if (!enJeu()) return;
  if (TOUCHES[e.code]) { entree[TOUCHES[e.code]] = 1; e.preventDefault(); }
  if (SAUTS.includes(e.code)) { if (!e.repeat) entree.saut += 1; e.preventDefault(); }
});
document.addEventListener("keyup", (e) => { if (TOUCHES[e.code]) entree[TOUCHES[e.code]] = 0; });
window.addEventListener("blur", () => { entree.g = entree.d = entree.b = entree.t = 0; });
function posSouris(e) {
  const r = toile.getBoundingClientRect();
  souris.x = (e.clientX - r.left) * W / r.width;
  souris.y = (e.clientY - r.top) * H / r.height;
}
toile.addEventListener("mousemove", (e) => { posSouris(e); souris.dedans = true; });
toile.addEventListener("mouseleave", () => { souris.dedans = false; });
toile.addEventListener("mousedown", (e) => { if (enJeu() && e.button === 0) { posSouris(e); entree.t = 1; e.preventDefault(); } });
document.addEventListener("mouseup", () => { entree.t = 0; });
toile.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("selectstart", (e) => { if (enJeu()) e.preventDefault(); });

function viser() {
  const j = sim && sim.joueurs[moi];
  if (!j) return;
  const dx = souris.x - j.x, dy = souris.y - (j.y - 42);
  const n = Math.hypot(dx, dy) || 1;
  entree.ax = Math.round(dx / n * 1000);
  entree.ay = Math.round(dy / n * 1000);
}

// ------------------------------------------------------------ robots (mode solo)
function robot(sim, j) {
  const e = j.entree;
  if (j.mort > 0) { e.t = 0; return; }
  j.ia = j.ia || { cible: null, prochain: 0, saut: 0, vise: [0, 0], erreur: 0 };
  const ia = j.ia;
  if (sim.t >= ia.prochain) {   // réfléchit ~6 fois par seconde
    ia.prochain = sim.t + 8 + Math.floor(Math.random() * 6);
    const vivants = sim.joueurs.filter((o) => o !== j && o.mort <= 0);
    ia.cible = vivants.sort((a, b) => Math.abs(a.x - j.x) + Math.abs(a.y - j.y) - Math.abs(b.x - j.x) - Math.abs(b.y - j.y))[0] || null;
    ia.erreur = (Math.random() - .5) * 0.5;
    const caisse = sim.caisses.find((c) => c.arme === "soin" ? j.hp < 60 : (j.arme === "poings" || j.mun < 4) && Math.abs(c.x - j.x) < 400);
    ia.but = caisse ? { x: caisse.x, y: caisse.y } : null;
  }
  const c = ia.cible;
  const but = ia.but || (c ? { x: c.x, y: c.y } : { x: W / 2, y: AR.SOL });
  const distVoulue = ia.but ? 0 : { poings: 20, pompe: 110, pistolet: 240, mitraillette: 220, bazooka: 300, canon_or: 300 }[j.arme];
  const dx = but.x - j.x;
  e.g = e.d = e.b = 0;
  if (Math.abs(dx) > distVoulue + 30) { if (dx > 0) e.d = 1; else e.g = 1; }
  else if (Math.abs(dx) < distVoulue - 40 && !ia.but) { if (dx > 0) e.g = 1; else e.d = 1; }
  // monter ou descendre vers la cible, sauter de temps en temps pour esquiver
  if (j.sol && sim.t > ia.saut) {
    if (but.y < j.y - 50 || Math.random() < 0.012) { e.saut += 1; ia.saut = sim.t + 30; }
    else if (but.y > j.y + 50) e.b = 1;
  }
  if (!j.sol && j.vy > 200 && but.y < j.y - 40 && j.dj && Math.random() < 0.08) e.saut += 1;
  // viser (avec une petite imprécision) et tirer
  if (c) {
    const vx = c.x - j.x, vy = c.y - 32 - (j.y - 42);
    const a = Math.atan2(vy, vx) + ia.erreur * (j.arme === "bazooka" || j.arme === "canon_or" ? .3 : 1) - (j.arme === "bazooka" || j.arme === "canon_or" ? Math.abs(vx) / 3000 : 0);
    e.ax = Math.round(Math.cos(a) * 1000);
    e.ay = Math.round(Math.sin(a) * 1000);
    const portee = { poings: 55, pompe: 230, pistolet: 520, mitraillette: 480, bazooka: 560, canon_or: 560 }[j.arme];
    e.t = Math.hypot(vx, vy) < portee && Math.abs(vy) < 160 && Math.random() < .9 ? 1 : 0;
  } else e.t = 0;
}

// ------------------------------------------------------------ lancement
function chargerVisages(ids) {
  visages = ids.map((id) => imageAvatar(id || "moka"));
}

document.getElementById("btn-solo").onclick = () => exigerConnexion(lancerSolo);

async function lancerSolo() {
  let r;
  try {
    r = await api("/api/arene/debut", {});
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  partie = r.partie;
  const robots = [...ROBOTS].sort(() => Math.random() - .5).slice(0, 3);
  sim = arNouveau(r.graine, [MJ.joueur.pseudo, ...robots]);
  const avs = Object.keys(LOOKS_AVATARS).filter((a) => a !== MJ.joueur.avatar).sort(() => Math.random() - .5);
  chargerVisages([MJ.joueur.avatar, avs[0], avs[1], avs[2]]);
  moi = 0; mode = "solo"; finie = false; vus.clear(); particules.length = 0; textes.length = 0; dernierMessage = -1;
  surcouche.classList.add("cache");
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  Sons.musique.jouer("rock");
  let dernier = performance.now(), cumul = 0;
  (function boucle(t) {
    cumul += Math.min(100, t - dernier);
    dernier = t;
    while (cumul >= 1000 / 60 && !sim.fini) {
      cumul -= 1000 / 60;
      viser();
      Object.assign(sim.joueurs[0].entree, entree);
      for (let k = 1; k < sim.joueurs.length; k++) robot(sim, sim.joueurs[k]);
      arPas(sim);
    }
    dessiner(sim);
    if (!sim.fini) requestAnimationFrame(boucle);
    else finSolo();
  })(dernier);
}

async function finSolo() {
  finie = true;
  Sons.musique.arreter();
  const rang = arClassement(sim).findIndex((j) => j.i === 0) + 1;
  const j = sim.joueurs[0];
  let r;
  try {
    r = await api("/api/arene/fin", { partie, k: j.k, m: j.m, place: rang });
  } catch (e) {
    alert(e.message);
    return surcouche.classList.remove("cache");
  }
  setTimeout(() => {
    surcouche.classList.remove("cache");
    afficherResultat({
      titre: rang === 1 ? "Champion de l'arène !" : `${rang}e place`,
      emoji: rang === 1 ? "🏆" : "🥊",
      victoire: rang === 1,
      lignes: [`${j.k} K.O. · mis K.O. ${j.m} fois`],
      fin: r.fin,
      rejouer: lancerSolo,
    });
  }, 1200);
}

// ------------------------------------------------------------ duel en ligne : on envoie ses commandes, le serveur renvoie le combat
let instantane = null, recu = 0, latence = 80, enVol = false, infosDuel = null;

async function lancerDuel() {
  await introMoka("arene");
  mode = "duel";
  surcouche.classList.add("cache");
  document.getElementById("bandeau-duel").classList.remove("cache");
  try {
    infosDuel = await api(`/api/duels/etat?duel=${DUEL}`);
  } catch (e) {
    surcouche.classList.remove("cache");
    return;
  }
  toile.scrollIntoView({ block: "center", behavior: "smooth" });
  document.getElementById("vs-adversaire").innerHTML = pseudoAvecAvatar(infosDuel.adversaire || "…", infosDuel.avatar_adversaire);
  Sons.musique.jouer("rock");
  setInterval(envoyer, 50);
  (function boucle() {
    if (instantane) {
      // prédiction : on part du dernier état du serveur et on avance avec mes commandes actuelles
      const p = arCopie(instantane);
      viser();
      const etapes = Math.min(12, Math.floor((performance.now() - recu + latence / 2) / (1000 / 60)));
      p.joueurs[moi].entree = { ...entree };
      if (!instantane.attente) for (let k = 0; k < etapes && !p.fini; k++) arPas(p);
      sim = p;
      dessiner(p);
    }
    if (!finie) requestAnimationFrame(boucle);
  })();
}

async function envoyer() {
  if (enVol || finie) return;
  enVol = true;
  const t0 = performance.now();
  try {
    const r = await api("/api/arene/duel", { duel: DUEL, entree });
    latence = latence * .8 + (performance.now() - t0) * .2;
    moi = r.moi ?? moi;
    if (r.sim) {
      if (!visages.length && infosDuel) {
        const avs = r.sim.joueurs.map((j) => (j.nom === infosDuel.moi ? infosDuel.avatar_moi : infosDuel.avatar_adversaire));
        chargerVisages(avs);
      }
      r.sim.attente = !!r.attente;
      instantane = r.sim;
      recu = performance.now();
    }
    if (r.fini) finDuel(r.vue);
  } catch (e) {
    if (e.statut === 403 || e.statut === 404) finie = true;
  }
  enVol = false;
}

function finDuel(v) {
  if (finie) return;
  finie = true;
  Sons.musique.arreter();
  const f = v.fin;
  const titres = { victoire: "Victoire dans l'arène !", defaite: "K.O. technique…", nulle: "Match nul" };
  setTimeout(() => afficherResultat({
    titre: titres[f.resultat],
    emoji: f.resultat === "victoire" ? "🏆" : f.resultat === "nulle" ? "🤝" : "🥊",
    victoire: f.resultat === "victoire",
    lignes: [`Duel contre ${echapper(v.adversaire)} · ${echapper(f.raison || "")}`],
    fin: f,
    rejouer: () => (location.href = "/duels.html"),
  }), 1000);
}

document.getElementById("btn-abandon-duel").onclick = async () => {
  if (!confirm("Abandonner le duel ? Tu perdras ta mise.")) return;
  try { finDuel(await api("/api/duels/abandon", { duel: DUEL })); } catch (e) { alert(e.message); }
};

// ------------------------------------------------------------ effets (déclenchés une seule fois par événement du moteur)
function particule(x, y, n, couleur, vitesse = 220, vie = .6, taille = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = vitesse * (.3 + Math.random() * .7);
    particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, vie, max: vie, couleur, taille });
  }
}
function texteFx(x, y, t, couleur, taille = 18) { textes.push({ x, y, t, couleur, taille, vie: 1 }); }

const SONS_TIRS = { pistolet: "pan", mitraillette: "rafale", pompe: "pompe", bazooka: "roquette", canon_or: "roquette" };
function traiterEffets(s) {
  const muet = !mode;   // la démo derrière le menu ne fait pas de bruit
  const jouer = (son) => { if (!muet) Sons.jouer(son); };
  const dire = (...a) => { if (!muet) mokaDit(...a); };
  for (const f of s.fx) {
    const cle = `${f.t}|${f.type}|${f.par ?? f.qui ?? ""}|${Math.round(f.x / 25)}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (vus.size > 600) vus.delete(vus.values().next().value);
    switch (f.type) {
      case "tir":
        particule(f.x + f.ux * 8, f.y + f.uy * 8, f.arme === "pompe" ? 10 : 4, "#ffe066", 160, .15, 3);
        jouer(SONS_TIRS[f.arme] || "pan");
        if (f.arme === "pompe" || f.arme === "bazooka" || f.arme === "canon_or") secousse = Math.max(secousse, 5);
        break;
      case "impact": particule(f.x, f.y, 6, "#fff3bf", 180, .25, 2); break;
      case "degats":
        texteFx(f.x + (Math.random() - .5) * 20, f.y, "-" + f.v, "#ff6b6b", 16 + Math.min(14, f.v / 3));
        if (performance.now() - dernierAie > 90) { dernierAie = performance.now(); jouer("aie"); }
        break;
      case "ko": {
        particule(f.x, f.y, 26, COULEURS[f.qui % 4], 320, .9, 4);
        texteFx(f.x, f.y - 30, "K.O. !", "#ffd43b", 30);
        secousse = Math.max(secousse, 10);
        jouer("ko");
        if (f.qui === moi) dire(["Hi hi hi ! K.O. ! Relève-toi !", "Hou hou ha ha ! Tu dors ?", "Aïe aïe aïe, quelle raclée !"][Math.floor(Math.random() * 3)], "taquin", 1800);
        else if (f.par === moi) dire(["BAM ! Joli K.O. !", "Quel coup ! La foule est en délire !", "Encore un ! Tu es en feu !"][Math.floor(Math.random() * 3)], "etoiles", 1600);
        break;
      }
      case "explosion":
        particule(f.x, f.y, 40, "#ff922b", 420, .7, 5);
        particule(f.x, f.y, 20, "#ffe066", 260, .5, 4);
        particule(f.x, f.y, 16, "rgba(120,120,120,.8)", 120, 1.2, 8);
        particules.push({ onde: true, x: f.x, y: f.y, r: 10, rmax: f.r * 1.3, vie: .4, max: .4 });
        secousse = Math.max(secousse, 14);
        jouer("kaboom");
        break;
      case "saut": particule(f.x, f.y, 6, "rgba(255,255,255,.7)", 90, .3, 3); break;
      case "saut2": particules.push({ onde: true, x: f.x, y: f.y, r: 4, rmax: 34, vie: .3, max: .3, couleur: "#a5d8ff" }); jouer("saut"); break;
      case "glisse":
        texteFx(f.x, f.y - 70, "GLISSADE !", "#ffe066", 20);
        jouer("boing");
        if (f.qui === moi) dire("Hou hou ha ha ! La peau de banane ! Classique !", "rire", 1800);
        break;
      case "ramasse":
        texteFx(f.x, f.y - 40, NOMS_ARMES[f.arme] + " !", "#8ce99a", 16);
        jouer("ramasse");
        break;
      case "soin": texteFx(f.x, f.y - 40, "+45 PV", "#8ce99a", 20); particule(f.x, f.y - 20, 14, "#8ce99a", 140, .6, 4); jouer("bonus"); break;
      case "bouclier": particule(f.x, f.y, 5, "#74c0fc", 150, .3, 3); break;
      case "coup": particule(f.x, f.y, 5, "#fff", 140, .2, 3); jouer("poing"); break;
    }
  }
  const dernierMsg = s.messages[s.messages.length - 1];
  if (dernierMsg && dernierMsg.t !== dernierMessage) {
    dernierMessage = dernierMsg.t;
    mokaVol = { debut: performance.now(), texte: dernierMsg.texte, type: dernierMsg.type };
    const humeur = { bananes: "taquin", coco: "rire", inverse: "taquin", lune: "etoiles", soin: "content", bouclier: "content", arme_or: "etoiles" }[dernierMsg.type];
    dire(dernierMsg.texte, humeur, 3200);
    jouer(humeur === "etoiles" ? "cri" : "sirene");
  }
}

// ------------------------------------------------------------ décor (dessiné une fois)
const decor = document.createElement("canvas");
decor.width = W; decor.height = H;
(function dessinerDecor() {
  const c = decor.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#120a2e"); g.addColorStop(.6, "#2a1560"); g.addColorStop(1, "#1a0f3d");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // gradins et public de singes (silhouettes)
  for (let rang = 0; rang < 4; rang++) {
    const y = 250 + rang * 42;
    c.fillStyle = `rgba(22, 14, 52, ${.6 + rang * .1})`;
    c.fillRect(0, y + 12, W, 42);
    for (let x = 10 + (rang % 2) * 14; x < W; x += 28) {
      const teinte = ["#2a1d52", "#31235e", "#251a49"][(x + rang) % 3];
      c.fillStyle = teinte;
      c.beginPath(); c.arc(x, y + 6, 10, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x - 9, y + 4, 4, 0, Math.PI * 2); c.arc(x + 9, y + 4, 4, 0, Math.PI * 2); c.fill();
      c.fillRect(x - 9, y + 12, 18, 16);
    }
  }
  // grand panneau lumineux
  c.save();
  c.shadowColor = "#ff2fd0"; c.shadowBlur = 25;
  c.strokeStyle = "#ff2fd0"; c.lineWidth = 4;
  c.strokeRect(W / 2 - 170, 26, 340, 62);
  c.font = "900 38px Arial Black, sans-serif"; c.textAlign = "center"; c.fillStyle = "#ffe066";
  c.shadowColor = "#ffd43b"; c.fillText("MOKA ARENA", W / 2, 72);
  c.restore();
  // sol de l'arène
  const s = c.createLinearGradient(0, AR.SOL, 0, H);
  s.addColorStop(0, "#3d3d5c"); s.addColorStop(1, "#1d1d33");
  c.fillStyle = s; c.fillRect(0, AR.SOL, W, H - AR.SOL);
  c.strokeStyle = "#3ee0e8"; c.lineWidth = 3; c.shadowColor = "#3ee0e8"; c.shadowBlur = 12;
  c.beginPath(); c.moveTo(0, AR.SOL + 1); c.lineTo(W, AR.SOL + 1); c.stroke();
  c.shadowBlur = 0;
  c.strokeStyle = "rgba(255,255,255,.06)"; c.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, AR.SOL + 4); c.lineTo(x - 30, H); c.stroke(); }
  // plateformes : poutres métalliques à bord néon
  AR.PLATEFORMES.forEach(([x, y, w], k) => {
    const pg = c.createLinearGradient(0, y, 0, y + 16);
    pg.addColorStop(0, "#6c6c8f"); pg.addColorStop(1, "#34344f");
    c.fillStyle = pg; c.beginPath(); c.roundRect(x, y, w, 16, 4); c.fill();
    c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 2;
    for (let i = 12; i < w - 6; i += 22) { c.beginPath(); c.moveTo(x + i, y + 3); c.lineTo(x + i + 10, y + 13); c.stroke(); }
    c.fillStyle = "#adb5bd";
    for (const bx of [x + 5, x + w - 5]) { c.beginPath(); c.arc(bx, y + 8, 2.5, 0, Math.PI * 2); c.fill(); }
    const neon = ["#ff2fd0", "#3ee0e8", "#ffd43b"][k % 3];
    c.strokeStyle = neon; c.lineWidth = 3; c.shadowColor = neon; c.shadowBlur = 12;
    c.beginPath(); c.moveTo(x + 2, y + 1); c.lineTo(x + w - 2, y + 1); c.stroke();
    c.shadowBlur = 0;
  });
})();

// ------------------------------------------------------------ dessin des combattants
function dessinerArme(arme, t) {
  switch (arme) {
    case "pistolet": ctx.fillStyle = "#495057"; ctx.fillRect(0, -3, 16, 6); ctx.fillStyle = "#212529"; ctx.fillRect(2, 2, 5, 7); break;
    case "pompe": ctx.fillStyle = "#8d5a2b"; ctx.fillRect(-6, -2, 10, 6); ctx.fillStyle = "#343a40"; ctx.fillRect(2, -3, 30, 5); ctx.fillStyle = "#868e96"; ctx.fillRect(10, 1, 10, 4); break;
    case "mitraillette": ctx.fillStyle = "#212529"; ctx.fillRect(-2, -4, 26, 7); ctx.fillStyle = "#495057"; ctx.fillRect(8, 3, 5, 10); ctx.fillRect(22, -2, 6, 3); break;
    case "bazooka":
      ctx.fillStyle = "#2f9e44"; ctx.fillRect(-10, -5, 36, 10); ctx.fillStyle = "#1b5e20"; ctx.fillRect(-10, -5, 5, 10);
      ctx.fillStyle = "#ffd43b"; ctx.beginPath(); ctx.ellipse(28, 0, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); break;
    case "canon_or": {
      const g = ctx.createLinearGradient(0, -7, 0, 7);
      g.addColorStop(0, "#fff3bf"); g.addColorStop(.5, "#fcc419"); g.addColorStop(1, "#c98a00");
      ctx.shadowColor = "#ffd43b"; ctx.shadowBlur = 12 + Math.sin(t * 10) * 5;
      ctx.fillStyle = g; ctx.fillRect(-10, -6, 40, 12); ctx.shadowBlur = 0;
      ctx.fillStyle = "#e8590c"; ctx.fillRect(28, -7, 5, 14); break;
    }
    default: ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.arc(2, 0, 6, 0, Math.PI * 2); ctx.fill();
  }
}

function membre(x1, y1, x2, y2, x3, y3) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
}

function dessinerCombattant(j, t) {
  const couleur = COULEURS[j.i % 4];
  if (j.mort > 0) { // fantôme qui s'envole après le K.O.
    const a = j.mort / 90;
    ctx.globalAlpha = a * .7;
    const img = visages[j.i];
    const y = j.y - 60 - (1 - a) * 80;
    if (img && img.complete) ctx.drawImage(img, j.x - 16, y - 16, 32, 32);
    ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("💫", j.x, y - 20); ctx.textAlign = "start";
    ctx.globalAlpha = 1;
    return;
  }
  const x = j.x, y = j.y;
  const court = Math.abs(j.vx) > 30 && j.sol;
  const phase = x * .075;
  const aim = Math.atan2(j.ay, j.ax || j.dir);
  ctx.save();
  if (j.glisse > 0) { ctx.translate(x, y - 10); ctx.rotate(-Math.sign(j.vx || 1) * 1.25); ctx.translate(-x, -(y - 10)); }
  const penche = Math.max(-5, Math.min(5, j.vx / 60));
  const hanche = [x, y - 26], cou = [x + penche, y - 50], epaule = [x + penche * .8, y - 46];
  const traits = (largeur, c) => { ctx.lineWidth = largeur; ctx.strokeStyle = c; ctx.lineCap = "round"; ctx.lineJoin = "round"; };
  const corps = (lw, c) => {
    traits(lw, c);
    // jambes
    let g1, g2, p1, p2;
    if (!j.sol) { g1 = [x - 6, y - 16]; p1 = [x - 10, y - 4]; g2 = [x + 8, y - 18]; p2 = [x + 4, y - 6]; }
    else if (court) {
      const s = Math.sin(phase), s2 = Math.sin(phase + Math.PI);
      g1 = [x + s * 9, y - 13 - Math.max(0, s) * 4]; p1 = [x + s * 15, y - Math.max(0, -s) * 3];
      g2 = [x + s2 * 9, y - 13 - Math.max(0, s2) * 4]; p2 = [x + s2 * 15, y - Math.max(0, -s2) * 3];
    } else { const r = Math.sin(t * 3) * 1.2; g1 = [x - 6, y - 13 + r]; p1 = [x - 8, y]; g2 = [x + 6, y - 13 + r]; p2 = [x + 8, y]; }
    membre(hanche[0], hanche[1], g1[0], g1[1], p1[0], p1[1]);
    membre(hanche[0], hanche[1], g2[0], g2[1], p2[0], p2[1]);
    // tronc
    ctx.beginPath(); ctx.moveTo(hanche[0], hanche[1]); ctx.lineTo(cou[0], cou[1]); ctx.stroke();
    // bras : l'un vise, l'autre soutient l'arme (ou se balance)
    const recul = j.cd > 0 && j.arme !== "poings" ? Math.min(6, j.cd) : 0;
    const coup = j.arme === "poings" && j.cd > 12 ? 1 : 0;
    const long = 24 + coup * 8 - recul * .6;
    const main = [epaule[0] + Math.cos(aim) * long, epaule[1] + Math.sin(aim) * long];
    const coude = [epaule[0] + Math.cos(aim + .5 * (Math.cos(aim) > 0 ? 1 : -1)) * 12, epaule[1] + Math.sin(aim + .5) * 12];
    membre(epaule[0], epaule[1], coude[0], coude[1], main[0], main[1]);
    const autre = j.arme === "poings" ? [epaule[0] - Math.cos(aim) * 10 + Math.sin(phase) * 4, epaule[1] + 16] : [epaule[0] + Math.cos(aim) * 16, epaule[1] + Math.sin(aim) * 16 + 4];
    membre(epaule[0], epaule[1], (epaule[0] + autre[0]) / 2, (epaule[1] + autre[1]) / 2 + 4, autre[0], autre[1]);
    return main;
  };
  corps(9, "#0d0b1f");
  const main = corps(5, j.touche > 0 && j.touche % 4 < 2 ? "#fff" : couleur);
  // arme dans la main, tournée vers la souris
  ctx.save();
  ctx.translate(main[0], main[1]);
  ctx.rotate(aim);
  if (Math.cos(aim) < 0) ctx.scale(1, -1);
  dessinerArme(j.arme, t);
  ctx.restore();
  // tête : l'avatar du joueur
  const tx = cou[0], ty = y - 64;
  ctx.fillStyle = "#0d0b1f"; ctx.beginPath(); ctx.arc(tx, ty, 17, 0, Math.PI * 2); ctx.fill();
  const img = visages[j.i];
  if (img && img.complete) {
    ctx.save(); ctx.beginPath(); ctx.arc(tx, ty, 15, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#e7f5ff"; ctx.fillRect(tx - 15, ty - 15, 30, 30);
    ctx.drawImage(img, tx - 17, ty - 16, 34, 34); ctx.restore();
  }
  ctx.strokeStyle = couleur; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, ty, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // bulle de protection, commandes inversées
  if (j.bouclier > 0) {
    ctx.strokeStyle = `rgba(116,192,252,${.5 + Math.sin(t * 10) * .25})`; ctx.fillStyle = "rgba(116,192,252,.12)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y - 36, 30, 44, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  if (j.inverse > 0) {
    ctx.font = "16px sans-serif"; ctx.textAlign = "center";
    for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.1; ctx.fillText(k % 2 ? "🍌" : "?", x + Math.cos(a) * 22, y - 90 + Math.sin(a) * 6); }
    ctx.textAlign = "start";
  }
  // nom et barre de vie
  ctx.font = "900 11px Arial Black, sans-serif"; ctx.textAlign = "center";
  ctx.fillStyle = j.i === moi ? "#ffe066" : "#fff"; ctx.fillText(j.i === moi ? "TOI" : j.nom, x, y - 96);
  ctx.textAlign = "start";
  ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(x - 22, y - 92, 44, 6);
  ctx.fillStyle = j.hp > 50 ? "#51cf66" : j.hp > 25 ? "#fcc419" : "#fa5252";
  ctx.fillRect(x - 22, y - 92, 44 * j.hp / 100, 6);
}

// ------------------------------------------------------------ dessin de la scène
function dessiner(s) {
  const t = performance.now() / 1000;
  const k = toile.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  traiterEffets(s);
  ctx.save();
  if (secousse > 0) { ctx.translate((Math.random() - .5) * secousse, (Math.random() - .5) * secousse); secousse *= .88; if (secousse < .4) secousse = 0; }
  ctx.drawImage(decor, 0, 0);
  // projecteurs qui balaient l'arène
  for (let i = 0; i < 3; i++) {
    const a = Math.sin(t * .6 + i * 2) * .5;
    const x0 = 120 + i * 360;
    const g = ctx.createLinearGradient(x0, 0, x0 + Math.sin(a) * 300, H);
    g.addColorStop(0, "rgba(255,255,220,.16)"); g.addColorStop(1, "rgba(255,255,220,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0 - 10, 0); ctx.lineTo(x0 + 10, 0); ctx.lineTo(x0 + Math.sin(a) * 300 + 90, H); ctx.lineTo(x0 + Math.sin(a) * 300 - 90, H); ctx.fill();
  }
  if (s.lune > 0) { // gravité lunaire : étoiles et teinte bleue
    ctx.fillStyle = "rgba(80,120,255,.12)"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 97 + t * 20) % W, (i * 53) % 300, 2, 2);
  }
  // peaux de banane
  for (const p of s.peaux) {
    ctx.save(); ctx.translate(p.x, p.y - 3);
    ctx.fillStyle = "#ffd43b"; ctx.strokeStyle = "#8a6400"; ctx.lineWidth = 1.5;
    for (const a of [-2.4, -1.57, -.7]) { ctx.beginPath(); ctx.ellipse(Math.cos(a) * 7, Math.sin(a) * 2, 8, 3, a * .6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  // caisses d'armes (avec parachute pendant la chute) et bananes dorées
  for (const c of s.caisses) {
    if (c.vy > 0) {
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(c.x - 12, c.y - 22); ctx.lineTo(c.x - 22, c.y - 52); ctx.moveTo(c.x + 12, c.y - 22); ctx.lineTo(c.x + 22, c.y - 52); ctx.stroke();
      ctx.fillStyle = c.arme === "canon_or" ? "#ffd43b" : "#e64980";
      ctx.beginPath(); ctx.arc(c.x, c.y - 52, 26, Math.PI, 0); ctx.fill();
    }
    if (c.arme === "soin") {
      ctx.save(); ctx.translate(c.x, c.y - 14); ctx.rotate(Math.sin(t * 4) * .3);
      ctx.shadowColor = "#ffd43b"; ctx.shadowBlur = 18; ctx.font = "26px sans-serif"; ctx.textAlign = "center"; ctx.fillText("🍌", 0, 9);
      ctx.restore();
    } else {
      const or = c.arme === "canon_or";
      ctx.fillStyle = or ? "#fcc419" : "#b07a45"; ctx.strokeStyle = or ? "#c98a00" : "#6b4226"; ctx.lineWidth = 2;
      if (or) { ctx.shadowColor = "#ffd43b"; ctx.shadowBlur = 16; }
      ctx.fillRect(c.x - 14, c.y - 24, 28, 24); ctx.strokeRect(c.x - 14, c.y - 24, 28, 24); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(c.x - 14, c.y - 24); ctx.lineTo(c.x + 14, c.y); ctx.moveTo(c.x + 14, c.y - 24); ctx.lineTo(c.x - 14, c.y); ctx.stroke();
      ctx.save(); ctx.translate(c.x - 8, c.y - 12); ctx.scale(.55, .55); dessinerArme(c.arme, t); ctx.restore();
    }
  }
  // noix de coco de Moka
  for (const c of s.cocos) {
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(c.x, AR.SOL, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(t * 8);
    ctx.fillStyle = "#6b4226"; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3d2208"; ctx.beginPath(); ctx.arc(-3, -3, 2, 0, Math.PI * 2); ctx.arc(3, -3, 2, 0, Math.PI * 2); ctx.arc(0, 3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // combattants (moi par-dessus)
  for (const j of s.joueurs) if (j.i !== moi) dessinerCombattant(j, t);
  if (s.joueurs[moi]) dessinerCombattant(s.joueurs[moi], t);
  // balles, plombs et roquettes-bananes
  for (const b of s.balles) {
    if (b.arme === "bazooka" || b.arme === "canon_or") {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx) + t * 12);
      ctx.fillStyle = b.arme === "canon_or" ? "#fcc419" : "#ffd43b"; ctx.strokeStyle = "#8a6400"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, -2); ctx.quadraticCurveTo(0, 10, 10, -2); ctx.quadraticCurveTo(0, 4, -10, -2); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (Math.random() < .6) particules.push({ x: b.x, y: b.y, vx: (Math.random() - .5) * 30, vy: -20, vie: .5, max: .5, couleur: "rgba(200,200,200,.6)", taille: 5 });
    } else {
      const n = Math.hypot(b.vx, b.vy) || 1, l = b.arme === "pompe" ? 6 : 14;
      ctx.strokeStyle = b.arme === "mitraillette" ? "#ffa94d" : "#fff3bf"; ctx.lineWidth = b.arme === "pompe" ? 3 : 2.5;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx / n * l, b.y - b.vy / n * l); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  // particules et ondes de choc
  const dt = 1 / 60;
  for (let i = particules.length - 1; i >= 0; i--) {
    const p = particules[i];
    p.vie -= dt;
    if (p.vie <= 0) { particules.splice(i, 1); continue; }
    if (p.onde) {
      p.r += (p.rmax - p.r) * .25;
      ctx.strokeStyle = p.couleur || `rgba(255,220,150,${p.vie / p.max})`; ctx.globalAlpha = p.vie / p.max; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      continue;
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
    ctx.globalAlpha = Math.min(1, p.vie / p.max * 1.5);
    ctx.fillStyle = p.couleur; ctx.beginPath(); ctx.arc(p.x, p.y, p.taille, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = textes.length - 1; i >= 0; i--) {
    const x = textes[i];
    x.vie -= dt * 1.2; x.y -= 40 * dt;
    if (x.vie <= 0) { textes.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, x.vie * 2);
    ctx.font = `900 ${x.taille}px Arial Black, sans-serif`; ctx.textAlign = "center";
    ctx.lineWidth = 4; ctx.strokeStyle = "#1b1340"; ctx.strokeText(x.t, x.x, x.y); ctx.fillStyle = x.couleur; ctx.fillText(x.t, x.x, x.y);
    ctx.textAlign = "start"; ctx.globalAlpha = 1;
  }
  dessinerMokaVol(t);
  ctx.restore();
  interfaceArene(s, t);
}

// Moka traverse le ciel de l'arène sur son jetpack quand il intervient
function dessinerMokaVol(t) {
  if (!mokaVol) return;
  const p = (performance.now() - mokaVol.debut) / 3200;
  if (p > 1) { mokaVol = null; return; }
  const x = -80 + p * (W + 160), y = 110 + Math.sin(p * 12) * 12;
  const img = imageTenue("arene", "rire");
  ctx.fillStyle = "#ff922b";
  ctx.beginPath(); ctx.moveTo(x - 10, y + 26); ctx.lineTo(x - 4, y + 46 + Math.random() * 10); ctx.lineTo(x + 2, y + 26); ctx.fill();
  if (img.complete) ctx.drawImage(img, x - 34, y - 34, 68, 68);
  if (Math.random() < .5) particules.push({ x, y: y + 30, vx: 0, vy: 40, vie: .6, max: .6, couleur: "#ffe066", taille: 3 });
}

function interfaceArene(s, t) {
  const texte = (txt, x, y, taille, couleur = "#fff", aligne = "left") => {
    ctx.font = `900 ${taille}px Arial Black, sans-serif`; ctx.textAlign = aligne;
    ctx.lineWidth = 5; ctx.strokeStyle = "#0d0b1f"; ctx.strokeText(txt, x, y);
    ctx.fillStyle = couleur; ctx.fillText(txt, x, y); ctx.textAlign = "start";
  };
  // chrono
  const reste = Math.max(0, (AR.DEPART + AR.DUREE - s.t) / 60);
  const txt = `${Math.floor(reste / 60)}:${String(Math.floor(reste % 60)).padStart(2, "0")}`;
  ctx.fillStyle = "rgba(13,11,31,.75)"; ctx.beginPath(); ctx.roundRect(W / 2 - 60, 96, 120, 40, 12); ctx.fill();
  texte(txt, W / 2, 126, 26, reste < 10 && Math.sin(t * 10) > 0 ? "#ff6b6b" : "#fff", "center");
  // tableau des K.O.
  const classement = arClassement(s);
  ctx.fillStyle = "rgba(13,11,31,.7)"; ctx.beginPath(); ctx.roundRect(10, 10, 190, 14 + classement.length * 26, 12); ctx.fill();
  classement.forEach((j, r) => {
    const y = 30 + r * 26;
    const img = visages[j.i];
    if (img && img.complete) ctx.drawImage(img, 16, y - 16, 22, 22);
    texte((j.i === moi ? "Toi" : j.nom).slice(0, 12), 42, y, 12, COULEURS[j.i % 4]);
    texte(`${j.k} K.O.`, 192, y, 13, "#fff", "right");
  });
  // mon arme et mes munitions
  const j = s.joueurs[moi];
  if (j) {
    ctx.fillStyle = "rgba(13,11,31,.7)"; ctx.beginPath(); ctx.roundRect(10, H - 56, 200, 46, 12); ctx.fill();
    ctx.save(); ctx.translate(30, H - 33); dessinerArme(j.arme, t); ctx.restore();
    texte(NOMS_ARMES[j.arme], 72, H - 36, 13);
    texte(j.mun < 0 ? "∞" : `${j.mun} munitions`, 72, H - 18, 11, "#ffe066");
    if (j.inverse > 0) texte("COMMANDES INVERSÉES !", W / 2, H - 20, 16, "#ff922b", "center");
    if (j.glisse > 0) texte("GLISSADE !", W / 2, H - 44, 16, "#ffe066", "center");
  }
  if (s.lune > 0) texte("🌙 GRAVITÉ LUNAIRE", W - 16, H - 20, 14, "#a5d8ff", "right");
  // compte à rebours et attente
  if (s.attente) texte("En attente de l'adversaire…", W / 2, H / 2, 30, "#ffe066", "center");
  else if (s.t <= AR.DEPART) {
    const n = Math.ceil((AR.DEPART - s.t) / 60);
    texte(n > 0 ? String(n) : "", W / 2, H / 2, 110 * (1 + ((AR.DEPART - s.t) % 60) / 120), "#fff", "center");
  } else if (s.t < AR.DEPART + 45) {
    texte("COMBAT !", W / 2, H / 2, 80, "#ffd43b", "center");
  }
  if (s.fini) texte("TERMINÉ !", W / 2, H / 2, 70, "#ffd43b", "center");
  // viseur
  if (souris.dedans && mode) {
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(souris.x, souris.y, 9, 0, Math.PI * 2);
    ctx.moveTo(souris.x - 15, souris.y); ctx.lineTo(souris.x - 5, souris.y); ctx.moveTo(souris.x + 5, souris.y); ctx.lineTo(souris.x + 15, souris.y);
    ctx.moveTo(souris.x, souris.y - 15); ctx.lineTo(souris.x, souris.y - 5); ctx.moveTo(souris.x, souris.y + 5); ctx.lineTo(souris.x, souris.y + 15); ctx.stroke();
  }
}

// ------------------------------------------------------------ taille du canvas et écran d'accueil
function ajusterToile() {
  const ratio = window.devicePixelRatio || 1;
  const largeur = Math.min(W, window.innerWidth - 32);
  toile.style.width = largeur + "px";
  toile.style.height = largeur * H / W + "px";
  toile.width = Math.round(largeur * ratio);
  toile.height = Math.round(largeur * H / W * ratio);
}
window.addEventListener("resize", ajusterToile);
ajusterToile();

// Démo sur l'écran d'accueil : quatre robots se battent derrière le menu
(function demo() {
  if (mode) return;
  if (!sim || sim.fini || sim.demo !== true) {
    sim = arNouveau(Math.floor(Math.random() * 1e9), ROBOTS.slice(0, 4));
    sim.demo = true; sim.t = AR.DEPART;
    chargerVisages(["pirate", "ninja", "clown", "robot"]);
    moi = -1;
  }
  for (const j of sim.joueurs) robot(sim, j);
  arPas(sim);
  dessiner(sim);
  requestAnimationFrame(demo);
})();

if (DUEL) {
  document.getElementById("choix-mode").classList.add("cache");
  MJ.pret.then(() => { if (MJ.joueur) lancerDuel(); else ouvrirConnexion(); });
}
