// Moka sous toutes ses formes : avatars des joueurs et tenues de la mascotte dans chaque jeu.
// Tout est dessiné ici en SVG (dessins originaux) à partir d'une même tête de singe
// à laquelle on change les yeux, la bouche, le chapeau, les lunettes et l'habit.

const FOURRURES = {
  brun: ["#9c6433", "#7a4a1f"], dore: ["#f2b632", "#c98a0c"], gris: ["#8a8f98", "#5f6570"],
  noir: ["#3b3232", "#1f1a1a"], rose: ["#f09ac0", "#c96d96"], blanc: ["#efe9df", "#c4baa9"],
  zombie: ["#7fa36b", "#557a45"], bleu: ["#5b8fd6", "#3d6bb0"], violet: ["#8e6bd1", "#6446a8"],
};
const PEAU = "#f3d3a6";
const ENCRE = "#2b1a0e";

// ------------------------------------------------------------ yeux (centres 49,57 et 71,57)
function oeil(type, x, y, cote) {
  const pupille = (dx = 1, dy = 2, r = 3.8, c = ENCRE) =>
    `<circle cx="${x + dx}" cy="${y + dy}" r="${r}" fill="${c}"/><circle cx="${x + dx + 1.4}" cy="${y + dy - 1.8}" r="1.3" fill="#fff"/>`;
  const blanc = (rx = 6.5, ry = 8) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff"/>`;
  const trait = (d, w = 3) => `<path d="${d}" fill="none" stroke="${ENCRE}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  switch (type) {
    case "content": return trait(`M${x - 6} ${y + 2} q6 -8 12 0`);
    case "ferme": return trait(`M${x - 6} ${y} q6 6 12 0`);
    case "triste": return blanc() + pupille(0, 3.5) + `<path d="M${x - 8} ${y - 9} L${x + 8} ${y - 9} L${x + (cote < 0 ? 8 : -8)} ${y - 2} z" fill="${PEAU}"/>`;
    case "choc": return blanc(8, 10) + `<circle cx="${x}" cy="${y}" r="2.2" fill="${ENCRE}"/>`;
    case "coeur": return `<path d="M${x} ${y + 7} l-7 -7 a4 4 0 0 1 7 -5 a4 4 0 0 1 7 5 z" fill="#e8364f" stroke="#a61e36" stroke-width="1"/>`;
    case "spirale": return blanc(7.5, 8.5) + trait(`M${x} ${y} m-1 0 a1 1 0 1 1 2 0 a2.5 2.5 0 1 1 -5 0 a4 4 0 1 1 8 0 a5.5 5.5 0 1 1 -11 0`, 1.6);
    case "etoile": return `<path d="M${x} ${y - 8} l2.4 5.6 6 .5 -4.6 4 1.4 6 -5.2 -3.2 -5.2 3.2 1.4 -6 -4.6 -4 6 -.5z" fill="#ffd43b" stroke="#c98a00" stroke-width="1"/>`;
    case "croix": return trait(`M${x - 5} ${y - 5} l10 10 M${x + 5} ${y - 5} l-10 10`);
    case "mdr": return trait(cote < 0 ? `M${x - 6} ${y - 5} l10 5 -10 5` : `M${x + 6} ${y - 5} l-10 5 10 5`);
    case "fente": return trait(`M${x - 6} ${y} h12`);
    case "rouge": return blanc() + pupille(1, 2, 3.8, "#d6182b");
    case "zombie": return blanc(6.5, 8) + (cote < 0 ? `<circle cx="${x - 1}" cy="${y + 1}" r="1.8" fill="${ENCRE}"/>` : pupille(1, 3, 3));
    case "clin": return cote < 0 ? blanc() + pupille() : trait(`M${x - 6} ${y + 2} q6 -7 12 0`);
    case "malin": return blanc(6.5, 6) + pupille(2, 1.5, 3.4) + `<path d="M${x - 8} ${y - 8} h16 v5 h-16z" fill="${PEAU}"/>`;
    default: return blanc() + pupille();
  }
}

function yeux(type) {
  return oeil(type, 49, 57, -1) + oeil(type, 71, 57, 1);
}

function sourcils(type) {
  const t = (d) => `<path d="${d}" fill="none" stroke="#4a2a10" stroke-width="3.2" stroke-linecap="round"/>`;
  switch (type) {
    case "colere": return t("M40 42 l14 7") + t("M80 42 l-14 7");
    case "triste": return t("M40 47 l13 -6") + t("M80 47 l-13 -6");
    case "haut": return t("M41 40 q8 -6 15 -1") + t("M79 40 q-8 -6 -15 -1");
    case "malin": return t("M41 45 l13 -3") + t("M79 41 l-13 5");
    default: return "";
  }
}

// ------------------------------------------------------------ bouches (autour de 60,80)
function bouche(type) {
  const trait = (d, w = 3) => `<path d="${d}" fill="none" stroke="#6b3d17" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  switch (type) {
    case "grand": return `<path d="M44 77 q16 22 32 0 z" fill="#8f1d1d"/><path d="M46 78 h28 l-2 4 h-24z" fill="#fff"/><path d="M52 90 q8 -6 16 0 q-8 4 -16 0" fill="#ff8787"/>`;
    case "ferme": return trait("M50 80 q10 7 20 0");
    case "triste": return trait("M50 87 q10 -9 20 0");
    case "o": return `<ellipse cx="60" cy="84" rx="5" ry="6.5" fill="#8f1d1d"/>`;
    case "langue": return trait("M47 79 q13 10 26 0") + `<path d="M58 84 q0 12 8 12 q7 0 6 -12 z" fill="#ff6b8b" stroke="#c2255c" stroke-width="1.5"/>`;
    case "zigzag": return trait("M47 84 l4 -3 4 3 4 -3 4 3 4 -3 4 3", 2.5);
    case "crocs": return trait("M48 80 q12 8 24 0") + `<path d="M51 82 l2 7 2 -6z M65 82 l2 6 2 -7z" fill="#fff" stroke="#999" stroke-width=".6"/>`;
    case "dents": return `<rect x="47" y="78" width="26" height="9" rx="4" fill="#fff" stroke="#6b3d17" stroke-width="2"/><path d="M53 78 v9 M60 78 v9 M67 78 v9" stroke="#bbb" stroke-width="1.2"/>`;
    case "grogne": return trait("M49 86 q11 -6 22 0") + `<path d="M53 84 l2 -3 2 3z M63 84 l2 -3 2 3z" fill="#fff"/>`;
    case "sourire_en_coin": return trait("M49 82 q12 6 22 -4");
    case "tetine": return `<circle cx="60" cy="84" r="9" fill="#74c0fc" stroke="#1c7ed6" stroke-width="2"/><circle cx="60" cy="84" r="4" fill="#e7f5ff"/><path d="M60 93 a5 5 0 1 0 0.1 0" fill="none" stroke="#1c7ed6" stroke-width="2"/>`;
    case "moustache": return `<path d="M60 80 q-8 -6 -18 2 q8 -2 10 3 q4 -1 8 -5 q4 4 8 5 q2 -5 10 -3 q-10 -8 -18 -2z" fill="#4a2a10"/>` + trait("M53 88 q7 4 14 0", 2.5);
    default: return `<path d="M47 78 q13 13 26 0 z" fill="#c92a2a"/><path d="M53 83 q7 5 14 0" fill="#ff8787"/>`;
  }
}

