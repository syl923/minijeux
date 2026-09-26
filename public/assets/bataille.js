// Bataille navale : la flotte ennemie et l'ordinateur vivent sur le serveur.

const TAILLE = 10;
const NAVIRES = [
  { nom: "Porte-avions", taille: 5, type: "porte-avions" },
  { nom: "Croiseur", taille: 4, type: "croiseur" },
  { nom: "Destroyer", taille: 3, type: "destroyer" },
  { nom: "Sous-marin", taille: 3, type: "sous-marin" },
  { nom: "Torpilleur", taille: 2, type: "torpilleur" },
];

// ------------------------------------------------------------ dessins des navires (vue de dessus, proue à droite)
function tourelle(x, y, r = 11) {
  return `<g><rect x="${x}" y="${y - 3.5}" width="${r * 2.6}" height="7" rx="3" fill="#39434d"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="var(--pont)" stroke="#2d3740" stroke-width="3"/>
    <circle cx="${x - 3}" cy="${y - 3}" r="${r / 3}" fill="rgba(255,255,255,.35)"/></g>`;
}

function coque(L, pointe = 70) {
  return `<path d="M12 50 Q12 16 42 14 L${L - pointe} 14 Q${L - 16} 20 ${L - 5} 50 Q${L - 16} 80 ${L - pointe} 86 L42 86 Q12 84 12 50Z"
      fill="var(--coque)" stroke="var(--coque-f)" stroke-width="4"/>
    <path d="M22 30 Q24 22 44 21 L${L - pointe - 5} 21 Q${L - 30} 26 ${L - 20} 38" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="4" stroke-linecap="round"/>`;
}

function dessinNavire(type, taille) {
  const L = taille * 100;
  switch (type) {
    case "porte-avions":
      return coque(L, 50) + `
        <rect x="26" y="22" width="${L - 80}" height="56" rx="8" fill="#3d4650"/>
        <line x1="40" y1="50" x2="${L - 70}" y2="50" stroke="#ffd84d" stroke-width="3" stroke-dasharray="16 12"/>
        <line x1="60" y1="70" x2="${L - 200}" y2="30" stroke="#fff" stroke-width="2.5" stroke-dasharray="10 8" opacity=".7"/>
        <rect x="${L * .56}" y="4" width="70" height="22" rx="4" fill="var(--pont)" stroke="#2d3740" stroke-width="3"/>
        <circle cx="${L * .56 + 50}" cy="15" r="6" fill="#e4ecf2"/>
        ${[120, 230].map((x) => `<path d="M${x} 58 l26 0 l10 -6 l2 6 l-2 6 l-10 -6 m-18 0 l-6 -12 l6 0 l8 12 l-8 12 l-6 0 z" fill="#d7e0e7" stroke="#55606b" stroke-width="1.5"/>`).join("")}`;
    case "croiseur":
      return coque(L) + `
        <rect x="130" y="30" width="140" height="40" rx="8" fill="var(--pont)" stroke="#2d3740" stroke-width="3"/>
        <rect x="170" y="38" width="22" height="24" rx="4" fill="#39434d"/><rect x="205" y="38" width="22" height="24" rx="4" fill="#39434d"/>
        ${tourelle(70, 50)}${tourelle(L - 110, 50)}${tourelle(L - 160, 50, 9)}`;
    case "destroyer":
      return coque(L, 80) + `
        <rect x="110" y="32" width="80" height="36" rx="8" fill="var(--pont)" stroke="#2d3740" stroke-width="3"/>
        <circle cx="150" cy="50" r="7" fill="#39434d"/>
        ${tourelle(60, 50, 10)}${tourelle(L - 90, 50, 10)}`;
    case "sous-marin":
      return `<ellipse cx="${L / 2}" cy="50" rx="${L / 2 - 8}" ry="30" fill="#34506b" stroke="#1d2f40" stroke-width="4"/>
        <path d="M30 40 Q${L / 2} 22 ${L - 40} 40" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round"/>
        <rect x="${L / 2 - 30}" y="36" width="60" height="28" rx="14" fill="#24394d" stroke="#132230" stroke-width="3"/>
        <circle cx="${L / 2 + 10}" cy="50" r="5" fill="#9fd4ff"/>
        <path d="M14 50 l-10 -14 l0 28z" fill="#24394d"/>
        <line x1="${L / 2 + 30}" y1="50" x2="${L / 2 + 60}" y2="50" stroke="#132230" stroke-width="4"/>`;
    default: // torpilleur
      return coque(L, 60) + `
        <rect x="60" y="32" width="56" height="36" rx="10" fill="var(--pont)" stroke="#2d3740" stroke-width="3"/>
        <rect x="70" y="40" width="10" height="20" rx="3" fill="#9fd4ff"/>
        <line x1="30" y1="50" x2="54" y2="50" stroke="#e24b4b" stroke-width="6" stroke-linecap="round"/>
        <rect x="130" y="28" width="30" height="8" rx="3" fill="#39434d"/><rect x="130" y="64" width="30" height="8" rx="3" fill="#39434d"/>`;
  }
}

