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

// Les recettes de départ ont été retirées (2 nov. 2026) : les recettes sont créées dans l'app.
