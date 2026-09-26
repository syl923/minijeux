// Sons et musiques fabriqués à la volée avec la Web Audio API : aucun fichier audio, aucun droit d'auteur.

const Sons = (() => {
  let ctx = null;
  let maitre = null;
  let coupe = false;
  try { coupe = localStorage.getItem("mj-muet") === "1"; } catch (e) {}

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      maitre = ctx.createGain();
      maitre.gain.value = coupe ? 0 : 0.8;
      maitre.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function note(freq, debut, duree, { type = "sine", volume = 0.2, attaque = 0.005, glisse = null, dest = null, filtre = null } = {}) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + debut;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glisse) o.frequency.exponentialRampToValueAtTime(glisse, t + duree);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + attaque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    let sortie = g;
    o.connect(g);
    if (filtre) {
      const f = a.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filtre;
      g.connect(f);
      sortie = f;
    }
    sortie.connect(dest || maitre);
    o.start(t);
    o.stop(t + duree + 0.05);
  }

  function bruit(debut, duree, { volume = 0.3, de = 3000, a = 200, type = "lowpass", dest = null } = {}) {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + debut;
    const taille = Math.floor(ac.sampleRate * duree);
    const tampon = ac.createBuffer(1, taille, ac.sampleRate);
    const d = tampon.getChannelData(0);
    for (let i = 0; i < taille; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource();
    s.buffer = tampon;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(de, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, a), t + duree);
    const g = ac.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    s.connect(f).connect(g).connect(dest || maitre);
    s.start(t);
  }

  // Guitare saturée (accord de puissance : fondamentale + quinte + octave, passé dans une distorsion)
  let courbe = null;
  function guitare(fondamentale, debut, duree, { volume = 0.12, dest = null, etouffe = false } = {}) {
    const a = audio();
    if (!a) return;
    if (!courbe) {
      courbe = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; courbe[i] = Math.tanh(x * 12); }
    }
    const t = a.currentTime + debut;
    const disto = a.createWaveShaper();
    disto.curve = courbe;
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = etouffe ? 1400 : 3200;
    const g = a.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    disto.connect(f).connect(g).connect(dest || maitre);
    for (const k of [1, 1.5, 2]) {
      const o = a.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = fondamentale * k;
      o.detune.value = (Math.random() - .5) * 12;
      const og = a.createGain();
      og.gain.value = 0.25;
      o.connect(og).connect(disto);
      o.start(t);
      o.stop(t + duree + 0.05);
    }
  }

  const effets = {
    clic: () => note(900, 0, 0.05, { type: "triangle", volume: 0.12 }),
    pop: (hauteur = 1) => note(500 * hauteur, 0, 0.09, { type: "sine", volume: 0.25, glisse: 900 * hauteur }),
    carte: () => { bruit(0, 0.08, { volume: 0.15, de: 6000, a: 1500, type: "bandpass" }); },
    paire: () => { note(660, 0, 0.12, { type: "triangle", volume: 0.2 }); note(990, 0.08, 0.2, { type: "triangle", volume: 0.2 }); },
    rate: () => note(300, 0, 0.18, { type: "triangle", volume: 0.12, glisse: 200 }),
    boing: () => { note(180, 0, 0.35, { type: "sine", volume: 0.35, glisse: 520 }); note(360, 0.02, 0.3, { type: "triangle", volume: 0.1, glisse: 900 }); },
    piece: () => { note(988, 0, 0.08, { type: "square", volume: 0.08 }); note(1319, 0.07, 0.25, { type: "square", volume: 0.08 }); },
    bonus: () => [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.06, 0.15, { type: "square", volume: 0.07 })),
    plouf: () => { bruit(0, 0.35, { volume: 0.3, de: 1500, a: 200 }); note(600, 0, 0.25, { volume: 0.15, glisse: 120 }); },
    explosion: () => {
      bruit(0, 0.9, { volume: 0.7, de: 2500, a: 60 });
      note(120, 0, 0.6, { type: "sawtooth", volume: 0.3, glisse: 30, filtre: 600 });
    },
    kaboom: () => { // explosion de dessin animé : sifflet qui descend puis gros boum
      note(1800, 0, 0.45, { type: "sine", volume: 0.15, glisse: 300 });
      setTimeout(() => {
        bruit(0, 1.2, { volume: 0.8, de: 3000, a: 50 });
        note(90, 0, 0.9, { type: "square", volume: 0.25, glisse: 25, filtre: 500 });
      }, 420);
    },
    meche: () => bruit(0, 0.5, { volume: 0.12, de: 8000, a: 4000, type: "highpass" }),
    perdu: () => [392, 370, 349, 330].forEach((f, i) => { // « wah wah wah waaah »
      const d = i === 3 ? 0.9 : 0.35;
      note(f / 2, i * 0.4, d, { type: "sawtooth", volume: 0.15, attaque: 0.05, filtre: 900, glisse: i === 3 ? f / 2.3 : null });
    }),
    victoire: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      note(f, i * 0.11, i === 5 ? 0.6 : 0.16, { type: "square", volume: 0.09 })),
    tic: () => note(1400, 0, 0.03, { type: "square", volume: 0.05 }),
    alerte: () => note(880, 0, 0.1, { type: "square", volume: 0.07 }),
    drapeau: () => { note(700, 0, 0.06, { type: "triangle", volume: 0.15 }); note(1050, 0.05, 0.1, { type: "triangle", volume: 0.15 }); },
    mange: () => { note(520, 0, 0.07, { type: "square", volume: 0.1, glisse: 1040 }); },
    manger_or: () => [784, 988, 1175, 1568].forEach((f, i) => note(f, i * 0.05, 0.12, { type: "square", volume: 0.08 })),
    crash: () => { bruit(0, 0.4, { volume: 0.4, de: 1200, a: 80 }); note(200, 0, 0.5, { type: "sawtooth", volume: 0.2, glisse: 40, filtre: 800 }); },
    deplacement: () => { bruit(0, 0.06, { volume: 0.35, de: 1800, a: 400 }); note(160, 0, 0.08, { volume: 0.2 }); },
    prise: () => { bruit(0, 0.12, { volume: 0.5, de: 2500, a: 300 }); note(110, 0, 0.15, { type: "triangle", volume: 0.3 }); },
    echec: () => { note(740, 0, 0.12, { type: "square", volume: 0.08 }); note(740, 0.16, 0.12, { type: "square", volume: 0.08 }); },
    bumper: () => { note(260 + Math.random() * 80, 0, 0.12, { type: "square", volume: 0.12, glisse: 900 }); bruit(0, 0.06, { volume: 0.2, de: 5000, a: 1000 }); },
    sling: () => note(420, 0, 0.08, { type: "sawtooth", volume: 0.1, glisse: 200, filtre: 2000 }),
    flip: () => bruit(0, 0.05, { volume: 0.25, de: 900, a: 200 }),
    cible: () => { note(1200, 0, 0.1, { type: "square", volume: 0.08 }); note(1600, 0.06, 0.12, { type: "square", volume: 0.08 }); },
    lancement: () => { bruit(0, 0.3, { volume: 0.3, de: 400, a: 3000, type: "bandpass" }); },
    perte_bille: () => { note(600, 0, 0.8, { type: "sawtooth", volume: 0.12, glisse: 60, filtre: 1500 }); },
    roue_tic: () => note(1800, 0, 0.02, { type: "square", volume: 0.04 }),
    // flipper rock'n'roll
    riff: () => [82, 82, 98, 110].forEach((f, i) => guitare(f, i * 0.12, i === 3 ? 0.5 : 0.11, { volume: 0.14 })),
    power: () => guitare(110, 0, 0.6, { volume: 0.16 }),
    feu: () => { bruit(0, 0.6, { volume: 0.35, de: 600, a: 4000, type: "bandpass" }); note(90, 0, 0.5, { type: "sawtooth", volume: 0.15, glisse: 220, filtre: 900 }); },
    sirene: () => { for (let i = 0; i < 4; i++) note(700, i * 0.25, 0.24, { type: "square", volume: 0.07, glisse: 1100 }); },
    extra: () => [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => note(f, i * 0.07, 0.12, { type: "square", volume: 0.08 })),
    // blocomania
    rotation: () => note(620, 0, 0.05, { type: "square", volume: 0.05 }),
    deplace: () => note(300, 0, 0.03, { type: "square", volume: 0.03 }),
    pose: () => { note(120, 0, 0.08, { type: "square", volume: 0.12 }); bruit(0, 0.05, { volume: 0.15, de: 1500, a: 300 }); },
    ligne: (n = 1) => [523, 659, 784, 1047].slice(0, n + 1).forEach((f, i) => note(f, i * 0.06, 0.18, { type: "square", volume: 0.09 })),
    // rail rush
    saut: () => note(300, 0, 0.2, { type: "square", volume: 0.08, glisse: 800 }),
    glisse: () => bruit(0, 0.25, { volume: 0.2, de: 2500, a: 500, type: "bandpass" }),
    bonus_pris: () => [784, 1047, 1319, 1568, 2093].forEach((f, i) => note(f, i * 0.05, 0.1, { type: "triangle", volume: 0.12 })),
    jetpack: () => bruit(0, 0.8, { volume: 0.25, de: 300, a: 2000, type: "bandpass" }),
  };

  // ------------------------------------------------------------------ musiques
  const MORCEAUX = {
    // Détente : accords jazzy lents, piano électrique doux et petite batterie feutrée.
    chill: {
      tempo: 78,
      accords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], // Fmaj7 Em7 Dm7 Cmaj7
      jouerTemps(t, temps, mesure, bus) {
        const acc = this.accords[mesure % 4];
        const beat = 60 / this.tempo;
        if (temps === 0) acc.forEach((n) => note(midi(n), t, beat * 4, { type: "triangle", volume: 0.035, attaque: 0.4, filtre: 900, dest: bus }));
        if (temps === 0) note(midi(acc[0] - 12), t, beat * 2, { type: "sine", volume: 0.12, attaque: 0.02, dest: bus });
        if (temps === 2) note(midi(acc[2] - 12), t, beat * 1.5, { type: "sine", volume: 0.09, attaque: 0.02, dest: bus });
        // arpège de piano électrique (deux croches par temps, avec des silences)
        for (let k = 0; k < 2; k++) {
          if (Math.random() < 0.35) continue;
          const n = acc[Math.floor(Math.random() * 4)] + 12 + (Math.random() < 0.3 ? 12 : 0);
          note(midi(n), t + k * beat / 2 + Math.random() * 0.02, beat * 1.2, { type: "sine", volume: 0.05, attaque: 0.01, dest: bus });
        }
        if (temps === 0 || temps === 2) bruitPlanifie(t, 0.25, 0.12, 150, 60, bus);          // grosse caisse feutrée
        if (temps === 1 || temps === 3) bruitPlanifie(t, 0.15, 0.05, 2500, 800, bus, "bandpass"); // caisse claire douce
        bruitPlanifie(t + beat / 2, 0.05, 0.025, 9000, 6000, bus, "highpass");                // charleston
      },
    },
    // Rétro-synthé pour le flipper : basse en croches, arpège brillant, batterie électronique.
    synthwave: {
      tempo: 116,
      accords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], // Am F C G
      jouerTemps(t, temps, mesure, bus) {
        const acc = this.accords[mesure % 4];
        const beat = 60 / this.tempo;
        for (let k = 0; k < 2; k++) note(midi(acc[0] - 24), t + k * beat / 2, beat / 2.2, { type: "sawtooth", volume: 0.09, filtre: 700, dest: bus });
        for (let k = 0; k < 4; k++) {
          const n = acc[(temps * 4 + k) % 3] + 12 * (k % 2 ? 2 : 1);
          note(midi(n), t + k * beat / 4, beat / 5, { type: "square", volume: 0.03, filtre: 3000, dest: bus });
        }
        if (temps === 0) acc.forEach((n) => note(midi(n), t, beat * 4, { type: "sawtooth", volume: 0.02, attaque: 0.3, filtre: 1500, dest: bus }));
        note(55, t, 0.25, { type: "sine", volume: 0.35, glisse: 30, dest: bus }); // grosse caisse à chaque temps
        if (temps === 1 || temps === 3) bruitPlanifie(t, 0.2, 0.18, 3000, 1000, bus, "bandpass");
        bruitPlanifie(t + beat / 2, 0.04, 0.05, 10000, 7000, bus, "highpass");
      },
    },
  };

  Object.assign(MORCEAUX, {
    // Bonbons : pop sucrée, basse rebondissante et arpège de clochettes
    sucre: {
      tempo: 124,
      accords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
      jouerTemps(t, temps, mesure, bus) {
        const acc = this.accords[mesure % 4], beat = 60 / this.tempo;
        note(midi(acc[0] - 24), t, beat * .45, { type: "triangle", volume: 0.16, dest: bus });
        note(midi(acc[(temps + 1) % 3] - 12), t + beat / 2, beat * .3, { type: "triangle", volume: 0.1, dest: bus });
        [0, 1].forEach((k) => note(midi(acc[(temps * 2 + k) % 3] + 12), t + k * beat / 2, beat * .4, { type: "sine", volume: 0.06, dest: bus }));
        if (temps === 3) note(midi(acc[2] + 24), t + beat / 2, beat * .3, { type: "sine", volume: 0.04, dest: bus });
        if (temps % 2) bruitPlanifie(t, 0.08, 0.12, 2000, 1200, bus, "bandpass");
        if (temps % 2 === 0) note(60, t, 0.18, { type: "sine", volume: 0.25, glisse: 40, dest: bus });
      },
    },
    // Blocomania : chiptune originale (mélodie en la mineur, basse en octaves)
    chiptune: {
      tempo: 140,
      melodie: [76, 71, 72, 74, 72, 71, 69, 69, 72, 76, 74, 72, 71, 71, 72, 74, 76, 72, 69, 69, 0, 74, 77, 81, 79, 77, 76, 72, 76, 74, 72, 71],
      basse: [45, 45, 52, 52, 48, 48, 43, 43],
      jouerTemps(t, temps, mesure, bus) {
        const beat = 60 / this.tempo, i = (mesure * 4 + temps) % 32;
        [0, 1].forEach((k) => {
          const n = this.melodie[(i + k * 0) % 32];
          if (k === 0 && n) note(midi(n), t, beat * .8, { type: "square", volume: 0.045, dest: bus });
          note(midi(this.basse[mesure % 8] + (k ? 12 : 0)), t + k * beat / 2, beat * .4, { type: "triangle", volume: 0.12, dest: bus });
        });
        bruitPlanifie(t + beat / 2, 0.03, 0.05, 9000, 7000, bus, "highpass");
        if (temps % 2) bruitPlanifie(t, 0.08, 0.1, 3000, 1500, bus, "bandpass");
      },
    },
    // Rail Rush : électro qui avance (grosse caisse à chaque temps, basse à contretemps)
    course: {
      tempo: 128,
      accords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
      jouerTemps(t, temps, mesure, bus) {
        const acc = this.accords[mesure % 4], beat = 60 / this.tempo;
        note(55, t, 0.22, { type: "sine", volume: 0.4, glisse: 32, dest: bus });
        note(midi(acc[0] - 24), t + beat / 2, beat * .4, { type: "sawtooth", volume: 0.1, filtre: 600, dest: bus });
        bruitPlanifie(t + beat / 2, 0.05, 0.07, 9000, 6000, bus, "highpass");
        if (temps === 1 || temps === 3) bruitPlanifie(t, 0.15, 0.14, 2500, 900, bus, "bandpass");
        if (temps === 0 || temps === 2) acc.forEach((n) => note(midi(n), t + beat * .75, beat * .25, { type: "square", volume: 0.025, filtre: 2500, dest: bus }));
        note(midi(acc[(mesure + temps) % 3] + 12), t + beat / 4, beat / 5, { type: "square", volume: 0.03, filtre: 3000, dest: bus });
      },
    },
    // Flipper : rock ! guitares saturées en croches, batterie qui cogne
    rock: {
      tempo: 152,
      riff: [40, 40, 43, 45, 40, 40, 47, 45], // mi, sol, la, si (notes MIDI graves)
      jouerTemps(t, temps, mesure, bus) {
        const beat = 60 / this.tempo;
        const f = this.riff[(mesure % 2) * 4 + temps];
        guitare(midi(f), t, beat * .45, { volume: 0.1, dest: bus, etouffe: true });
        guitare(midi(f), t + beat / 2, beat * .4, { volume: 0.08, dest: bus, etouffe: temps !== 3 });
        note(midi(f - 12), t, beat * .9, { type: "triangle", volume: 0.14, dest: bus });
        if (temps === 0 || temps === 2) note(60, t, 0.25, { type: "sine", volume: 0.45, glisse: 35, dest: bus });
        if (temps === 1 || temps === 3) { bruitPlanifie(t, 0.2, 0.3, 4000, 1200, bus, "bandpass"); note(200, t, 0.1, { type: "triangle", volume: 0.12, dest: bus }); }
        bruitPlanifie(t, 0.05, 0.06, 10000, 7000, bus, "highpass");
        bruitPlanifie(t + beat / 2, 0.05, 0.06, 10000, 7000, bus, "highpass");
        if (mesure % 4 === 3 && temps === 3) bruitPlanifie(t, 0.8, 0.12, 12000, 5000, bus, "highpass"); // cymbale
      },
    },
  });

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  // `t` est un décalage en secondes par rapport à maintenant, comme pour note() et bruit().
  function bruitPlanifie(t, duree, volume, de, a, bus, type = "lowpass") {
    bruit(t, duree, { volume, de, a, type, dest: bus });
  }

  let lecture = null;
  const musique = {
    jouer(nom) {
      const a = audio();
      if (!a || !MORCEAUX[nom]) return;
      musique.arreter();
      const m = MORCEAUX[nom];
      const bus = a.createGain();
      bus.gain.value = 0.9;
      bus.connect(maitre);
      const beat = 60 / m.tempo;
      let prochain = a.currentTime + 0.1;
      let n = 0;
      const minuteur = setInterval(() => {
        while (prochain < a.currentTime + 0.3) {
          m.jouerTemps(Math.max(0, prochain - a.currentTime), n % 4, Math.floor(n / 4), bus);
          prochain += beat;
          n++;
        }
      }, 50);
      lecture = { minuteur, bus };
    },
    arreter() {
      if (!lecture) return;
      clearInterval(lecture.minuteur);
      const bus = lecture.bus;
      try {
        bus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => bus.disconnect(), 1500);
      } catch (e) {}
      lecture = null;
    },
  };

  return {
    jouer(nom, ...args) {
      if (coupe || !effets[nom]) return;
      try { effets[nom](...args); } catch (e) {}
    },
    musique,
    get coupe() { return coupe; },
    basculer() {
      coupe = !coupe;
      try { localStorage.setItem("mj-muet", coupe ? "1" : "0"); } catch (e) {}
      if (maitre) maitre.gain.value = coupe ? 0 : 0.8;
      return coupe;
    },
  };
})();
