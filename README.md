# Life

Application perso pour organiser sport, alimentation, école et budget.
Une PWA : elle s'ouvre dans le navigateur et s'installe sur l'écran d'accueil du téléphone comme une vraie app.

- **Interface** : React + Vite, hébergée gratuitement sur GitHub Pages
- **Données** : Supabase (base PostgreSQL gratuite), synchronisées entre téléphone et ordi
- **Déploiement** : automatique, à chaque `git push` sur `main`

---

## Installation (à faire une fois, ±45 min)

### 1. Prérequis

- [Node.js](https://nodejs.org) version 20 ou plus (`node -v` pour vérifier)
- [Git](https://git-scm.com)
- Un compte [GitHub](https://github.com) et un compte [Supabase](https://supabase.com) (gratuits)

### 2. Tester l'app en local (sans Supabase)

```bash
npm install
npm run dev
```

Ouvre l'adresse affichée (http://localhost:5173). Sans configuration Supabase, l'app tourne en **mode local** :
tout fonctionne, mais les données restent dans ce navigateur.

### 3. Créer la base Supabase

1. Sur supabase.com : **New project**. Nom : `life`. Région : une région européenne (Paris ou Francfort).
   Note le mot de passe de la base quelque part, même si l'app ne l'utilise pas.
2. Menu **SQL Editor** > **New query** : colle le contenu de `supabase/migrations/000_fondations.sql`, puis **Run**.
   Tu dois voir « Success. No rows returned ».
3. Menu **Authentication** > **Users** > **Add user** > **Create new user** :
   ton e-mail + un mot de passe, coche **Auto Confirm User**. C'est ton compte pour te connecter à l'app.
4. Toujours dans **Authentication**, dans les réglages de connexion (**Sign In / Providers**) :
   désactive **Allow new users to sign up**. Comme ça, personne d'autre ne peut se créer un compte.
5. Dans les **paramètres du projet**, section **API** (ou **API Keys**), copie :
   - la **Project URL** (`https://xxxx.supabase.co`)
   - la clé **publishable** (ou **anon / public** selon l'affichage). Jamais la clé `secret` ou `service_role`.

### 4. Brancher Supabase en local

Copie `.env.example` en `.env.local`, colle les deux valeurs, puis relance `npm run dev`.
L'app demande maintenant de se connecter : utilise le compte créé à l'étape 3.3.
Dans **Réglages**, enregistre ton prénom : s'il apparaît sur l'accueil, la base fonctionne.

### 5. Mettre l'app en ligne avec GitHub Pages

1. Sur GitHub : **New repository**, nom `life`. Public ou privé :
   - public : gratuit, le code est visible mais tes données restent protégées dans Supabase ;
   - privé : GitHub Pages demande alors GitHub Pro, gratuit pour les étudiants avec le GitHub Student Developer Pack.
2. Dans le dossier du projet :
   ```bash
   git init
   git add .
   git commit -m "Étape 0 : fondations"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/life.git
   git push -u origin main
   ```
3. Sur GitHub, dans le repo : **Settings** > **Secrets and variables** > **Actions** > **New repository secret**, deux fois :
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la clé publishable
4. **Settings** > **Pages** > **Source** : choisis **GitHub Actions**.
5. Onglet **Actions** : relance le workflow « Déployer Life » (**Run workflow**) ou fais un nouveau push.
   Après 1 à 2 minutes, l'app est en ligne sur `https://TON-PSEUDO.github.io/life/`.

### 6. Installer l'app sur ton téléphone

- **iPhone** (Safari) : ouvre l'adresse > bouton **Partager** > **Sur l'écran d'accueil**.
- **Android** (Chrome) : ouvre l'adresse > menu ⋮ > **Installer l'application**.

Connecte-toi une fois, la session reste ouverte.

---

## Module Sport : mise en place

1. **SQL Editor** > New query : colle `supabase/migrations/001_sport.sql`, puis **Run**.
2. **Edge Functions** > Deploy a new function > **Via Editor** : nom `calendar-sync`,
   colle `supabase/functions/calendar-sync/index.ts`, puis **Deploy function**.
3. Dans l'app : **Sport** > ⚙︎ > **Agendas reliés** : colle l'adresse secrète iCal de ton agenda Google.
   Ne la partage nulle part ailleurs.

Comment la semaine se construit :
- chaque lundi, la semaine type de la phase en cours (Base 1, examens, voyage, Base 2, construction, pic) ;
- une semaine sur quatre est allégée ;
- si un événement de ton agenda prend un créneau, la séance glisse (même jour plus tard, ou autre jour)
  en respectant les règles du programme, avec une note qui explique le déplacement ;
- mots-clés dans les titres : escalade, examen, voyage (modifiables dans les réglages) ;
- une séance faite ou sautée ne bouge plus ; une séance ratée est reportée si c'est possible.

## Module Alimentation : mise en place

1. **SQL Editor** > New query : colle `supabase/migrations/002_alimentation.sql`, puis **Run**.
2. C'est tout : la table Ciqual est intégrée à l'app, et Open Food Facts est interrogé directement.

Ce que fait le module :
- cible du jour = dépense de base (Mifflin-St Jeor × activité) + surplus + séances sport du jour
  (vélo : 1 kJ ≈ 1 kcal, calculé depuis la FTP ou la puissance moyenne notée ; muscu : 200 kcal) ;
- 110 g de protéines, lipides 28 %, glucides pour le reste ; conseils de glucides avant une sortie longue ;
- recherche dans la table Ciqual (Anses, 3 484 aliments), scan des codes-barres (ZXing en WebAssembly + Open Food Facts),
  favoris, récents, « comme hier », recettes avec poids cuit ;
- pesées, moyenne sur 7 jours, ajustement de ±150 kcal toutes les 2 semaines (à partir de la 4e semaine).

**v0.5 (recettes, planning, courses)** : colle aussi `supabase/migrations/003_recettes_courses.sql` dans le SQL Editor.
- base de recettes de départ (`src/modules/alimentation/seed.js`) installée au premier lancement : ingrédients avec
  prix Colruyt estimés (à corriger depuis la liste de courses ou « Ingrédients et prix ») ;
- planning de la semaine : une recette par repas, plats en lot répartis sur les jours suivants, glisser-déposer sur ordinateur ;
- portions ajustées : seuls les féculents (riz, pâtes, pain, flocons, pommes de terre) changent pour atteindre la cible du jour ;
- liste de courses par période (d'un jour de courses à la veille du suivant ; lundi et jeudi par défaut), par rayon, en paquets, avec le prix ;
- pesée une fois par semaine (samedi) : ajustement d'après la tendance des 3 dernières pesées.

**v0.6 (menus automatiques, batch cooking)** : colle aussi `supabase/migrations/004_menus_auto.sql`.
- recettes de base retirées : les recettes sont créées dans l'app (les ingrédients et leurs prix restent) ;
- chaque dimanche, l'app propose les menus de la semaine suivante (bouton « Proposer / Reproposer » à tout moment) :
  boîte pour chaque midi à l'école (lu dans l'horaire de cours relié comme agenda « Horaire de cours », sinon jours réglés),
  un seul plat cuisiné en lot la veille au soir, restes utilisés pendant 3 jours, ravitaillement les jours de sortie longue ;
- fiche de batch cooking : quantités totales et répartition des féculents par portion selon la cible de chaque jour.

Pour régénérer la table Ciqual : `python3 scripts/build-ciqual.py ciqual_2025_complete.json`.
Données : Anses, Table de composition nutritionnelle des aliments Ciqual 2025 (Licence Ouverte) ; Open Food Facts (ODbL).

## Module École : mise en place

1. **SQL Editor** : colle `supabase/migrations/005_ecole.sql`, puis **Run** (ajoute la salle et la description des événements).
2. **Edge Functions › calendar-sync › Code** : remplace par le nouveau `supabase/functions/calendar-sync/index.ts`, puis **Deploy**
   (lit maintenant 30 jours en arrière et 6 mois à venir, avec la salle).
3. Dans l'app : **Sport › Réglages › Agendas reliés** : ajoute le lien iCal d'Hyperplanning avec le type **Horaire de cours**.

L'horaire sert à trois endroits : l'onglet École (aujourd'hui, semaine façon Calendrier Apple, mes cours),
le planning sport (les cours comptent comme occupés) et les menus (midis à l'école = boîte).

## À savoir

- **Mise en pause de Supabase** : sur l'offre gratuite, un projet sans activité pendant 7 jours est mis en pause.
  Si tu utilises l'app tous les jours, ça n'arrivera pas. Sinon : tableau de bord Supabase > **Resume project**
  (tes données sont conservées).
- **Sauvegardes** : l'offre gratuite ne fait pas de sauvegarde automatique.
  **Réglages** > **Exporter mes données** télécharge tout en JSON ; fais-le de temps en temps.
- **Mises à jour de l'app** : après un déploiement, l'app installée se met à jour toute seule au prochain lancement.

---

## Organisation du code

```
src/
  modules.js            ← la liste des modules (nav, accueil et export se construisent à partir d'ici)
  lib/
    store.js            ← accès aux données (Supabase ou mode local, même interface)
    supabase.js         ← connexion Supabase
    auth.jsx            ← connexion / déconnexion
    profile.js          ← profil utilisateur
    dates.js            ← semaines du lundi au dimanche, formats belges
  components/           ← éléments réutilisables (navigation, icônes)
  pages/                ← accueil, réglages, connexion, page d'un module
  modules/
    sport/
      data.js           ← le programme : exercices, séances, semaine type, saison
      planner.js        ← construit la semaine et la réorganise selon tes agendas
      progression.js    ← double progression, charges proposées, stagnation
      api.js            ← lecture / écriture des données sport
      zwift.js          ← export .zwo
      *.jsx             ← écrans : semaine, séance muscu, séance vélo, réglages
supabase/migrations/    ← un fichier SQL par étape, à exécuter dans l'ordre
supabase/functions/     ← fonctions Supabase (lecture des agendas)
tests/                  ← `npm test` : vérifie le planning et la progression
```

**Ajouter un bloc sur l'accueil** = une entrée dans `src/modules.js` (nom, couleur de la palette, icône, résumé).
Il apparaît aussitôt sur l'accueil, dans la barre latérale et dans « Plus ».
Quand le module est codé : un dossier dans `src/modules/`, un fichier SQL dans `supabase/migrations/`,
puis renseigner `component` et `tables`.

**Style** : mélange Notion × Apple, défini dans `src/styles.css` (police du système, palette Notion,
listes groupées et barre d'onglets façon iOS). Thème clair ou sombre selon le réglage de l'appareil.
Couleurs libres pour de futurs blocs : `--gray`, `--brown`, `--orange`, `--red`.

## Feuille de route

| Étape | Contenu | État |
|---|---|---|
| 0 | Fondations : structure, navigation, connexion, PWA, déploiement, accueil en blocs | ✅ |
| 1 | Sport : semaine automatique, lien agenda, mode séance muscu, vélo + Zwift | ✅ v0.3 |
| 1b | Sport : écran progrès, test FTP, import Garmin, Hyperplanning | |
| 2 | Alimentation : cible du jour liée au sport, journal, scan, recettes, poids | ✅ v0.4 |
| 2b | Alimentation : base de recettes, planning des repas, portions ajustées, liste de courses avec prix | ✅ v0.5 |
| 2c | Alimentation : menus proposés chaque dimanche, batch cooking, boîtes pour l'école | ✅ v0.6 |
| 2d | Alimentation : historique, lien Budget | |
| 3 | École (horaires) : aujourd'hui, semaine, mes cours, lien sport et menus | ✅ v0.7 |
| 4 | Budget | |
| 5 | Connexions entre modules, bilan hebdo | |
