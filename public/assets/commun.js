// Éléments communs à toutes les pages : en-tête, compte joueur, bourse de pièces d'or, fenêtres, roue.

// Catalogue des jeux : catégorie pour le menu, thème graphique de la page, badge éventuel.
const JEUX = [
  { id: "jet", nom: "Moka Jet", emoji: "🚀", cat: "arcade", theme: "jungle", badge: "NOUVEAU", desc: "Pilote Moka et son jetpack entre les bambous et attrape les bananes !" },
  { id: "pingouin", nom: "Pingu Glisse", emoji: "🐧", cat: "action", theme: "banquise", badge: "NOUVEAU", desc: "Plonge dans les descentes, envole-toi sur les bosses et fuis la tempête de neige !" },
  { id: "runner", nom: "Rail Rush", emoji: "🛹", cat: "action", theme: "ville", badge: "HOT", desc: "Cours sur les rails, saute par-dessus les trains et ramasse les pièces et les bonus !" },
  { id: "candy", nom: "Bonbons Folies", emoji: "🍬", cat: "reflexion", theme: "bonbons", badge: "NOUVEAU", desc: "Aligne 3 bonbons ou plus. Rayés, emballés, arc-en-ciel : déclenche des combos sucrés !" },
  { id: "tetris", nom: "Blocomania", emoji: "🧱", cat: "arcade", theme: "arcade", badge: "NOUVEAU", desc: "Empile les blocs qui tombent et complète des lignes. Ça accélère !" },
  { id: "flipper", nom: "Flipper Néon", emoji: "🪩", cat: "arcade", theme: "futur", badge: "HOT", desc: "Bumpers, flammes, multibille et jackpot sur fond de rock !" },
  { id: "snake", nom: "Snake", emoji: "🐍", cat: "arcade", theme: "savane", desc: "Mange les fruits, grandis, et surtout ne te mords pas la queue !" },
  { id: "memory", nom: "Memory", emoji: "🃏", cat: "reflexion", theme: "magie", desc: "Retrouve les paires avant la fin du chrono : chaque paire rapporte 5 secondes." },
  { id: "demineur", nom: "Démineur", emoji: "💣", cat: "reflexion", theme: "chantier", desc: "Déniche toutes les cases sûres sans réveiller les bombes farceuses." },
  { id: "echecs", nom: "Échecs", emoji: "♞", cat: "duel", theme: "bois", badge: "EN LIGNE", desc: "Contre l'ordinateur (3 niveaux) ou contre un autre joueur en ligne." },
  { id: "bataille", nom: "Bataille navale", emoji: "🚢", cat: "duel", theme: "ocean", badge: "EN LIGNE", desc: "Coule la flotte de l'ordinateur… ou celle d'un autre joueur en ligne." },
];
const CATEGORIES = { tous: "⭐ Tous", action: "🏃 Action", arcade: "👾 Arcade", reflexion: "🧠 Réflexion", duel: "⚔️ Duels" };
const THEMES_PAGES = { roue: "ciel", classement: "ciel", accueil: "ciel", duels: "ciel" };

