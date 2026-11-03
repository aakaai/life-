// Registre des blocs (modules) de l'app.
// Ajouter un bloc = ajouter une entrée ici : l'accueil, la navigation
// et l'export des données se construisent automatiquement à partir de cette liste.
//
// color : une des couleurs de la palette (voir styles.css, inspirée de Notion)
// icon  : nom d'une icône de src/components/Icon.jsx
// step  : étape de la feuille de route où le module sera construit
// component : la page du module, une fois codée (null = « à venir »)
// homeWidget : ancien bloc de l'accueil (plus affiché depuis v0.19 : l'accueil a sa propre mise en page)
// homeOrder : position du bloc sur l'accueil (plus petit = plus haut, 10 par défaut)

import SportModule from './modules/sport/SportModule'
import SportToday from './modules/sport/TodayTile'
import { SPORT_TABLES } from './modules/sport/api'
import FoodModule from './modules/alimentation/FoodModule'
import FoodToday from './modules/alimentation/TodayTile'
import { FOOD_TABLES } from './modules/alimentation/api'
import EcoleModule from './modules/ecole/EcoleModule'
import SchoolToday from './modules/ecole/TodayTile'
import BudgetModule from './modules/budget/BudgetModule'
import BudgetToday from './modules/budget/TodayTile'
import { BUDGET_TABLES } from './modules/budget/api'
import HabitsModule from './modules/habitudes/HabitsModule'
import HabitsToday from './modules/habitudes/TodayTile'
import { HABIT_TABLES } from './modules/habitudes/api'
import { AGENDA_TABLES } from './modules/agenda/api'
import TasksModule from './modules/taches/TasksModule'
import { TASK_TABLES } from './modules/taches/api'

export const MODULES = [
  {
    id: 'taches',
    label: 'Tâches',
    color: 'var(--orange)',
    icon: 'taches',
    path: '/taches',
    step: 6,
    summary: 'Tes tâches : aujourd’hui, à venir, sans date, priorité et date limite.',
    tables: TASK_TABLES,
    component: TasksModule
  },
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
    summary: 'Cible du jour selon tes séances, repas, protéines et poids.',
    tables: FOOD_TABLES,
    component: FoodModule,
    homeWidget: FoodToday
  },
  {
    id: 'ecole',
    label: 'École',
    color: 'var(--purple)',
    icon: 'ecole',
    path: '/ecole',
    step: 3,
    summary: 'Ton horaire de cours (Hyperplanning) : aujourd’hui, semaine, salles.',
    tables: [],
    component: EcoleModule,
    homeWidget: SchoolToday
  },
  {
    id: 'budget',
    label: 'Budget',
    color: 'var(--yellow)',
    icon: 'budget',
    path: '/budget',
    step: 4,
    summary: 'Reste à dépenser, dépenses, abonnements et objectifs d’épargne.',
    tables: BUDGET_TABLES,
    component: BudgetModule,
    homeWidget: BudgetToday
  },
  {
    id: 'habitudes',
    label: 'Habitudes',
    color: 'var(--pink)',
    icon: 'habitudes',
    path: '/habitudes',
    step: 5,
    summary: 'Habitudes du jour, de la semaine et du mois : séries, calendrier et bilans.',
    tables: HABIT_TABLES,
    component: HabitsModule,
    homeWidget: HabitsToday,
    homeOrder: 0
  }
]

// Tables communes à toute l'app (incluses dans l'export) : profil et agenda de l'accueil.
export const CORE_TABLES = ['profiles', ...AGENDA_TABLES]

export const ALL_TABLES = [...CORE_TABLES, ...MODULES.flatMap((m) => m.tables)]

// Modules affichés directement dans la barre du bas sur téléphone.
// Les autres sont accessibles via « Plus ».
export const MOBILE_PRIMARY = ['sport', 'alimentation', 'ecole']
