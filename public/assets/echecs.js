// Échecs : les règles et l'ordinateur tournent sur le serveur ; la page affiche et propose les coups légaux.
// Plateau = chaîne de 64 caractères, case 0 = a8, case 63 = h1 ; majuscules = blancs.

const GLYPHES = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const VALEURS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NOMS_NIVEAUX = { facile: "Facile", normal: "Normal", difficile: "Difficile" };
const echiquier = document.getElementById("echiquier");
let partie = null, plateau = "", coups = [], choisie = null, dernier = null, enAttente = false, niveau = "normal", nbCoups = 0;
let retourne = false; // échiquier vu du côté des noirs (duel en ligne)
const DUEL = new URLSearchParams(location.search).get("duel");

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
  const ecran = (sq) => (retourne ? 63 - sq : sq); // position à l'écran d'une case
  for (let i = 0; i < 64; i++) {
    const sq = retourne ? 63 - i : i;
    const r = Math.floor(i / 8), f = i % 8;
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
      if (echec && p === (retourne ? "k" : "K")) c.classList.add("en-echec");
      if (anim && anim[1] === sq) {
        const dr = Math.floor(ecran(anim[0]) / 8) - r, df = ecran(anim[0]) % 8 - f;
        piece.style.transform = `translate(${df * 100}%, ${dr * 100}%)`;
        piece.classList.add("en-vol");
        requestAnimationFrame(() => requestAnimationFrame(() => (piece.style.transform = "")));
      }
      c.append(piece);
    }
    if (f === 0) c.insertAdjacentHTML("beforeend", `<i class="coord-r">${8 - Math.floor(sq / 8)}</i>`);
    if (r === 7) c.insertAdjacentHTML("beforeend", `<i class="coord-f">${"abcdefgh"[sq % 8]}</i>`);
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
  let [miennes, pMiennes] = zone(false);  // pièces adverses prises par le joueur (qui a les blancs)
  let [siennes, pSiennes] = zone(true);
  if (retourne) [miennes, pMiennes, siennes, pSiennes] = [siennes, pSiennes, miennes, pMiennes];
  document.getElementById("prises-joueur").innerHTML = miennes + (pMiennes > pSiennes ? ` <b>+${pMiennes - pSiennes}</b>` : "");
  document.getElementById("prises-ia").innerHTML = siennes + (pSiennes > pMiennes ? ` <b>+${pSiennes - pMiennes}</b>` : "");
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
  if (DUEL) return clicDuel(sq);
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

// ------------------------------------------------------------ duel en ligne contre un autre joueur
let vueDuel = null, versionDuel = -1, finMontree = false, limiteDuel = 0;

async function suivreDuel() {
  try {
    const v = await api(`/api/duels/etat?duel=${DUEL}&version=${versionDuel}`);
    if (!v.inchange) appliquerVue(v);
  } catch (e) {
    statut(e.message);
  }
}

function appliquerVue(v) {
  const ancien = vueDuel;
  vueDuel = v;
  versionDuel = v.version;
  if (v.statut === "attente") return statut("En attente d'un adversaire…");
  retourne = v.couleur === "noirs";
  document.getElementById("vs-adversaire").textContent = v.adversaire;
  document.getElementById("vs-couleur").textContent = `Tu as les ${v.couleur}`;
  document.getElementById("sous-titre").textContent = `Duel en ligne : tu as les ${v.couleur}. Un pion qui atteint le bout de l'échiquier devient une dame.`;
  const joueAdverse = ancien && ancien.plateau !== v.plateau && v.dernier && ancien.mon_tour === false;
  const prise = ancien && v.dernier && ancien.plateau[v.dernier[1]] !== ".";
  plateau = v.plateau;
  coups = v.coups;
  dernier = v.dernier;
  nbCoups = Math.ceil(v.demi_coups / 2);
  document.getElementById("nb-coups").textContent = v.demi_coups;
  limiteDuel = Date.now() + (v.reste || 0) * 1000;
  if (joueAdverse) {
    Sons.jouer(prise ? "prise" : "deplacement");
    if (v.echec) setTimeout(() => Sons.jouer("echec"), 250);
  }
  dessiner(joueAdverse ? v.dernier : null, v.echec);
  if (v.statut === "termine") return finDuel(v);
  statut(v.mon_tour ? (v.echec ? "Échec au roi ! À toi" : "À toi de jouer !") : `${v.adversaire} réfléchit…`);
  echiquier.classList.toggle("reflechit", !v.mon_tour);
}

async function clicDuel(sq) {
  if (!vueDuel || !vueDuel.mon_tour || enAttente) return;
  const p = plateau[sq];
  const mienne = p !== "." && (retourne ? p === p.toLowerCase() : p === p.toUpperCase());
  if (choisie !== null && coups.some(([d, v]) => d === choisie && v === sq)) {
    const de = choisie;
    const prise = plateau[sq] !== ".";
    plateau = appliquer(plateau, de, sq);
    choisie = null;
    dernier = [de, sq];
    Sons.jouer(prise ? "prise" : "deplacement");
    vueDuel.mon_tour = false;
    dessiner([de, sq]);
    enAttente = true;
    try {
      const v = await api("/api/duels/jouer", { duel: DUEL, de, vers: sq });
      vueDuel.plateau = v.plateau; // le coup est déjà affiché : pas de nouvelle animation
      appliquerVue(v);
    } catch (e) {
      statut(e.message);
      versionDuel = -1;
      suivreDuel();
    }
    enAttente = false;
    return;
  }
  choisie = mienne && sq !== choisie ? sq : null;
  if (mienne) Sons.jouer("clic");
  dessiner(null, vueDuel.echec);
}

function finDuel(v) {
  if (finMontree) return;
  finMontree = true;
  echiquier.classList.remove("reflechit");
  const f = v.fin;
  const titres = { victoire: "Victoire !", defaite: "Défaite…", nulle: "Partie nulle" };
  statut(titres[f.resultat]);
  afficherResultat({
    titre: titres[f.resultat],
    emoji: f.resultat === "victoire" ? "👑" : f.resultat === "nulle" ? "🤝" : "♚",
    victoire: f.resultat === "victoire",
    lignes: [`Duel contre ${echapper(v.adversaire)} · ${echapper(f.raison || "")}`],
    fin: f,
    rejouer: () => (location.href = "/duels.html"),
  });
}

if (DUEL) {
  document.getElementById("ecran-mode").classList.add("cache");
  document.getElementById("ecran-jeu").classList.remove("cache");
  document.getElementById("bloc-niveau").classList.add("cache");
  document.getElementById("bandeau-duel").classList.remove("cache");
  document.getElementById("btn-abandon").onclick = async () => {
    if (!vueDuel || vueDuel.statut !== "en_cours" || !confirm("Abandonner le duel ? Ton adversaire gagnera la mise.")) return;
    appliquerVue(await api("/api/duels/abandon", { duel: DUEL }));
  };
  statut("Connexion au duel…");
  MJ.pret.then(() => exigerConnexion(() => { suivreDuel(); setInterval(suivreDuel, 1000); }));
  setInterval(() => {
    if (!vueDuel || vueDuel.statut !== "en_cours") return;
    const reste = Math.max(0, Math.round((limiteDuel - Date.now()) / 1000));
    const el = document.getElementById("chrono-duel");
    el.textContent = `⏱️ ${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")} ${vueDuel.mon_tour ? "pour jouer" : "pour ton adversaire"}`;
    el.classList.toggle("urgent", vueDuel.mon_tour && reste <= 20);
  }, 250);
}
