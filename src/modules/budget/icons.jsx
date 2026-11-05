// Icônes au trait du Budget (v0.21, demande du 3 nov. : plus d'emoji Apple).
// La colonne `emoji` des catégories et objectifs garde maintenant une clé d'icône ('courses', 'voyages'…) ;
// les anciennes valeurs (emoji) et les noms sont reconnus pour retrouver la bonne icône.

const P = {
  courses: <><path d="M3 4.5h2.5l2.2 10h10.1l2-7H6.4" /><circle cx="9" cy="19" r="1.4" /><circle cx="16.5" cy="19" r="1.4" /></>,
  resto: <><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5" /><path d="M17 21V3c-2 1.5-3 4-3 7v3h3" /></>,
  cafe: <><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M9 3.5c-.6.8-.6 1.7 0 2.5M12.5 3.5c-.6.8-.6 1.7 0 2.5" /></>,
  logement: <><path d="M4 10.5L12 4l8 6.5" /><path d="M6 9v10.5h4.5V14h3v5.5H18V9" /></>,
  transport: <><path d="M4.5 16.5v-4L6.6 7h10.8l2.1 5.5v4" /><path d="M4.5 12.5h15" /><circle cx="8" cy="16.5" r="1.8" /><circle cx="16" cy="16.5" r="1.8" /></>,
  sport: <><circle cx="6" cy="16.5" r="3.5" /><circle cx="18" cy="16.5" r="3.5" /><path d="M6 16.5l4-7h5.5M10 9.5l3.5 7H18M14 6h2.5l2 3" /></>,
  ecole: <><path d="M2.5 9L12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v4.5c1.5 1.3 3.4 2 5.5 2s4-.7 5.5-2V11M21.5 9v5" /></>,
  livres: <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" />,
  sorties: <><path d="M4 7h16v3.2a1.8 1.8 0 0 0 0 3.6V17H4v-3.2a1.8 1.8 0 0 0 0-3.6z" /><path d="M14.5 7.5v1.5M14.5 11.25v1.5M14.5 15v1.5" /></>,
  musique: <><path d="M9 17.5V6l10-2v11.5" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="15.5" r="2.5" /></>,
  abos: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>,
  voyages: <path d="M12 2.8c.8 0 1.3.8 1.3 1.8v5l7 4.1v2l-7-2.1v4.1l2.1 1.6v1.5L12 20.1l-3.4.7v-1.5l2.1-1.6v-4.1l-7 2.1v-2l7-4.1v-5c0-1 .5-1.8 1.3-1.8z" />,
  sante: <path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z" />,
  vetements: <path d="M9 4l-5 2.5 1.5 4L8 9.5V20h8V9.5l2.5 1 1.5-4L15 4c-.5 1.5-1.6 2.3-3 2.3S9.5 5.5 9 4z" />,
  tech: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 17.5h2" /></>,
  cadeau: <><rect x="4" y="9" width="16" height="4" rx="1" /><path d="M5.5 13v7h13v-7M12 9v11" /><path d="M12 9c-1-3-5-4-5-1.5C7 9 12 9 12 9zM12 9c1-3 5-4 5-1.5C17 9 12 9 12 9z" /></>,
  divers: <><path d="M4 8l8-4 8 4v8.5l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8.5" /></>,
  revenus: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><path d="M15.5 14.5h2.5" /></>,
  epargne: <><ellipse cx="12" cy="6.5" rx="6.5" ry="2.5" /><path d="M5.5 6.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5M5.5 11.5v5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-5" /></>,
  objectif: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.8" /><circle cx="12" cy="12" r="1.3" /></>,
  deco: <><path d="M7 13.5h10l-1.4 6.5H8.4z" /><path d="M12 13.5V8.5M12 10.5c-2.6 0-4.2-1.6-4.2-4.2 2.6 0 4.2 1.6 4.2 4.2zM12 9.5c2.6 0 4.2-1.6 4.2-4.2-2.6 0-4.2 1.6-4.2 4.2z" /></>,
  casque: <><path d="M4 15a8 8 0 0 1 16 0v1H4z" /><path d="M9 7.5l1.5 3.5M15 7.5l-1.5 3.5M12 7v4" /></>,
  inconnu: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.5" /><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none" /></>
}

