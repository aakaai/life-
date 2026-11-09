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

**4e séance muscu (v0.14, 3 nov.)** : « Haut C — épaules et bras » (40 min : développé épaules, élévations latérales,
pompes pieds surélevés, curl, extension triceps, oiseau), le jeudi à 16 h après la sortie longue. Optionnelle : retirée
les semaines allégées et pendant les examens, jamais en voyage ; jamais la veille ou le lendemain de Haut A (donc pas le dimanche).

**3 sorties vélo jusqu'à fin janvier (v0.17, 3 nov.)** : en Base 1, examens et voyage, la semaine garde le sweet spot
(mardi), la sortie longue (jeudi) et Z2 + sprints (vendredi). Les Z2 courtes du mercredi et du dimanche reviennent
en Base 2 (8 février) : le dimanche soir devient un repos, pour laisser de la place à la muscu du haut et aux examens.

**Semaine en cartes (v0.20, 3 nov.)** : chaque jour est une carte (séances avec heure, durée, statut et bouton
« Démarrer »). 5 jours de face sur ordinateur (4 ou 3 sur écran moyen), 2 sur téléphone ; les jours suivants s'inclinent
en perspective à droite, les jours passés se replient à gauche. La page s'ouvre sur aujourd'hui (carte gris clair).
Flèches ‹ ›, touches ← → du clavier, balayage du doigt ou du trackpad ; après dimanche on passe à la semaine suivante.
« Démarrer » lance directement le mode séance (muscu) ou ouvre la sortie (vélo) ; toucher la séance ouvre son détail.
v0.20.1 : sur ordinateur, aujourd'hui est la carte du milieu (2 jours avant, 2 après) ; sur téléphone elle reste en premier.

**Progrès** (onglet à côté de « Semaine ») : exécute une fois `supabase/migrations/008_progres_ftp.sql`
(historique des tests FTP). L'écran montre, sur 4 semaines, 12 semaines, 6 mois ou tout :
- vélo : temps de selle et énergie (kJ) par semaine, puissance moyenne de chaque sortie face à ta FTP ;
- muscu : 1RM estimé par exercice (Epley), charge soulevée par semaine, records ;
- régularité (séances faites / prévues) et poids (pesées du module Alimentation).
« Nouveau test » enregistre une FTP (95 % de ta moyenne sur 20 min) et met à jour les réglages.
Chaque graphique a un tableau « Données » ; survole (ou touche) un graphique pour lire les valeurs.

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

## Module Budget : mise en place

1. **SQL Editor** : colle `supabase/migrations/007_budget.sql`, puis **Run**.
2. Ouvre **Budget** : au premier lancement, fixe un montant par mois pour chaque catégorie (ou laisse vide).

- saisie manuelle des dépenses et revenus (bouton +), catégorie devinée d'après le commerçant, raccourcis pour les dépenses fréquentes ;
- abonnements et revenus réguliers ajoutés automatiquement le bon jour, rappel 3 jours avant un renouvellement ;
- reste à dépenser par catégorie (orange à 80 %, rouge au-delà), appui long pour changer un budget ;
- objectifs d'épargne (montant par semaine pour y arriver), bilan du mois, export CSV ;
- pas de lien avec l'Alimentation (choix du 2 nov. 2026).

## Habitudes et Tâches v0.30 : chacun sur une seule page

**Accueil v0.30.2** : tâches et habitudes séparées — d'abord « Tâches du jour » (en retard, puis dans l'ordre de la journée),
puis « Habitudes » en petites cases (habitudes + séances du jour ; toucher = fait, appui long = la fiche sur la page Habitudes,
ou la séance). Les cours ne sont plus dans la liste : ils restent dans le calendrier du jour.

