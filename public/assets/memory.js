// Memory contre la montre : le serveur connaît l'ordre des cartes et tient le vrai chrono.

const SYMBOLES = [
  "🦊", "🐼", "🐸", "🦁", "🐙", "🦄", "🐧", "🐢", "🦋", "🐝", "🐬", "🦉",
  "🍉", "🍓", "🍍", "🥑", "🍩", "🍒", "🌈", "⭐", "🚀", "🎸", "⚽", "👑",
];

const plateau = document.getElementById("plateau");
const texteTemps = document.getElementById("temps");
const rempli = document.getElementById("chrono-rempli");
let partie = null;
let mode = "facile";
let occupe = false;
let aCacher = null;   // deux cartes ratées encore visibles
let paires = 0;
let limite = 0;       // instant (ms) de fin du chrono
let tempsMax = 20;
let minuteur = null;
let dernierTic = 0;
let fini = true;

document.querySelectorAll("#ecran-mode button").forEach((b) => {
  b.onclick = () => exigerConnexion(() => lancer(b.dataset.mode));
});
document.getElementById("btn-abandon").onclick = () => {
  arreter();
  document.getElementById("ecran-jeu").classList.add("cache");
  document.getElementById("ecran-mode").classList.remove("cache");
};

function arreter() {
  fini = true;
  clearInterval(minuteur);
  Sons.musique.arreter();
}

async function lancer(m) {
  mode = m;
  let r;
  try {
    r = await api("/api/memory/debut", { mode });
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  partie = r.partie;
  paires = 0;
  aCacher = null;
  fini = false;
  document.getElementById("coups").textContent = "0";
  document.getElementById("paires").textContent = `0 / ${r.nb_cartes / 2}`;
  document.getElementById("ecran-mode").classList.add("cache");
  document.getElementById("ecran-jeu").classList.remove("cache");

  plateau.className = `plateau-memory ${mode}`;
  plateau.innerHTML = "";
  for (let i = 0; i < r.nb_cartes; i++) {
    const carte = document.createElement("button");
    carte.className = "carte-memory";
    carte.dataset.index = i;
    carte.setAttribute("aria-label", `Carte ${i + 1}`);
    carte.innerHTML = `<span class="face dos"></span><span class="face recto"></span>`;
    carte.onclick = () => retourner(carte);
    plateau.append(carte);
  }

  tempsMax = r.temps;
  limite = Date.now() + r.temps * 1000;
  clearInterval(minuteur);
  minuteur = setInterval(majTemps, 100);
  majTemps();
  Sons.musique.jouer("chill");
}

function majTemps() {
  if (fini) return;
  const reste = Math.max(0, (limite - Date.now()) / 1000);
  tempsMax = Math.max(tempsMax, reste);
  texteTemps.textContent = reste.toFixed(1).replace(".", ",");
  rempli.style.width = (100 * reste / tempsMax) + "%";
  document.getElementById("chrono").classList.toggle("urgent", reste <= 5);
  if (reste <= 5 && Math.ceil(reste) !== dernierTic && reste > 0) {
    dernierTic = Math.ceil(reste);
    Sons.jouer("alerte");
  }
  if (reste <= 0) tempsEcoule();
}

async function tempsEcoule() {
  clearInterval(minuteur);
  try {
    const r = await api("/api/memory/temps_ecoule", { partie });
    terminer(r.fin);
  } catch (e) {
    // l'horloge de la page avance un peu sur celle du serveur : on réessaie
    if (!fini) setTimeout(tempsEcoule, 600);
  }
}

function bonusTemps(carte) {
  const b = document.createElement("span");
  b.className = "bonus-temps";
  b.textContent = "+5 s";
  const r = carte.getBoundingClientRect();
  b.style.left = r.left + r.width / 2 + "px";
  b.style.top = r.top + "px";
  document.body.append(b);
  setTimeout(() => b.remove(), 1200);
  document.getElementById("chrono").classList.add("bonus");
  setTimeout(() => document.getElementById("chrono").classList.remove("bonus"), 500);
}

function cacherRatees() {
  if (!aCacher) return;
  aCacher.forEach((c) => c.classList.remove("retournee", "rate"));
  aCacher = null;
}

async function retourner(carte) {
  if (fini || occupe || carte.classList.contains("retournee") || carte.classList.contains("trouvee")) return;
  cacherRatees();
  occupe = true;
  let r;
  try {
    r = await api("/api/memory/retourner", { partie, index: Number(carte.dataset.index) });
  } catch (e) {
    occupe = false;
    return;
  }
  occupe = false;
  if (r.fin && r.symbole === undefined) return terminer(r.fin); // temps écoulé côté serveur

  Sons.jouer("carte");
  carte.querySelector(".recto").textContent = SYMBOLES[r.symbole];
  carte.classList.add("retournee");
  document.getElementById("coups").textContent = r.coups;
  limite = Date.now() + r.temps_restant * 1000; // on se recale sur le chrono du serveur

  if (r.paire !== undefined) {
    const autre = plateau.children[r.autre];
    if (r.paire) {
      paires++;
      Sons.jouer("paire");
      bonusTemps(carte);
      document.getElementById("paires").textContent = `${paires} / ${plateau.children.length / 2}`;
      setTimeout(() => [carte, autre].forEach((c) => c.classList.add("trouvee")), 300);
    } else {
      aCacher = [carte, autre];
      setTimeout(() => { if (aCacher) { aCacher.forEach((c) => c.classList.add("rate")); Sons.jouer("rate"); } }, 350);
      const ceux = aCacher;
      setTimeout(() => { if (aCacher === ceux) cacherRatees(); }, 1100);
    }
  }
  if (r.fin) setTimeout(() => terminer(r.fin), 700);
}

function terminer(f) {
  if (partie === null) return;
  partie = null;
  arreter();
  afficherResultat({
    titre: f.victoire ? "Toutes les paires trouvées !" : "Temps écoulé !",
    emoji: f.victoire ? "🎉" : "⏰",
    victoire: f.victoire,
    lignes: f.victoire
      ? [`${f.coups} essais · il restait ${f.temps_restant} s au chrono`]
      : [`${f.paires} paire(s) trouvée(s) sur ${plateau.children.length / 2}`],
    fin: f,
    rejouer: () => lancer(mode),
  });
}
