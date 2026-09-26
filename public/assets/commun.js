// Éléments communs à toutes les pages : en-tête, compte joueur, bourse de pièces d'or, fenêtres, roue.

const JEUX = [
  { id: "memory", nom: "Memory", emoji: "🃏", desc: "Retrouve les paires avant la fin du chrono : chaque paire rapporte 5 secondes.", classe: "memory" },
  { id: "bataille", nom: "Bataille navale", emoji: "🚢", desc: "Place ta flotte et coule celle de l'amiral ordinateur avant qu'il ne coule la tienne.", classe: "bataille" },
  { id: "snake", nom: "Snake", emoji: "🐍", desc: "Mange les fruits, grandis, et surtout ne te mords pas la queue !", classe: "snake" },
  { id: "demineur", nom: "Démineur", emoji: "💣", desc: "Déniche toutes les cases sûres sans réveiller les bombes farceuses.", classe: "demineur" },
  { id: "echecs", nom: "Échecs", emoji: "♞", desc: "Affronte l'ordinateur en 3 niveaux. Un mat rapide rapporte gros.", classe: "echecs" },
  { id: "flipper", nom: "Flipper", emoji: "🪩", desc: "Bumpers, cibles, multiplicateur… et une bonne musique rétro.", classe: "flipper" },
];

const MJ = { joueur: null, surChangement: [] };

async function api(chemin, donnees) {
  const options = donnees === undefined
    ? {}
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(donnees) };
  const rep = await fetch(chemin, options);
  const json = await rep.json().catch(() => ({ erreur: "Réponse illisible du serveur." }));
  if (!rep.ok) {
    if (rep.status === 401) ouvrirConnexion();
    if (rep.status === 402) ouvrirFauche(json.erreur);
    const err = new Error(json.erreur || "Erreur inconnue.");
    err.statut = rep.status;
    throw err;
  }
  return json;
}

// Pour les boutons « Jouer » : n'affiche un message que pour les erreurs sans fenêtre dédiée.
function erreurLancement(e) {
  if (e.statut !== 401 && e.statut !== 402) alert(e.message);
}