function svgNavire(type, taille, vertical) {
  const L = taille * 100;
  const contenu = dessinNavire(type, taille);
  return vertical
    ? `<svg viewBox="0 0 100 ${L}" preserveAspectRatio="none"><g transform="translate(100 0) rotate(90)">${contenu}</g></svg>`
    : `<svg viewBox="0 0 ${L} 100" preserveAspectRatio="none">${contenu}</svg>`;
}

function typeDeNom(nom) {
  return (NAVIRES.find((n) => n.nom === nom) || NAVIRES[0]).type;
}
const LETTRES = "ABCDEFGHIJ";

let flotte = NAVIRES.map(() => null); // placement du joueur, même ordre que NAVIRES
let choisi = 0;
let vertical = false;
let partie = null;
let tirEnCours = false;
let enJeu = false;
let nbTirs = 0;
const message = document.getElementById("message");

// ------------------------------------------------------------ outils de grille
function cases(b) {
  return Array.from({ length: b.taille }, (_, k) => [b.x + (b.vertical ? 0 : k), b.y + (b.vertical ? k : 0)]);
}

function placementOk(liste) {
  const occ = new Map();
  for (let n = 0; n < liste.length; n++) {
    if (!liste[n]) continue;
    for (const [x, y] of cases(liste[n])) {
      if (x < 0 || y < 0 || x >= TAILLE || y >= TAILLE) return false;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const o = occ.get(`${x + dx},${y + dy}`);
          if (o !== undefined && o !== n) return false;
        }
      occ.set(`${x},${y}`, n);
    }
  }
  return true;
}

function creerGrille(conteneur, cible) {
  conteneur.innerHTML = `
    <div class="coordonnees">
      <div class="coord-haut">${Array.from({ length: TAILLE }, (_, i) => `<span>${i + 1}</span>`).join("")}</div>
      <div class="coord-gauche">${LETTRES.split("").map((l) => `<span>${l}</span>`).join("")}</div>
      <div class="grille-mer ${cible ? "cible" : ""}"></div>
    </div>`;
  const g = conteneur.querySelector(".grille-mer");
  for (let y = 0; y < TAILLE; y++)
    for (let x = 0; x < TAILLE; x++) {
      const c = document.createElement("button");
      c.className = "case-mer";
      c.dataset.x = x;
      c.dataset.y = y;
      c.setAttribute("aria-label", `${LETTRES[y]}${x + 1}`);
      g.append(c);
    }
  return g;
}

function caseDe(g, x, y) {
  return g.children[y * TAILLE + x];
}

function dessinerBateau(g, b, classe = "", type = "torpilleur") {
  const d = document.createElement("div");
  d.className = `bateau ${b.vertical ? "vertical" : ""} ${classe}`;
  d.style.left = `calc(var(--case) * ${b.x} + 3px)`;
  d.style.top = `calc(var(--case) * ${b.y} + 3px)`;
  d.style.width = `calc(var(--case) * ${b.vertical ? 1 : b.taille} - 6px)`;
  d.style.height = `calc(var(--case) * ${b.vertical ? b.taille : 1} - 6px)`;
  d.dataset.cle = `${b.x},${b.y}`;
  d.innerHTML = svgNavire(type, b.taille, b.vertical);
  g.append(d);
  return d;
}

function marquer(g, x, y, resultat) {
  const c = caseDe(g, x, y);
  c.classList.add("visee");
  c.innerHTML = `<span class="marque ${resultat === "eau" ? "eau" : "touche"}"></span>`;
}

// ------------------------------------------------------------ placement
const grilleJoueur = creerGrille(document.getElementById("grille-joueur"), false);
const liste = document.getElementById("liste-flotte");