// ------------------------------------------------------------ chapeaux (haut de tête vers y = 26)
function chapeau(type) {
  switch (type) {
    case "casquette": return `<path d="M27 42 q33 -36 66 0 q-33 -9 -66 0z" fill="#e03131"/><path d="M27 42 q-12 2 -16 8 q14 2 28 -6z" fill="#c92a2a"/>
      <circle cx="60" cy="14" r="3.5" fill="#fff"/><text x="60" y="36" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="Arial Black, sans-serif">MJ</text>`;
    case "capitaine": return `<path d="M26 36 q34 -32 68 0 v8 h-68z" fill="#fff" stroke="#c9c9c9" stroke-width="1.5"/><rect x="26" y="36" width="68" height="8" fill="#1d3557"/>
      <path d="M28 44 q32 12 64 0 q-32 5 -64 0" fill="#111"/><circle cx="60" cy="30" r="6" fill="#f2c230" stroke="#b8860b" stroke-width="1.5"/>
      <path d="M60 26 v8 M56 31 q4 4 8 0" stroke="#7a5a00" stroke-width="1.6" fill="none"/><path d="M40 44 q20 -4 40 0" stroke="#f2c230" stroke-width="2" fill="none"/>`;
    case "toque": return `<rect x="40" y="20" width="40" height="20" fill="#fff" stroke="#ddd"/><circle cx="44" cy="20" r="11" fill="#fff"/><circle cx="60" cy="13" r="13" fill="#fff"/>
      <circle cx="76" cy="20" r="11" fill="#fff"/><rect x="38" y="34" width="44" height="8" rx="2" fill="#f1f3f5" stroke="#ced4da"/>`;
    case "chantier": return `<path d="M27 42 q33 -44 66 0z" fill="#ffc933" stroke="#e0a100" stroke-width="2"/><rect x="22" y="40" width="76" height="6" rx="3" fill="#f5b700"/>
      <path d="M60 10 v30" stroke="#e0a100" stroke-width="5"/><circle cx="60" cy="24" r="6" fill="#fff9c4" stroke="#aaa" stroke-width="1.5"/><circle cx="60" cy="24" r="10" fill="#fff59d" opacity=".35"/>`;
    case "magicien": return `<path d="M32 38 L64 3 L88 38 z" fill="#5f3dc4"/><ellipse cx="60" cy="38" rx="36" ry="7" fill="#4527a0"/>
      <path d="M56 20 l1.5 3.5 3.8 .3 -2.9 2.5 .9 3.7 -3.3 -2 -3.3 2 .9 -3.7 -2.9 -2.5 3.8 -.3z" fill="#ffd43b"/><circle cx="72" cy="28" r="2" fill="#ffd43b"/><circle cx="48" cy="32" r="1.6" fill="#ffd43b"/>`;
    case "couronne": return `<path d="M34 36 l5 -20 9 10 12 -16 12 16 9 -10 5 20 z" fill="#ffd43b" stroke="#c98a00" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="60" cy="28" r="3.5" fill="#e03131"/><circle cx="46" cy="30" r="2.5" fill="#339af0"/><circle cx="74" cy="30" r="2.5" fill="#51cf66"/><rect x="34" y="34" width="52" height="5" fill="#f2b632"/>`;
    case "crete": return `<path d="M46 32 l2 -24 7 15 5 -20 5 20 7 -15 2 24z" fill="#ffd43b" stroke="#c98a00" stroke-width="1.5" stroke-linejoin="round"/>`;
    case "bandeau": return `<path d="M26 44 q34 -10 68 0 v7 q-34 -9 -68 0z" fill="#1a1a2e"/><path d="M92 46 q10 2 14 10 q-8 -2 -12 -4 M92 48 q8 6 8 14" stroke="#1a1a2e" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case "tricorne": return `<path d="M20 40 q40 -44 80 0 q-40 -14 -80 0z" fill="#212529"/><path d="M20 40 q40 -14 80 0" stroke="#f2c230" stroke-width="2.5" fill="none"/>
      <circle cx="60" cy="26" r="5" fill="#fff"/><path d="M57 25 h1.5 M61.5 25 h1.5 M58 29 h4" stroke="#212529" stroke-width="1.4"/>`;
    case "cowboy": return `<path d="M40 36 q0 -24 20 -22 q20 -2 20 22z" fill="#a0632b"/><path d="M40 32 h40 v4 h-40z" fill="#5c3310"/>
      <ellipse cx="60" cy="38" rx="42" ry="7" fill="#8d5524"/><path d="M18 36 q-2 -8 6 -8 M102 36 q2 -8 -6 -8" stroke="#8d5524" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    case "bonnet_nuit": return `<path d="M28 42 q20 -40 52 -26 q18 10 22 34 l-6 2 q-6 -16 -16 -18 q-26 -6 -52 8z" fill="#4dabf7"/>
      <path d="M28 42 q30 -12 60 -4" stroke="#fff" stroke-width="5" fill="none"/><circle cx="100" cy="54" r="6" fill="#fff"/>`;
    case "casquette_envers": return `<path d="M28 42 q32 -36 64 0 q-32 -8 -64 0z" fill="#212529"/><path d="M26 38 q-14 -6 -18 2 q10 4 20 2z" fill="#343a40"/>
      <text x="60" y="36" text-anchor="middle" font-size="9" font-weight="900" fill="#ffd43b" font-family="Arial Black, sans-serif">MJ</text>`;
    case "corne": return `<path d="M60 2 l6 28 h-12z" fill="#ffe066" stroke="#e0a100" stroke-width="1.5"/><path d="M56 22 l8 -3 M57 15 l6 -2 M58 9 l4 -1" stroke="#e0a100" stroke-width="1.2"/>
      <path d="M30 40 q-6 -14 6 -20 q2 10 10 12z" fill="#f783ac"/><path d="M84 40 q8 -12 0 -22 q-4 10 -12 12z" fill="#b197fc"/>`;
    case "explorateur": return `<path d="M27 42 q33 -44 66 0z" fill="#d8c08a"/><rect x="28" y="34" width="64" height="6" fill="#8d6e3a"/>
      <ellipse cx="60" cy="43" rx="44" ry="6" fill="#c9ae70"/>`;
    case "bonnet": return `<path d="M27 44 q33 -44 66 0z" fill="#e03131"/><rect x="25" y="38" width="70" height="10" rx="5" fill="#fff"/>
      <path d="M36 32 h48 M40 24 h40" stroke="#ff8787" stroke-width="3"/><circle cx="60" cy="10" r="7" fill="#fff"/>`;
    case "universitaire": return `<path d="M34 40 q26 -14 52 0 v-8 q-26 -10 -52 0z" fill="#212529"/><path d="M22 24 l38 -12 38 12 -38 12z" fill="#343a40"/>
      <path d="M60 24 l24 6 v14" stroke="#ffd43b" stroke-width="2" fill="none"/><circle cx="84" cy="46" r="3" fill="#ffd43b"/>`;
    case "meche": return `<path d="M58 28 q-10 -12 2 -16 q8 -2 6 6 q-2 4 -6 2" fill="none" stroke="#7a4a1f" stroke-width="3.5" stroke-linecap="round"/>`;
    case "ebouriffe": return `<path d="M34 36 l-6 -14 12 6 2 -14 8 12 6 -16 6 16 8 -12 2 14 12 -6 -6 14z" fill="#7a4a1f"/>`;
    case "pointe": return `<path d="M36 36 q24 -6 48 0 l-24 12z" fill="#1f1a1a"/>`;
    case "aureole": return `<ellipse cx="60" cy="14" rx="22" ry="6" fill="none" stroke="#ffe066" stroke-width="4"/>`;
    default: return "";
  }
}

