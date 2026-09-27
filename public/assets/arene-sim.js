// Stickman Arena : le moteur du jeu (sans dessin).
// Il tourne dans la page (solo contre des robots, et prédiction en duel) et à l'identique sur le serveur
// (jeux/arene.py) qui arbitre les duels en ligne : toute modification doit être faite des deux côtés.
// Monde en pixels, 60 pas par seconde, y vers le bas ; x, y d'un combattant = milieu de ses pieds.

const AR = {
  W: 960, H: 540, SOL: 500, G: 1900, DT: 1 / 60,
  DEPART: 180,                 // 3 s de compte à rebours
  DUREE: 3600,                 // 60 s de combat
  LARG: 26, HAUT: 64, VMAX: 340, ACC_SOL: 3400, ACC_AIR: 1800, FROT: 2600, SAUT: -660, SAUT2: -580,
  PLATEFORMES: [[110, 390, 210], [640, 390, 210], [375, 290, 210], [60, 195, 150], [750, 195, 150], [405, 150, 150]],
  SPAWNS: [[160, 500], [800, 500], [480, 290], [135, 195], [825, 195], [480, 150]],
  ARMES: {
    poings: { cd: 20, degats: 14, portee: 54, mun: -1, recul: 260 },
    pistolet: { cd: 16, vit: 1150, degats: 15, mun: 14, vie: 48, recul: 90 },
    pompe: { cd: 50, vit: 1050, degats: 10, mun: 6, vie: 20, recul: 150, plombs: 5 },
    mitraillette: { cd: 5, vit: 1250, degats: 7, mun: 45, vie: 42, recul: 40 },
    bazooka: { cd: 60, vit: 620, degats: 55, mun: 3, vie: 150, recul: 520, rayon: 95 },
    canon_or: { cd: 36, vit: 700, degats: 60, mun: 5, vie: 150, recul: 560, rayon: 115 },
  },
  ARMES_CAISSES: ["pistolet", "pompe", "mitraillette", "bazooka", "pistolet", "mitraillette"],
  MOKA: ["bananes", "soin", "lune", "coco", "bouclier", "inverse", "arme_or"],
  // petites rotations précalculées (dispersion) : [cos, sin]
  DISPERSION: { pompe: [[0.98722728, -0.15931821], [0.99680171, -0.07991469], [1, 0], [0.99680171, 0.07991469], [0.98722728, 0.15931821]],
    mitraillette: [[0.99955003, 0.0299955], [0.99955003, -0.0299955]] },
};