**Accueil v0.30.3** : Habitudes en **bulles** (option A) — gros anneau du jour + « Plus que N aujourd'hui », une bulle par habitude
ou séance dans l'ordre de la journée, de la couleur de sa catégorie, pleine quand c'est fait (anneau qui se remplit pour l'eau ou
les « X fois par semaine »), nom + petite info dessous. Tâches (option 2) — encadré rouge pâle **« Important »** en haut
(priorité haute ou en retard), puis le reste par heure (sans heure ensuite, basse priorité en dernier et en gris), les faites en bas ;
rond à cocher de la couleur de la catégorie et « ● École » sous le titre (plus de « !!! » ni d'étiquette à droite).

**v0.33 — planning repas : reset du samedi** : plus de menus proposés tout seuls. Dès le samedi matin, le planning s'ouvre sur la semaine suivante (lundi → dimanche), vide, à remplir soi-même (les menus restent proposables à la main) ; rappel « Prépare les menus de la semaine prochaine » dans Alimentation le samedi et le dimanche.

**v0.33.1 — féculents conseillés** : les recettes gardent toujours tes quantités (planning, calories, liste de courses, journal). Pour les féculents, une quantité conseillée s'affiche à côté (« conseillé : 180 g ») selon ta cible du jour : fiche du repas, Aujourd'hui, Prochain repas, batch cooking. Réglage « Conseiller une quantité de féculents » dans les réglages Alimentation.

**v0.32 — habitudes : mieux tenir + routines matin / soir**
- **Journée complète** : quand la dernière habitude du jour est cochée, l'anneau brille (éclat + étincelles) et affiche « Journée complète ✓ » (accueil et page Habitudes) ; petite vibration sur l'app iPhone après réinstallation depuis Xcode.
- **Relance** : un 2e rappel 1 h après, seulement si l'habitude n'est toujours pas cochée (jamais après 23:30).
- **Ta semaine** : le dimanche dès 19 h (notification) et le lundi, carte sur l'accueil avec la grille 7 jours × habitudes, le % tenu et la comparaison avec la semaine d'avant ; « Faire mon bilan » ouvre le bilan guidé, avec la même grille.
- **Routines** : routine du matin = habitudes « Matin », routine du soir = séance d'étirements du jour + habitudes « Soir ». Une habitude à la fois en plein écran (« Fait · suivante », « Passer »), les étirements se lancent avec le chrono puis reviennent à la routine, anneau qui brille à la fin. Sur l'app iPhone, la routine s'ouvre toute seule une fois quand Life est ouvert le matin (4 h → midi) ou le soir (dès 22:45) — c'est l'app Raccourcis qui ouvre Life (guide dans Habitudes › Gérer › Routines, avec l'ordre des habitudes et l'heure du soir). Carte « Commencer / Reprendre » sur l'accueil pendant le créneau.

**v0.31.2 — tâches** (accueil et page Tâches) : à faire = contour de la couleur de la catégorie ; faite = rond vert plein avec coche blanche.

**v0.31 — « Retour au kot »** : du lundi au samedi, une petite ligne en haut de l'accueil « À prendre dimanche · 3 »
(le + ou un toucher ouvre la liste : ajouter, retirer). Le dimanche, un bloc « Retour au kot » à cocher remplace la ligne
toute la journée (caché si la liste est vide, « Tout est prêt ✓ » quand tout est coché), avec un rappel iPhone à 12:00
s'il reste des choses. Le lundi, la liste repart vide (même ce qui n'était pas coché). **À lancer : `020_retour_kot.sql`.**

**v0.30.5 — accueil : habitudes en cases** comme sur la page Habitudes (icône, rond à cocher, nom, petite info ;
case teintée = fait, remplie par le bas pour les quantités), toujours dans l'ordre de la journée. L'anneau du jour et le
calendrier reprennent le **rose d'origine des Habitudes** ; icônes lisibles en thème sombre.

**v0.30.4 — couleurs « doux pastel »** (option 4) sur l'accueil (Tâches, Habitudes), la page Habitudes et la page Tâches :
anneau du jour et calendrier en lavande, catégories en pastel (bulles, cases, ronds à cocher, projets), icônes et coches
en version foncée de la couleur pour rester lisibles ; le rouge reste vif (retard, Important, écart). Le reste de l'app ne change pas.

**Habitudes**
- En haut, la journée : anneau « 5/7 » et ce qu'il reste (flèches pour regarder hier).
- Les habitudes en **cases**, rangées Matin / Journée / Soir : **un toucher = fait** (quantité : chaque toucher ajoute
  un pas et la case se remplit ; « à éviter » : toucher = écart, la case devient rouge ; automatiques marquées « auto »).
- **Appui long** (ou clic droit) : la fiche de l'habitude — régler la quantité, série, record, taux sur 30 jours,
  son calendrier, Modifier / Pause (3 jours, 1 ou 2 semaines) / Archiver.
- En bas, le calendrier (depuis ta première habitude) ; « Calendrier détaillé » et les bilans sont derrière la roue dentée (Gérer).
- **Création rapide** : nom + rythme (chaque jour, 1×, 3×, 5× par semaine, 4× par mois) + moment ; « Plus d'options » ouvre le formulaire complet.
- **v0.30.1 — séances dans les habitudes** : chaque séance du jour (vélo, muscu, mobilité, étirements) a sa case, prise du planning Sport,
  rangée selon son heure et comptée dans l'anneau. Toucher = faite (comme dans Sport), appui long = ouvrir la séance.
  Les jours sans séance, rien n'apparaît. Les habitudes automatiques « séance du jour » et « étirements » ne sont plus affichées en double (elles restent dans Gérer).

**Tâches**
- Une seule page : **Aujourd'hui** (en retard + du jour, les faites du jour en bas), **Bientôt** (7 jours, par jour),
  **Projets** en cases, puis Plus tard / Sans date / Terminées à déplier. Recherche (loupe).