// ------------------------------------------------------------ lunettes et masques
function lunettes(type) {
  switch (type) {
    case "soleil": return `<path d="M36 50 h26 v6 q-1 10 -12 10 q-12 0 -14 -10z M58 50 h26 l-2 6 q-2 10 -12 10 q-11 0 -12 -10z" fill="#111"/>
      <path d="M40 54 l6 -3 M62 54 l6 -3" stroke="#6ab7ff" stroke-width="2"/><path d="M26 52 h10 M84 52 h10" stroke="#111" stroke-width="3"/>`;
    case "rondes": return `<circle cx="49" cy="57" r="10.5" fill="rgba(255,255,255,.18)" stroke="#343a40" stroke-width="2.6"/>
      <circle cx="71" cy="57" r="10.5" fill="rgba(255,255,255,.18)" stroke="#343a40" stroke-width="2.6"/><path d="M59 56 q1 -3 2 0 M38 55 l-12 -2 M82 55 l12 -2" stroke="#343a40" stroke-width="2.4" fill="none"/>`;
    case "etoile": return [49, 71].map((x) => `<path d="M${x} 44 l3.6 8 8.7 .8 -6.6 5.8 2 8.5 -7.7 -4.6 -7.7 4.6 2 -8.5 -6.6 -5.8 8.7 -.8z" fill="rgba(255,105,180,.35)" stroke="#e64980" stroke-width="2.4" stroke-linejoin="round"/>`).join("");
    case "aviateur": return `<path d="M24 52 q36 -10 72 0" stroke="#6b3d17" stroke-width="7" fill="none"/>
      <circle cx="47" cy="54" r="10" fill="#74c0fc" stroke="#8d6e3a" stroke-width="4"/><circle cx="73" cy="54" r="10" fill="#74c0fc" stroke="#8d6e3a" stroke-width="4"/>
      <path d="M42 50 l5 -2 M68 50 l5 -2" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`;
    case "cache_oeil": return `<path d="M30 42 L92 62" stroke="#111" stroke-width="2.5"/><ellipse cx="71" cy="57" rx="9" ry="9.5" fill="#111"/>`;
    case "masque_ninja": return `<path d="M30 66 q30 -10 60 0 q2 24 -30 28 q-32 -4 -30 -28z" fill="#1a1a2e"/>`;
    case "casque_astro": return `<circle cx="60" cy="60" r="50" fill="rgba(165,216,255,.22)" stroke="#e9ecef" stroke-width="5"/>
      <path d="M26 40 q10 -22 34 -26" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>`;
    default: return "";
  }
}

