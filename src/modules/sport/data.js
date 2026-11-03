// Données du programme sport (voir le document « Programme sport »).
// Tout ce qui décrit le programme vit ici : exercices, séances, semaine type,
// saison vélo. La base de données ne stocke que ce que tu fais (journal).

/* ---------- Exercices ---------- */
// load : 'two' = deux haltères, 'one' = un seul haltère, 'bw' = poids du corps, 'time' = gainage (secondes)
export const EXERCISES = {
  floor_press: {
    name: 'Développé couché au sol', load: 'two', start: 10,
    cues: 'Genoux pliés, coudes à environ 45° du corps. Les bras touchent le sol sans s’y reposer.'
  },
  row_1arm: {
    name: 'Rowing un bras, appui sur chaise', load: 'one', start: 13, unilateral: true,
    cues: 'Dos plat. Tire le coude vers la hanche, pas vers l’épaule.'
  },
  shoulder_press: {
    name: 'Développé épaules assis', load: 'two', start: 7,
    cues: 'Assis dos droit, sans cambrer. Haltères jusqu’au niveau des oreilles.'
  },
  pushups: {
    name: 'Pompes', load: 'bw',
    cues: 'Corps gainé d’un bloc, poitrine jusqu’à 5 cm du sol. Arrête-toi 2 répétitions avant l’échec. Au-delà de 20, pieds surélevés.'
  },
  lateral_raise: {
    name: 'Élévations latérales', load: 'two', start: 4,
    cues: 'Monte jusqu’à l’horizontale, coudes légèrement fléchis, sans élan.'
  },
  curl: {
    name: 'Curl haltères', load: 'two', start: 7,
    cues: 'Coudes fixés le long du corps.'
  },
  overhead_triceps: {
    name: 'Extension triceps au-dessus de la tête', load: 'one', start: 9,
    cues: 'Un haltère tenu à deux mains. Coudes vers le plafond, descends derrière la nuque.'
  },
  bent_row: {
    name: 'Rowing penché deux haltères', load: 'two', start: 12,
    cues: 'Buste à environ 45°, dos plat. Serre les omoplates en haut.'
  },
  floor_press_neutral: {
    name: 'Développé au sol prise neutre', load: 'two', start: 10,
    cues: 'Paumes face à face : plus doux pour les épaules.'
  },
  pullover: {
    name: 'Pull-over au sol', load: 'one', start: 10,
    cues: 'Bras presque tendus. Descends derrière la tête tant que le bas du dos reste collé au sol.'
  },
  rear_delt: {
    name: 'Oiseau (élévations buste penché)', load: 'two', start: 3,
    cues: 'Arrière d’épaule : bon contre la posture voûtée du vélo.'
  },
  hammer_curl: {
    name: 'Curl marteau', load: 'two', start: 7,
    cues: 'Paumes face à face.'
  },
  skull_crusher: {
    name: 'Extension triceps couché au sol', load: 'two', start: 6,
    cues: 'Seuls les avant-bras bougent.'
  },
  bulgarian: {
    name: 'Fente bulgare (pied arrière sur une chaise)', load: 'two', start: 8, unilateral: true,
    cues: 'Genou avant dans l’axe du pied. Descente lente, remontée explosive. Au-delà de 10 répétitions à charge maximale, descente en 3-4 s.'
  },
  rdl: {
    name: 'Soulevé de terre roumain', load: 'two', start: 11,
    cues: 'Jambes presque tendues, hanches vers l’arrière, dos plat. Quand la charge maximale devient facile, passe sur une jambe.'
  },
  calf: {
    name: 'Mollets debout sur une jambe', load: 'one', start: 10, unilateral: true,
    cues: 'Sur une marche, amplitude complète, 1 seconde de pause en bas.'
  },
  plank: { name: 'Planche', load: 'time', cues: 'Fessiers serrés, ne creuse pas le dos.' },
  side_plank: { name: 'Gainage latéral', load: 'time', unilateral: true, cues: 'Corps aligné de la tête aux pieds.' },
  dead_bug: { name: 'Dead bug', load: 'bw', unilateral: true, cues: 'Bas du dos plaqué au sol tout le long.' },
  lunges_bw: { name: 'Fentes au poids du corps', load: 'bw', unilateral: true, cues: 'Grand pas, genou arrière qui frôle le sol.' },
  pushups_decline: { name: 'Pompes pieds surélevés', load: 'bw', cues: 'Pieds sur une chaise ou un lit, corps gainé.' }
}

