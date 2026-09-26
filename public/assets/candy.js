// Bonbons Folies : la page affiche et anime ; le serveur résout les alignements et les cascades.

const plateau = document.getElementById("plateau");
const annonce = document.getElementById("annonce");
const N = 8;
let partie = null, grille = null, occupe = false, choisi = null, score = 0;
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const MOTS_CASCADE = ["", "", "Délicieux !", "Sucré !", "Divin !", "Bonbonesque !", "SUCRE-FOU !"];

document.getElementById("btn-jouer").onclick = () => exigerConnexion(lancer);

async function lancer() {
  let r;
  try {
    r = await api("/api/candy/debut", {});
  } catch (e) {
    return erreurLancement(e);
  }
  majJoueur(r.joueur);
  partie = r.partie; grille = r.grille; score = 0; choisi = null; occupe = false;
  document.getElementById("score").textContent = "0";
  document.getElementById("coups").textContent = r.coups;
  document.getElementById("surcouche").classList.add("cache");
  dessiner(null, true);
  Sons.musique.jouer("sucre");
}

// ------------------------------------------------------------ affichage
function caseEl(x, y) { return plateau.children[y * N + x]; }

function dessiner(chute = null, entree = false) {
  plateau.innerHTML = "";
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const [c, s] = grille[y][x];
      const d = document.createElement("div");
      d.className = "case-c";
      d.dataset.x = x;
      d.dataset.y = y;
      const b = document.createElement("span");
      b.className = `bonbon ${c < 0 ? "cB" : "c" + c} ${s ? "s" + s : ""}`;
      const h = entree ? N - y + 2 : chute ? chute[y][x] : 0;
      if (h) {
        b.style.transform = `translateY(${-h * 110}%)`;
        b.style.transition = "none";
        requestAnimationFrame(() => requestAnimationFrame(() => {
          b.style.transition = `transform ${0.18 + h * 0.05}s cubic-bezier(.4, 1.5, .6, 1)`;
          b.style.transform = "";
        }));
      }
      d.append(b);
      plateau.append(d);
    }
}

function flotter(x, y, texte, classe = "") {
  const r = caseEl(x, y).getBoundingClientRect();
  const t = document.createElement("span");
  t.className = `points-flottants ${classe}`;
  t.textContent = texte;
  t.style.left = r.left + r.width / 2 + "px";
  t.style.top = r.top + "px";
  document.body.append(t);
  setTimeout(() => t.remove(), 1000);
}

function crier(texte) {
  annonce.textContent = texte;
  annonce.classList.remove("montre");
  void annonce.offsetWidth;
  annonce.classList.add("montre");
}

// ------------------------------------------------------------ échanges
function decalage(a, b) {
  const ra = caseEl(...a).getBoundingClientRect(), rb = caseEl(...b).getBoundingClientRect();
  return [rb.left - ra.left, rb.top - ra.top];
}

async function animerEchange(a, b, retour = false) {
  const [dx, dy] = decalage(a, b);
  const ba = caseEl(...a).firstChild, bb = caseEl(...b).firstChild;
  for (const [el, sx, sy] of [[ba, dx, dy], [bb, -dx, -dy]]) {
    el.style.transition = "transform .18s ease";
    el.style.transform = `translate(${sx}px, ${sy}px)`;
  }
  await attendre(190);
  if (retour) {
    for (const el of [ba, bb]) el.style.transform = "";
    await attendre(190);
  }
}