// ------------------------------------------------------------ habits (épaules en bas du dessin)
const EPAULES = "M12 122 C14 100 36 93 60 93 C84 93 106 100 108 122 Z";
function habit(type, couleur) {
  const base = (c) => `<path d="${EPAULES}" fill="${c}"/>`;
  switch (type) {
    case "capitaine": return base("#1d3557") + `<path d="M60 93 l-10 29 M60 93 l10 29" stroke="#fff" stroke-width="2"/>
      <circle cx="52" cy="108" r="2.4" fill="#f2c230"/><circle cx="68" cy="108" r="2.4" fill="#f2c230"/><circle cx="52" cy="117" r="2.4" fill="#f2c230"/><circle cx="68" cy="117" r="2.4" fill="#f2c230"/>
      <path d="M18 104 q10 -8 22 -7 v5 q-12 0 -22 6z M102 104 q-10 -8 -22 -7 v5 q12 0 22 6z" fill="#f2c230"/>`;
    case "blouse": return base("#f8f9fa") + `<path d="M60 93 l-12 29 M60 93 l12 29" stroke="#ced4da" stroke-width="2"/><path d="M50 96 l10 6 10 -6 v8 l-10 -6 -10 6z" fill="#e03131"/>`;
    case "doudoune": return base("#e03131") + `<path d="M16 108 q44 -8 88 0 M13 118 q47 -8 94 0" stroke="#b02525" stroke-width="2.5" fill="none"/>
      <path d="M40 94 q20 12 40 0 v8 q-20 8 -40 0z" fill="#c92a2a"/><path d="M60 102 v20" stroke="#868e96" stroke-width="2.5"/>`;
    case "chef": return base("#fff") + `<circle cx="52" cy="104" r="2" fill="#adb5bd"/><circle cx="68" cy="104" r="2" fill="#adb5bd"/><circle cx="52" cy="114" r="2" fill="#adb5bd"/><circle cx="68" cy="114" r="2" fill="#adb5bd"/>
      <path d="M44 94 l16 8 16 -8" stroke="#dee2e6" stroke-width="3" fill="none"/>`;
    case "roi": return base("#c92a2a") + `<path d="M22 100 q38 -14 76 0 v8 q-38 -12 -76 0z" fill="#fff"/><circle cx="34" cy="102" r="1.6" fill="#111"/><circle cx="50" cy="98" r="1.6" fill="#111"/><circle cx="70" cy="98" r="1.6" fill="#111"/><circle cx="86" cy="102" r="1.6" fill="#111"/>`;
    case "astronaute": return base("#f1f3f5") + `<rect x="36" y="104" width="16" height="10" rx="2" fill="#339af0"/><path d="M68 106 q6 -6 12 0 q-6 8 -12 0" fill="#ffd43b"/>
      <path d="M30 96 q30 10 60 0" stroke="#adb5bd" stroke-width="4" fill="none"/>`;
    case "ninja": return base("#1a1a2e") + `<path d="M46 93 l14 18 14 -18" stroke="#495057" stroke-width="3" fill="none"/><path d="M14 112 h92" stroke="#c92a2a" stroke-width="4"/>`;
    case "vampire": return `<path d="M8 122 L20 70 L44 94 z M112 122 L100 70 L76 94 z" fill="#c92a2a" stroke="#6b0f1a" stroke-width="2"/>` + base("#111") +
      `<path d="M52 94 l8 10 8 -10" fill="#fff"/><circle cx="60" cy="108" r="3" fill="#c92a2a"/>`;
    case "cowboy": return base("#8d5524") + `<path d="M40 94 l20 14 20 -14 l-6 -2 -14 8 -14 -8z" fill="#e03131"/><path d="M60 108 v14" stroke="#5c3310" stroke-width="2"/>`;
    case "rappeur": return base("#212529") + `<path d="M40 96 q20 26 40 0" stroke="#ffd43b" stroke-width="3.5" fill="none" stroke-dasharray="4 2"/>
      <circle cx="60" cy="112" r="7" fill="#ffd43b" stroke="#c98a00" stroke-width="2"/><text x="60" y="115" text-anchor="middle" font-size="7" font-weight="900" fill="#8a5a00">MJ</text>`;
    case "zombie": return base("#6c7a5c") + `<path d="M24 122 l6 -10 6 10 6 -8 5 8 M78 122 l5 -9 6 9 6 -10 5 10" fill="#3c4a2e"/><path d="M44 104 l6 6 M70 102 l-4 8" stroke="#3c4a2e" stroke-width="2"/>`;
    case "gilet": return base("#495057") + `<path d="M30 97 q30 -4 60 0 l6 25 h-72z" fill="#ff922b"/><path d="M27 108 h66 M25 116 h70" stroke="#e9ecef" stroke-width="4"/><path d="M60 95 v27" stroke="#495057" stroke-width="3"/>`;
    case "cuir": return base("#212529") + `<path d="M60 93 l-14 29 M60 93 l14 29" stroke="#495057" stroke-width="3"/><path d="M46 94 l14 10 14 -10 l-2 -4 -12 8 -12 -8z" fill="#343a40"/>
      <circle cx="42" cy="110" r="2" fill="#ced4da"/><circle cx="78" cy="110" r="2" fill="#ced4da"/>`;
    case "robe": return base("#5f3dc4") + `<path d="M36 104 l1.4 3 3.2 .3 -2.4 2 .8 3 -3 -1.6 -3 1.6 .8 -3 -2.4 -2 3.2 -.3z M82 110 l1.2 2.6 2.8 .3 -2.1 1.8 .7 2.7 -2.6 -1.5 -2.6 1.5 .7 -2.7 -2.1 -1.8 2.8 -.3z" fill="#ffd43b"/>`;
    case "marin": return base("#fff") + `<path d="M16 104 h88 M13 112 h94 M12 120 h96" stroke="#1c7ed6" stroke-width="4"/>`;
    case "safari": return base("#c9ae70") + `<path d="M60 93 l-8 29 M60 93 l8 29" stroke="#8d6e3a" stroke-width="2"/><rect x="34" y="104" width="12" height="10" rx="2" fill="#b39658" stroke="#8d6e3a"/><rect x="74" y="104" width="12" height="10" rx="2" fill="#b39658" stroke="#8d6e3a"/>`;
    case "combi": return base("#ff922b") + `<path d="M60 96 v26" stroke="#d9480f" stroke-width="3"/><rect x="66" y="104" width="14" height="8" rx="2" fill="#fff"/><path d="M30 98 q30 8 60 0" stroke="#d9480f" stroke-width="3" fill="none"/>`;
    case "maillot": return base(couleur || "#1c7ed6") + `<path d="M44 94 q16 10 32 0" stroke="#fff" stroke-width="3" fill="none"/><text x="60" y="118" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="Arial Black, sans-serif">7</text>`;
    case "bebe": return base("#ffc9e3") + `<path d="M40 96 q20 14 40 0 q-2 10 -20 12 q-18 -2 -20 -12z" fill="#fff" stroke="#f783ac" stroke-width="1.5"/>`;
    case "dore": return base("#f2b632") + `<path d="M40 96 q20 26 40 0" stroke="#fff3bf" stroke-width="3" fill="none"/>`;
    case "aucun": return "";
    default: return base(couleur || "#5c7cfa") + `<path d="M46 94 q14 8 28 0" stroke="rgba(255,255,255,.5)" stroke-width="3" fill="none"/>`;
  }
}

