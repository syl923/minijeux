// Memory : le serveur connaît l'ordre des cartes, la page ne découvre une carte qu'en la retournant.

const SYMBOLES = [
  "🦊", "🐼", "🐸", "🦁", "🐙", "🦄", "🐧", "🐢", "🦋", "🐝", "🐬", "🦉",
  "🍉", "🍓", "🍍", "🥑", "🍩", "🍒", "🌈", "⭐", "🚀", "🎸", "⚽", "👑",
];

const plateau = document.getElementById("plateau");
let partie = null;
let mode = "facile";
let occupe = false;
let aCacher = null; // deux cartes ratées encore visibles
let paires = 0;
let debut = 0;
let minuteur = null;

document.querySelectorAll("#ecran-mode button").forEach((b) => {
  b.onclick = () => exigerConnexion(() => lancer(b.dataset.mode));
});
document.getElementById("btn-abandon").onclick = () => {
  clearInterval(minuteur);
  document.getElementById("ecran-jeu").classList.add("cache");
  document.getElementById("ecran-mode").classList.remove("cache");
};

async function lancer(m) {
  mode = m;
  let r;
  try {
    r = await api("/api/memory/debut", { mode });
  } catch (e) {
    return alert(e.message);
  }
  partie = r.partie;
  paires = 0;
  aCacher = null;
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

  debut = Date.now();
  clearInterval(minuteur);
  minuteur = setInterval(majTemps, 250);
  majTemps();
}

function majTemps() {
  const s = Math.floor((Date.now() - debut) / 1000);
  document.getElementById("temps").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function cacherRatees() {
  if (!aCacher) return;
  aCacher.forEach((c) => c.classList.remove("retournee", "rate"));
  aCacher = null;
}

async function retourner(carte) {
  if (occupe || carte.classList.contains("retournee") || carte.classList.contains("trouvee")) return;
  cacherRatees();
  occupe = true;
  let r;
  try {
    r = await api("/api/memory/retourner", { partie, index: Number(carte.dataset.index) });
  } catch (e) {
    occupe = false;
    return;
  }
  carte.querySelector(".recto").textContent = SYMBOLES[r.symbole];
  carte.classList.add("retournee");
  occupe = false;
  document.getElementById("coups").textContent = r.coups;

  if (r.paire === undefined) return;
  const autre = plateau.children[r.autre];
  if (r.paire) {
    paires++;
    document.getElementById("paires").textContent = `${paires} / ${plateau.children.length / 2}`;
    setTimeout(() => [carte, autre].forEach((c) => c.classList.add("trouvee")), 300);
  } else {
    aCacher = [carte, autre];
    setTimeout(() => aCacher && aCacher.forEach((c) => c.classList.add("rate")), 350);
    const ceux = aCacher;
    setTimeout(() => { if (aCacher === ceux) cacherRatees(); }, 1100);
  }

  if (r.fin) {
    clearInterval(minuteur);
    const f = r.fin;
    setTimeout(() => afficherResultat({
      titre: "Toutes les paires trouvées !",
      emoji: "🎉",
      lignes: [`${f.coups} essais · ${Math.floor(f.secondes / 60)} min ${String(f.secondes % 60).padStart(2, "0")} s`],
      fin: f,
      rejouer: () => lancer(mode),
    }), 900);
  }
}
