// Bataille navale : la flotte ennemie et l'ordinateur vivent sur le serveur.

const TAILLE = 10;
const NAVIRES = [
  { nom: "Porte-avions", taille: 5 },
  { nom: "Croiseur", taille: 4 },
  { nom: "Destroyer", taille: 3 },
  { nom: "Sous-marin", taille: 3 },
  { nom: "Torpilleur", taille: 2 },
];
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

function dessinerBateau(g, b, classe = "") {
  const d = document.createElement("div");
  d.className = `bateau ${b.vertical ? "vertical" : ""} ${classe}`;
  d.style.left = `calc(var(--case) * ${b.x} + 3px)`;
  d.style.top = `calc(var(--case) * ${b.y} + 3px)`;
  d.style.width = `calc(var(--case) * ${b.vertical ? 1 : b.taille} - 6px)`;
  d.style.height = `calc(var(--case) * ${b.vertical ? b.taille : 1} - 6px)`;
  d.dataset.cle = `${b.x},${b.y}`;
  d.innerHTML = "<i></i>".repeat(b.taille);
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
  flotte.forEach((b) => b && dessinerBateau(grilleJoueur, b));
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
    return alert(e.message);
  }
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
    dessinerBateau(grilleEnnemi, j.coule, "ennemi coule");
    message.textContent = `💥 Tu as coulé le ${nom} ennemi !`;
  } else {
    message.textContent = j.resultat === "touche" ? `🔥 Touché en ${LETTRES[y]}${x + 1} !` : `💧 Plouf… ${LETTRES[y]}${x + 1} dans l'eau.`;
  }
  majEtats();

  if (r.ia) {
    await attendre(700);
    message.textContent = "L'amiral ennemi vise…";
    await attendre(500);
    const ia = r.ia;
    marquer(grilleJoueur, ia.x, ia.y, ia.resultat);
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
      f.flotte_ia.forEach((b) => {
        if (!cases(b).every(([bx, by]) => caseDe(grilleEnnemi, bx, by).classList.contains("visee"))) dessinerBateau(grilleEnnemi, b, "ennemi fantome");
      });
    }
    message.textContent = f.victoire ? "🏆 Victoire ! La flotte ennemie est au fond de l'eau." : "💀 Défaite… ta flotte a sombré.";
    await attendre(900);
    afficherResultat({
      titre: f.victoire ? "Victoire !" : "Défaite…",
      emoji: f.victoire ? "🏆" : "🌊",
      lignes: f.victoire
        ? [`Flotte ennemie coulée en ${f.tirs} tirs`]
        : [`${coulesEnnemi.size} navire(s) ennemi(s) coulé(s) : lot de consolation`],
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