// Hasard reproductible (même suite de nombres en JavaScript et en Python)
function arAlea(sim) {
  let t = (sim.alea = (sim.alea + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const arArrondi = (x) => Math.floor(x + 0.5);

function arNouveau(graine, noms) {
  const sim = { t: 0, alea: graine >>> 0, lune: 0, joueurs: [], balles: [], caisses: [], peaux: [], cocos: [], fx: [], messages: [],
    prochaineCaisse: AR.DEPART + 120, prochainMoka: AR.DEPART + 600, fini: false };
  noms.forEach((nom, i) => {
    const [x, y] = AR.SPAWNS[i % AR.SPAWNS.length];
    sim.joueurs.push({ i, nom, x, y, vx: 0, vy: 0, sol: true, dj: true, hp: 100, arme: "pistolet", mun: 14, cd: 0,
      ax: i % 2 ? -1000 : 1000, ay: 0, dir: i % 2 ? -1 : 1, mort: 0, k: 0, m: 0, glisse: 0, bouclier: 0, inverse: 0, traverse: 0,
      sautVu: 0, touche: 0, entree: { g: 0, d: 0, b: 0, t: 0, saut: 0, ax: 1000, ay: 0 } });
  });
  return sim;
}

function arCopie(sim) { return JSON.parse(JSON.stringify(sim)); }

function arMessage(sim, texte, type) {
  sim.messages.push({ t: sim.t, texte, type });
  if (sim.messages.length > 6) sim.messages.shift();
}
function arFx(sim, fx) {
  fx.t = sim.t;
  sim.fx.push(fx);
  while (sim.fx.length && sim.fx[0].t < sim.t - 40) sim.fx.shift();
}

// ------------------------------------------------------------ dégâts, explosions, réapparition
function arBlesser(sim, cible, degats, source, kx, ky) {
  if (cible.mort > 0) return;
  if (cible.bouclier > 0) { arFx(sim, { type: "bouclier", x: cible.x, y: cible.y - 32 }); return; }
  cible.hp -= degats;
  cible.touche = 10;
  cible.vx += kx; cible.vy += ky;
  arFx(sim, { type: "degats", x: cible.x, y: cible.y - AR.HAUT - 6, v: degats });
  if (cible.hp <= 0) {
    cible.hp = 0; cible.mort = 90; cible.m += 1;
    const tueur = source >= 0 && source !== cible.i ? sim.joueurs[source] : null;
    if (tueur) tueur.k += 1;
    arFx(sim, { type: "ko", x: cible.x, y: cible.y - 32, par: tueur ? tueur.i : -1, qui: cible.i });
  }
}

function arExplosion(sim, x, y, rayon, degats, recul, source) {
  arFx(sim, { type: "explosion", x, y, r: rayon });
  for (const j of sim.joueurs) {
    if (j.mort > 0) continue;
    const dx = j.x - x, dy = j.y - 32 - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= rayon) continue;
    const f = 1 - d / rayon * 0.6;
    const n = d > 0.001 ? d : 1;
    const moi = j.i === source ? 0.5 : 1;   // on se blesse moins avec sa propre roquette
    arBlesser(sim, j, arArrondi(degats * f * moi), source, dx / n * recul * f, dy / n * recul * f - 180);
  }
}

function arReapparaitre(sim, j) {
  // point d'apparition le plus éloigné des adversaires vivants
  let meilleur = 0, dist = -1;
  AR.SPAWNS.forEach(([x, y], k) => {
    let d = 1e9;
    for (const o of sim.joueurs) if (o !== j && o.mort <= 0) d = Math.min(d, Math.abs(o.x - x) + Math.abs(o.y - y));
    if (d > dist) { dist = d; meilleur = k; }
  });
  const [x, y] = AR.SPAWNS[meilleur];
  Object.assign(j, { x, y, vx: 0, vy: 0, hp: 100, arme: "pistolet", mun: 14, cd: 0, sol: true, dj: true, glisse: 0, bouclier: 90, inverse: 0 });
}

function arMeneur(sim) {
  const max = Math.max(...sim.joueurs.map((j) => j.k));
  const tete = sim.joueurs.filter((j) => j.k === max);
  return tete[Math.floor(arAlea(sim) * tete.length)];
}
function arDernier(sim) {
  const min = Math.min(...sim.joueurs.map((j) => j.k));
  const queue = sim.joueurs.filter((j) => j.k === min);
  return queue[Math.floor(arAlea(sim) * queue.length)];
}

// ------------------------------------------------------------ Moka s'en mêle
function arMoka(sim) {
  const type = AR.MOKA[Math.floor(arAlea(sim) * AR.MOKA.length)];
  if (type === "bananes") {
    for (let k = 0; k < 4; k++) {
      const p = arAlea(sim) < 0.35 ? [0, AR.SOL, AR.W] : AR.PLATEFORMES[Math.floor(arAlea(sim) * AR.PLATEFORMES.length)];
      sim.peaux.push({ x: p[0] + 20 + arAlea(sim) * (p[2] - 40), y: p[1] });
    }
    arMessage(sim, "Moka sème des peaux de banane ! Attention où vous marchez, hi hi !", type);
  } else if (type === "soin") {
    sim.caisses.push({ x: 60 + arAlea(sim) * (AR.W - 120), y: -20, vy: 0, arme: "soin", vie: 720 });
    arMessage(sim, "Moka lance une banane dorée : +45 PV pour qui l'attrape !", type);
  } else if (type === "lune") {
    sim.lune = 420;
    arMessage(sim, "Moka coupe la gravité ! Tout le monde sur la lune !", type);
  } else if (type === "coco") {
    const cible = arMeneur(sim);
    sim.cocos.push({ x: cible.x, y: -30, vy: 0 });
    arMessage(sim, `Moka balance une noix de coco sur ${cible.nom} ! Hou hou ha ha !`, type);
  } else if (type === "bouclier") {
    const cible = arDernier(sim);
    cible.bouclier = 360;
    arMessage(sim, `Moka protège ${cible.nom} avec une bulle !`, type);
  } else if (type === "inverse") {
    const cible = arMeneur(sim);
    cible.inverse = 300;
    arMessage(sim, `Moka a mélangé les commandes de ${cible.nom} ! Gauche-droite, droite-gauche…`, type);
  } else {
    sim.caisses.push({ x: 60 + arAlea(sim) * (AR.W - 120), y: -20, vy: 0, arme: "canon_or", vie: 720 });
    arMessage(sim, "Moka largue le CANON À BANANES EN OR !", type);
  }
}

// ------------------------------------------------------------ un pas de simulation (1/60 s)
function arTirer(sim, j) {
  const a = AR.ARMES[j.arme];
  const n = Math.sqrt(j.ax * j.ax + j.ay * j.ay);
  const ux = n > 0 ? j.ax / n : j.dir, uy = n > 0 ? j.ay / n : 0;
  j.cd = a.cd;
  if (j.arme === "poings") {
    arFx(sim, { type: "coup", x: j.x + j.dir * 30, y: j.y - 40, par: j.i });
    for (const o of sim.joueurs) {
      if (o === j || o.mort > 0) continue;
      const dx = o.x - j.x;
      if (dx * j.dir > -8 && Math.abs(dx) < a.portee && Math.abs(o.y - j.y) < 50) arBlesser(sim, o, a.degats, j.i, j.dir * a.recul, -160);
    }
    return;
  }
  const bx = j.x + ux * 22, by = j.y - 42 + uy * 22;
  const tirs = AR.DISPERSION[j.arme] ? (j.arme === "pompe" ? AR.DISPERSION.pompe : [AR.DISPERSION.mitraillette[j.mun % 2]]) : [[1, 0]];
  for (const [c, s] of tirs) {
    const vx = (ux * c - uy * s) * a.vit, vy = (ux * s + uy * c) * a.vit;
    sim.balles.push({ x: bx, y: by, vx, vy, arme: j.arme, par: j.i, vie: a.vie });
  }
  arFx(sim, { type: "tir", x: bx, y: by, ux, uy, arme: j.arme });
  j.vx -= ux * a.recul * 0.35;
  j.mun -= 1;
  if (j.mun <= 0) { j.arme = "poings"; j.mun = -1; }
}

function arPas(sim) {
  if (sim.fini) return;
  sim.t += 1;
  const actif = sim.t > AR.DEPART;
  const g = AR.G * (sim.lune > 0 ? 0.42 : 1);
  if (sim.lune > 0) sim.lune -= 1;

  for (const j of sim.joueurs) {
    const e = j.entree;
    if (j.cd > 0) j.cd -= 1;
    if (j.touche > 0) j.touche -= 1;
    if (j.bouclier > 0) j.bouclier -= 1;
    if (j.inverse > 0) j.inverse -= 1;
    if (j.traverse > 0) j.traverse -= 1;
    if (j.mort > 0) {
      j.mort -= 1;
      if (j.mort === 0) arReapparaitre(sim, j);
      continue;
    }
    j.ax = e.ax; j.ay = e.ay;
    if (e.ax !== 0) j.dir = e.ax > 0 ? 1 : -1;
    let dirX = 0;
    if (actif) {
      dirX = (e.d ? 1 : 0) - (e.g ? 1 : 0);
      if (j.inverse > 0) dirX = -dirX;
    }
    if (j.glisse > 0) {   // sur une peau de banane : plus aucun contrôle
      j.glisse -= 1;
      dirX = 0;
    }
    // déplacement horizontal
    const acc = j.sol ? AR.ACC_SOL : AR.ACC_AIR;
    if (dirX !== 0) {
      j.vx += dirX * acc * AR.DT;
      if (j.vx > AR.VMAX) j.vx = Math.max(AR.VMAX, j.vx - AR.FROT * AR.DT);
      if (j.vx < -AR.VMAX) j.vx = Math.min(-AR.VMAX, j.vx + AR.FROT * AR.DT);
    } else if (j.sol) {
      const f = (j.glisse > 0 ? 250 : AR.FROT) * AR.DT;
      j.vx = Math.abs(j.vx) <= f ? 0 : j.vx - Math.sign(j.vx) * f;
    }
    // saut (le compteur augmente à chaque appui) et descente à travers les plateformes
    if (actif && e.saut !== j.sautVu) {
      j.sautVu = e.saut;
      if (j.glisse <= 0) {
        if (j.sol) { j.vy = AR.SAUT; j.sol = false; arFx(sim, { type: "saut", x: j.x, y: j.y }); }
        else if (j.dj) { j.vy = AR.SAUT2; j.dj = false; arFx(sim, { type: "saut2", x: j.x, y: j.y }); }
      }
    }
    if (actif && e.b && j.sol && j.y < AR.SOL) { j.traverse = 14; j.sol = false; }
    // gravité et mouvement
    j.vy += g * AR.DT;
    if (j.vy > 1400) j.vy = 1400;
    const avantY = j.y;
    j.x += j.vx * AR.DT;
    j.y += j.vy * AR.DT;
    if (j.x < AR.LARG / 2) { j.x = AR.LARG / 2; j.vx = 0; }
    if (j.x > AR.W - AR.LARG / 2) { j.x = AR.W - AR.LARG / 2; j.vx = 0; }
    if (j.y - AR.HAUT < 0) { j.y = AR.HAUT; if (j.vy < 0) j.vy = 0; }
    j.sol = false;
    if (j.y >= AR.SOL) { j.y = AR.SOL; j.vy = 0; j.sol = true; }
    else if (j.vy >= 0 && j.traverse <= 0) {
      for (const [px, py, pw] of AR.PLATEFORMES) {
        if (avantY <= py && j.y >= py && j.x > px - 8 && j.x < px + pw + 8) { j.y = py; j.vy = 0; j.sol = true; break; }
      }
    }
    if (j.sol) j.dj = true;
    // peaux de banane
    if (j.sol && j.glisse <= 0 && Math.abs(j.vx) > 60) {
      for (let k = 0; k < sim.peaux.length; k++) {
        const p = sim.peaux[k];
        if (Math.abs(p.x - j.x) < 16 && Math.abs(p.y - j.y) < 4) {
          sim.peaux.splice(k, 1);
          j.glisse = 55;
          j.vx = Math.sign(j.vx) * 520;
          arFx(sim, { type: "glisse", x: j.x, y: j.y, qui: j.i });
          break;
        }
      }
    }
    // tir
    if (actif && e.t && j.cd <= 0 && j.glisse <= 0) arTirer(sim, j);
  }

  // balles et roquettes
  for (let k = sim.balles.length - 1; k >= 0; k--) {
    const b = sim.balles[k];
    const a = AR.ARMES[b.arme];
    b.x += b.vx * AR.DT;
    b.y += b.vy * AR.DT;
    if (a.rayon) b.vy += 260 * AR.DT;
    b.vie -= 1;
    let explose = b.x < 0 || b.x > AR.W || b.y > AR.SOL || b.y < -40 || b.vie <= 0;
    let touche = null;
    for (const o of sim.joueurs) {
      if (o.i === b.par || o.mort > 0) continue;
      if (b.x > o.x - 14 && b.x < o.x + 14 && b.y > o.y - AR.HAUT && b.y < o.y) { touche = o; break; }
    }
    if (touche && !a.rayon) {
      const n = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      arBlesser(sim, touche, a.degats, b.par, b.vx / n * a.recul, -80);
      arFx(sim, { type: "impact", x: b.x, y: b.y });
      sim.balles.splice(k, 1);
      continue;
    }
    if (a.rayon && (touche || explose)) {
      arExplosion(sim, b.x, Math.min(b.y, AR.SOL), a.rayon, a.degats, a.recul, b.par);
      sim.balles.splice(k, 1);
      continue;
    }
    if (explose) sim.balles.splice(k, 1);
  }

  // caisses d'armes et bananes dorées
  if (actif && sim.t >= sim.prochaineCaisse) {
    if (sim.caisses.length < 3) {
      sim.caisses.push({ x: 60 + arAlea(sim) * (AR.W - 120), y: -20, vy: 0,
        arme: AR.ARMES_CAISSES[Math.floor(arAlea(sim) * AR.ARMES_CAISSES.length)], vie: 720 });
    }
    sim.prochaineCaisse = sim.t + 240 + Math.floor(arAlea(sim) * 180);
  }
  for (let k = sim.caisses.length - 1; k >= 0; k--) {
    const c = sim.caisses[k];
    c.vie -= 1;
    if (c.vie <= 0) { sim.caisses.splice(k, 1); continue; }
    const avant = c.y;
    c.vy = Math.min(700, c.vy + AR.G * 0.5 * AR.DT);
    c.y += c.vy * AR.DT;
    if (c.y >= AR.SOL) { c.y = AR.SOL; c.vy = 0; }
    else for (const [px, py, pw] of AR.PLATEFORMES) if (avant <= py && c.y >= py && c.x > px && c.x < px + pw) { c.y = py; c.vy = 0; }
    for (const j of sim.joueurs) {
      if (j.mort > 0 || Math.abs(j.x - c.x) > 26 || c.y < j.y - AR.HAUT - 10 || c.y > j.y + 20) continue;
      if (c.arme === "soin") { j.hp = Math.min(100, j.hp + 45); arFx(sim, { type: "soin", x: c.x, y: c.y }); }
      else { j.arme = c.arme; j.mun = AR.ARMES[c.arme].mun; j.cd = 0; arFx(sim, { type: "ramasse", x: c.x, y: c.y, arme: c.arme, qui: j.i }); }
      sim.caisses.splice(k, 1);
      break;
    }
  }

  // noix de coco de Moka
  for (let k = sim.cocos.length - 1; k >= 0; k--) {
    const c = sim.cocos[k];
    c.vy = Math.min(900, c.vy + AR.G * 0.6 * AR.DT);
    const avant = c.y;
    c.y += c.vy * AR.DT;
    let boum = c.y >= AR.SOL;
    for (const [px, py, pw] of AR.PLATEFORMES) if (avant <= py && c.y >= py && c.x > px && c.x < px + pw) boum = true;
    for (const j of sim.joueurs) if (j.mort <= 0 && Math.abs(j.x - c.x) < 16 && c.y > j.y - AR.HAUT && c.y < j.y) boum = true;
    if (boum) { arExplosion(sim, c.x, Math.min(c.y, AR.SOL), 100, 40, 480, -1); sim.cocos.splice(k, 1); }
  }

  // Moka s'en mêle régulièrement
  if (actif && sim.t >= sim.prochainMoka) {
    arMoka(sim);
    sim.prochainMoka = sim.t + 600 + Math.floor(arAlea(sim) * 240);
  }
  if (sim.t >= AR.DEPART + AR.DUREE) sim.fini = true;
}

// Classement de fin : plus de K.O. d'abord, puis moins de morts.
function arClassement(sim) {
  return [...sim.joueurs].sort((a, b) => b.k - a.k || a.m - b.m || a.i - b.i);
}

if (typeof module !== "undefined") module.exports = { AR, arNouveau, arPas, arCopie, arClassement };
