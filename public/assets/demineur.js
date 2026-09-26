// Démineur : les bombes sont placées et gardées par le serveur ; la page ne gère que l'affichage et les drapeaux.

// ------------------------------------------------------------ les bombes farceuses (dessins maison)
const BOMBES = {
  bombinette: { nom: "La Bombinette ronchon", svg: `
    <circle cx="50" cy="58" r="34" fill="#2b2b3a"/><circle cx="38" cy="46" r="10" fill="rgba(255,255,255,.18)"/>
    <rect x="58" y="16" width="16" height="14" rx="3" transform="rotate(30 66 23)" fill="#5a5a70"/>
    <path d="M72 14 q8 -10 16 -4" stroke="#b7803c" stroke-width="4" fill="none"/>
    <g class="etincelle"><circle cx="89" cy="9" r="6" fill="#ffdd33"/><circle cx="89" cy="9" r="3" fill="#fff"/></g>
    <circle cx="38" cy="58" r="9" fill="#fff"/><circle cx="62" cy="58" r="9" fill="#fff"/>
    <circle cx="40" cy="60" r="4" fill="#111"/><circle cx="60" cy="60" r="4" fill="#111"/>
    <path d="M28 45 l18 6 M72 45 l-18 6" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <path d="M40 78 q10 -6 20 0" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>` },
  pasteque: { nom: "La Pastèque piégée", svg: `
    <ellipse cx="50" cy="58" rx="38" ry="32" fill="#2f9e44"/>
    <path d="M22 40 q6 18 0 36 M38 30 q6 28 0 56 M56 28 q6 30 0 60 M74 34 q6 22 0 48" stroke="#1d6b2b" stroke-width="5" fill="none"/>
    <path d="M50 26 q4 -12 14 -14" stroke="#b7803c" stroke-width="4" fill="none"/>
    <g class="etincelle"><circle cx="66" cy="11" r="6" fill="#ff7b33"/><circle cx="66" cy="11" r="3" fill="#fff"/></g>
    <circle cx="38" cy="54" r="8" fill="#fff"/><circle cx="62" cy="54" r="8" fill="#fff"/>
    <circle cx="36" cy="55" r="4" fill="#111"/><circle cx="60" cy="55" r="4" fill="#111"/>
    <path d="M34 70 q16 14 32 0 z" fill="#ff4d6d" stroke="#7a1027" stroke-width="2"/>
    <circle cx="44" cy="73" r="1.6" fill="#111"/><circle cx="54" cy="74" r="1.6" fill="#111"/>` },
  poulpe: { nom: "La Mine-poulpe", svg: `
    <g fill="#8b5cf6">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="46" y="10" width="8" height="18" rx="4" transform="rotate(${a} 50 52)"/>`).join("")}</g>
    <circle cx="50" cy="52" r="30" fill="#a78bfa"/><circle cx="40" cy="40" r="8" fill="rgba(255,255,255,.3)"/>
    <path d="M28 76 q4 12 10 4 q4 12 12 2 q8 10 12 -2 q6 8 10 -4" stroke="#8b5cf6" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="40" cy="52" r="7" fill="#fff"/><circle cx="60" cy="52" r="7" fill="#fff"/>
    <circle cx="41" cy="53" r="3.5" fill="#111"/><circle cx="61" cy="53" r="3.5" fill="#111"/>
    <circle cx="32" cy="62" r="4" fill="#f9a8d4"/><circle cx="68" cy="62" r="4" fill="#f9a8d4"/>
    <path d="M44 64 q6 5 12 0" stroke="#4c1d95" stroke-width="3" fill="none" stroke-linecap="round"/>` },
  poussin: { nom: "Le Poussin-pétard", svg: `
    <ellipse cx="50" cy="60" rx="32" ry="30" fill="#ffd43b"/><ellipse cx="40" cy="48" rx="8" ry="6" fill="rgba(255,255,255,.45)"/>
    <path d="M50 30 q-2 -12 8 -18" stroke="#b7803c" stroke-width="4" fill="none"/>
    <g class="etincelle"><circle cx="59" cy="11" r="6" fill="#ff5b5b"/><circle cx="59" cy="11" r="3" fill="#fff"/></g>
    <path d="M20 62 q-10 -4 -6 -14 q6 6 12 4z M80 62 q10 -4 6 -14 q-6 6 -12 4z" fill="#fab005"/>
    <circle cx="40" cy="54" r="8" fill="#fff"/><circle cx="60" cy="54" r="8" fill="#fff"/>
    <circle cx="40" cy="55" r="4.5" fill="#111"/><circle cx="60" cy="55" r="4.5" fill="#111"/>
    <path d="M44 64 l6 8 l6 -8z" fill="#ff922b"/>
    <path d="M38 88 l-4 6 M42 88 l0 7 M58 88 l0 7 M62 88 l4 6" stroke="#ff922b" stroke-width="3" stroke-linecap="round"/>` },
};
const NOMS_BOMBES = Object.keys(BOMBES);
const svgBombe = (nom, classe = "") => `<svg class="bombe ${classe}" viewBox="0 0 100 100">${BOMBES[nom].svg}</svg>`;
const SVG_DRAPEAU = `<svg class="drapeau" viewBox="0 0 100 100"><rect x="30" y="14" width="7" height="72" rx="3" fill="#6b4a2b"/>
  <path d="M37 16 q20 -6 40 6 q-10 12 0 26 q-20 -10 -40 -4z" fill="#ff4d6d" stroke="#a61e3c" stroke-width="3"/>
  <ellipse cx="34" cy="88" rx="18" ry="5" fill="rgba(0,0,0,.25)"/></svg>`;
const SVG_KABOOM = `<svg class="kaboom" viewBox="0 0 200 200">
  <path d="M100 5 L118 55 L165 25 L148 75 L195 85 L152 108 L185 150 L132 135 L128 190 L100 148 L70 192 L68 138 L15 158 L48 112 L5 88 L52 74 L35 25 L82 55Z" fill="#ffdd33" stroke="#ff5b1f" stroke-width="8" stroke-linejoin="round"/>
  <text x="100" y="112" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-weight="900" font-size="34" fill="#e8311a" stroke="#fff" stroke-width="2">KABOOM!</text></svg>`;

document.getElementById("galerie").innerHTML = `<h3>Les bombes farceuses qui se cachent sous les cases</h3>
  <div>${NOMS_BOMBES.map((n) => `<figure>${svgBombe(n)}<figcaption>${BOMBES[n].nom}</figcaption></figure>`).join("")}</div>`;

// ------------------------------------------------------------ partie
const plateau = document.getElementById("plateau");
let partie = null, L = 0, H = 0, nbBombes = 0, mode = "facile";
let drapeaux = new Set(), vues = new Set(), fini = true, debut = 0, minuteur = null, modeDrapeau = false;

document.querySelectorAll("#ecran-mode button").forEach((b) => (b.onclick = () => exigerConnexion(() => lancer(b.dataset.mode))));
document.getElementById("btn-changer").onclick = () => {
  fini = true;
  clearInterval(minuteur);
  document.getElementById("ecran-jeu").classList.add("cache");
  document.getElementById("ecran-mode").classList.remove("cache");
};
const btnDrapeau = document.getElementById("btn-drapeau");
btnDrapeau.onclick = () => {
  modeDrapeau = !modeDrapeau;
  btnDrapeau.textContent = `🚩 Mode drapeau : ${modeDrapeau ? "oui" : "non"}`;
  btnDrapeau.classList.toggle("actif", modeDrapeau);
};

async function lancer(m) {
  mode = m;
  let r;
  try {
    r = await api("/api/demineur/debut", { mode });
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  partie = r.partie; L = r.largeur; H = r.hauteur; nbBombes = r.bombes;
  drapeaux = new Set(); vues = new Set(); fini = false; debut = 0;
  clearInterval(minuteur);
  document.getElementById("temps").textContent = "0";
  majRestantes();
  document.getElementById("ecran-mode").classList.add("cache");
  document.getElementById("ecran-jeu").classList.remove("cache");
  plateau.style.setProperty("--colonnes", L);
  plateau.className = `plateau-demineur ${mode}`;
  plateau.innerHTML = "";
  for (let y = 0; y < H; y++)
    for (let x = 0; x < L; x++) {
      const c = document.createElement("button");
      c.className = "tuile";
      c.dataset.x = x;
      c.dataset.y = y;
      plateau.append(c);
    }
}

const cle = (x, y) => `${x},${y}`;
const tuile = (x, y) => plateau.children[y * L + x];
function voisins(x, y) {
  const v = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
    if ((dx || dy) && x + dx >= 0 && x + dx < L && y + dy >= 0 && y + dy < H) v.push([x + dx, y + dy]);
  return v;
}
function majRestantes() { document.getElementById("restantes").textContent = nbBombes - drapeaux.size; }

function basculerDrapeau(x, y) {
  if (fini || vues.has(cle(x, y))) return;
  const t = tuile(x, y);
  if (drapeaux.delete(cle(x, y))) {
    t.innerHTML = "";
    t.classList.remove("avec-drapeau");
    Sons.jouer("boing");
  } else {
    drapeaux.add(cle(x, y));
    t.innerHTML = SVG_DRAPEAU;
    t.classList.add("avec-drapeau");
    Sons.jouer("drapeau");
  }
  majRestantes();
}

async function reveler(x, y) {
  if (fini || drapeaux.has(cle(x, y))) return;
  let cases;
  if (vues.has(cle(x, y))) {
    // clic sur un chiffre entouré d'assez de drapeaux : on découvre tous les voisins d'un coup
    const n = Number(tuile(x, y).dataset.n);
    const autour = voisins(x, y);
    if (!n || autour.filter(([a, b]) => drapeaux.has(cle(a, b))).length !== n) return;
    cases = autour.filter(([a, b]) => !drapeaux.has(cle(a, b)) && !vues.has(cle(a, b)));
    if (!cases.length) return;
  } else {
    cases = [[x, y]];
  }
  if (!debut) {
    debut = Date.now();
    minuteur = setInterval(() => (document.getElementById("temps").textContent = Math.floor((Date.now() - debut) / 1000)), 250);
  }
  let r;
  try {
    r = await api("/api/demineur/reveler", { partie, cases });
  } catch (e) {
    return;
  }
  afficherCases(r.cases, x, y);
  if (r.fin) terminer(r, x, y);
}

function afficherCases(liste, ox, oy) {
  liste.forEach(([x, y, n]) => {
    vues.add(cle(x, y));
    const t = tuile(x, y);
    const d = Math.hypot(x - ox, y - oy);
    setTimeout(() => {
      t.className = `tuile vue n${n}`;
      t.dataset.n = n;
      t.innerHTML = n ? `<span>${n}</span>` : "";
    }, d * 28);
  });
  if (liste.length > 8) { // cascade : une rafale de petits « pops »
    for (let i = 0; i < Math.min(8, liste.length / 4); i++) setTimeout(() => Sons.jouer("pop", 1 + i * .15), i * 60);
  } else if (liste.length) {
    Sons.jouer("pop", 1 + (liste[0][2] || 0) * .1);
  }
}

async function terminer(r, x, y) {
  fini = true;
  clearInterval(minuteur);
  const f = r.fin;
  const deBombe = () => NOMS_BOMBES[Math.floor(Math.random() * NOMS_BOMBES.length)];
  if (f.victoire) {
    // les bombes se montrent… endormies
    r.bombes.forEach(([bx, by], i) => setTimeout(() => {
      const t = tuile(bx, by);
      t.className = "tuile bombe-dodo";
      t.innerHTML = svgBombe(deBombe(), "dort") + `<span class="zzz">z</span>`;
      Sons.jouer("pop", 1.5);
    }, 300 + i * 70));
    await new Promise((ok) => setTimeout(ok, 600 + r.bombes.length * 70));
  } else {
    const [bx, by] = f.bombe;
    const t = tuile(bx, by);
    t.className = "tuile explosee";
    t.innerHTML = svgBombe(deBombe(), "boum") + SVG_KABOOM;
    Sons.jouer("kaboom");
    document.querySelector(".zone-demineur").classList.add("secousse");
    setTimeout(() => document.querySelector(".zone-demineur").classList.remove("secousse"), 700);
    const autres = r.bombes.filter(([a, b]) => a !== bx || b !== by);
    autres.forEach(([ax, ay], i) => setTimeout(() => {
      const tt = tuile(ax, ay);
      const bienVu = drapeaux.has(cle(ax, ay));
      tt.className = `tuile bombe-revelee ${bienVu ? "bien-vu" : ""}`;
      tt.innerHTML = svgBombe(deBombe());
      Sons.jouer("pop", .6 + Math.random() * .6);
    }, 1100 + i * 90));
    // drapeaux posés à tort
    drapeaux.forEach((k) => {
      if (!r.bombes.some(([a, b]) => cle(a, b) === k)) {
        const [a, b] = k.split(",").map(Number);
        tuile(a, b).classList.add("faux-drapeau");
      }
    });
    await new Promise((ok) => setTimeout(ok, 1600 + autres.length * 90));
  }
  afficherResultat({
    titre: f.victoire ? "Terrain déminé !" : "KABOOM !",
    emoji: f.victoire ? "😎" : "💥",
    victoire: f.victoire,
    lignes: f.victoire ? [`En ${f.secondes} secondes`] : ["Une bombe farceuse t'a eu…", f.pieces ? "Petit lot de consolation pour les cases découvertes" : ""].filter(Boolean),
    fin: f,
    rejouer: () => lancer(mode),
  });
}

// ------------------------------------------------------------ souris et doigt
plateau.addEventListener("click", (e) => {
  const t = e.target.closest(".tuile");
  if (!t) return;
  const x = Number(t.dataset.x), y = Number(t.dataset.y);
  if (modeDrapeau && !vues.has(cle(x, y))) basculerDrapeau(x, y);
  else reveler(x, y);
});
plateau.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const t = e.target.closest(".tuile");
  if (t) basculerDrapeau(Number(t.dataset.x), Number(t.dataset.y));
});
let appui = null;
plateau.addEventListener("touchstart", (e) => {
  const t = e.target.closest(".tuile");
  if (!t) return;
  appui = setTimeout(() => {
    appui = "long";
    basculerDrapeau(Number(t.dataset.x), Number(t.dataset.y));
    if (navigator.vibrate) navigator.vibrate(30);
  }, 380);
}, { passive: true });
plateau.addEventListener("touchend", (e) => {
  if (appui === "long") e.preventDefault(); // pas de clic après un appui long
  else clearTimeout(appui);
  appui = null;
});
plateau.addEventListener("touchmove", () => { clearTimeout(appui); appui = null; }, { passive: true });
