// Souplesse (v0.26) : étirements du soir et séances de mobilité.
// Tout est décrit ici (mouvements, durées, consignes) ; la base ne stocke que les séances
// prévues (planned_sessions, kind 'etirements' ou 'mobilite') et si elles sont faites.
// Fonctions pures, testées dans tests/souplesse.test.mjs.

export const SOFT_KINDS = ['etirements', 'mobilite']
export const isSoft = (s) => SOFT_KINDS.includes(s?.kind)

export const SOUPLESSE = {
  stretchDays: [6, 0, 1, 2, 3], // dimanche → jeudi (0 = lundi) ; pas le vendredi ni le samedi
  stretchTime: '22:45',
  mobilityKeys: ['mob_a', 'mob_b'], // 2 séances par semaine, jours choisis par le planning
  mobilityTime: '20:30', // heure préférée, dans tes disponibilités
  mobilityGap: 2, // au moins 2 jours entre les deux séances
  prep: 10, // secondes pour se mettre en place avant un mouvement
  switch: 5 // secondes pour changer de côté
}

/* ---------- Mouvements ---------- */
// secs : durée d'un passage ; sides : un passage par côté ; rounds : nombre de passages
export const MOVES = {
  mollet_tendu: {
    name: 'Mollet jambe tendue, contre le mur', zone: 'Mollet', secs: 45, sides: true,
    cue: 'Mains au mur, jambe arrière tendue, talon bien au sol, pied droit. Avance le bassin jusqu’à sentir le mollet. Pas de rebonds.'
  },
  mollet_plie: {
    name: 'Mollet genou plié', zone: 'Tendon d’Achille', secs: 45, sides: true,
    cue: 'Face au mur, pied arrière à plat, genou arrière fléchi : l’étirement descend vers le talon. Respire lentement, pas de rebonds.'
  },
  fente_basse: {
    name: 'Fente basse', zone: 'Devant de la hanche', secs: 45, sides: true,
    cue: 'Genou arrière au sol (sur un coussin). Serre le fessier du côté arrière et avance doucement le bassin, buste droit.'
  },
  ischios_serviette: {
    name: 'Arrière des cuisses, avec une serviette', zone: 'Ischios', secs: 45, sides: true,
    cue: 'Sur le dos, serviette sous le pied, jambe tendue vers le plafond. Tire doucement ; l’autre jambe reste au sol.'
  },
  genoux_poitrine: {
    name: 'Genoux à la poitrine', zone: 'Bas du dos', secs: 45,
    cue: 'Sur le dos, ramène les deux genoux vers la poitrine et laisse le bas du dos s’arrondir. Petits balancements possibles.'
  },
  torsion: {
    name: 'Torsion allongée', zone: 'Bas du dos', secs: 30, sides: true,
    cue: 'Sur le dos, bras en croix, laisse tomber les genoux pliés d’un côté. Les épaules restent au sol, regarde de l’autre côté.'
  },
  enfant: {
    name: 'Posture de l’enfant', zone: 'Dos, détente', secs: 45,
    cue: 'Fesses vers les talons, bras devant, front au sol. Respire lentement par le ventre.'
  },
  chat_vache: {
    name: 'Chat-vache', zone: 'Bas du dos', secs: 60,
    cue: 'À quatre pattes : arrondis le dos en expirant, puis creuse doucement en inspirant. Lent, environ 8 cycles.'
  },
  cercles_hanche: {
    name: 'Cercles de hanche à quatre pattes', zone: 'Hanches', secs: 45, sides: true,
    cue: 'Genou plié, dessine le plus grand cercle possible avec le genou sans bouger le bassin. 5 cercles dans chaque sens.'
  },
  hanche_90_90: {
    name: 'Position 90/90', zone: 'Hanches', secs: 45, sides: true, rounds: 2,
    cue: 'Assis, une jambe devant et une derrière, genoux à 90°. Buste droit, penche-toi doucement au-dessus du tibia avant.'
  },
  genou_mur: {
    name: 'Genou au mur', zone: 'Cheville', secs: 45, sides: true, rounds: 2,
    cue: 'Pied à une main du mur : avance le genou pour toucher le mur sans décoller le talon. Une dizaine d’allers-retours ; recule le pied si c’est facile.'
  },
  descente_marche: {
    name: 'Descente lente sur une marche', zone: 'Tendon d’Achille', secs: 45, sides: true, rounds: 2,
    cue: 'Sur une marche, monte sur les deux pieds, puis descends sur un seul en 4 secondes, talon sous la marche. Environ 8 fois, en te tenant au mur. Une légère gêne va, pas une douleur vive.'
  },
  fente_rotation: {
    name: 'Fente avec rotation', zone: 'Hanches, haut du dos', secs: 45, sides: true,
    cue: 'Grande fente, main opposée au sol : ouvre l’autre bras vers le plafond en suivant la main des yeux. Alterne doucement.'
  },
  bird_dog: {
    name: 'Bird dog', zone: 'Bas du dos', secs: 45, sides: true,
    cue: 'À quatre pattes, tends le bras et la jambe opposés, tiens 2 secondes, reviens. Dos plat, le bassin ne bascule pas.'
  },
  squat_profond: {
    name: 'Squat profond tenu', zone: 'Chevilles, hanches', secs: 60,
    cue: 'Pieds largeur d’épaules, descends le plus bas possible talons au sol. Tiens-toi à un meuble si besoin ; les coudes écartent les genoux.'
  },
  respiration: {
    name: 'Respiration allongée', zone: 'Détente', secs: 60,
    cue: 'Sur le dos, genoux pliés, une main sur le ventre. Inspire 4 secondes par le nez, expire 6 secondes.'
  },
  livre_ouvert: {
    name: 'Livre ouvert', zone: 'Haut du dos', secs: 45, sides: true, rounds: 2,
    cue: 'Allongé sur le côté, genoux pliés à 90°, bras tendus devant. Ouvre le bras du dessus vers l’arrière en suivant la main des yeux, genoux collés.'
  },
  extension_serviette: {
    name: 'Extension sur serviette roulée', zone: 'Haut du dos', secs: 60, rounds: 2,
    cue: 'Serviette roulée en travers sous les omoplates, mains derrière la tête. Laisse le haut du dos s’ouvrir sans cambrer le bas du dos. Décale la serviette d’un cran au 2e passage.'
  },
  fil_aiguille: {
    name: 'Fil de l’aiguille', zone: 'Haut du dos', secs: 45, sides: true,
    cue: 'À quatre pattes, glisse un bras sous l’autre jusqu’à poser l’épaule, puis ouvre-le vers le plafond. Lentement.'
  },
  glisses_mur: {
    name: 'Glissés au mur', zone: 'Épaules', secs: 45, rounds: 2,
    cue: 'Dos, tête et avant-bras contre le mur : glisse les bras vers le haut sans décoller les coudes. Si l’épaule pince, réduis l’amplitude.'
  },
  ytw: {
    name: 'Y-T-W sans poids', zone: 'Épaules, haut du dos', secs: 45, rounds: 3,
    cue: 'Allongé sur le ventre, lève les bras en Y, puis en T, puis en W, pouces vers le plafond. Serre les omoplates, sans charge.'
  },
  pecs_porte: {
    name: 'Pectoraux à la porte', zone: 'Pectoraux', secs: 45, sides: true,
    cue: 'Avant-bras sur le cadre de la porte, coude à hauteur d’épaule, avance doucement. Rien ne doit faire mal dans l’épaule.'
  },
  passe_serviette: {
    name: 'Passages avec une serviette', zone: 'Épaules', secs: 45, rounds: 2,
    cue: 'Serviette tenue large à deux mains : passe bras tendus de devant à derrière la tête, puis reviens. Écarte les mains si ça bloque.'
  },
  enfant_bras: {
    name: 'Posture de l’enfant, bras tendus', zone: 'Dos, flancs', secs: 60,
    cue: 'Fesses vers les talons, bras loin devant. Marche avec les mains d’un côté puis de l’autre pour étirer les flancs.'
  }
}