function majPlacement() {
  grilleJoueur.querySelectorAll(".bateau").forEach((b) => b.remove());
  flotte.forEach((b, i) => b && dessinerBateau(grilleJoueur, b, "", NAVIRES[i].type));
  liste.innerHTML = NAVIRES.map((n, i) => `
    <button data-i="${i}" class="${i === choisi ? "choisi" : ""} ${flotte[i] ? "place" : ""}">
      <span class="mini">${"<i></i>".repeat(n.taille)}</span>${n.nom}${flotte[i] ? " ✓" : ""}
    </button>`).join("");
  liste.querySelectorAll("button").forEach((b) => (b.onclick = () => { choisi = Number(b.dataset.i); majPlacement(); }));
  document.getElementById("btn-lancer").disabled = flotte.some((b) => !b);
}

function effacerApercu() {
  grilleJoueur.querySelectorAll(".apercu, .apercu-ko").forEach((c) => c.classList.remove("apercu", "apercu-ko"));
}

function candidat(x, y) {
  return { x, y, taille: NAVIRES[choisi].taille, vertical };
}

grilleJoueur.addEventListener("mouseover", (e) => {
  if (enJeu || choisi < 0 || !e.target.dataset.x) return;
  effacerApercu();
  const b = candidat(Number(e.target.dataset.x), Number(e.target.dataset.y));
  const essai = flotte.slice();
  essai[choisi] = b;
  const ok = placementOk(essai);
  cases(b).forEach(([x, y]) => {
    if (x < TAILLE && y < TAILLE) caseDe(grilleJoueur, x, y).classList.add(ok ? "apercu" : "apercu-ko");
  });
});
grilleJoueur.addEventListener("mouseleave", effacerApercu);

grilleJoueur.addEventListener("click", (e) => {
  if (enJeu || !e.target.dataset.x) return;
  const x = Number(e.target.dataset.x);
  const y = Number(e.target.dataset.y);
  // Clic sur un navire déjà posé : on le reprend en main.
  const pris = flotte.findIndex((b) => b && cases(b).some(([bx, by]) => bx === x && by === y));
  if (pris >= 0) {
    choisi = pris;
    vertical = flotte[pris].vertical;
    flotte[pris] = null;
    return majPlacement();
  }
  if (choisi < 0) return;
  const essai = flotte.slice();
  essai[choisi] = candidat(x, y);
  if (!placementOk(essai)) return;
  flotte = essai;
  const suivant = flotte.findIndex((b) => !b);
  choisi = suivant;
  effacerApercu();
  majPlacement();
});

function pivoter() {
  vertical = !vertical;
  effacerApercu();
}
document.getElementById("btn-pivoter").onclick = pivoter;
document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") pivoter(); });

document.getElementById("btn-hasard").onclick = () => {
  for (;;) {
    const essai = [];
    let ok = true;
    for (const n of NAVIRES) {
      let place = false;
      for (let t = 0; t < 200 && !place; t++) {
        const b = { taille: n.taille, vertical: Math.random() < .5, x: Math.floor(Math.random() * TAILLE), y: Math.floor(Math.random() * TAILLE) };
        if (placementOk([...essai, b])) { essai.push(b); place = true; }
      }
      if (!place) { ok = false; break; }
    }
    if (ok) { flotte = essai; break; }
  }
  choisi = -1;
  majPlacement();
};

document.getElementById("btn-effacer").onclick = () => {
  flotte = NAVIRES.map(() => null);
  choisi = 0;
  majPlacement();
};

document.getElementById("btn-lancer").onclick = () => exigerConnexion(lancer);

// ------------------------------------------------------------ combat
let grilleEnnemi;
const coulesJoueur = new Set();
const coulesEnnemi = new Set();

function majEtats() {
  const ligne = (set) => NAVIRES.map((n) => `<span class="${set.has(n.nom) ? "coule" : ""}">${n.nom}</span>`).join("");
  document.getElementById("etat-joueur").innerHTML = ligne(coulesJoueur);
  document.getElementById("etat-ennemi").innerHTML = ligne(coulesEnnemi);
}

// Le serveur renvoie le navire coulé ; on retrouve son nom d'après sa taille (deux navires de 3 cases).
function nomNavire(set, taille) {
  const n = NAVIRES.find((v) => v.taille === taille && !set.has(v.nom));
  return n ? n.nom : "";
}

