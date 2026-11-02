// Registre des blocs (modules) de l'app.
// Ajouter un bloc = ajouter une entrée ici : l'accueil, la navigation
// et l'export des données se construisent automatiquement à partir de cette liste.
//
// color : une des couleurs de la palette (voir styles.css, inspirée de Notion)
// icon  : nom d'une icône de src/components/Icon.jsx
// step  : étape de la feuille de route où le module sera construit
// component : la page du module, une fois codée (null = « à venir »)
// homeWidget : bloc facultatif affiché en haut de l'accueil

import SportModule from './modules/sport/SportModule'
import SportToday from './modules/sport/TodayTile'
import { SPORT_TABLES } from './modules/sport/api'

export const MODULES = [
  {
    id: 'sport',
    label: 'Sport',
    color: 'var(--blue)',
    icon: 'sport',
    path: '/sport',
    step: 1,
    summary: 'Muscu, vélo et escalade : séances, planning et progression.',
    tables: SPORT_TABLES,
    component: SportModule,
    homeWidget: SportToday
  },
  {
    id: 'alimentation',
    label: 'Alimentation',
    color: 'var(--green)',
    icon: 'alimentation',
    path: '/alimentation',
    step: 2,
    summary: 'Repas, protéines et calories, liste de courses.',
    tables: [],
    component: null
  },
  {
    id: 'ecole',
    label: 'École',
    color: 'var(--purple)',
    icon: 'ecole',
    path: '/ecole',
    step: 3,
    summary: 'Cours, échéances, examens et révisions.',
    tables: [],
    component: null
  },
  {
    id: 'budget',
    label: 'Budget',
    color: 'var(--yellow)',
    icon: 'budget',
    path: '/budget',
    step: 4,
    summary: 'Dépenses, budget du mois et objectifs d’épargne.',
    tables: [],
    component: null
  }
]

// Tables communes à toute l'app (incluses dans l'export).
export const CORE_TABLES = ['profiles']

export const ALL_TABLES = [...CORE_TABLES, ...MODULES.flatMap((m) => m.tables)]

// Modules affichés directement dans la barre du bas sur téléphone.
// Les autres sont accessibles via « Plus ».
export const MOBILE_PRIMARY = ['sport', 'alimentation', 'ecole']