/* ---------- Routines ---------- */
export const ROUTINES = {
  etirements: {
    name: 'Étirements du soir', short: 'Étirements', sub: 'Mollets, tendon d’Achille, hanches, bas du dos',
    where: 'Sur le lit ou un tapis',
    moves: ['mollet_tendu', 'mollet_plie', 'fente_basse', 'ischios_serviette', 'genoux_poitrine', 'torsion', 'enfant']
  },
  mob_a: {
    name: 'Mobilité A — hanches, chevilles, bas du dos', short: 'Mobilité A', sub: 'Hanches, chevilles, bas du dos',
    where: 'Un tapis, une marche, un mur',
    moves: ['chat_vache', 'cercles_hanche', 'hanche_90_90', 'genou_mur', 'descente_marche', 'fente_rotation', 'bird_dog', 'squat_profond', 'respiration']
  },
  mob_b: {
    name: 'Mobilité B — haut du dos et épaules', short: 'Mobilité B', sub: 'Haut du dos et épaules, en douceur',
    where: 'Un tapis, un mur, une porte, une serviette',
    moves: ['chat_vache', 'livre_ouvert', 'extension_serviette', 'fil_aiguille', 'glisses_mur', 'ytw', 'pecs_porte', 'passe_serviette', 'enfant_bras']
  }
}

