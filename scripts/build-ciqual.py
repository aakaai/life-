"""Construit src/modules/alimentation/ciqual-data.js à partir de la table Ciqual 2025 (Anses, JSON complet).
Usage : python3 scripts/build-ciqual.py chemin/ciqual_2025_complete.json
Licence : Licence Ouverte / Etalab — source : Anses, Table de composition nutritionnelle des aliments Ciqual 2025."""
import json, sys

FISH = ('0405', '0406', '0407', '0408', '0409')  # poissons, mollusques, crustacés et produits à base de poisson

def num(v):
    v = (v or '').strip().replace(',', '.')
    if v in ('', '-', 'traces'):
        return 0.0
    if v.startswith('<'):
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0

def get(comp, key):
    return num(comp.get(key, {}).get('valeur'))

rows = []
for a in json.load(open(sys.argv[1], encoding='utf-8')):
    c = a['composition']
    p = get(c, 'Protéines, N x facteur de Jones (g/100 g)')
    g = get(c, 'Glucides (g/100 g)')
    l = get(c, 'Lipides (g/100 g)')
    f = get(c, 'Fibres alimentaires (g/100 g)')
    kcal = get(c, 'Energie, Règlement UE N° 1169/2011 (kcal/100 g)') or round(4 * p + 4 * g + 9 * l + 2 * f)
    rows.append([
        a['alim_code'], a['alim_nom_fr'].strip(), round(kcal), round(p, 1), round(g, 1), round(l, 1), round(f, 1),
        1 if a['alim_ssgrp_code'] in FISH else 0,
    ])
rows.sort(key=lambda r: r[1].lower())
out = sys.argv[2] if len(sys.argv) > 2 else 'src/modules/alimentation/ciqual-data.js'
with open(out, 'w', encoding='utf-8') as fh:
    fh.write('// Généré par scripts/build-ciqual.py — ne pas modifier à la main.\n')
    fh.write('// Source : Anses, Table de composition nutritionnelle des aliments Ciqual 2025 (Licence Ouverte).\n')
    fh.write('// [code, nom, kcal, protéines, glucides, lipides, fibres, poisson] pour 100 g\n')
    fh.write('export default ')
    json.dump(rows, fh, ensure_ascii=False, separators=(',', ':'))
    fh.write('\n')
print(len(rows), 'aliments')