// ------------------------------------------------------------ décors autour (derrière / devant)
function extras(liste) {
  const d = {
    larme: `<path d="M44 66 q-3 6 0 9 q4 2 5 -2 q0 -3 -5 -7z" fill="#74c0fc"/>`,
    larmes_joie: `<path d="M36 60 q-8 4 -10 12 q4 2 8 -4z M84 60 q8 4 10 12 q-4 2 -8 -4z" fill="#74c0fc"/>`,
    joues: `<circle cx="38" cy="72" r="5.5" fill="#ff8fa3" opacity=".6"/><circle cx="82" cy="72" r="5.5" fill="#ff8fa3" opacity=".6"/>`,
    coeurs: `<path d="M100 22 l-6 -6 a3.5 3.5 0 0 1 6 -4 a3.5 3.5 0 0 1 6 4z M16 30 l-4 -4 a2.5 2.5 0 0 1 4 -3 a2.5 2.5 0 0 1 4 3z" fill="#e8364f"/>`,
    zzz: `<text x="92" y="30" font-size="16" font-weight="900" fill="#4dabf7" font-family="Arial Black, sans-serif">z</text><text x="102" y="18" font-size="11" font-weight="900" fill="#74c0fc" font-family="Arial Black, sans-serif">z</text>`,
    bulle_nez: `<circle cx="67" cy="76" r="6" fill="rgba(165,216,255,.6)" stroke="#74c0fc" stroke-width="1"/>`,
    goutte: `<path d="M92 36 q-4 8 0 11 q5 1 5 -3 q0 -4 -5 -8z" fill="#74c0fc"/>`,
    colere: `<path d="M94 30 l4 4 M100 28 l-2 6 M92 38 l6 -2 M102 38 l-4 -2" stroke="#e03131" stroke-width="3" stroke-linecap="round"/>`,
    etoiles: `<path d="M14 26 l2 5 5 .5 -4 3 1.3 5 -4.3 -2.7 -4.3 2.7 1.3 -5 -4 -3 5 -.5z M102 14 l1.6 4 4 .4 -3 2.6 1 4 -3.6 -2.2 -3.6 2.2 1 -4 -3 -2.6 4 -.4z" fill="#ffd43b"/>`,
    points_zombie: `<path d="M34 46 l10 10 M36 52 l4 -4 M40 56 l4 -4" stroke="#2b3a22" stroke-width="2"/>`,
    barbe: `<path d="M38 82 q22 44 44 0 q-4 14 -22 14 q-18 0 -22 -14z" fill="#f1f3f5" stroke="#ced4da" stroke-width="1.5"/>`,
    paillettes: `<circle cx="18" cy="40" r="2.5" fill="#fff3bf"/><circle cx="104" cy="44" r="3" fill="#fff3bf"/><circle cx="98" cy="84" r="2" fill="#fff3bf"/><circle cx="20" cy="86" r="2" fill="#fff3bf"/>`,
    noeud: `<path d="M50 96 l10 6 10 -6 v10 l-10 -6 -10 6z" fill="#e03131"/><circle cx="60" cy="101" r="2.5" fill="#a61e1e"/>`,
    banane: `<path d="M92 92 c-4 14 3 24 16 24 c-9 -4 -13 -13 -11 -24 z" fill="#ffd43b" stroke="#8a6400" stroke-width="2" stroke-linejoin="round"/>`,
    echarpe: `<path d="M34 92 q26 10 52 0 v8 q-26 10 -52 0z" fill="#339af0"/><path d="M76 98 l4 18 h-8z" fill="#339af0"/>`,
  };
  return (liste || []).map((e) => d[e] || "").join("");
}