async function echanger(a, b) {
  if (occupe || !partie) return;
  occupe = true;
  choisi = null;
  plateau.querySelectorAll(".choisi").forEach((c) => c.classList.remove("choisi"));
  Sons.jouer("clic");
  await animerEchange(a, b);
  let r;
  try {
    r = await api("/api/candy/echanger", { partie, a, b });
  } catch (e) {
    occupe = false;
    return dessiner();
  }
  if (!r.valide) {
    Sons.jouer("rate");
    const [dx, dy] = decalage(a, b);
    const ba = caseEl(...a).firstChild, bb = caseEl(...b).firstChild;
    ba.style.transform = ""; bb.style.transform = "";
    caseEl(...a).classList.add("refus"); caseEl(...b).classList.add("refus");
    await attendre(350);
    occupe = false;
    return dessiner();
  }
  // on garde la grille échangée à l'écran avant les étapes
  const tmp = grille[a[1]][a[0]]; grille[a[1]][a[0]] = grille[b[1]][b[0]]; grille[b[1]][b[0]] = tmp;
  dessiner();
  for (const e of r.etapes) {
    e.retire.forEach(([x, y]) => caseEl(x, y).firstChild.classList.add("croque"));
    e.speciaux.forEach(([x, y]) => caseEl(x, y).classList.add("naissance"));
    Sons.jouer("pop", 1 + (e.cascade - 1) * .18);
    if (e.speciaux.length) { Sons.jouer("bonus"); mokaDit(["Un bonbon spécial, miam !", "Oh la belle friandise !"][Math.floor(Math.random() * 2)], "etoiles", 1600); }
    else if (e.cascade === 3) mokaDit("Cascade sucrée !", "content", 1400);
    else if (e.cascade >= 5) mokaDit("DÉLICIEUX ! Quelle cascade !", "etoiles", 1800);
    if (e.retire.length >= 12) Sons.jouer("explosion");
    if (e.retire.length) {
      const [mx, my] = e.retire[Math.floor(e.retire.length / 2)];
      flotter(mx, my, "+" + e.points, e.cascade > 1 ? "gros" : "");
    }
    if (MOTS_CASCADE[Math.min(e.cascade, 6)]) crier(MOTS_CASCADE[Math.min(e.cascade, 6)]);
    score += e.points;
    document.getElementById("score").textContent = score;
    await attendre(280);
    grille = e.grille;
    dessiner(e.chute);
    await attendre(330);
  }
  if (r.melange) {
    crier("Mélange !");
    grille = r.melange;
    await attendre(400);
    dessiner(null, true);
    await attendre(500);
  }
  document.getElementById("coups").textContent = r.coups;
  document.getElementById("coups").parentElement.classList.toggle("urgent", r.coups <= 5);
  occupe = false;
  if (r.fin) {
    partie = null;
    Sons.musique.arreter();
    crier("Terminé !");
    await attendre(900);
    document.getElementById("surcouche").classList.remove("cache");
    afficherResultat({
      titre: "Plus de coups !",
      emoji: r.fin.score >= 5000 ? "🏆" : "🍭",
      victoire: true,
      lignes: [`${r.fin.score} points en 20 coups`],
      fin: r.fin,
      rejouer: lancer,
    });
  }
}

// souris / doigt : cliquer deux bonbons voisins, ou glisser un bonbon vers son voisin
let depart = null;
plateau.addEventListener("pointerdown", (e) => {
  const c = e.target.closest(".case-c");
  if (!c || occupe || !partie) return;
  const p = [Number(c.dataset.x), Number(c.dataset.y)];
  depart = { p, x: e.clientX, y: e.clientY };
  if (choisi && Math.abs(choisi[0] - p[0]) + Math.abs(choisi[1] - p[1]) === 1) {
    const a = choisi;
    depart = null;
    return echanger(a, p);
  }
  plateau.querySelectorAll(".choisi").forEach((x) => x.classList.remove("choisi"));
  choisi = p;
  c.classList.add("choisi");
});
plateau.addEventListener("pointermove", (e) => {
  if (!depart) return;
  const dx = e.clientX - depart.x, dy = e.clientY - depart.y;
  if (Math.hypot(dx, dy) < 22) return;
  const [x, y] = depart.p;
  const b = Math.abs(dx) > Math.abs(dy) ? [x + Math.sign(dx), y] : [x, y + Math.sign(dy)];
  depart = null;
  if (b[0] >= 0 && b[0] < N && b[1] >= 0 && b[1] < N) echanger([x, y], b);
});
document.addEventListener("pointerup", () => (depart = null));

// grille de démonstration derrière l'écran d'accueil
grille = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => [(x * 7 + y * 3 + (x * y) % 5) % 6, ""]));
dessiner();
