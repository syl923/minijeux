// Éléments communs à toutes les pages : en-tête, compte joueur, bourse de pièces d'or, fenêtres.

const MJ = {
  joueur: null,
  surChangement: [],
};

async function api(chemin, donnees) {
  const options = donnees === undefined
    ? {}
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(donnees) };
  const rep = await fetch(chemin, options);
  const json = await rep.json().catch(() => ({ erreur: "Réponse illisible du serveur." }));
  if (!rep.ok) {
    if (rep.status === 401) ouvrirConnexion();
    throw new Error(json.erreur || "Erreur inconnue.");
  }
  return json;
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
    <div class="compte" id="compte"></div>`;
  document.body.prepend(entete);

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
    ${j.mult_parties > 0 ? `<span class="badge-mult" title="Multiplicateur de la roue : encore ${j.mult_parties} partie(s)">${formatMult(j.mult)} · ${j.mult_parties} partie${j.mult_parties > 1 ? "s" : ""}</span>` : ""}
    <span class="bourse" id="bourse" title="Pièces d'or"><i class="piece"></i><span id="nb-pieces">${j.pieces}</span></span>
    <span class="pseudo">${echapper(j.pseudo)}</span>
    <button class="bouton secondaire petit" id="btn-deco" title="Se déconnecter">⏻</button>`;
  zone.querySelector("#btn-deco").onclick = async () => {
    await api("/api/deconnexion", {});
    majJoueur(null);
  };
}

// ------------------------------------------------------------ fenêtres
function ouvrirFenetre(html) {
  fermerFenetre();
  const voile = document.createElement("div");
  voile.className = "voile";
  voile.id = "voile";
  voile.innerHTML = `<div class="fenetre">${html}</div>`;
  voile.addEventListener("click", (e) => { if (e.target === voile && !voile.dataset.bloque) fermerFenetre(); });
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

// Affiche le résultat d'une partie et fait voler les pièces jusqu'à la bourse.
function afficherResultat({ titre, emoji, lignes = [], fin, rejouer }) {
  const f = ouvrirFenetre(`
    <p class="gros">${emoji}</p>
    <h2>${titre}</h2>
    ${lignes.map((l) => `<p class="doux" style="margin:4px 0">${l}</p>`).join("")}
    ${fin.score > 0 ? `<p style="font-size:22px;margin:12px 0 0">Score : <b>${fin.score}</b></p>` : ""}
    ${fin.record && fin.score > 0 ? `<p class="record">🏆 Nouveau record personnel !</p>` : ""}
    <div class="gain-total"><i class="piece"></i>+${fin.pieces}</div>
    ${fin.mult > 1 ? `<p class="doux" style="margin:0">${fin.pieces_base} pièces ${formatMult(fin.mult)} grâce à la roue</p>` : ""}
    <div class="actions">
      <button class="bouton" id="r-rejouer">Rejouer</button>
      <a class="bouton secondaire" href="/classement.html">Classement</a>
    </div>`);
  f.querySelector("#r-rejouer").onclick = () => { fermerFenetre(); rejouer(); };
  const depart = f.querySelector(".gain-total").getBoundingClientRect();
  pluieDePieces(depart, Math.min(12, Math.max(3, fin.pieces)), () => majJoueur(fin.joueur));
  if (fin.score > 0) confettis();
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
    }, 300 + i * 70);
    setTimeout(() => p.remove(), 1200 + i * 70);
  }
  setTimeout(() => {
    fin();
    document.getElementById("bourse")?.classList.add("gagne");
  }, 1100 + nombre * 70);
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

// Appelle `action` si le joueur est connecté, sinon ouvre la fenêtre de connexion.
function exigerConnexion(action) {
  if (MJ.joueur) return action();
  ouvrirConnexion();
}

construireEntete();
MJ.pret = api("/api/moi").then((r) => majJoueur(r.joueur)).catch(() => majJoueur(null));