- **Projets** : nom, couleur, icône, date de fin facultative ; avancement 4/10 ; fiche avec ses tâches, « + Ajouter une tâche au projet »,
  Terminer / Rouvrir, Supprimer (les tâches sont gardées).
- **Rappel par tâche** : à l'heure, 15 min ou 1 h avant (tâche avec heure), le jour même à 9 h, la veille à 20 h.
  Notification sur l'iPhone avec « Fait ✓ » (pas besoin de réinstaller l'app : passe par les rappels d'habitudes).
- SQL : **`019_projets.sql`** (table `task_projects`, colonnes `tasks.project_id` et `tasks.reminder`). Sans lui, tout marche sauf projets et rappels.

## Budget v0.29 : un gros compte Épargne et des sous-comptes

- Un **gros compte « Épargne »** (créé tout seul) : tout l'argent mis de côté arrive là. Sa carte montre le total,
  ce que tu as ajouté sur la période, la part **pas encore répartie** (hachurée) et deux boutons : **Mettre de côté** et **Répartir**.
- **Répartir** : une fiche avec chaque sous-compte (Vacances, Vélo, Déco…) et un montant à donner, raccourcis
  « Partager également », « Vers les objectifs », « Remettre à 0 » ; le reste peut rester libre.
  Répartir ne compte pas dans « Épargné » (c'est le même argent, rangé).
- Les anciens comptes deviennent des **sous-comptes** (liseré vert) : « Remettre dans Épargne », Retirer, Virer.
  Une dépense peut être payée avec « Épargne (libre) » ou un sous-compte.
- Style : titres en pastille (Catégories en gris, Comptes en vert) et traits qui s'estompent entre les sections.
- **v0.29.1 — objectif par mois** : avec un montant visé et une date, l'app calcule **combien mettre de côté par mois**
  (mois en cours compris, aperçu en direct dans la fiche du compte) ; la case affiche « 137 €/mois » puis « mois ✓ ».
  Le détail montre **« En novembre : 50 € sur 137 € »** et ce qu'il reste à mettre ce mois-ci (une dépense payée avec le
  compte le fait monter). Le montant du mois est calculé depuis le solde du 1er du mois, il ne bouge pas pendant le mois.
  Fiche Épargne : total demandé par tes objectifs chaque mois ; fiche Répartir : bouton « Ce qu'il faut en novembre ».
- Aucune migration.

## Budget v0.28 : une seule page, mois ou année

- Plus d'onglets : tout le Budget tient sur **une page** qu'on fait défiler — en haut **Mois / Année** et les flèches
  (toute la page suit), le **reste à dépenser** avec le bilan en une ligne (revenus · dépenses · épargné · solde) et la
  comparaison avec la période d'avant, l'alerte des prélèvements des 3 prochains jours, puis **Catégories**,
  **Opérations** (5 dernières + « Tout voir » : recherche, filtre, toute la période), **Comptes**, **Abonnements et revenus**.
- Vue **Année** : budget mensuel × 12, catégories sur l'année, abonnements et revenus par an d'abord. Le choix Mois / Année est retenu.
- Comptes : sur chaque case, ce que tu y as **ajouté sur la période** (« + 50 € en novembre », « + 420 € en 2026 »),
  et une case **Total** (tous tes comptes, répartition) qui s'ouvre : courbe du total, objectifs réunis, répartition, tous les mouvements.
- Cases compactes (v0.28.1) : catégories et comptes 3 par ligne. Ordinateur : Catégories | Comptes côte à côte, puis Opérations | Abonnements et revenus.
- Aucune migration.

## Budget v0.27 : comptes d'épargne

- L'onglet « Objectifs » devient **Comptes** : des enveloppes où tu mets de l'argent de côté (Vacances, Vélo, Déco, Autre…),
  créées par toi, avec un **objectif facultatif** (montant et date → combien mettre de côté par semaine).
- « + » sur une case : mettre de côté. Toucher une case : solde, courbe, Mettre de côté / Retirer / Virer vers un autre
  compte, historique des mouvements (toucher un mouvement pour le corriger ou le supprimer).