// Aura derrière la tête (avatars rares)
function aura(type) {
  if (type === "or") return `<circle cx="60" cy="60" r="56" fill="url(#aura-or)"/><defs><radialGradient id="aura-or"><stop offset=".55" stop-color="#fff3bf"/><stop offset="1" stop-color="#fff3bf" stop-opacity="0"/></radialGradient></defs>`;
  if (type === "cosmos") return `<circle cx="60" cy="60" r="58" fill="#1b1545"/><circle cx="20" cy="24" r="1.5" fill="#fff"/><circle cx="96" cy="30" r="1.2" fill="#fff"/><circle cx="104" cy="80" r="1.6" fill="#fff"/><circle cx="14" cy="92" r="1.2" fill="#fff"/><circle cx="86" cy="12" r="1" fill="#fff"/>`;
  return "";
}

// Dessin complet. o = { fourrure, yeux, bouche, sourcils, chapeau, lunettes, habit, couleur, extras, aura, fond }
function singe(o = {}, classe = "singe") {
  const [f, f2] = FOURRURES[o.fourrure || "brun"] || FOURRURES.brun;
  return `<svg class="${classe}" viewBox="0 0 120 120" aria-hidden="true">
    ${o.fond ? `<circle cx="60" cy="60" r="60" fill="${o.fond}"/>` : ""}${aura(o.aura)}
    ${habit(o.habit || "tshirt", o.couleur)}
    <circle cx="24" cy="60" r="13" fill="${f}"/><circle cx="24" cy="60" r="7" fill="#f3b894"/>
    <circle cx="96" cy="60" r="13" fill="${f}"/><circle cx="96" cy="60" r="7" fill="#f3b894"/>
    <circle cx="60" cy="60" r="34" fill="${f}"/><path d="M52 27 q6 -8 10 0 q4 -6 8 1" fill="${f2}"/>
    <ellipse cx="48" cy="58" rx="14" ry="15" fill="${PEAU}"/><ellipse cx="72" cy="58" rx="14" ry="15" fill="${PEAU}"/>
    <ellipse cx="60" cy="76" rx="20" ry="13" fill="${PEAU}"/>
    ${yeux(o.yeux)}${sourcils(o.sourcils)}
    <ellipse cx="56" cy="71" rx="2" ry="1.5" fill="#6b3d17"/><ellipse cx="64" cy="71" rx="2" ry="1.5" fill="#6b3d17"/>
    ${bouche(o.bouche)}${lunettes(o.lunettes)}${chapeau(o.chapeau)}${extras(o.extras)}
  </svg>`;
}

