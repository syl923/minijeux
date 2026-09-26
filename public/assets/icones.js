// Icônes des jeux, dessinées à la main en SVG (100 × 100). Utilisées sur l'accueil, le menu et les pages.

const ICONES_JEUX = {
  runner: `
    <rect width="100" height="62" fill="#ffd8a8"/><circle cx="72" cy="30" r="16" fill="#ffa94d"/>
    <path d="M0 62 q25 -10 50 -2 t50 -4 V100 H0z" fill="#d9a441"/>
    <path d="M40 60 L18 100 H82 L60 60Z" fill="#b8804a"/><path d="M47 60 L40 100 M53 60 L60 100" stroke="#9a6536" stroke-width="3"/>
    <rect x="11" y="30" width="3" height="28" fill="#5c3d22"/><ellipse cx="12" cy="30" rx="12" ry="4" fill="#5c7a29"/>
    <path d="M58 70 q12 4 10 -10 q-2 -6 -6 -3" stroke="#7a4a1f" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="72" rx="12" ry="14" fill="#9c6433"/><rect x="41" y="62" width="18" height="16" rx="5" fill="#2f9e44"/>
    <path d="M40 66 l-10 -10 M60 66 l10 -12" stroke="#9c6433" stroke-width="6" stroke-linecap="round"/>
    <path d="M45 84 l-4 10 M55 84 l5 10" stroke="#9c6433" stroke-width="6" stroke-linecap="round"/>
    <circle cx="39" cy="50" r="5" fill="#9c6433"/><circle cx="61" cy="50" r="5" fill="#9c6433"/>
    <circle cx="50" cy="50" r="11" fill="#9c6433"/><path d="M39 47 q11 -14 22 0z" fill="#e03131"/>
    <path d="M78 64 c-3 10 2 18 12 18 c-7 -3 -10 -9 -8 -18z" fill="#ffd43b" stroke="#8a6400" stroke-width="2"/>`,
  candy: `
    <g transform="rotate(-20 50 50)">
      <path d="M18 50 L6 40 L8 60Z M82 50 L94 40 L92 60Z" fill="#ff8787" stroke="#c92a2a" stroke-width="2"/>
      <ellipse cx="50" cy="50" rx="33" ry="22" fill="#e03131" stroke="#a51111" stroke-width="3"/>
      <path d="M30 34 q10 16 0 32 M46 29 q10 20 0 42 M62 30 q10 18 0 40" stroke="#fff" stroke-width="5" fill="none" opacity=".85"/>
      <ellipse cx="40" cy="40" rx="10" ry="5" fill="#fff" opacity=".6"/>
    </g>
    <circle cx="26" cy="80" r="12" fill="#1c7ed6" stroke="#0b4a8a" stroke-width="3"/><circle cx="22" cy="76" r="4" fill="#fff" opacity=".7"/>
    <path d="M70 70 l12 12 l-12 12 l-12 -12z" fill="#fab005" stroke="#d99a00" stroke-width="3"/>`,
  tetris: `
    <g stroke="#1b1340" stroke-width="3">
      <rect x="10" y="66" width="20" height="20" fill="#3b82f6"/><rect x="30" y="66" width="20" height="20" fill="#3b82f6"/><rect x="50" y="66" width="20" height="20" fill="#3b82f6"/><rect x="50" y="46" width="20" height="20" fill="#3b82f6"/>
      <rect x="70" y="66" width="20" height="20" fill="#22c55e"/><rect x="70" y="46" width="20" height="20" fill="#22c55e"/><rect x="70" y="26" width="20" height="20" fill="#22c55e"/><rect x="70" y="6" width="20" height="20" fill="#22c55e"/>
      <rect x="10" y="46" width="20" height="20" fill="#facc15"/><rect x="30" y="46" width="20" height="20" fill="#facc15"/><rect x="10" y="26" width="20" height="20" fill="#facc15"/><rect x="30" y="26" width="20" height="20" fill="#facc15"/>
      <rect x="30" y="4" width="20" height="16" fill="#a855f7"/><rect x="50" y="4" width="16" height="16" fill="#a855f7"/>
    </g>
    <g fill="#fff" opacity=".45"><rect x="13" y="69" width="8" height="4"/><rect x="73" y="9" width="8" height="4"/><rect x="13" y="29" width="8" height="4"/><rect x="53" y="49" width="8" height="4"/></g>`,
  flipper: `
    <circle cx="50" cy="34" r="20" fill="#ff5fa2" stroke="#fff" stroke-width="4"/><circle cx="50" cy="34" r="10" fill="#1a0b3d"/><circle cx="50" cy="34" r="5" fill="#ff5fa2"/>
    <path d="M12 84 L42 70" stroke="#ff2fd0" stroke-width="12" stroke-linecap="round"/><path d="M12 84 L42 70" stroke="#ffd0e4" stroke-width="4" stroke-linecap="round"/>
    <path d="M88 84 L58 70" stroke="#ff2fd0" stroke-width="12" stroke-linecap="round"/><path d="M88 84 L58 70" stroke="#ffd0e4" stroke-width="4" stroke-linecap="round"/>
    <circle cx="70" cy="60" r="9" fill="#dee2e6" stroke="#868e96" stroke-width="2"/><circle cx="67" cy="57" r="3" fill="#fff"/>
    <path d="M78 64 q8 -4 12 2 M76 70 q10 2 12 10" stroke="#ffd43b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M18 20 l3 7 7 1 -5 5 1 7 -6 -4 -6 4 1 -7 -5 -5 7 -1z" fill="#3ee0e8"/>`,
  snake: `
    <path d="M20 80 q-12 -20 10 -26 q26 -6 34 -24 q6 -16 -10 -18" fill="none" stroke="#f08c00" stroke-width="16" stroke-linecap="round"/>
    <path d="M20 80 q-12 -20 10 -26 q26 -6 34 -24 q6 -16 -10 -18" fill="none" stroke="#ffd43b" stroke-width="9" stroke-linecap="round" stroke-dasharray="3 9"/>
    <circle cx="44" cy="12" r="12" fill="#f59f00"/><circle cx="40" cy="9" r="3.5" fill="#fff"/><circle cx="41" cy="9" r="2" fill="#111"/>
    <path d="M33 13 l-9 2 m9 -2 l-8 -3" stroke="#e03131" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="74" cy="72" r="15" fill="#e03131"/><path d="M74 58 q2 -8 8 -9" stroke="#5c3d1e" stroke-width="3" fill="none"/><ellipse cx="82" cy="55" rx="7" ry="4" fill="#51cf66" transform="rotate(-30 82 55)"/><circle cx="68" cy="66" r="4" fill="#fff" opacity=".6"/>`,
  memory: `
    <g transform="rotate(-12 38 55)"><rect x="14" y="22" width="44" height="62" rx="8" fill="#7048e8" stroke="#fff" stroke-width="4"/>
      <path d="M20 30 l32 46 M20 50 l20 28 M32 30 l20 28" stroke="#9775fa" stroke-width="6"/><circle cx="36" cy="53" r="9" fill="#fff" opacity=".35"/></g>
    <g transform="rotate(12 64 50)"><rect x="42" y="16" width="44" height="62" rx="8" fill="#fffaf0" stroke="#ffc93c" stroke-width="4"/>
      <path d="M64 30 l5 11 12 1 -9 8 3 12 -11 -6 -11 6 3 -12 -9 -8 12 -1z" fill="#fab005" stroke="#e8a200" stroke-width="2"/></g>`,
  demineur: `
    <circle cx="50" cy="58" r="30" fill="#2b2b3a"/><circle cx="39" cy="47" r="9" fill="rgba(255,255,255,.18)"/>
    <rect x="58" y="18" width="14" height="12" rx="3" transform="rotate(30 65 24)" fill="#5a5a70"/>
    <path d="M70 16 q8 -10 16 -4" stroke="#b7803c" stroke-width="4" fill="none"/><circle cx="87" cy="11" r="7" fill="#ffdd33"/><circle cx="87" cy="11" r="3" fill="#fff"/>
    <circle cx="40" cy="58" r="8" fill="#fff"/><circle cx="60" cy="58" r="8" fill="#fff"/><circle cx="42" cy="60" r="4" fill="#111"/><circle cx="58" cy="60" r="4" fill="#111"/>
    <path d="M30 46 l16 5 M70 46 l-16 5" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M42 76 q8 -5 16 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  echecs: `
    <g opacity=".9"><rect x="4" y="60" width="23" height="23" fill="#f0d9b5"/><rect x="27" y="60" width="23" height="23" fill="#b58863"/><rect x="50" y="60" width="23" height="23" fill="#f0d9b5"/><rect x="73" y="60" width="23" height="23" fill="#b58863"/></g>
    <path d="M30 88 h44 l-4 -10 h-36z" fill="#ffd43b" stroke="#a86f00" stroke-width="3"/>
    <path d="M36 78 c0 -14 8 -18 6 -30 c-6 4 -14 4 -16 -4 c6 -12 14 -22 30 -26 c14 4 22 18 20 36 c-2 10 -6 16 -4 24z" fill="#ffd43b" stroke="#a86f00" stroke-width="3"/>
    <circle cx="48" cy="30" r="3" fill="#a86f00"/><path d="M54 22 l6 -10 4 12" fill="#ffd43b" stroke="#a86f00" stroke-width="3"/>
    <path d="M62 34 q6 16 -2 40" stroke="#fff3bf" stroke-width="4" fill="none" opacity=".7"/>`,
  bataille: `
    <path d="M0 70 q12 -6 25 0 t25 0 t25 0 t25 0 V100 H0z" fill="#1c7ed6"/>
    <path d="M14 62 h62 l-8 14 h-48z" fill="#adb5bd" stroke="#495057" stroke-width="3"/>
    <rect x="34" y="46" width="22" height="16" rx="3" fill="#dee2e6" stroke="#495057" stroke-width="3"/>
    <rect x="42" y="34" width="6" height="12" fill="#495057"/><path d="M56 54 h18" stroke="#495057" stroke-width="4"/>
    <circle cx="78" cy="26" r="16" fill="none" stroke="#e03131" stroke-width="4"/><path d="M78 6 v12 M78 34 v12 M58 26 h12 M86 26 h12" stroke="#e03131" stroke-width="4"/>
    <circle cx="78" cy="26" r="4" fill="#e03131"/>
    <path d="M20 84 q4 -8 8 0 q4 -8 8 0" stroke="#fff" stroke-width="3" fill="none"/>`,
  jet: `
    <path d="M26 58 l-6 30 l10 -8 l6 10 l4 -30z" fill="#ff922b"/><path d="M28 60 l-2 18 l6 -4 l3 6 l2 -18z" fill="#ffe066"/>
    <rect x="22" y="34" width="16" height="30" rx="5" fill="#adb5bd" stroke="#495057" stroke-width="2"/>
    <circle cx="36" cy="30" r="8" fill="#8b5a2b"/><circle cx="76" cy="30" r="8" fill="#8b5a2b"/>
    <circle cx="56" cy="40" r="24" fill="#9c6433"/><ellipse cx="59" cy="48" rx="16" ry="13" fill="#f3d3a6"/>
    <circle cx="50" cy="36" r="8" fill="#1864ab"/><circle cx="66" cy="36" r="8" fill="#1864ab"/><circle cx="50" cy="36" r="5" fill="#a5d8ff"/><circle cx="66" cy="36" r="5" fill="#a5d8ff"/>
    <path d="M34 24 q22 -24 46 0z" fill="#e03131"/><rect x="58" y="20" width="26" height="6" rx="3" fill="#c92a2a"/>
    <path d="M52 54 q7 7 14 0" stroke="#6b3d17" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  pingouin: `
    <rect width="100" height="100" fill="#d0ebff"/>
    <path d="M0 74 q30 -26 60 -8 t40 -6 V100 H0z" fill="#f8f9fa"/><path d="M0 74 q30 -26 60 -8 t40 -6" stroke="#a5d8ff" stroke-width="3" fill="none"/>
    <path d="M10 30 l26 22" stroke="#8d5a2b" stroke-width="8" stroke-linecap="round"/><path d="M8 28 l6 -6" stroke="#5c3d22" stroke-width="5" stroke-linecap="round"/>
    <path d="M30 40 q8 -6 14 2 M28 48 q10 -4 16 4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g transform="rotate(-25 62 46)">
      <ellipse cx="62" cy="52" rx="20" ry="14" fill="#e03131"/><path d="M44 50 h36 M45 57 h34" stroke="#b02525" stroke-width="2"/>
      <circle cx="68" cy="34" r="13" fill="#9c6433"/><ellipse cx="71" cy="37" rx="8" ry="6" fill="#f3d3a6"/>
      <circle cx="66" cy="31" r="2.2" fill="#2b1a0e"/><circle cx="74" cy="31" r="2.2" fill="#2b1a0e"/>
      <path d="M56 28 q12 -16 24 0z" fill="#e03131"/><rect x="55" y="26" width="26" height="5" rx="2.5" fill="#fff"/><circle cx="68" cy="14" r="4" fill="#fff"/>
      <path d="M82 58 q10 2 12 10" stroke="#9c6433" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>
    <circle cx="20" cy="12" r="2.5" fill="#fff"/><circle cx="88" cy="14" r="2" fill="#fff"/><circle cx="46" cy="8" r="2" fill="#fff"/>`,
};

function iconeJeu(id, classe = "icone-jeu") {
  return ICONES_JEUX[id] ? `<svg class="${classe}" viewBox="0 0 100 100" aria-hidden="true">${ICONES_JEUX[id]}</svg>` : "";
}
