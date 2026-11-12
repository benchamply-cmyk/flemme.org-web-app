#!/usr/bin/env python3
"""Extrait les Tweaks du canevas 63uk3vE… vers l'atelier visuel.

Entrée : dossier contenant les artboards « 00 · Réglages communs » des pages V0.5, V0.6, V0.7 et Design PR55
(V05-00-ReglagesCommuns.dc.html, V06-00-…, V07-00-…, PR55-00-…), lus depuis le canevas.
Sortie : apps/web/src/atelier/tweaks.ts (catalogue, préréglages par page, règles CSS t-*).
Usage : python3 -I atelier/canevas/extraire-tweaks.py <dossier-des-artboards>
"""
import html, json, re, sys
from pathlib import Path

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / 'apps/web/src/atelier/tweaks.ts'
MAITRE = 'PR55-00-ReglagesCommuns.dc.html'  # page la plus complète (V0.6/V0.7 + options B6)
PAGES = [('v05', 'Canevas V0.5', 'V05-00-ReglagesCommuns.dc.html'), ('v06', 'Canevas V0.6', 'V06-00-ReglagesCommuns.dc.html'),
         ('v07', 'Canevas V0.7', 'V07-00-ReglagesCommuns.dc.html'), ('pr55', 'Canevas Design PR55', MAITRE)]
IGNORES = {'page', 'textes'}  # page affichée dans le canevas, textes de remplacement (l'éditeur de texte de l'atelier s'en charge)

def lire(f):
    return (SRC / f).read_text(encoding='utf-8')

def props(s):
    m = re.search(r'data-props="(.*?)"', s, re.S) or re.search(r"data-props='(.*?)'", s, re.S)
    return json.loads(html.unescape(m.group(1)))

def css(s):
    a = s.index('<style>', s.index('<helmet>')) + 7
    return s[a:s.index('</style>', a)]

def regles(texte):
    out, i = [], 0
    while True:
        j = texte.find('{', i)
        if j < 0: return out
        depth, k = 1, j + 1
        while depth and k < len(texte):
            depth += {'{': 1, '}': -1}.get(texte[k], 0); k += 1
        out.append((re.sub(r'/\*.*?\*/', '', texte[i:j], flags=re.S).strip(), texte[j + 1:k - 1])); i = k

def num(v): return str(v).split(' · ')[0]
def texte(v): return str(v).split(' · ', 1)[-1].replace(' (actuel)', '').strip().lower()

maitre = lire(MAITRE)
P = props(maitre)
cles = [k for k in P if not k.startswith('$') and k not in IGNORES]
tweaks = []
for k in cles:
    opts = [(num(o), str(o).split(' · ', 1)[-1]) for o in P[k]['options'] if num(o) != '0']
    tweaks.append({'key': k, 'label': P[k].get('label', k), 'section': P[k].get('section', ''), 'options': opts})
# Option ajoutée : « Bleu V0.3 » (fond du haut de la page V0.5, retirée des pages suivantes sous le nom x6).
fond = next(t for t in tweaks if t['key'] == 'fond'); fond['options'].append(('14', 'Bleu V0.3 (page V0.5)'))

valide = re.compile(r'\.t-([a-z0-9]+)-([a-z0-9]+)')
def filtre(sel):
    garde = []
    for part in sel.split(','):
        ok = True
        for k, v in valide.findall(part):
            if k == 'fond' and v == 'x6': continue
            if k not in cles or not v.isdigit(): ok = False
        if ok and '.t-' in part: garde.append(part.strip().replace('.t-fond-x6', '.t-fond-14'))
    return ', '.join(garde)

def sortie(liste):
    lignes = []
    for sel, corps in liste:
        if sel.startswith('@'):
            inner = sortie(regles(corps))
            if inner: lignes.append(sel + '{' + inner + '}')
        elif sel.startswith('.t-') or ' .t-' in sel or ',.t-' in sel.replace(', ', ','):
            s = filtre(sel)
            if s: lignes.append(s + '{' + corps.strip() + '}')
    return '\n'.join(lignes)

regles_css = sortie(regles(css(maitre)))
police = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/css2\?[^"]+)"', maitre)
presets = {}
for pid, nom, f in PAGES:
    pp = props(lire(f)); val = {}
    for t in tweaks:
        d = pp.get(t['key'], {}).get('default')
        if d is None or num(d) == '0': continue
        if f == MAITRE or t['key'] not in pp: val[t['key']] = num(d); continue
        # Les numéros de la page V0.5 ne suivent pas toujours ceux des pages suivantes : correspondance par libellé.
        cible = next((n for n, l in t['options'] if texte(l) == texte(d) or texte(l).startswith(texte(d))), None)
        if cible is None and t['key'] == 'fond' and 'bleu v0.3' in texte(d): cible = '14'
        if cible: val[t['key']] = cible
    presets[pid] = {'label': nom, 'values': val}
sections = []
for t in tweaks:
    if t['section'] not in sections: sections.append(t['section'])
ts = ('// Généré par atelier/canevas/extraire-tweaks.py depuis le canevas 63uk3vECEJaGSNwhxWcXeB (pages V0.5, V0.6, V0.7, Design PR55). Ne pas modifier à la main.\n'
      'export type Tweak={key:string;label:string;section:string;options:[string,string][]};\n'
      f'export const tweakSections:string[]={json.dumps(sections, ensure_ascii=False)};\n'
      f'export const tweaks:Tweak[]={json.dumps(tweaks, ensure_ascii=False)};\n'
      f'export const tweakPresets:Record<string,{{label:string;values:Record<string,string>}}>={json.dumps(presets, ensure_ascii=False)};\n'
      f'export const tweakFonts={json.dumps(html.unescape(police.group(1)) if police else "")};\n'
      f'export const tweakCSS={json.dumps(regles_css, ensure_ascii=False)};\n')
OUT.write_text(ts, encoding='utf-8')
print(f'{len(tweaks)} tweaks, {len(regles_css)} caractères de CSS, préréglages : ' + ', '.join(f"{k}={len(v['values'])}" for k, v in presets.items()))