// ------------------------------------------------------------ avatars (mêmes identifiants que avatars.py)
const LOOKS_AVATARS = {
  moka: { chapeau: "casquette", habit: "tshirt", couleur: "#1c7ed6" },
  content: { yeux: "content", bouche: "grand", extras: ["joues"], habit: "tshirt", couleur: "#40c057" },
  triste: { yeux: "triste", sourcils: "triste", bouche: "triste", extras: ["larme"], habit: "tshirt", couleur: "#868e96", fourrure: "gris" },
  choque: { yeux: "choc", sourcils: "haut", bouche: "o", extras: ["goutte"], habit: "tshirt", couleur: "#fab005" },
  grognon: { sourcils: "colere", bouche: "grogne", extras: ["colere"], habit: "tshirt", couleur: "#e03131" },
  cool: { lunettes: "soleil", bouche: "sourire_en_coin", chapeau: "casquette_envers", habit: "tshirt", couleur: "#15aabf" },
  amoureux: { yeux: "coeur", bouche: "ferme", extras: ["joues", "coeurs"], habit: "tshirt", couleur: "#f06595", fourrure: "rose" },
  mdr: { yeux: "mdr", bouche: "grand", extras: ["larmes_joie"], habit: "tshirt", couleur: "#fd7e14" },
  dodo: { yeux: "ferme", bouche: "o", chapeau: "bonnet_nuit", extras: ["zzz", "bulle_nez"], habit: "tshirt", couleur: "#748ffc" },
  dejante: { yeux: "spirale", bouche: "langue", chapeau: "ebouriffe", extras: ["etoiles"], habit: "tshirt", couleur: "#be4bdb" },
  bebe: { yeux: "normal", bouche: "tetine", chapeau: "meche", extras: ["joues"], habit: "bebe" },
  chef: { chapeau: "toque", bouche: "moustache", habit: "chef" },
  cowboy: { chapeau: "cowboy", yeux: "malin", sourcils: "malin", bouche: "sourire_en_coin", habit: "cowboy" },
  punk: { chapeau: "crete", yeux: "clin", bouche: "langue", habit: "cuir", fourrure: "noir" },
  pirate: { chapeau: "tricorne", lunettes: "cache_oeil", bouche: "dents", habit: "marin" },
  rappeur: { chapeau: "casquette_envers", lunettes: "soleil", bouche: "dents", habit: "rappeur" },
  ninja: { chapeau: "bandeau", lunettes: "masque_ninja", yeux: "malin", sourcils: "colere", habit: "ninja", fourrure: "noir" },
  magicien: { chapeau: "magicien", bouche: "ferme", extras: ["barbe", "etoiles"], habit: "robe", fourrure: "gris" },
  zombie: { yeux: "zombie", bouche: "zigzag", extras: ["points_zombie"], habit: "zombie", fourrure: "zombie" },
  vampire: { yeux: "rouge", sourcils: "malin", bouche: "crocs", chapeau: "pointe", habit: "vampire", fourrure: "violet" },
  astronaute: { yeux: "content", bouche: "grand", lunettes: "casque_astro", habit: "astronaute", aura: "cosmos" },
  licorne: { yeux: "coeur", bouche: "grand", chapeau: "corne", extras: ["etoiles", "joues"], habit: "tshirt", couleur: "#b197fc", fourrure: "blanc" },
  roi: { chapeau: "couronne", yeux: "malin", bouche: "sourire_en_coin", habit: "roi" },
  dore: { chapeau: "aureole", yeux: "etoile", bouche: "grand", extras: ["paillettes"], habit: "dore", fourrure: "dore", aura: "or" },
};

