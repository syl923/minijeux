// Roue de la fortune : le serveur tire le secteur, la page anime la roue jusqu'à lui.

const canvas = document.getElementById("roue");
const ctx = canvas.getContext("2d");
const bouton = document.getElementById("btn-tourner");
const COULEURS = ["#ff5fa2", "#3ee0e8", "#8a5cf6", "#ffc93c", "#ff7a59", "#5be37d", "#e63b7a", "#ffd700"];
let secteurs = [];
let angle = 0;
let enRotation = false;

function dessiner() {
  const n = secteurs.length;
  const r = canvas.width / 2;
  const pas = (2 * Math.PI) / n;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // anneau extérieur
  ctx.beginPath();
  ctx.arc(r, r, r - 4, 0, 2 * Math.PI);
  ctx.fillStyle = "#2a1d5e";
  ctx.fill();
  for (let i = 0; i < n; i++) {
    const debut = -Math.PI / 2 + i * pas;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r - 34, debut, debut + pas);
    ctx.closePath();
    const g = ctx.createRadialGradient(r, r, 40, r, r, r - 34);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(.18, COULEURS[i % COULEURS.length]);
    g.addColorStop(1, COULEURS[i % COULEURS.length]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(debut + pas / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const m = secteurs[i];
    ctx.font = `900 ${m >= 5 ? 92 : 76}px Trebuchet MS, sans-serif`;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(40, 20, 80, .55)";
    const texte = "x" + String(m).replace(".", ",");
    ctx.strokeText(texte, r - 70, 0);
    ctx.fillStyle = "#fff";
    ctx.fillText(texte, r - 70, 0);
    ctx.restore();
  }
  // ampoules
  for (let i = 0; i < n * 3; i++) {
    const a = (i / (n * 3)) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(r + Math.cos(a) * (r - 18), r + Math.sin(a) * (r - 18), 9, 0, 2 * Math.PI);
    ctx.fillStyle = i % 2 ? "#ffe07a" : "#fff";
    ctx.fill();
  }
}

function majBouton(j) {
  if (enRotation) return;
  const etat = document.getElementById("etat-mult");
  if (!j) {
    bouton.textContent = "🎡 Tourner la roue";
    etat.textContent = "";
    return;
  }
  bouton.innerHTML = j.tour_gratuit
    ? "🎁 Tour gratuit du jour"
    : `🎡 Relancer pour ${j.prix_tour} <i class="piece"></i>`;
  bouton.disabled = !j.tour_gratuit && j.pieces < j.prix_tour;
  etat.innerHTML = j.mult_parties > 0
    ? `Multiplicateur actif : <b class="gain">${formatMult(j.mult)}</b> sur tes ${j.mult_parties} prochaine(s) partie(s).`
    : "Aucun multiplicateur actif.";
}
MJ.surChangement.push(majBouton);

bouton.onclick = () => exigerConnexion(async () => {
  if (enRotation) return;
  let r;
  try {
    r = await api("/api/roue/tourner", {});
  } catch (e) {
    return alert(e.message);
  }
  enRotation = true;
  bouton.disabled = true;
  // Le secteur i est centré à (i + 0,5) × pas (sens horaire depuis le haut) : on le ramène sous la flèche.
  const pas = 360 / secteurs.length;
  const cible = 360 - (r.secteur + .5) * pas + (Math.random() - .5) * pas * .6;
  const actuel = ((angle % 360) + 360) % 360;
  angle += 360 * 6 + ((cible - actuel + 360) % 360);
  canvas.style.transition = "transform 5.5s cubic-bezier(.12, .8, .15, 1)";
  canvas.style.transform = `rotate(${angle}deg)`;
  setTimeout(() => {
    enRotation = false;
    const gagne = r.mult > 1;
    ouvrirFenetre(`
      <p class="gros">${gagne ? (r.mult >= 5 ? "🤩" : "🎉") : "😅"}</p>
      <h2>${gagne ? `Multiplicateur ${formatMult(r.mult)} !` : "Pas de chance…"}</h2>
      <p class="doux">${gagne
        ? (r.joueur.mult === r.mult
            ? `Tes pièces d'or seront multipliées par ${String(r.mult).replace(".", ",")} pendant tes ${r.joueur.mult_parties} prochaines parties.`
            : `Ton multiplicateur actuel (${formatMult(r.joueur.mult)}) est plus fort : on le garde.`)
        : "x1 : tes gains restent normaux. Reviens demain pour un nouveau tour gratuit !"}</p>
      <div class="actions"><a class="bouton" href="/">Jouer maintenant</a></div>`);
    if (r.mult >= 3) confettis();
    majJoueur(r.joueur);
  }, 5700);
});

api("/api/roue").then((c) => {
  secteurs = c.secteurs;
  document.getElementById("prix").textContent = c.prix;
  document.getElementById("nb-parties").textContent = c.parties;
  dessiner();
});