// Icônes proposées dans le choix (catégories et objectifs)
export const ICON_CHOICES = ['courses', 'resto', 'cafe', 'logement', 'transport', 'sport', 'ecole', 'livres', 'sorties', 'musique', 'abos', 'voyages', 'sante', 'vetements', 'tech', 'cadeau', 'divers', 'epargne', 'objectif', 'casque', 'deco']

const FROM_EMOJI = {
  '🛒': 'courses', '🍔': 'resto', '🍕': 'resto', '🍽': 'resto', '☕': 'cafe', '🏠': 'logement', '🏡': 'logement', '🚗': 'transport', '⛽': 'transport', '🚆': 'transport', '🚌': 'transport',
  '🚴': 'sport', '🚲': 'sport', '🏋': 'sport', '🎓': 'ecole', '📚': 'livres', '📖': 'livres', '🎉': 'sorties', '🍻': 'sorties', '🎬': 'sorties', '🎵': 'musique', '🎧': 'musique',
  '🔁': 'abos', '✈': 'voyages', '🏖': 'voyages', '💊': 'sante', '❤': 'sante', '👕': 'vetements', '👟': 'vetements', '📱': 'tech', '💻': 'tech', '🎁': 'cadeau', '📦': 'divers',
  '💶': 'revenus', '💰': 'epargne', '🐷': 'epargne', '🎯': 'objectif', '⛑': 'casque', '🪖': 'casque'
}
const FROM_NAME = [
  [/course|supermarch|colruyt|aldi|lidl|delhaize/, 'courses'], [/resto|repas|restaurant|fast|snack|pizza/, 'resto'], [/caf[eé]/, 'cafe'],
  [/logement|loyer|kot|maison/, 'logement'], [/transport|essence|carburant|voiture|train|bus/, 'transport'], [/sport|v[eé]lo|gym|escalade/, 'sport'],
  [/[eé]cole|cours|[eé]tude|universit/, 'ecole'], [/livre/, 'livres'], [/sortie|soir[eé]e|bar|cin[eé]/, 'sorties'], [/musique|concert/, 'musique'],
  [/abonnement/, 'abos'], [/voyage|vacance|tha[iï]lande|vietnam/, 'voyages'], [/sant[eé]|pharma|m[eé]decin/, 'sante'], [/v[eê]tement|habit|chaussure/, 'vetements'],
  [/tech|t[eé]l[eé]phone|informatique|ordi/, 'tech'], [/cadeau/, 'cadeau'], [/[eé]pargne|urgence/, 'epargne'], [/casque/, 'casque'], [/d[eé]co/, 'deco'], [/divers|autre/, 'divers']
]

export function iconOf(item, fallback = 'divers') {
  const raw = String(item?.emoji || '').replace(/️/g, '').trim()
  if (P[raw]) return raw
  if (raw) for (const ch of Array.from(raw)) if (FROM_EMOJI[ch]) return FROM_EMOJI[ch]
  const name = String(item?.name || '').toLowerCase()
  for (const [re, key] of FROM_NAME) if (re.test(name)) return key
  return fallback
}

export function BudgetIcon({ name, size = 20, stroke = 1.7, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] || P.divers}
    </svg>
  )
}

// Petite pastille grise avec l'icône (listes : opérations, abonnements, réglages)
export function IconTile({ name }) {
  return <span className="cat-tile icon-tile"><BudgetIcon name={name} size={19} /></span>
}

export function IconPicker({ value, onChange }) {
  return (
    <div className="icon-pick" role="radiogroup" aria-label="Icône">
      {ICON_CHOICES.map((k) => (
        <button type="button" key={k} role="radio" aria-checked={value === k} aria-label={k} className={value === k ? 'is-on' : ''} onClick={() => onChange(k)}>
          <BudgetIcon name={k} size={20} />
        </button>
      ))}
    </div>
  )
}
