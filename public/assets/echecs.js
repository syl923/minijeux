// Échecs : les règles et l'ordinateur tournent sur le serveur ; la page affiche et propose les coups légaux.
// Plateau = chaîne de 64 caractères, case 0 = a8, case 63 = h1 ; majuscules = blancs.

const GLYPHES = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const VALEURS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NOMS_NIVEAUX = { facile: "Facile", normal: "Normal", difficile: "Difficile" };
const echiquier = document.getElementById("echiquier");
let partie = null, plateau = "", coups = [], choisie = null, dernier = null, enAttente = false, niveau = "normal", nbCoups = 0;

document.querySelectorAll("#ecran-mode button").forEach((b) => (b.onclick = () => exigerConnexion(() => lancer(b.dataset.niveau))));
document.getElementById("btn-abandon").onclick = async () => {
  if (!partie || enAttente || !confirm("Abandonner la partie ?")) return;
  const r = await api("/api/echecs/abandon", { partie });
  terminer(r.fin);
};

async function lancer(n) {
  niveau = n;
  let r;
  try {
    r = await api("/api/echecs/debut", { niveau });
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  partie = r.partie; plateau = r.plateau; coups = r.coups; choisie = null; dernier = null; nbCoups = 0;
  document.getElementById("niveau").textContent = NOMS_NIVEAUX[n];
  document.getElementById("nb-coups").textContent = "0";
  document.getElementById("ecran-mode").classList.add("cache");
  document.getElementById("ecran-jeu").classList.remove("cache");
  statut("À toi de jouer !");
  dessiner();
}

function statut(t) { document.getElementById("statut").textContent = t; }

function dessiner(anim = null, echec = false) {
  echiquier.innerHTML = "";
  const cibles = choisie === null ? [] : coups.filter(([d]) => d === choisie).map(([, v]) => v);
  for (let sq = 0; sq < 64; sq++) {
    const r = Math.floor(sq / 8), f = sq % 8;
    const c = document.createElement("div");
    c.className = `case-e ${(r + f) % 2 ? "sombre" : "claire"}`;
    if (dernier && dernier.includes(sq)) c.classList.add("dernier");
    if (sq === choisie) c.classList.add("choisie");
    if (cibles.includes(sq)) c.classList.add(plateau[sq] === "." ? "cible" : "cible-prise");
    const p = plateau[sq];
    if (p !== ".") {
      const piece = document.createElement("span");
      piece.className = `piece-e ${p === p.toUpperCase() ? "blanche" : "noire"}`;
      piece.textContent = GLYPHES[p.toLowerCase()] + "︎";
      if (echec && p === "K") c.classList.add("en-echec");
      if (anim && anim[1] === sq) {
        const dr = Math.floor(anim[0] / 8) - r, df = anim[0] % 8 - f;
        piece.style.transform = `translate(${df * 100}%, ${dr * 100}%)`;
        piece.classList.add("en-vol");
        requestAnimationFrame(() => requestAnimationFrame(() => (piece.style.transform = "")));
      }
      c.append(piece);
    }
    if (f === 0) c.insertAdjacentHTML("beforeend", `<i class="coord-r">${8 - r}</i>`);
    if (r === 7) c.insertAdjacentHTML("beforeend", `<i class="coord-f">${"abcdefgh"[f]}</i>`);
    c.onclick = () => clic(sq);
    echiquier.append(c);
  }
  dessinerPrises();
}

function dessinerPrises() {
  const depart = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const zone = (majuscule) => {
    let html = "", total = 0;
    for (const t of ["q", "r", "b", "n", "p"]) {
      const lettre = majuscule ? t.toUpperCase() : t;
      const manque = Math.max(0, depart[t] - [...plateau].filter((c) => c === lettre).length);
      html += `<span class="piece-e ${majuscule ? "blanche" : "noire"}">${(GLYPHES[t] + "︎").repeat(manque)}</span>`;
      total += manque * VALEURS[t];
    }
    return [html, total];
  };
  const [noires, pNoires] = zone(false);  // prises par le joueur
  const [blanches, pBlanches] = zone(true);
  document.getElementById("prises-joueur").innerHTML = noires + (pNoires > pBlanches ? ` <b>+${pNoires - pBlanches}</b>` : "");
  document.getElementById("prises-ia").innerHTML = blanches + (pBlanches > pNoires ? ` <b>+${pBlanches - pNoires}</b>` : "");
}

// Coup du joueur appliqué tout de suite à l'écran (le serveur renverra la position officielle).
function appliquer(b, de, vers) {
  const t = b.split("");
  const p = t[de];
  if (p.toLowerCase() === "p" && de % 8 !== vers % 8 && t[vers] === ".") t[vers + (p === "P" ? 8 : -8)] = "."; // en passant
  if (p.toLowerCase() === "k" && Math.abs(vers - de) === 2) {                                             // roque
    if (vers > de) { t[de + 1] = t[de + 3]; t[de + 3] = "."; } else { t[de - 1] = t[de - 4]; t[de - 4] = "."; }
  }
  t[vers] = p; t[de] = ".";
  if (p === "P" && vers < 8) t[vers] = "Q";
  if (p === "p" && vers >= 56) t[vers] = "q";
  return t.join("");
}

async function clic(sq) {
  if (!partie || enAttente) return;
  const p = plateau[sq];
  if (choisie !== null && coups.some(([d, v]) => d === choisie && v === sq)) {
    const de = choisie;
    const prise = plateau[sq] !== ".";
    plateau = appliquer(plateau, de, sq);
    choisie = null;
    dernier = [de, sq];
    nbCoups++;
    document.getElementById("nb-coups").textContent = nbCoups;
    Sons.jouer(prise ? "prise" : "deplacement");
    dessiner([de, sq]);
    enAttente = true;
    statut("L'ordinateur réfléchit… 🤔");
    echiquier.classList.add("reflechit");
    let r;
    try {
      r = await api("/api/echecs/coup", { partie, de, vers: sq });
    } catch (e) {
      enAttente = false;
      echiquier.classList.remove("reflechit");
      return statut(e.message);
    }
    await new Promise((ok) => setTimeout(ok, 350));
    echiquier.classList.remove("reflechit");
    if (r.ia) {
      const priseIa = plateau[r.ia[1]] !== ".";
      dernier = r.ia;
      plateau = r.plateau;
      Sons.jouer(priseIa ? "prise" : "deplacement");
      if (r.echec) setTimeout(() => Sons.jouer("echec"), 250);
      dessiner(r.ia, r.echec);
    } else {
      plateau = r.plateau;
      dessiner(null, r.echec);
    }
    coups = r.coups;
    enAttente = false;
    if (r.fin) return setTimeout(() => terminer(r.fin), 700);
    statut(r.echec ? "Échec au roi ! ⚠️" : "À toi de jouer !");
    return;
  }
  if (p !== "." && p === p.toUpperCase()) {
    choisie = sq === choisie ? null : sq;
    Sons.jouer("clic");
  } else {
    choisie = null;
  }
  dessiner(null, false);
}

function terminer(f) {
  partie = null;
  const titres = { victoire: "Échec et mat, bravo !", defaite: f.detail === "Abandon" ? "Partie abandonnée" : "Échec et mat…", nulle: "Partie nulle" };
  statut(titres[f.resultat]);
  afficherResultat({
    titre: titres[f.resultat],
    emoji: f.resultat === "victoire" ? "👑" : f.resultat === "nulle" ? "🤝" : "♚",
    victoire: f.resultat === "victoire",
    lignes: [`${f.detail} · ${f.coups} coups · niveau ${NOMS_NIVEAUX[niveau].toLowerCase()}`],
    fin: f,
    rejouer: () => lancer(niveau),
  });
}