/* ---------- Séances de musculation ---------- */
// sets × [min, max] ; rest en secondes
export const WORKOUTS = {
  haut_a: {
    name: 'Haut A — poussée', duration: 50, upper: true,
    items: [
      { ex: 'floor_press', sets: 3, reps: [8, 12], rest: 150 },
      { ex: 'row_1arm', sets: 3, reps: [8, 12], rest: 120 },
      { ex: 'shoulder_press', sets: 3, reps: [8, 12], rest: 120 },
      { ex: 'pushups', sets: 2, reps: [5, 30], rest: 90 },
      { ex: 'lateral_raise', sets: 3, reps: [12, 20], rest: 90 },
      { ex: 'curl', sets: 2, reps: [10, 15], rest: 90 },
      { ex: 'overhead_triceps', sets: 2, reps: [10, 15], rest: 90 }
    ]
  },
  haut_b: {
    name: 'Haut B — tirage', duration: 50, upper: true, pull: true,
    items: [
      { ex: 'bent_row', sets: 3, reps: [8, 12], rest: 150, pull: true },
      { ex: 'floor_press_neutral', sets: 3, reps: [10, 15], rest: 120 },
      { ex: 'pullover', sets: 3, reps: [10, 15], rest: 90, pull: true },
      { ex: 'lateral_raise', sets: 3, reps: [12, 20], rest: 90 },
      { ex: 'rear_delt', sets: 3, reps: [12, 20], rest: 90 },
      { ex: 'hammer_curl', sets: 3, reps: [10, 15], rest: 90, pull: true },
      { ex: 'skull_crusher', sets: 2, reps: [10, 15], rest: 90 }
    ]
  },
  // 4e séance (ajoutée le 3 nov.) : plus de volume pour les épaules et les bras, un peu de pecs.
  // Placée le jeudi (jour libre, sortie longue en endurance) ; retirée en semaine allégée, examens et voyage.
  haut_c: {
    name: 'Haut C — épaules et bras', duration: 40, upper: true,
    items: [
      { ex: 'shoulder_press', sets: 3, reps: [8, 12], rest: 120 },
      { ex: 'lateral_raise', sets: 3, reps: [12, 20], rest: 75 },
      { ex: 'pushups_decline', sets: 2, reps: [5, 25], rest: 90 },
      { ex: 'curl', sets: 3, reps: [10, 15], rest: 75 },
      { ex: 'overhead_triceps', sets: 3, reps: [10, 15], rest: 75 },
      { ex: 'rear_delt', sets: 2, reps: [12, 20], rest: 60 }
    ]
  },
  jambes: {
    name: 'Jambes & tronc', duration: 40, legs: true,
    items: [
      { ex: 'bulgarian', sets: 3, reps: [6, 10], rest: 150 },
      { ex: 'rdl', sets: 3, reps: [8, 12], rest: 150 },
      { ex: 'calf', sets: 3, reps: [10, 15], rest: 60 },
      { ex: 'plank', sets: 3, reps: [30, 45], rest: 60 },
      { ex: 'side_plank', sets: 2, reps: [30, 30], rest: 45 },
      { ex: 'dead_bug', sets: 2, reps: [10, 10], rest: 45 }
    ]
  },
  poids_du_corps: {
    name: 'Poids du corps (voyage)', duration: 30,
    items: [
      { ex: 'pushups', sets: 3, reps: [5, 30], rest: 90 },
      { ex: 'lunges_bw', sets: 3, reps: [10, 15], rest: 90 },
      { ex: 'pushups_decline', sets: 2, reps: [5, 25], rest: 90 },
      { ex: 'plank', sets: 3, reps: [30, 45], rest: 60 }
    ]
  }
}

// Variantes appliquées par le planificateur
export const VARIANTS = {
  normal: { label: null },
  allegee: { label: 'Allégée', hint: 'Escalade proche : sans rowing, pull-over ni curl.' },
  express: { label: 'Express', hint: 'Journée chargée : 3 premiers exercices, 2 séries.' },
  recup: { label: 'Semaine allégée', hint: 'Mêmes charges, moitié des séries.' },
  poids_du_corps: { label: 'Poids du corps', hint: 'Voyage : séance sans haltères.' }
}

