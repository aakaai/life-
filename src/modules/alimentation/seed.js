// Base de départ : ingrédients (avec prix Colruyt estimés) et recettes adaptées
// (pas de poisson, légumes surtout cachés dans les sauces, cuisine en lot ou en 15 min, budget kot).
// Les valeurs nutritionnelles viennent de la table Ciqual (code indiqué), sinon de l'étiquette.
// Prix : estimations Colruyt de novembre 2026, à corriger en magasin depuis la liste de courses.

export const RAYONS = [
  'Fruits et légumes',
  'Viande et charcuterie',
  'Produits laitiers et œufs',
  'Boulangerie',
  'Épicerie',
  'Conserves et sauces',
  'Surgelés'
]

// Catégories de recettes et repas où elles vont d'habitude (0 = matin … 4 = coucher).
export const CATEGORIES = [
  { key: 'matin', name: 'Petit-déjeuner', meals: [0] },
  { key: 'plat', name: 'Plats en lot', meals: [1, 3] },
  { key: 'rapide', name: 'Rapides (15 min)', meals: [1, 3] },
  { key: 'collation', name: 'Collations', meals: [2] },
  { key: 'soir', name: 'Avant de dormir', meals: [4] },
  { key: 'velo', name: 'Vélo', meals: [2] }
]

export const categoryFor = (meal) => CATEGORIES.find((c) => c.meals.includes(meal))?.key || 'plat'

// [clé, nom, code Ciqual ou valeurs pour 100 g [kcal, prot., gluc., lip.], rayon, paquet [grammes, libellé, prix €], options]
// options : unit = [grammes par pièce, nom de la pièce], scalable = féculent ajusté selon la cible, pantry = placard
const I = (key, name, nutrition, rayon, pack, opts = {}) => ({ key, name, nutrition, rayon, pack, ...opts })