function echapper(texte) {
  return String(texte).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatMult(m) {
  return "x" + String(m).replace(".", ",");
}

function majJoueur(joueur) {
  MJ.joueur = joueur;
  afficherCompte();
  MJ.surChangement.forEach((f) => f(joueur));
}

// ------------------------------------------------------------ en-tête
function construireEntete() {
  const page = document.body.dataset.page;
  const lien = (href, id, texte) => `<a href="${href}" class="${page === id ? "actif" : ""}">${texte}</a>`;
  const entete = document.createElement("header");
  entete.className = "entete";
  entete.innerHTML = `
    <a class="logo" href="/"><span class="manette">🎮</span>Mini<span>Jeux</span></a>
    <nav class="nav">
      ${lien("/", "accueil", "Jeux")}
      ${lien("/roue.html", "roue", "Roue de la fortune")}
      ${lien("/classement.html", "classement", "Classements")}
    </nav>
    <div class="compte">
      <button class="bouton-son" id="btn-son" title="Couper / remettre le son"></button>
      <span id="compte"></span>
    </div>`;
  document.body.prepend(entete);
  const son = entete.querySelector("#btn-son");
  const majSon = () => (son.textContent = Sons.coupe ? "🔇" : "🔊");
  son.onclick = () => { Sons.basculer(); majSon(); };
  majSon();

  const pied = document.createElement("footer");
  pied.className = "pied";
  pied.textContent = "MiniJeux — jeux gratuits, sans publicité. Les pièces d'or n'ont aucune valeur monétaire.";
  document.body.append(pied);
}

function afficherCompte() {
  const zone = document.getElementById("compte");
  if (!zone) return;
  const j = MJ.joueur;
  if (!j) {
    zone.innerHTML = `<button class="bouton petit" id="btn-connexion">Choisir mon pseudo</button>`;
    zone.querySelector("button").onclick = () => ouvrirConnexion();
    return;
  }
  zone.innerHTML = `
    ${j.secours ? `<button class="bouton petit" id="btn-secours" title="Tu n'as plus de quoi jouer : 20 pièces offertes une fois par jour">🆘 +20 pièces</button>` : ""}
    <span class="bourse" id="bourse" title="Pièces d'or"><i class="piece"></i><span id="nb-pieces">${j.pieces}</span></span>
    <span class="pseudo">${echapper(j.pseudo)}</span>
    <button class="bouton secondaire petit" id="btn-deco" title="Se déconnecter">⏻</button>`;
  zone.querySelector("#btn-deco").onclick = async () => {
    await api("/api/deconnexion", {});
    majJoueur(null);
  };
  const s = zone.querySelector("#btn-secours");
  if (s) s.onclick = prendreSecours;
}

async function prendreSecours() {
  const r = await api("/api/secours", {});
  Sons.jouer("bonus");
  fermerFenetre();
  majJoueur(r.joueur);
}

// ------------------------------------------------------------ fenêtres
function ouvrirFenetre(html, { bloquee = false, classe = "" } = {}) {
  fermerFenetre();
  const voile = document.createElement("div");
  voile.className = "voile";
  voile.id = "voile";
  voile.innerHTML = `<div class="fenetre ${classe}">${html}</div>`;
  voile.addEventListener("click", (e) => { if (e.target === voile && !bloquee) fermerFenetre(); });
  document.body.append(voile);
  return voile.firstElementChild;
}

function fermerFenetre() {
  document.getElementById("voile")?.remove();
}

function ouvrirConnexion() {
  if (document.getElementById("form-compte")) return;
  const f = ouvrirFenetre(`
    <p class="gros">🎮</p>
    <h2>Entre dans la salle de jeux</h2>
    <p class="doux">Ton pseudo apparaît dans les classements. Pas besoin d'e-mail.</p>
    <div class="onglets">
      <button type="button" class="actif" data-mode="inscription">Nouveau joueur</button>
      <button type="button" data-mode="connexion">J'ai déjà un pseudo</button>
    </div>
    <form id="form-compte">
      <label for="f-pseudo">Pseudo</label>
      <input type="text" id="f-pseudo" autocomplete="username" maxlength="16" required>
      <label for="f-mdp">Mot de passe</label>
      <input type="password" id="f-mdp" autocomplete="new-password" required>
      <p class="erreur" id="f-erreur"></p>
      <button class="bouton" style="width:100%" id="f-valider">Créer mon compte (+20 pièces offertes)</button>
    </form>`);
  let mode = "inscription";
  f.querySelectorAll(".onglets button").forEach((b) => {
    b.onclick = () => {
      mode = b.dataset.mode;
      f.querySelectorAll(".onglets button").forEach((x) => x.classList.toggle("actif", x === b));
      f.querySelector("#f-valider").textContent = mode === "inscription" ? "Créer mon compte (+20 pièces offertes)" : "Me connecter";
      f.querySelector("#f-mdp").autocomplete = mode === "inscription" ? "new-password" : "current-password";
    };
  });
  f.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api(`/api/${mode}`, {
        pseudo: f.querySelector("#f-pseudo").value,
        mot_de_passe: f.querySelector("#f-mdp").value,
      });
      fermerFenetre();
      majJoueur(r.joueur);
    } catch (err) {
      f.querySelector("#f-erreur").textContent = err.message;
    }
  };
  f.querySelector("#f-pseudo").focus();
}

function ouvrirFauche(message) {
  const j = MJ.joueur || {};
  const f = ouvrirFenetre(`
    <p class="gros">🪙</p>
    <h2>Plus assez de pièces</h2>
    <p class="doux">${echapper(message)}</p>
    ${j.secours
      ? `<p>Pas de panique : voici <b>20 pièces de secours</b>, une fois par jour.</p>
         <div class="actions"><button class="bouton" id="f-secours">🆘 Récupérer 20 pièces</button></div>`
      : `<p>Reviens demain pour tes pièces de secours !</p>
         <div class="actions"><button class="bouton secondaire" onclick="fermerFenetre()">OK</button></div>`}`);
  const b = f.querySelector("#f-secours");
  if (b) b.onclick = prendreSecours;
}

// Appelle `action` si le joueur est connecté, sinon ouvre la fenêtre de connexion.
function exigerConnexion(action) {
  if (MJ.joueur) return action();
  ouvrirConnexion();
}

// Texte des boutons « Jouer » avec le prix de la partie.
function prixPartie() {
  return `10 <i class="piece"></i>`;
}

// ------------------------------------------------------------ roue de la fortune
const COULEURS_ROUE = ["#ff5fa2", "#3ee0e8", "#8a5cf6", "#ffc93c", "#ff7a59", "#5be37d", "#e63b7a", "#ffd700"];
let configRoue = null;