// Construit la liste réelle d'exercices d'une séance selon sa variante
export function workoutItems(key, variant = 'normal') {
  if (variant === 'poids_du_corps') return WORKOUTS.poids_du_corps.items
  let items = WORKOUTS[key]?.items || []
  if (variant === 'allegee') items = items.filter((it) => !it.pull)
  if (variant === 'express') items = items.slice(0, 3).map((it) => ({ ...it, sets: 2 }))
  if (variant === 'recup') items = items.map((it) => ({ ...it, sets: Math.ceil(it.sets / 2) }))
  return items
}

/* ---------- Séances vélo ---------- */
// blocs : minutes, % de FTP (bas, haut). reps pour les blocs répétés.
export const RIDES = {
  sweet_spot: {
    name: 'Sweet spot', hard: true,
    build: (w) => {
      const plan = [[2, 15], [2, 20], [2, 20], [3, 15], [3, 15], [3, 20], [3, 20]]
      const [n, len] = plan[Math.min(w, plan.length - 1)]
      return [
        { min: 15, lo: 55, hi: 70, label: 'Échauffement' },
        { repeat: n, work: { min: len, lo: 88, hi: 94, label: 'Sweet spot' }, rest: { min: 5, lo: 50, hi: 55, label: 'Récupération' } },
        { min: 10, lo: 50, hi: 55, label: 'Retour au calme' }
      ]
    }
  },
  seuil: {
    name: 'Seuil', hard: true,
    build: (w) => {
      const plan = [[3, 10], [3, 12], [2, 15], [2, 20]]
      const [n, len] = plan[Math.min(w, plan.length - 1)]
      return [
        { min: 15, lo: 55, hi: 70, label: 'Échauffement' },
        { repeat: n, work: { min: len, lo: 95, hi: 102, label: 'Seuil' }, rest: { min: 5, lo: 50, hi: 55, label: 'Récupération' } },
        { min: 10, lo: 50, hi: 55, label: 'Retour au calme' }
      ]
    }
  },
  vo2_3015: {
    name: '30/15 de Rønnestad', hard: true,
    build: () => [
      { min: 20, lo: 55, hi: 70, label: 'Échauffement' },
      { repeat: 3, work: { min: 9.75, lo: 120, hi: 130, label: '13 × (30 s fort, 15 s facile)', micro: { reps: 13, on: 30, off: 15, offPct: 50 } }, rest: { min: 3, lo: 50, hi: 55, label: 'Récupération' } },
      { min: 10, lo: 50, hi: 55, label: 'Retour au calme' }
    ]
  },
  z2_long: { name: 'Sortie longue Z2', long: true, build: (w, min = 165) => [{ min, lo: 56, hi: 75, label: 'Endurance' }] },
  z2_sprints: {
    name: 'Z2 + 6 sprints', build: (w, min = 90) => [
      { min: 20, lo: 56, hi: 75, label: 'Endurance' },
      { repeat: 6, work: { min: 1 / 6, lo: 150, hi: 200, label: 'Sprint 10 s à fond' }, rest: { min: 3, lo: 56, hi: 65, label: 'Récupération' } },
      { min: Math.max(min - 20 - 16, 10), lo: 56, hi: 75, label: 'Endurance' }
    ]
  },
  z2: { name: 'Endurance Z2', build: (w, min = 50) => [{ min, lo: 56, hi: 75, label: 'Endurance' }] }
}

export function rideBlocks(key, weekInPhase = 0, minutes) {
  return RIDES[key].build(weekInPhase, minutes)
}

// Déplie les blocs en segments simples { min, pct } (graphique, énergie dépensée).
export function rideSegments(blocks) {
  const out = []
  for (const b of blocks) {
    if (!b.repeat) {
      out.push({ min: b.min, pct: (b.lo + b.hi) / 2 })
      continue
    }
    for (let i = 0; i < b.repeat; i++) {
      if (b.work.micro) {
        for (let j = 0; j < b.work.micro.reps; j++) {
          out.push({ min: b.work.micro.on / 60, pct: (b.work.lo + b.work.hi) / 2 })
          out.push({ min: b.work.micro.off / 60, pct: b.work.micro.offPct })
        }
      } else out.push({ min: b.work.min, pct: (b.work.lo + b.work.hi) / 2 })
      if (i < b.repeat - 1) out.push({ min: b.rest.min, pct: (b.rest.lo + b.rest.hi) / 2 })
    }
  }
  return out
}