async function lancer() {
  let r;
  try {
    r = await api("/api/bataille/debut", { flotte });
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  partie = r.partie;
  try { sessionStorage.setItem("flotte", JSON.stringify(flotte)); } catch (e) {}
  enJeu = true;
  nbTirs = 0;
  coulesJoueur.clear();
  coulesEnnemi.clear();
  effacerApercu();
  document.getElementById("bloc-placement").classList.add("cache");
  document.getElementById("bloc-ennemi").classList.remove("cache");
  grilleEnnemi = creerGrille(document.getElementById("grille-ennemi"), true);
  grilleEnnemi.addEventListener("click", (e) => {
    const c = e.target.closest(".case-mer");
    if (c) tirer(Number(c.dataset.x), Number(c.dataset.y));
  });
  majEtats();
  message.textContent = "À toi de tirer ! Clique sur la grille ennemie 🎯";
}

const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function tirer(x, y) {
  if (tirEnCours || !enJeu || caseDe(grilleEnnemi, x, y).classList.contains("visee")) return;
  tirEnCours = true;
  grilleEnnemi.classList.remove("cible");
  let r;
  try {
    r = await api("/api/bataille/tir", { partie, x, y });
  } catch (e) {
    message.textContent = e.message;
    tirEnCours = false;
    grilleEnnemi.classList.add("cible");
    return;
  }
  nbTirs++;
  const j = r.joueur;
  marquer(grilleEnnemi, j.x, j.y, j.resultat);
  if (j.resultat === "coule") {
    const nom = nomNavire(coulesEnnemi, j.coule.taille);
    coulesEnnemi.add(nom);
    dessinerBateau(grilleEnnemi, j.coule, "ennemi coule", typeDeNom(nom));
    Sons.jouer("kaboom");
    message.textContent = `💥 Tu as coulé le ${nom} ennemi !`;
  } else {
    message.textContent = j.resultat === "touche" ? `🔥 Touché en ${LETTRES[y]}${x + 1} !` : `💧 Plouf… ${LETTRES[y]}${x + 1} dans l'eau.`;
    Sons.jouer(j.resultat === "touche" ? "explosion" : "plouf");
  }
  majEtats();

  if (r.ia) {
    await attendre(700);
    message.textContent = "L'amiral ennemi vise…";
    await attendre(500);
    const ia = r.ia;
    marquer(grilleJoueur, ia.x, ia.y, ia.resultat);
    Sons.jouer(ia.resultat === "eau" ? "plouf" : ia.resultat === "coule" ? "kaboom" : "explosion");
    if (ia.resultat === "coule") {
      const nom = nomNavire(coulesJoueur, ia.coule.taille);
      coulesJoueur.add(nom);
      grilleJoueur.querySelector(`.bateau[data-cle="${ia.coule.x},${ia.coule.y}"]`)?.classList.add("coule");
      message.textContent = `😱 L'ennemi a coulé ton ${nom} !`;
    } else {
      message.textContent = ia.resultat === "touche"
        ? `🔥 L'ennemi t'a touché en ${LETTRES[ia.y]}${ia.x + 1} ! À toi.`
        : `💧 L'ennemi rate en ${LETTRES[ia.y]}${ia.x + 1}. À toi !`;
    }
    majEtats();
  }

  if (r.fin) {
    enJeu = false;
    const f = r.fin;
    if (f.flotte_ia) {
      const nommes = new Set(coulesEnnemi);
      f.flotte_ia.forEach((b) => {
        if (cases(b).every(([bx, by]) => caseDe(grilleEnnemi, bx, by).classList.contains("visee"))) return;
        const nom = nomNavire(nommes, b.taille);
        nommes.add(nom);
        dessinerBateau(grilleEnnemi, b, "ennemi fantome", typeDeNom(nom));
      });
    }
    message.textContent = f.victoire ? "🏆 Victoire ! La flotte ennemie est au fond de l'eau." : "💀 Défaite… ta flotte a sombré.";
    await attendre(900);
    afficherResultat({
      titre: f.victoire ? "Victoire !" : "Défaite…",
      victoire: f.victoire,
      emoji: f.victoire ? "🏆" : "🌊",
      lignes: f.victoire
        ? [`Flotte ennemie coulée en ${f.tirs} tirs`]
        : [`${coulesEnnemi.size} navire(s) ennemi(s) coulé(s) : 2 pièces par navire`],
      fin: f,
      rejouer: () => location.reload(),
    });
    return;
  }
  tirEnCours = false;
  grilleEnnemi.classList.add("cible");
}

// En rejouant, on retrouve la flotte de la partie précédente.
try {
  const precedente = JSON.parse(sessionStorage.getItem("flotte"));
  if (Array.isArray(precedente) && precedente.length === NAVIRES.length && precedente.every(Boolean) && placementOk(precedente)) {
    flotte = precedente;
    choisi = -1;
  }
} catch (e) {}
majPlacement();