// Moka, la mascotte (dessin original)
const MASCOTTE = `<svg class="mascotte" viewBox="0 0 120 140" aria-hidden="true">
  <path d="M84 118 q30 6 26 -22 q-3 -14 -14 -8" fill="none" stroke="#7a4a1f" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="60" cy="112" rx="27" ry="24" fill="#8b5a2b"/>
  <ellipse cx="60" cy="116" rx="16" ry="15" fill="#f3d3a6"/>
  <g class="bras-salut"><path d="M36 104 q-20 -8 -22 -30" fill="none" stroke="#8b5a2b" stroke-width="10" stroke-linecap="round"/>
    <circle cx="14" cy="72" r="8" fill="#f3d3a6"/></g>
  <path d="M84 104 q14 -2 16 -12" fill="none" stroke="#8b5a2b" stroke-width="10" stroke-linecap="round"/>
  <g class="piece-mascotte"><circle cx="102" cy="88" r="12" fill="#ffd43b" stroke="#e8a200" stroke-width="3"/>
    <text x="102" y="93" text-anchor="middle" font-size="14" font-weight="900" fill="#c98a00">★</text></g>
  <circle cx="24" cy="54" r="14" fill="#8b5a2b"/><circle cx="24" cy="54" r="8" fill="#f3b894"/>
  <circle cx="96" cy="54" r="14" fill="#8b5a2b"/><circle cx="96" cy="54" r="8" fill="#f3b894"/>
  <circle cx="60" cy="56" r="35" fill="#9c6433"/>
  <ellipse cx="48" cy="54" rx="15" ry="16" fill="#f3d3a6"/><ellipse cx="72" cy="54" rx="15" ry="16" fill="#f3d3a6"/>
  <ellipse cx="60" cy="73" rx="21" ry="14" fill="#f3d3a6"/>
  <g class="yeux"><ellipse cx="49" cy="53" rx="6.5" ry="8" fill="#fff"/><ellipse cx="71" cy="53" rx="6.5" ry="8" fill="#fff"/>
    <circle cx="50" cy="55" r="3.8" fill="#2b1a0e"/><circle cx="70" cy="55" r="3.8" fill="#2b1a0e"/>
    <circle cx="51.5" cy="53" r="1.3" fill="#fff"/><circle cx="71.5" cy="53" r="1.3" fill="#fff"/></g>
  <ellipse cx="56" cy="67" rx="2" ry="1.5" fill="#6b3d17"/><ellipse cx="64" cy="67" rx="2" ry="1.5" fill="#6b3d17"/>
  <path d="M47 75 q13 13 26 0 z" fill="#c92a2a"/><path d="M53 80 q7 5 14 0" fill="#ff8787"/>
  <path d="M26 40 q34 -38 68 0 q-34 -9 -68 0z" fill="#e03131"/>
  <path d="M26 40 q-12 2 -16 8 q14 2 28 -6z" fill="#c92a2a"/>
  <circle cx="60" cy="17" r="4" fill="#fff"/>
  <text x="60" y="36" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" font-family="Arial Black, sans-serif">MJ</text>
</svg>`;

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
  const jeu = JEUX.find((j) => j.id === page);
  document.body.classList.add("theme-" + (jeu ? jeu.theme : THEMES_PAGES[page] || "ciel"));
  const lien = (href, id, texte) => `<a href="${href}" class="onglet-nav ${page === id ? "actif" : ""}">${texte}</a>`;
  const entete = document.createElement("header");
  entete.className = "entete";
  entete.innerHTML = `
    <div class="entete-haut">
      <a class="logo" href="/" title="Accueil">${MASCOTTE}<span class="logo-texte">Moka <b>Arcade</b></span></a>
      <span class="slogan">Les petits jeux qui rapportent gros !</span>
      <div class="compte">
        <button class="bouton-son" id="btn-son" title="Couper / remettre le son"></button>
        <span id="compte"></span>
      </div>
    </div>
    <nav class="nav">
      ${lien("/", "accueil", "🏠 Accueil")}
      <span class="menu-jeux ${jeu ? "actif" : ""}">
        <button class="onglet-nav" type="button">🎮 Les jeux ▾</button>
        <span class="deroulant">${JEUX.map((j) => `<a href="/${j.id}.html" class="${page === j.id ? "actif" : ""}">${iconeJeu(j.id, "icone-menu")}${j.nom}${j.badge ? `<em class="${j.badge.split(" ")[0]}">${j.badge}</em>` : ""}</a>`).join("")}</span>
      </span>
      ${lien("/duels.html", "duels", "⚔️ Duels en ligne")}
      ${lien("/roue.html", "roue", "🎡 Roue")}
      ${lien("/classement.html", "classement", "🏆 Classements")}
    </nav>`;
  document.body.prepend(entete);
  const menu = entete.querySelector(".menu-jeux");
  menu.querySelector("button").onclick = () => menu.classList.toggle("ouvert");
  document.addEventListener("click", (e) => { if (!menu.contains(e.target)) menu.classList.remove("ouvert"); });
  const son = entete.querySelector("#btn-son");
  const majSon = () => (son.textContent = Sons.coupe ? "🔇" : "🔊");
  son.onclick = () => { Sons.basculer(); majSon(); };
  majSon();

  const pied = document.createElement("footer");
  pied.className = "pied";
  pied.innerHTML = `<div class="pied-mascotte">${MASCOTTE}</div>
    <b>Moka Arcade</b> — petits jeux gratuits, sans publicité · Les pièces d'or sont virtuelles et n'ont aucune valeur monétaire<br>
    ${JEUX.map((j) => `<a href="/${j.id}.html">${j.nom}</a>`).join(" · ")}<br>
    <a href="/mentions-legales.html">Mentions légales</a> · <a href="/confidentialite.html">Confidentialité et cookies</a> ·
    <a href="/cgu.html">Règles du site</a> · <a href="/compte.html">Mon compte</a>`;
  // icône du jeu dans le titre de la page (à la place de l'émoji)
  const h1 = document.querySelector(".titre-page h1");
  if (jeu && h1) h1.innerHTML = iconeJeu(jeu.id, "icone-titre") + h1.textContent.replace(/^\S+\s/, "");
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