function avatarSVG(id, classe = "avatar") {
  return singe(LOOKS_AVATARS[id] || LOOKS_AVATARS.moka, classe);
}

// ------------------------------------------------------------ tenues de Moka dans chaque jeu
const TENUES = {
  jet: { nom: "Moka le pilote", look: { lunettes: "aviateur", habit: "combi", bouche: "grand" } },
  pingouin: { nom: "Moka en doudoune", look: { chapeau: "bonnet", habit: "doudoune", extras: ["echarpe"], yeux: "content", bouche: "grand" } },
  runner: { nom: "Moka le fugitif", look: { chapeau: "casquette", habit: "maillot", couleur: "#2f9e44", bouche: "grand" } },
  candy: { nom: "Chef Moka", look: { chapeau: "toque", habit: "chef", bouche: "moustache", extras: ["joues"] } },
  tetris: { nom: "Moka le bâtisseur", look: { chapeau: "chantier", habit: "gilet", bouche: "ferme" } },
  flipper: { nom: "Moka la rockstar", look: { chapeau: "crete", lunettes: "etoile", habit: "cuir", bouche: "langue" } },
  snake: { nom: "Moka l'explorateur", look: { chapeau: "explorateur", habit: "safari", bouche: "sourire_en_coin" } },
  memory: { nom: "Moka le magicien", look: { chapeau: "magicien", habit: "robe", yeux: "malin", sourcils: "malin", bouche: "sourire_en_coin" } },
  demineur: { nom: "Moka le démineur", look: { chapeau: "chantier", habit: "gilet", sourcils: "haut", bouche: "zigzag", extras: ["goutte"] } },
  echecs: { nom: "Professeur Moka", look: { chapeau: "universitaire", lunettes: "rondes", habit: "blouse", bouche: "ferme" } },
  bataille: { nom: "Capitaine Moka", look: { chapeau: "capitaine", habit: "capitaine", bouche: "dents", sourcils: "malin" } },
};

// Humeurs passagères du coach (se superposent à la tenue)
const HUMEURS = {
  content: { yeux: "content", bouche: "grand" },
  rire: { yeux: "mdr", bouche: "grand", extras: ["larmes_joie"] },
  choc: { yeux: "choc", sourcils: "haut", bouche: "o" },
  triste: { yeux: "triste", sourcils: "triste", bouche: "triste" },
  colere: { sourcils: "colere", bouche: "grogne" },
  malin: { yeux: "malin", sourcils: "malin", bouche: "sourire_en_coin" },
  ko: { yeux: "croix", bouche: "zigzag" },
  etoiles: { yeux: "etoile", bouche: "grand", extras: ["etoiles"] },
};

function tenueSVG(jeu, humeur, classe = "singe") {
  const t = TENUES[jeu];
  if (!t) return avatarSVG("moka", classe);
  const look = { ...t.look, ...(HUMEURS[humeur] || {}) };
  if (HUMEURS[humeur]?.extras) look.extras = [...(t.look.extras || []).filter((e) => e !== "goutte"), ...HUMEURS[humeur].extras];
  return singe(look, classe);
}

// Image utilisable dans un canvas (drawImage) à partir d'un dessin SVG.
const cacheImagesSinges = {};
function imageSVG(svg, cle) {
  if (cle && cacheImagesSinges[cle]) return cacheImagesSinges[cle];
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" '));
  if (cle) cacheImagesSinges[cle] = img;
  return img;
}
function imageTenue(jeu, humeur) {
  return imageSVG(tenueSVG(jeu, humeur), "tenue-" + jeu + "-" + (humeur || ""));
}
function imageAvatar(id) {
  return imageSVG(avatarSVG(id), "avatar-" + id);
}