async function chargerRoue() {
  if (!configRoue) configRoue = await api("/api/roue");
  return configRoue;
}

function dessinerRoue(canvas, secteurs) {
  const ctx = canvas.getContext("2d");
  const n = secteurs.length;
  const r = canvas.width / 2;
  const pas = (2 * Math.PI) / n;
  const k = canvas.width / 880; // tailles pensées pour 880 px
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.arc(r, r, r - 4 * k, 0, 2 * Math.PI);
  ctx.fillStyle = "#2a1d5e";
  ctx.fill();
  for (let i = 0; i < n; i++) {
    const debut = -Math.PI / 2 + i * pas;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r - 34 * k, debut, debut + pas);
    ctx.closePath();
    const g = ctx.createRadialGradient(r, r, 40 * k, r, r, r - 34 * k);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(.18, COULEURS_ROUE[i % COULEURS_ROUE.length]);
    g.addColorStop(1, COULEURS_ROUE[i % COULEURS_ROUE.length]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 6 * k;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(debut + pas / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const m = secteurs[i];
    ctx.font = `900 ${(m >= 5 ? 92 : 76) * k}px Trebuchet MS, sans-serif`;
    ctx.lineWidth = 10 * k;
    ctx.strokeStyle = "rgba(40, 20, 80, .55)";
    ctx.strokeText(formatMult(m), r - 70 * k, 0);
    ctx.fillStyle = "#fff";
    ctx.fillText(formatMult(m), r - 70 * k, 0);
    ctx.restore();
  }
  for (let i = 0; i < n * 3; i++) {
    const a = (i / (n * 3)) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(r + Math.cos(a) * (r - 18 * k), r + Math.sin(a) * (r - 18 * k), 9 * k, 0, 2 * Math.PI);
    ctx.fillStyle = i % 2 ? "#ffe07a" : "#fff";
    ctx.fill();
  }
}

// Fait tourner la roue (élément canvas) jusqu'au secteur demandé, avec un « tic » à chaque secteur.
function animerRoue(canvas, nbSecteurs, secteur, duree = 5200) {
  return new Promise((fini) => {
    const pas = 360 / nbSecteurs;
    const depart = Number(canvas.dataset.angle || 0);
    const cible = 360 - (secteur + .5) * pas + (Math.random() - .5) * pas * .6;
    const actuel = ((depart % 360) + 360) % 360;
    const arrivee = depart + 360 * 6 + ((cible - actuel + 360) % 360);
    const t0 = performance.now();
    let dernierSecteur = Math.floor(depart / pas);
    function image(t) {
      const x = Math.min(1, (t - t0) / duree);
      const ease = 1 - Math.pow(1 - x, 4);
      const angle = depart + (arrivee - depart) * ease;
      canvas.style.transform = `rotate(${angle}deg)`;
      const s = Math.floor(angle / pas);
      if (s !== dernierSecteur) { dernierSecteur = s; Sons.jouer("roue_tic"); }
      if (x < 1) requestAnimationFrame(image);
      else { canvas.dataset.angle = arrivee; fini(); }
    }
    requestAnimationFrame(image);
  });
}

// Fin de partie avec tour de roue disponible : la roue s'ouvre pour multiplier les gains.
async function roueDeFin(fin) {
  const conf = await chargerRoue();
  return new Promise((suite) => {
    const f = ouvrirFenetre(`
      <h2>🎡 Roue de la fortune !</h2>
      <p class="doux" style="margin:0 0 10px">Ton tour gratuit du jour : multiplie les <b class="gain">${fin.pieces} pièces</b> de cette partie.</p>
      <div class="roue-cadre petite">
        <div class="fleche"></div>
        <canvas width="640" height="640"></canvas>
        <div class="moyeu">🪙</div>
      </div>
      <p class="resultat-roue" id="resultat-roue"></p>
      <div class="actions"><button class="bouton gros-bouton" id="btn-lancer-roue">🎡 Lancer la roue !</button></div>`,
      { bloquee: true, classe: "large" });
    const canvas = f.querySelector("canvas");
    dessinerRoue(canvas, conf.secteurs);
    const bouton = f.querySelector("#btn-lancer-roue");
    bouton.onclick = async () => {
      bouton.disabled = true;
      let r;
      try {
        r = await api("/api/roue/tourner", { partie: fin.partie });
      } catch (e) {
        fermerFenetre();
        return suite({ ...fin, roue: false });
      }
      await animerRoue(canvas, conf.secteurs.length, r.secteur);
      const texte = f.querySelector("#resultat-roue");
      if (r.mult > 1) {
        Sons.jouer("bonus");
        if (r.mult >= 3) confettis();
        texte.innerHTML = `${formatMult(r.mult)} ! <span class="gain">${fin.pieces} → ${r.pieces} pièces</span>`;
      } else {
        Sons.jouer("rate");
        texte.innerHTML = "x1… tes gains restent les mêmes.";
      }
      bouton.textContent = "Continuer";
      bouton.disabled = false;
      bouton.onclick = () => suite({ ...fin, pieces_base: fin.pieces, pieces: r.pieces, mult: r.mult, joueur: r.joueur, roue: false });
    };
  });
}

// Affiche le résultat d'une partie (après la roue si elle est disponible) et fait voler les pièces.
async function afficherResultat({ titre, emoji, lignes = [], fin, rejouer, victoire = fin.score > 0 }) {
  if (fin.roue) fin = await roueDeFin(fin);
  Sons.jouer(victoire ? "victoire" : "perdu");
  const net = fin.pieces - fin.mise;
  const f = ouvrirFenetre(`
    <p class="gros">${emoji}</p>
    <h2>${titre}</h2>
    ${lignes.map((l) => `<p class="doux" style="margin:4px 0">${l}</p>`).join("")}
    ${fin.score > 0 ? `<p style="font-size:22px;margin:12px 0 0">Score : <b>${fin.score}</b></p>` : ""}
    ${fin.record ? `<p class="record">🏆 Nouveau record personnel !</p>` : ""}
    <div class="gain-total"><i class="piece"></i>+${fin.pieces}</div>
    ${fin.mult > 1 ? `<p class="doux" style="margin:0">${fin.pieces_base} pièces ${formatMult(fin.mult)} grâce à la roue</p>` : ""}
    <p class="doux" style="margin:6px 0 0">Mise : ${fin.mise} · bilan de la partie : <b style="color:${net >= 0 ? "var(--vert)" : "var(--rouge)"}">${net >= 0 ? "+" : ""}${net}</b></p>
    <div class="actions">
      <button class="bouton" id="r-rejouer">Rejouer (${prixPartie()})</button>
      <a class="bouton secondaire" href="/classement.html?jeu=${document.body.dataset.page}">Classement</a>
    </div>`);
  f.querySelector("#r-rejouer").onclick = () => { fermerFenetre(); rejouer(); };
  if (fin.pieces > 0) {
    const depart = f.querySelector(".gain-total").getBoundingClientRect();
    pluieDePieces(depart, Math.min(12, Math.max(3, fin.pieces)), () => majJoueur(fin.joueur));
  } else {
    majJoueur(fin.joueur);
  }
  if (victoire) confettis();
}

function pluieDePieces(depart, nombre, fin) {
  const bourse = document.getElementById("bourse");
  if (!bourse) return fin();
  const arrivee = bourse.getBoundingClientRect();
  for (let i = 0; i < nombre; i++) {
    const p = document.createElement("i");
    p.className = "piece piece-volante";
    const x = depart.left + depart.width / 2 + (Math.random() - .5) * 80;
    const y = depart.top + depart.height / 2 + (Math.random() - .5) * 30;
    p.style.left = x + "px";
    p.style.top = y + "px";
    document.body.append(p);
    setTimeout(() => {
      p.style.transform = `translate(${arrivee.left + 12 - x}px, ${arrivee.top + 6 - y}px) scale(.7)`;
      p.style.opacity = ".3";
      Sons.jouer("piece");
    }, 300 + i * 90);
    setTimeout(() => p.remove(), 1300 + i * 90);
  }
  setTimeout(() => {
    fin();
    document.getElementById("bourse")?.classList.add("gagne");
  }, 1100 + nombre * 90);
}

function confettis() {
  const couleurs = ["#ffc93c", "#ff5fa2", "#3ee0e8", "#5be37d", "#b99cff"];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = couleurs[i % couleurs.length];
    c.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
    c.style.animationDelay = Math.random() * .5 + "s";
    document.body.append(c);
    setTimeout(() => c.remove(), 4500);
  }
}

construireEntete();
MJ.pret = api("/api/moi").then((r) => majJoueur(r.joueur)).catch(() => majJoueur(null));