export const routineOf = (session) => ROUTINES[session?.template_key] || ROUTINES.etirements

/**
 * Déroulé complet d'une routine : mise en place, passages, changements de côté.
 * @returns [{ type: 'prep'|'work'|'switch', move, index, side, round, secs }]
 */
export function routineSteps(key, { prep = SOUPLESSE.prep, sw = SOUPLESSE.switch } = {}) {
  const r = ROUTINES[key] || ROUTINES.etirements
  const out = []
  r.moves.forEach((mk, index) => {
    const m = MOVES[mk]
    const rounds = m.rounds || 1
    const sides = m.sides ? ['droit', 'gauche'] : [null]
    let first = true
    for (let round = 1; round <= rounds; round++) {
      for (const side of sides) {
        if (first) out.push({ type: 'prep', move: mk, index, side, round, secs: prep })
        else out.push({ type: 'switch', move: mk, index, side, round, secs: sw })
        out.push({ type: 'work', move: mk, index, side, round, secs: m.secs })
        first = false
      }
    }
  })
  return out
}

export const stepsDuration = (steps) => steps.reduce((s, x) => s + x.secs, 0)
export const routineSeconds = (key) => stepsDuration(routineSteps(key))
// Durée affichée dans le planning (minutes, arrondie à 5)
export const routineMinutes = (key) => Math.max(5, Math.round(routineSeconds(key) / 300) * 5)

// « 45 s par côté », « 45 s par côté × 2 », « 60 s × 2 »
export function moveDose(mk) {
  const m = MOVES[mk]
  const base = `${m.secs} s${m.sides ? ' par côté' : ''}`
  return m.rounds > 1 ? `${base} × ${m.rounds}` : base
}

// « 9 min 45 »
export function fmtMinSec(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`
}

/**
 * Avance le chrono : où en est-on à l'instant `now` ? (rattrape le temps passé app fermée)
 * @param state { idx, endAt, paused, left } ; steps : routineSteps(...)
 * @returns { idx, endAt, finished, advanced }
 */
export function advance(state, steps, now) {
  if (state.paused) return { ...state, finished: false, advanced: 0 }
  let { idx, endAt } = state
  let advanced = 0
  while (idx < steps.length && now >= endAt) {
    idx++
    advanced++
    if (idx < steps.length) endAt += steps[idx].secs * 1000
  }
  return { ...state, idx, endAt, finished: idx >= steps.length, advanced }
}

// Index du premier passage du mouvement suivant (bouton « Passer ce mouvement »)
export function nextMoveIndex(steps, idx) {
  const cur = steps[idx]?.index
  const j = steps.findIndex((s, i) => i > idx && s.index !== cur)
  return j === -1 ? steps.length : j
}
