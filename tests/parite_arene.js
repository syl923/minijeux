// Rejoue une manche scriptée avec le moteur JavaScript de Stickman Arena (comparée au moteur Python par test_api.py).
const { arNouveau, arPas } = require(require("path").join(__dirname, "..", "public", "assets", "arene-sim.js"));
const graine = Number(process.argv[2]);
const sim = arNouveau(graine, ["A", "B", "C", "D"]);
function entree(i, t) {  // commandes scriptées identiques des deux côtés
  const c = (t * 7 + i * 13) % 97;
  return { g: c < 30 ? 1 : 0, d: c > 60 ? 1 : 0, b: c % 23 === 0 ? 1 : 0, t: (t + i) % 5 < 3 ? 1 : 0,
    saut: Math.floor((t + i * 11) / 37), ax: ((t * 31 + i * 17) % 2001) - 1000, ay: ((t * 13 + i * 29) % 1201) - 600 };
}
for (let t = 0; t < 4000; t++) { sim.joueurs.forEach((j) => (j.entree = entree(j.i, t))); arPas(sim); }
console.log(JSON.stringify(sim));