- Une dépense peut être **« payée avec »** un compte : le compte baisse, le budget du mois n'est pas touché
  (impossible de payer plus que ce qu'il y a dedans).
- Bilan du mois : nouvelle ligne **Épargné** (mis de côté − retiré) ; solde = revenus − dépenses − épargné ;
  liste « Payé avec tes comptes ». Export CSV : colonne « Payé avec ».
- Tes anciens objectifs deviennent des comptes, avec ce que tu avais déjà mis de côté comme solde de départ.
- À lancer dans Supabase : `018_comptes.sql`.

## Souplesse v0.26 : étirements du soir et mobilité

- **Étirements du soir** : 10 min du dimanche au jeudi à 22:45 (mollets, tendon d'Achille, hanches, ischios, bas du dos).
- **Mobilité** : 2 séances d'environ 20 min par semaine, placées par le planning (dimanche → jeudi, au moins 2 jours d'écart, de préférence sans muscu). A : hanches, chevilles, bas du dos ; B : haut du dos et épaules, en douceur. Un soir de mobilité remplace les étirements.
- **Mode guidé** : chrono par mouvement et par côté, bips, île dynamique, écran allumé, Pause / Suivant / +15 s, « Ça fait mal ? » pour passer un mouvement. Reprend où tu en étais si tu quittes l'écran.
- **Raté = oublié** : rien n'est reporté.
- **Habitude « Étirements »** : créée toute seule (5 fois par semaine, rappel à 22:45 du dimanche au jeudi), cochée automatiquement quand tu termines les étirements ou une séance de mobilité. Sur l'accueil, c'est elle qui ouvre la séance du jour.
- À lancer dans Supabase : `017_souplesse.sql` (sans lui, la semaine sport fonctionne comme avant et affiche un rappel).

## Sport v0.25 : repos, notes de séance, contrôle de gêne

- Repos : sous le chrono, l'exercice (ou la série) suivant à préparer : séries × reps visées, charge et disques à
  monter (« Par haltère : poignée 2 kg + 7 disques de 1 kg (4 + 3) »), consignes.
- Notes : « Note » sur chaque exercice (gêne / douleur + zone + texte), pendant la séance et au résumé de fin.
- Gêne notée la dernière fois → la séance suivante demande au début « Comment ça va ? » : comme prévu, un cran plus
  bas (la progression repart de là) ou passer l'exercice. « Commencer » attend la réponse.
- Sport › Réglages › « Tester le chrono dans l'île dynamique » : lance un chrono de 30 s et dit pourquoi iOS refuse
  s'il ne s'affiche pas (Activités en direct désactivées…). Demande Pull + ▶︎ dans Xcode.
- À lancer dans Supabase : `016_notes_seance.sql`.

## Agenda v0.24 : catégories avec plus de couleurs

16 couleurs au lieu de 9 (sable, corail, rose pâle, indigo, bleu marine, turquoise, vert pomme en plus), pour l'agenda
et les tâches. Nouvelle catégorie directement en créant un évènement : « + Catégorie » dans la fiche (nom, couleur,
« bloque le sport »), toujours modifiable via ⚙︎ à droite de « Semaine / Mois ». v0.24.1 : « ✎ Modifier » dans la fiche
de l'évènement change le nom, la couleur ou « bloque le sport » de la catégorie choisie, ou la supprime (ses évènements restent). Rien à faire dans Supabase.

## Widget iPhone « Ma journée » (v0.23)

Grand widget (4×4) : calendrier du jour à gauche, à partir de maintenant (agenda Google + Life, cours, sport,
repas prévus ; demain quand la journée est finie), Tâches et Habitudes à droite, cochables sans ouvrir Life.

Comment ça marche : l'app (web ou iPhone) écrit un résumé de ta journée dans la table `widget_feed` à chaque
ouverture, retour dans l'app, changement et toutes les 15 min. Le widget le lit avec ta **clé privée** via la
fonction Edge `widget` (iOS le rafraîchit à peu près toutes les 30 min), et y coche tâches et habitudes. Pas
d'App Group (le compte Apple gratuit ne le garantit pas) : le widget a sa propre copie et sa clé.

Mise en place (une fois) :
1. Supabase › SQL Editor : lance `supabase/migrations/015_widget.sql`.
2. Supabase › Edge Functions › Deploy a new function › Via Editor : nom `widget`, colle
   `supabase/functions/widget/index.ts`, Deploy ; dans ses réglages, désactive **Verify JWT**.
3. GitHub Desktop › Pull, puis ▶︎ dans Xcode (iPhone branché).
4. Life › Réglages › Widget iPhone › **Créer la clé du widget** › Copier.
5. Écran d'accueil de l'iPhone : appui long › + › Life › « Ma journée » (grand) › Ajouter. Puis appui long sur
   le widget › Modifier le widget › colle la clé dans « Clé ».

Nouvelle clé = l'ancienne ne marche plus (à recoller dans le widget). Supprimer la clé désactive le widget.

## Accueil v0.22 : « Prochain repas » qui suit l'heure

La case montre le repas logique du moment, même si rien n'est prévu : avant 10 h petit-déjeuner, 10–12 h collation,
12–14 h 30 midi, 14 h 30–18 h collation, 18–21 h 30 soir, ensuite avant de dormir. Un repas déjà noté fait passer
au suivant. Plat prévu → « Je l'ai mangé » ; rien de prévu → tes 3 aliments ou recettes habituels à ce repas, ajoutés
d'un toucher avec la dernière quantité (« Annuler » pendant 8 s), ou « Autre chose… ». Pastilles des repas notés
(« Petit-déj. ✓ 520 ») et des repas principaux oubliés (« Midi · à noter »). Toujours « + Collation » et « + Repas » ;
l'ajout revient sur l'accueil. Journal : chaque ajout affiche son heure (10:02, 11:05). Rien à faire dans Supabase.

## Budget v0.21 : catégories en cases

Onglet Mois : chaque catégorie est une case (2 par ligne sur téléphone, 4 sur ordinateur) avec ce qu'il reste
(« 77,40 € restants », ou « 11,40 € de trop ») et « dépensé / budget ». Le fond se remplit en gris avec le budget
utilisé ; toute la case passe en rouge si le budget est dépassé. « + » en haut à droite : ajouter une dépense dans
cette catégorie. Toucher la case : détail (dépenses du mois, modifier la catégorie et le budget). Maintenir puis glisser
(souris : glisser) pour changer l'ordre. Catégories sans plafond : sans remplissage, cachées si rien dépensé ce mois-ci.
Plus d'emoji : icônes au trait partout (cases, opérations, abonnements, réglages, choix d'une icône dans la catégorie
ou l'objectif ; les anciens emoji sont reconnus). Objectifs aussi en cases (vert quand atteint, « + » = mettre de côté).
Rien à faire dans Supabase.

## Alimentation v0.20.1 : le journal remplit aussi le planning

Ce que tu ajoutes dans « Aujourd'hui » (recette, ton ingrédient, aliment Ciqual ou de ta base, « comme hier »)
apparaît aussi dans le planning, coché « mangé ». Un aliment Ciqual devient un de tes ingrédients, comme quand tu
l'ajoutes depuis le planning. Si le même plat était déjà prévu à ce repas, il est simplement coché. Changer la quantité
dans le journal la change dans le planning ; supprimer du journal retire aussi du planning (un plat qui était prévu
redevient « prévu »). Les repas notés avant cette version sont rattrapés à l'ouverture du planning. Rien à faire dans Supabase.

## Alimentation v0.12 : collation du matin et aliments seuls

1. **SQL Editor** > New query : colle `supabase/migrations/010_collations_aliments.sql`, puis **Run**.
2. Les repas sont maintenant : petit-déjeuner, **collation du matin**, midi, collation de l'après-midi, soir,
   avant de dormir. Chaque repas peut contenir plusieurs choses (journal et planning : touche « + » autant de fois que tu veux).
3. **Aliment seul dans le planning** (une banane, un yaourt…) : « + » dans un repas, puis tape son nom (rubrique
   « Aliments seuls ») ou « Un aliment seul » pour le choisir dans tes ingrédients ou le créer depuis Ciqual.
   Il compte dans les calories prévues et s'ajoute à la liste de courses (en pièces si l'ingrédient a un poids par pièce).