export const SEED_INGREDIENTS = [
  I('flocons', 'Flocons d’avoine', '32140', 'Épicerie', [1000, '1 kg', 1.79], { scalable: true }),
  I('muesli', 'Muesli', '32141', 'Épicerie', [750, '750 g', 2.49], { scalable: true }),
  I('riz', 'Riz blanc', '9100', 'Épicerie', [1000, '1 kg', 1.69], { scalable: true }),
  I('pates', 'Pâtes', '9810', 'Épicerie', [1000, '1 kg', 1.49], { scalable: true }),
  I('nouilles', 'Nouilles aux œufs', '9863', 'Épicerie', [500, '500 g', 1.79], { scalable: true }),
  I('lentilles', 'Lentilles corail', '20535', 'Épicerie', [500, '500 g', 1.79]),
  I('cacahuete', 'Beurre de cacahuète', '15202', 'Épicerie', [350, '350 g', 2.49]),
  I('miel', 'Miel', '31008', 'Épicerie', [500, '500 g', 4.29]),
  I('confiture', 'Confiture de fraise', '31024', 'Épicerie', [450, '450 g', 1.79]),
  I('sucre', 'Sucre', '31016', 'Épicerie', [1000, '1 kg', 1.29], { pantry: true }),
  I('barre', 'Barres de céréales', '31113', 'Épicerie', [150, '6 barres', 1.49], { unit: [25, 'barre'] }),
  I('compote', 'Compote de pomme', '13038', 'Épicerie', [600, '6 × 100 g', 1.69], { unit: [100, 'pot'] }),
  I('huile', 'Huile d’olive', '17270', 'Épicerie', [1000, '1 L', 8.99], { pantry: true }),
  I('soja', 'Sauce soja', '11104', 'Épicerie', [250, '25 cl', 1.79], { pantry: true }),
  I('curry', 'Curry en poudre', '11005', 'Épicerie', [50, '50 g', 1.49], { pantry: true }),
  I('epices', 'Épices (paprika, cumin)', [300, 14, 40, 10], 'Épicerie', [50, '50 g', 1.49], { pantry: true }),
  I('bouillon', 'Bouillon de volaille', '11174', 'Épicerie', [100, '10 cubes', 1.29], { pantry: true, unit: [10, 'cube'] }),
  I('ail', 'Ail', '11000', 'Fruits et légumes', [250, '1 filet', 1.49], { pantry: true, unit: [5, 'gousse'] }),

  I('tomates', 'Tomates concassées (boîte)', '20169', 'Conserves et sauces', [400, '400 g', 0.65]),
  I('passata', 'Coulis de tomates', '20260', 'Conserves et sauces', [700, '700 g', 1.19]),
  I('haricots', 'Haricots rouges (boîte, égouttés)', '20524', 'Conserves et sauces', [250, '1 boîte', 0.69]),
  I('pois_chiches', 'Pois chiches (boîte, égouttés)', '20532', 'Conserves et sauces', [265, '1 boîte', 0.79]),
  I('mais', 'Maïs doux (boîte)', '20066', 'Conserves et sauces', [285, '1 boîte', 0.89]),
  I('coco', 'Lait de coco allégé', [75, 0.7, 2.5, 7], 'Conserves et sauces', [400, '40 cl', 1.39]),

  I('banane', 'Bananes', '13005', 'Fruits et légumes', [1000, '1 kg', 1.69], { unit: [120, 'banane'] }),
  I('pomme', 'Pommes', '13039', 'Fruits et légumes', [1500, '1,5 kg', 2.49], { unit: [150, 'pomme'] }),
  I('oignon', 'Oignons', '20034', 'Fruits et légumes', [1000, '1 kg', 1.29], { unit: [150, 'oignon'] }),
  I('poivron', 'Poivrons', '20041', 'Fruits et légumes', [450, '3 pièces', 2.29], { unit: [150, 'poivron'] }),
  I('carotte', 'Carottes', '20009', 'Fruits et légumes', [1000, '1 kg', 0.99], { unit: [100, 'carotte'] }),
  I('pdt', 'Pommes de terre', '4008', 'Fruits et légumes', [2500, '2,5 kg', 2.99], { scalable: true }),

  I('poulet', 'Filet de poulet', '36017', 'Viande et charcuterie', [1000, '1 kg', 9.99]),
  I('hache', 'Haché pur bœuf 5 %', '6250', 'Viande et charcuterie', [500, '500 g', 6.49]),
  I('jambon', 'Jambon cuit', '28900', 'Viande et charcuterie', [300, '300 g', 2.99], { unit: [40, 'tranche'] }),
  I('lardons', 'Lardons', '28501', 'Viande et charcuterie', [200, '200 g', 1.99]),

  I('oeuf', 'Œufs', '22000', 'Produits laitiers et œufs', [600, 'boîte de 12', 3.29], { unit: [50, 'œuf'] }),
  I('lait', 'Lait demi-écrémé', '19041', 'Produits laitiers et œufs', [1000, '1 L', 0.99]),
  I('skyr', 'Skyr nature', [63, 11, 4, 0.2], 'Produits laitiers et œufs', [450, '450 g', 1.99]),
  I('maquee', 'Maquée (fromage blanc 0 %)', '19644', 'Produits laitiers et œufs', [1000, '1 kg', 2.29]),
  I('emmental', 'Emmental râpé', '12118', 'Produits laitiers et œufs', [200, '200 g', 1.99]),
  I('gouda', 'Gouda en tranches', '12736', 'Produits laitiers et œufs', [400, '400 g', 3.99], { unit: [25, 'tranche'] }),
  I('creme', 'Crème légère (cuisine)', '19436', 'Produits laitiers et œufs', [250, '25 cl', 1.09]),
  I('beurre', 'Beurre', '16400', 'Produits laitiers et œufs', [250, '250 g', 2.39]),

  I('pain_complet', 'Pain complet tranché', '7110', 'Boulangerie', [800, '800 g', 1.99], { scalable: true, unit: [35, 'tranche'] }),
  I('pain_mie', 'Pain de mie', '7200', 'Boulangerie', [500, '500 g', 1.39], { scalable: true, unit: [25, 'tranche'] }),
  I('tortilla', 'Tortillas de blé', '7815', 'Boulangerie', [320, '8 pièces', 1.69], { scalable: true, unit: [40, 'tortilla'] }),

  I('fruits_rouges', 'Fruits rouges surgelés', '13136', 'Surgelés', [750, '750 g', 3.49]),
  I('petits_pois', 'Petits pois surgelés', '20084', 'Surgelés', [1000, '1 kg', 1.99]),
  I('poelee', 'Poêlée de légumes surgelée', '20101', 'Surgelés', [1000, '1 kg', 2.49])
]

// [clé, nom, catégorie, portions, minutes, en lot, [[ingrédient, grammes pour toute la recette]], étapes]
const R = (key, name, category, servings, prep_min, batch, lines, steps) => ({ key, name, category, servings, prep_min, batch, lines, steps })

