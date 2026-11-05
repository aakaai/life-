// Idées d'habitudes pour démarrer (pré-remplissent le formulaire, tout reste modifiable).
export const SUGGESTIONS = [
  { name: 'Ma séance de sport', emoji: '🚴', kind: 'check', frequency: 'daily', moment: 'evening', auto: 'sport_session' },
  { name: 'Protéines atteintes', emoji: '🥚', kind: 'check', frequency: 'daily', moment: 'evening', auto: 'protein' },
  { name: 'Pesée du samedi', emoji: '⚖️', kind: 'check', frequency: 'weekly', times: 1, moment: 'morning', auto: 'weigh_in' },
  { name: 'Boire de l’eau', emoji: '💧', kind: 'quantity', target: 2, unit: 'L', step: 0.5, frequency: 'daily', moment: 'day' },
  { name: 'Lire', emoji: '📖', kind: 'quantity', target: 20, unit: 'min', step: 10, frequency: 'daily', moment: 'evening' },
  { name: 'Réviser', emoji: '📚', kind: 'quantity', target: 60, unit: 'min', step: 15, frequency: 'weekly', times: 4, moment: 'day' },
  { name: 'Étirements', emoji: '🧘', kind: 'check', frequency: 'weekly', times: 5, moment: 'evening', auto: 'stretch', reminder_time: '22:45' },
  { name: 'Coucher avant minuit', emoji: '🌙', kind: 'check', frequency: 'daily', moment: 'evening' },
  { name: 'Pas de snack', emoji: '🍫', kind: 'avoid', frequency: 'daily', moment: 'day' },
  { name: 'Escalade', emoji: '🧗', kind: 'check', frequency: 'monthly', times: 4, moment: 'day' },
  { name: 'Ranger le kot', emoji: '🧹', kind: 'check', frequency: 'weekly', times: 1, moment: 'day' },
  { name: 'Bilan du budget', emoji: '💶', kind: 'check', frequency: 'monthly_task', day_of_month: 1, moment: 'evening' }
]