4. **Tes propres ingrédients et aliments partout (v0.18.2)** : dans le journal (« + » d'une collation ou d'un repas),
   la recherche montre aussi tes ingrédients (Recettes › Ingrédients, étiquette « Ingrédient ») ; sans recherche,
   ils sont listés sous « Mes ingrédients ». Dans le planning, la recherche d'un aliment seul montre aussi les aliments
   que tu as créés ou scannés dans le journal : en choisir un le copie dans tes ingrédients (avec sa portion).

## Module Habitudes : mise en place

1. **SQL Editor** > New query : colle `supabase/migrations/009_habitudes.sql`, puis **Run**.
2. Dans l'app : **Habitudes** › **Gérer** › **Nouvelle habitude** (ou une des idées proposées).

Ce que fait le module :
- types : oui/non, quantité avec objectif (bouton « + »), à éviter (réussie tant que tu ne notes pas d'écart) ;
- rythmes : tous les jours, X fois par semaine, X fois par mois, tâche du mois (à partir d'un jour), défi de 30 jours ;
- rangement par moment (matin, journée, soir) avec la couleur de la catégorie ;
- coches automatiques : séance de sport du jour, protéines atteintes, calories dans la cible (±10 %), pesée ;
- séries et records (en jours, semaines ou mois), **un joker par semaine** (le premier jour raté ne casse pas la série),
  **pauses** sur une période (toutes les habitudes ou une seule) ;
- calendrier de l'année (une case par jour, plus foncée = plus d'habitudes tenues ; toucher une case deux fois ouvre ce jour) ;
- bilans de la semaine et du mois (taux de réussite, comparaison à la période d'avant) et **bilan guidé du dimanche**
  (note, ce qui a marché, ce qui a coincé, objectif de la semaine affiché ensuite sur « Aujourd'hui ») ;
- bloc « Habitudes du jour » en haut de l'accueil, à cocher directement.
La journée se termine à 3 h du matin.

**Rappels (app iPhone, v0.13)** : choisis une heure dans « Rappel » sur une habitude. L'app programme les notifications
des 7 prochains jours (60 au plus) à chaque ouverture et à chaque coche, seulement pour les habitudes pas encore faites
(pas pendant une pause, pas pour « à éviter », plus rien pour un objectif de la semaine déjà atteint).
Bouton **« Fait ✓ »** dans la notification : l'app s'ouvre et coche l'habitude (quantité : objectif atteint).
Toucher la notification ouvre Habitudes. Gérer › « Vérifier mes rappels » indique combien sont programmés.
Après une mise à jour de `ios/` : GitHub Desktop › Pull, puis ▶︎ dans Xcode.

## Accueil et Tâches (v0.19)

1. **SQL Editor** > New query : colle `supabase/migrations/014_taches.sql`, puis **Run**.
2. L'accueil (version A choisie le 3 nov.) :
   - **À faire aujourd'hui** (en haut à gauche) : tâches, habitudes, séances sport et cours, dans l'ordre de la
     journée (En retard, Matin, Après-midi, Soir, Sans heure). On coche directement ; toucher le texte ouvre l'élément.
     Les cours sont des repères (pas de case). « + » ajoute une tâche pour aujourd'hui.
   - **Prochain repas** (dessous) : le repas en cours ou le suivant du planning, « Je l'ai mangé », anneaux du jour.
   - **Aujourd'hui** (à droite) : calendrier du jour, glisser pour créer, les tâches avec heure y apparaissent.
   - **En bas** : le calendrier semaine / mois. Sur téléphone, tout est empilé dans cet ordre.
3. **Espace Tâches** (logo liste dans l'île) : Aujourd'hui (avec « En retard »), À venir, Sans date, Terminées ;
   filtre par catégorie (École, Perso, Job au départ, modifiables avec ⚙︎). Une tâche : titre, catégorie,
   jour prévu, heure et durée facultatives, date limite, priorité (basse / moyenne / haute), « Bloque le sport »
   si elle a une heure. Pas faite le jour prévu : elle reste en retard (pas de report automatique).
4. L'île de navigation a maintenant des logos d'une seule couleur (gris, l'espace ouvert en noir).

## Agenda de l'accueil (v0.15)

1. **SQL Editor** > New query : colle `supabase/migrations/011_agenda.sql`, puis **Run**.
2. Le calendrier est tout en haut de l'accueil. Il montre ton agenda Google, tes cours, tes séances sport
   et tes propres évènements (enregistrés dans Life seulement, pas dans Google).

- **Vues** : Semaine (0 h → 24 h ; 7 jours sur ordinateur, 3 jours sur téléphone) et Mois. Sur ordinateur :
  `W` semaine, `M` mois, `T` aujourd'hui, `←` `→`.
- **Créer** : glisse sur une plage horaire (téléphone : appui long puis glisse), tape le titre, puis Entrée ou « Ajouter ».
  Glisser sur la bande « jour » ou sur des jours en vue Mois = évènement d'une ou plusieurs journées entières.
- **Modifier** : glisse un de tes évènements pour le déplacer, tire son bord du bas pour changer sa durée,
  touche-le pour ouvrir sa fiche (catégorie, lieu, note, répétition, rappel). Évènement répété : « celui-ci » ou
  « celui-ci et les suivants ».
- **Catégories** (⚙︎) : Perso, Amis / sorties, Job, Rendez-vous, Deadline, modifiables, chacune avec
  « bloque le sport » par défaut.
- **Lien Sport** : un évènement « Bloque le sport » compte comme occupé pour le planning sport (journée entière :
  toute la journée). Les mots-clés escalade / examen / voyage marchent aussi.
- **Rappels** (app iPhone) : notification à l'avance, toucher = ouvre l'accueil sur ce jour.
  Bannière sans bouton « Fait » après GitHub Desktop › Pull puis ▶︎ dans Xcode.
- Les pastilles sous le titre masquent ou affichent une source (mémorisé sur l'appareil).
- Toucher un cours ou une séance ouvre un aperçu avec un lien vers École ou Sport.
- **Déplacer une séance sport (v0.16)** : lance une fois `supabase/migrations/012_sport_deplacer.sql`, puis glisse
  la séance (iPhone : appui long). Elle reste où tu la poses (« placée par toi », dans sa semaine), et le reste de la
  semaine se réorganise autour selon les règles du programme. Si une règle coince (ex. jambes la veille d'une séance
  intense, évènement au même moment), la séance garde ta place avec un « Attention : … ».
  Dans son aperçu : « Laisser le planning choisir l'heure » la rend au placement automatique.

## App iPhone (île dynamique)

L'app native (dossier `ios/`, faite avec Capacitor) affiche le site en ligne : toute modification du site
arrive dans l'app sans rien refaire. Seules les parties natives (île dynamique, widgets) demandent de
recompiler dans Xcode. Le site reste utilisable partout comme avant.

**Installation (une fois, sur ton Mac)**
1. Installe **Xcode** depuis l'App Store (gratuit), ouvre-le une fois et accepte d'installer les composants.
2. Avec GitHub Desktop, clone (ou mets à jour) le dépôt `life-`.
3. Ouvre `ios/App/App.xcodeproj` (double-clic). Attends que Xcode télécharge « capacitor-swift-pm » (barre en haut).
4. Xcode › Réglages › **Comptes** › « + » › Apple ID : connecte-toi avec ton identifiant Apple.
5. Dans la colonne de gauche, clique sur **App** (icône bleue) › onglet **Signing & Capabilities** :
   pour la cible **App** puis pour la cible **LifeWidgets**, choisis **Team** = « Ton nom (Personal Team) ».
   Si Xcode dit que l'identifiant est déjà pris, remplace `com.aakaai.life` par `com.aakaai.life2`
   (et `com.aakaai.life.LifeWidgets` par `com.aakaai.life2.LifeWidgets`).
6. Branche l'iPhone au Mac (câble), déverrouille-le et touche « Se fier ».
   Sur l'iPhone : Réglages › Confidentialité et sécurité › **Mode développeur** › activer (redémarrage).
7. En haut de Xcode, choisis ton iPhone, puis ▶︎ (Run).
8. Première fois : sur l'iPhone, Réglages › Général › **VPN et gestion de l'appareil** › ton identifiant › Faire confiance.
9. Ouvre Life, connecte-toi (même e-mail et mot de passe que sur le site).

**Toutes les semaines (compte Apple gratuit)** : l'app expire après 7 jours. Branche l'iPhone, ▶︎ dans Xcode : c'est reparti.

**Ce que fait l'app native aujourd'hui**
- Séance muscu : pendant le repos, le chrono s'affiche dans l'île dynamique et sur l'écran verrouillé
  (exercice suivant, charge prévue), et une notification sonne à la fin du repos, même téléphone en poche.
- À la première série validée, iOS demande l'autorisation des notifications : accepte.

**Code** : `src/lib/native.js` (pont côté site), `ios/App/App/RestActivityPlugin.swift` (côté iPhone),
`ios/App/LifeWidgets/` (affichage dans l'île dynamique). Le workflow « App iPhone (compilation) »
vérifie sur un Mac de GitHub que tout compile à chaque modification de `ios/`.

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
  components/           ← éléments réutilisables (navigation, icônes, graphiques SVG : charts.jsx)
  pages/                ← accueil, réglages, connexion, page d'un module
  modules/
    agenda/
      logic.js          ← répétitions, chevauchements, rappels, lien avec le planning sport (testé)
      api.js            ← tout ce qu'affiche le calendrier (tes évènements, agendas reliés, cours, sport)
      gestures.js       ← glisser à la souris et au doigt (appui long)
      *.jsx             ← calendrier de l'accueil : semaine, mois, fiches
    sport/
      data.js           ← le programme : exercices, séances, semaine type, saison
      planner.js        ← construit la semaine et la réorganise selon tes agendas
      progression.js    ← double progression, charges proposées, stagnation
      api.js            ← lecture / écriture des données sport
      zwift.js          ← export .zwo
      stats.js          ← calculs de l'écran Progrès (par semaine, records, FTP)
      *.jsx             ← écrans : semaine, progrès, séance muscu, séance vélo, réglages
supabase/migrations/    ← un fichier SQL par étape, à exécuter dans l'ordre
supabase/functions/     ← fonctions Supabase (lecture des agendas)
tests/                  ← `npm test` : vérifie le planning et la progression
```

**Ajouter un bloc sur l'accueil** = une entrée dans `src/modules.js` (nom, couleur de la palette, icône, résumé).
Il apparaît aussitôt dans l'île de navigation en bas de l'écran (et son bloc du jour sur l'accueil, s'il en a un).
Quand le module est codé : un dossier dans `src/modules/`, un fichier SQL dans `supabase/migrations/`,
puis renseigner `component` et `tables`.

**Style** : mélange Notion × Apple, défini dans `src/styles.css` (police du système, palette Notion,
listes groupées façon iOS, navigation par une île flottante en bas avec les logos des espaces). Thème clair ou sombre selon le réglage de l'appareil.
Couleurs libres pour de futurs blocs : `--gray`, `--brown`, `--orange`, `--red`.
Sur ordinateur, les pages prennent toute la largeur (jusqu'à 1120 px) : jours en deux colonnes,
bilan du jour à côté des repas. Graphiques : `--c-velo` (bleu), `--c-muscu` (orange), `--c-context`
(gris), couleurs vérifiées pour le daltonisme et le contraste en clair et en sombre.

## Feuille de route

| Étape | Contenu | État |
|---|---|---|
| 0 | Fondations : structure, navigation, connexion, PWA, déploiement, accueil en blocs | ✅ |
| 1 | Sport : semaine automatique, lien agenda, mode séance muscu, vélo + Zwift | ✅ v0.3 |
| 1b | Sport : écran Progrès (graphiques vélo et muscu, records, régularité, poids), tests FTP · pages larges sur ordinateur | ✅ v0.9 |
| 1c | Sport : import Garmin / Strava | |
| 1d | Sport : 4e séance muscu (Haut C — épaules et bras, jeudi) | ✅ v0.14 |
| 1f | Sport : semaine en cartes de jours avec perspective 3D, bouton Démarrer | ✅ v0.20 |
| 1g | Sport : aujourd'hui au milieu sur ordi · Alimentation : le journal remplit le planning | ✅ v0.20.1 |
| 1h | Budget : catégories et objectifs en cases, « + » par catégorie, icônes au trait | ✅ v0.21 |
| 1i | Accueil : « Prochain repas » qui suit l'heure, + Collation / + Repas, heure dans le journal | ✅ v0.22 |
| 1j | Widget iPhone « Ma journée » (calendrier, tâches, habitudes cochables) | ✅ v0.23 |
| 1k | Agenda : 16 couleurs, nouvelle catégorie depuis l'évènement | ✅ v0.24 |
| 1l | Sport : prochain exercice pendant le repos, notes, contrôle de gêne, test du chrono | ✅ v0.25 |
| 1m | Souplesse : étirements du soir, 2 séances de mobilité guidées, habitude « Étirements » automatique | ✅ v0.26 |
| 1n | Budget : comptes d'épargne (enveloppes, objectif facultatif, virements, dépenses payées avec un compte) | ✅ v0.27 |
| 1o | Budget sur une seule page, vue Mois / Année, case Total des comptes | ✅ v0.28 |
| 1p | Gros compte Épargne réparti en sous-comptes, style pastilles | ✅ v0.29 |
| 1q | Objectif daté : montant à mettre par mois, suivi du mois en cours | ✅ v0.29.1 |
| 1r | Habitudes en cases sur une page, Tâches sur une page avec projets et rappels | ✅ v0.30 |
| 9 | Accueil v2 (à faire du jour, prochain repas, calendrier du jour) + espace Tâches | ✅ v0.19 |
| 8 | Navigation : île flottante en bas (logos en couleur), sans barre latérale ni « Mes espaces » sur l'accueil | ✅ v0.18 |
| 1e | Sport : 3 sorties vélo par semaine jusqu'à fin janvier (Z2 courtes de retour en Base 2) | ✅ v0.17 |
| 6 | App iPhone native : chrono de repos dans l'île dynamique + notification de fin de repos | ✅ v0.10 |
| 5 | Habitudes : quotidien, hebdo, mensuel, défis, séries, jokers, pauses, calendrier, bilans du dimanche | ✅ v0.11 |
| 2e | Alimentation : collation du matin, plusieurs aliments par repas, aliments seuls dans le planning et les courses | ✅ v0.12 |
| 5b | Habitudes : rappels iPhone avec bouton « Fait » | ✅ v0.13 |
| 7 | Agenda sur l'accueil : semaine / mois, glisser pour créer et déplacer, répétitions, rappels, lien sport | ✅ v0.15 |
| 7b | Agenda : déplacer les séances sport en glissant (le reste de la semaine s'adapte) | ✅ v0.16 |
| 5c | Habitudes : widget iPhone | |
| 6b | App iPhone : widgets (anneaux, séance du jour, prochain cours), intervalles vélo et cours dans l'île dynamique | |
| 2 | Alimentation : cible du jour liée au sport, journal, scan, recettes, poids | ✅ v0.4 |
| 2b | Alimentation : base de recettes, planning des repas, portions ajustées, liste de courses avec prix | ✅ v0.5 |
| 2c | Alimentation : menus proposés chaque dimanche, batch cooking, boîtes pour l'école | ✅ v0.6 |
| 2d | Alimentation : historique, lien Budget | |
| 3 | École (horaires) : aujourd'hui, semaine, mes cours, lien sport et menus | ✅ v0.7 |
| 4 | Budget : reste à dépenser, saisie rapide, abonnements automatiques, objectifs, export | ✅ v0.8 |
| 5 | Connexions entre modules, bilan hebdo | |