// Travail mécanique estimé en kJ (≈ kcal dépensées, règle des applis d'entraînement).
export function rideKj(blocks, ftp) {
  return Math.round(rideSegments(blocks).reduce((t, s) => t + (s.min * 60 * ftp * s.pct) / 100, 0) / 1000)
}

export function blocksDuration(blocks) {
  return Math.round(
    blocks.reduce((s, b) => s + (b.repeat ? b.repeat * b.work.min + (b.repeat - 1) * b.rest.min : b.min), 0)
  )
}

/* ---------- Saison ---------- */
export const SEASON_START = '2026-11-02' // lundi de la semaine 1
export const PHASES = [
  { key: 'base1', name: 'Base 1', from: '2026-11-02', to: '2026-12-20' },
  { key: 'examens', name: 'Examens et fêtes', from: '2026-12-21', to: '2027-01-22' },
  { key: 'voyage', name: 'Voyage', from: '2027-01-23', to: '2027-02-07' },
  { key: 'base2', name: 'Base 2', from: '2027-02-08', to: '2027-03-14' },
  { key: 'build', name: 'Construction', from: '2027-03-15', to: '2027-05-23' },
  { key: 'peak', name: 'FTP au plus haut', from: '2027-05-24', to: '2027-06-27' }
]

/* ---------- Semaine type ----------
   day : 0 = lundi … 6 = dimanche ; time : heure préférée ; priority : ordre de placement */
export function weekTemplate(phaseKey) {
  const build = phaseKey === 'build' || phaseKey === 'peak'
  const quality = build ? 'vo2_3015' : phaseKey === 'base2' ? 'seuil' : 'sweet_spot'
  // Haut C : optionnelle (retirée en semaine allégée et pendant les examens), jamais en voyage
  const hautC = phaseKey === 'voyage' ? [] : [{ key: 'haut_c', kind: 'muscu', day: 3, time: '16:00', optional: true, priority: 9 }]
  // Jusqu'à fin janvier (Base 1, examens, voyage) : 3 sorties seulement (choix du 3 nov.),
  // pour laisser de la place à la muscu du haut et aux examens. Les Z2 courtes reviennent en Base 2.
  const winter = ['base1', 'examens', 'voyage'].includes(phaseKey)
  return [
    ...hautC,
    { key: 'haut_a', kind: 'muscu', day: 0, time: '18:00', priority: 4 },
    { key: quality, kind: 'velo', day: 1, time: '17:30', priority: 2 },
    ...(winter ? [] : [{ key: 'z2', kind: 'velo', day: 2, time: '17:30', minutes: 45, optional: true, priority: 8 }]),
    { key: 'haut_b', kind: 'muscu', day: 2, time: '18:30', priority: 5 },
    { key: 'z2_long', kind: 'velo', day: 3, time: '10:00', minutes: 165, priority: 1 },
    { key: 'z2_sprints', kind: 'velo', day: 4, time: '09:00', minutes: 90, priority: 6 },
    { key: 'jambes', kind: 'muscu', day: 4, time: '16:00', priority: 3 },
    // en phase de construction, le dimanche devient une séance au seuil ; en hiver, repos
    ...(build
      ? [{ key: 'seuil', kind: 'velo', day: 6, time: '18:30', priority: 2.5 }]
      : winter ? [] : [{ key: 'z2', kind: 'velo', day: 6, time: '19:00', minutes: 50, priority: 7 }])
  ]
}

/* ---------- Réglages par défaut ---------- */
export const DEFAULT_SETTINGS = {
  ftp: 210,
  handle_kg: 2,
  plates_total_kg: 22,
  plate_step_kg: 1,
  // fenêtres où tu acceptes de t'entraîner, du lundi (0) au dimanche (6)
  availability: [
    [{ from: '17:15', to: '22:00' }],
    [{ from: '17:15', to: '22:00' }],
    [{ from: '17:15', to: '22:00' }],
    [{ from: '08:00', to: '21:00' }],
    [{ from: '08:00', to: '21:00' }],
    [],
    [{ from: '18:00', to: '22:00' }]
  ],
  keywords: {
    escalade: ['escalade', 'grimpe', 'bloc', 'climbing'],
    examen: ['examen', 'exam'],
    voyage: ['voyage', 'vacances à', 'trip']
  },
  rest_sound: true
}