export const SEED_RECIPES = [
  // ---- Petit-déjeuner
  R('porridge', 'Porridge banane et cacahuète', 'matin', 1, 5, false,
    [['flocons', 80], ['lait', 300], ['banane', 120], ['cacahuete', 20]],
    'Cuire les flocons dans le lait 3 à 4 min (ou 2 × 1 min 30 au micro-ondes, en remuant).\nAjouter la banane en rondelles et le beurre de cacahuète.'),
  R('overnight', 'Overnight oats skyr et fruits rouges', 'matin', 1, 5, false,
    [['flocons', 70], ['skyr', 150], ['lait', 150], ['fruits_rouges', 100], ['miel', 15]],
    'La veille : tout mélanger dans un bocal ou une boîte, fermer, mettre au frigo.\nLe matin : c’est prêt, à manger froid.'),
  R('omelette_pain', 'Omelette au fromage et pain complet', 'matin', 1, 10, false,
    [['oeuf', 150], ['emmental', 20], ['pain_complet', 105], ['beurre', 5]],
    'Battre les 3 œufs, cuire à la poêle avec le beurre, ajouter le fromage à la fin.\nServir avec 3 tranches de pain.'),
  R('tartines_maquee', 'Tartines maquée et confiture', 'matin', 1, 3, false,
    [['pain_complet', 140], ['maquee', 200], ['confiture', 30]],
    '4 tranches de pain, maquée et confiture.'),
  R('muesli_lait', 'Muesli, lait et banane', 'matin', 1, 2, false,
    [['muesli', 80], ['lait', 300], ['banane', 120]],
    'Tout dans un bol.'),
  R('pancakes', 'Pancakes avoine et banane', 'matin', 2, 15, false,
    [['flocons', 120], ['oeuf', 100], ['banane', 240], ['lait', 150], ['miel', 20]],
    'Mixer flocons, œufs, bananes et lait.\nCuire de petites crêpes épaisses à la poêle, 2 min par face.\nLa 2e portion se garde 2 jours au frigo.'),

  // ---- Plats en lot (4 portions)
  R('chili', 'Chili con carne', 'plat', 4, 40, true,
    [['hache', 500], ['haricots', 500], ['tomates', 800], ['oignon', 150], ['poivron', 150], ['riz', 400], ['huile', 15], ['epices', 10]],
    'Mixer l’oignon et le poivron (ils disparaissent dans la sauce).\nFaire revenir dans l’huile, ajouter le haché et le faire dorer.\nAjouter les tomates, les épices, laisser mijoter 20 min, puis les haricots 5 min.\nCuire le riz à part. Répartir en 4 boîtes.'),
  R('bolo', 'Pâtes bolognaise aux légumes cachés', 'plat', 4, 40, true,
    [['hache', 500], ['pates', 400], ['passata', 700], ['carotte', 200], ['oignon', 150], ['huile', 15], ['emmental', 60]],
    'Mixer carottes et oignon très fin, les faire revenir 5 min dans l’huile.\nAjouter le haché, puis le coulis ; mijoter 20 min.\nCuire les pâtes, mélanger, répartir en 4 boîtes avec le fromage.'),
  R('curry', 'Poulet curry coco et riz', 'plat', 4, 35, true,
    [['poulet', 600], ['riz', 400], ['coco', 400], ['oignon', 150], ['petits_pois', 300], ['curry', 10], ['huile', 15]],
    'Couper le poulet en dés, le dorer dans l’huile avec l’oignon émincé.\nAjouter le curry, le lait de coco et les petits pois, mijoter 15 min.\nCuire le riz. Répartir en 4 boîtes.'),
  R('poulet_four', 'Poulet au four et pommes de terre', 'plat', 4, 50, true,
    [['poulet', 600], ['pdt', 1200], ['carotte', 400], ['huile', 30], ['epices', 5]],
    'Four à 200 °C. Pommes de terre et carottes en morceaux, huile et épices, 25 min.\nAjouter le poulet assaisonné, encore 20 min.\nRépartir en 4 boîtes.'),
  R('parmentier', 'Hachis parmentier', 'plat', 4, 50, true,
    [['hache', 500], ['pdt', 1200], ['lait', 200], ['emmental', 80], ['oignon', 150], ['carotte', 200], ['beurre', 20]],
    'Cuire les pommes de terre 20 min, écraser en purée avec le lait et le beurre.\nMixer oignon et carottes, les faire revenir avec le haché.\nPlat à four : viande, purée, fromage. 20 min à 200 °C. Couper en 4.'),
  R('pates_poulet', 'Pâtes poulet, tomate et crème', 'plat', 4, 30, true,
    [['pates', 400], ['poulet', 500], ['tomates', 400], ['creme', 200], ['oignon', 100], ['emmental', 60]],
    'Dorer le poulet en dés avec l’oignon.\nAjouter les tomates et la crème, mijoter 10 min.\nMélanger avec les pâtes cuites et le fromage. 4 boîtes.'),
  R('cantonais', 'Riz cantonais', 'plat', 4, 30, true,
    [['riz', 400], ['oeuf', 300], ['jambon', 200], ['petits_pois', 300], ['huile', 20], ['soja', 30]],
    'Cuire le riz (idéalement la veille, il saute mieux).\nFaire une omelette avec les 6 œufs, la couper en lanières.\nPoêle chaude : huile, riz, petits pois, jambon en dés, omelette, sauce soja. 4 boîtes.'),
  R('wok', 'Wok de nouilles au poulet', 'plat', 4, 25, true,
    [['nouilles', 400], ['poulet', 500], ['poelee', 600], ['soja', 40], ['huile', 20]],
    'Cuire les nouilles.\nPoêle très chaude : poulet en lanières, puis la poêlée de légumes, puis les nouilles et la sauce soja. 4 boîtes.'),
  R('dahl', 'Dahl de lentilles au poulet', 'plat', 4, 35, true,
    [['lentilles', 250], ['poulet', 400], ['riz', 300], ['tomates', 400], ['coco', 200], ['oignon', 150], ['curry', 10]],
    'Faire revenir oignon et poulet en dés avec le curry.\nAjouter lentilles, tomates, lait de coco et 500 ml d’eau ; cuire 20 min.\nServir avec le riz. 4 boîtes.'),

  // ---- Rapides (1 portion)
  R('pates_oeufs', 'Pâtes, œufs et sauce tomate', 'rapide', 1, 15, false,
    [['pates', 100], ['oeuf', 100], ['passata', 150], ['huile', 10], ['emmental', 15]],
    'Cuire les pâtes. Pendant ce temps, œufs au plat ou brouillés.\nChauffer le coulis, tout mélanger, fromage dessus.'),
  R('wraps', 'Wraps au poulet', 'rapide', 1, 15, false,
    [['tortilla', 120], ['poulet', 130], ['gouda', 30], ['mais', 50], ['creme', 20]],
    'Poulet en lanières à la poêle.\nGarnir les 3 tortillas : poulet, maïs, fromage, un peu de crème. Rouler.'),
  R('riz_hache', 'Riz, haché et sauce tomate', 'rapide', 1, 15, false,
    [['riz', 100], ['hache', 125], ['passata', 150], ['oignon', 50], ['huile', 5]],
    'Cuire le riz. Dorer l’oignon et le haché, ajouter le coulis 5 min.'),
  R('croque', 'Croque-monsieur', 'rapide', 1, 10, false,
    [['pain_mie', 100], ['jambon', 80], ['gouda', 50], ['beurre', 10]],
    '4 tranches de pain de mie : jambon et fromage entre deux tranches, beurre dehors.\nPoêle ou appareil, 3 min par face.'),
  R('carbonara', 'Pâtes carbonara', 'rapide', 1, 15, false,
    [['pates', 110], ['lardons', 70], ['oeuf', 50], ['creme', 40], ['emmental', 15]],
    'Cuire les pâtes. Dorer les lardons.\nHors du feu : pâtes, lardons, œuf battu avec la crème et le fromage.'),
  R('omelette_jambon', 'Omelette jambon-fromage et pain', 'rapide', 1, 10, false,
    [['oeuf', 150], ['jambon', 40], ['emmental', 20], ['pain_complet', 70]],
    'Omelette de 3 œufs avec le jambon en dés et le fromage. 2 tranches de pain.'),

  // ---- Collations
  R('skyr_bol', 'Bol skyr, fruits rouges et flocons', 'collation', 1, 2, false,
    [['skyr', 150], ['fruits_rouges', 80], ['miel', 15], ['flocons', 30]],
    'Tout dans un bol (fruits décongelés quelques minutes ou au micro-ondes).'),
  R('tartine_cacahuete', 'Tartines cacahuète et banane', 'collation', 1, 3, false,
    [['pain_complet', 70], ['cacahuete', 25], ['banane', 120]],
    '2 tranches, beurre de cacahuète, rondelles de banane.'),
  R('smoothie', 'Smoothie banane-avoine', 'collation', 1, 3, false,
    [['lait', 300], ['banane', 120], ['flocons', 40], ['cacahuete', 15]],
    'Tout mixer.'),
  R('tartines_jambon', 'Tartines jambon-fromage', 'collation', 1, 3, false,
    [['pain_complet', 105], ['jambon', 80], ['gouda', 25]],
    '3 tranches de pain, 2 tranches de jambon, 1 de fromage.'),
  R('pomme_barre', 'Pomme et barre de céréales', 'collation', 1, 0, false,
    [['pomme', 150], ['barre', 25]],
    'À emporter.'),

  // ---- Avant de dormir
  R('maquee_miel', 'Maquée et miel', 'soir', 1, 1, false,
    [['maquee', 250], ['miel', 10]],
    'Protéines lentes pour la nuit.'),
  R('skyr_soir', 'Skyr et fruits rouges', 'soir', 1, 1, false,
    [['skyr', 200], ['fruits_rouges', 50]],
    'Protéines lentes pour la nuit.'),

  // ---- Vélo
  R('ravito', 'Ravitaillement sortie longue', 'velo', 1, 5, false,
    [['sucre', 60], ['banane', 240], ['barre', 50]],
    '2 bidons avec 30 g de sucre chacun (et une pincée de sel), 2 bananes, 2 barres.\nCommence à manger après 30 min, environ 30 à 60 g de glucides par heure.')
]
