"""Extract a muscle OIAN table (Muscle Name / Origin / Insertion / Innervation / Action)
from a course .docx into public/course/oian.json for Body Atlas.

The output is course material: it stays local (public/course/ is git-ignored).

Usage: python3 -I tools/oian-from-docx.py <master-list.docx> [out.json]
"""
import html, json, re, sys, zipfile

def text(xml):
    paras = []
    for p in re.findall(r'<w:p[ >].*?</w:p>', xml, flags=re.S):
        t = html.unescape(''.join(re.findall(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', p, flags=re.S))).strip()
        if t:
            paras.append(t)
    return ' '.join(paras)

def clean(s):
    s = re.sub(r'\bNeve\b', 'Nerve', s)
    return re.sub(r'\s+', ' ', s).strip()

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'public/course/oian.json'
xml = zipfile.ZipFile(src).read('word/document.xml').decode('utf8')
rows_out = []
for tbl in re.findall(r'<w:tbl>.*?</w:tbl>', xml, flags=re.S):
    cols = None
    for tr in re.findall(r'<w:tr[ >].*?</w:tr>', tbl, flags=re.S):
        cells = [clean(text(tc)) for tc in re.findall(r'<w:tc>.*?</w:tc>', tr, flags=re.S)]
        low = [c.lower() for c in cells]
        if any(c.startswith('muscle name') for c in low):
            cols = {}
            for i, c in enumerate(low):
                for k in ('muscle', 'origin', 'insertion', 'innervation', 'action'):
                    if c.startswith(k) or (k == 'muscle' and c.startswith('muscle name')):
                        cols.setdefault(k, i)
            continue
        if not cols or not cells or not cells[cols['muscle']]:
            continue
        get = lambda k: cells[cols[k]] if k in cols and cols[k] < len(cells) else ''
        name = get('muscle')
        alt = []
        m = re.match(r'^(.*?)\s*\((.*?)\)\s*(.*)$', name)
        base = name
        if m:
            base = (m.group(1) + ' ' + m.group(3)).strip()
        base = re.sub(r':.*$', '', base).strip()
        # "Rhomboids: R. Major & R. Minor" -> also match each muscle
        if re.search(r'R\. Major', name):
            alt += ['Rhomboid major', 'Rhomboid minor']
        if name.isupper() and not any(get(k) for k in ('origin', 'insertion', 'innervation', 'action')):
            continue  # section heading row
        base = re.sub(r'\s*\*.*$', '', base)  # "Rectus abdominis *note ..."
        m2 = re.match(r'^(Anterior|Posterior|Lateral) compartment\s+(.*)$', base)
        if m2:
            words = m2.group(2)
            if 'Gastrocnemius' in words:
                base, alt = 'Gastrocnemius', alt + ['Soleus', 'Triceps surae']
            elif 'Fibularis' in words:
                base, alt = 'Fibularis muscles', alt + ['Fibularis longus', 'Fibularis brevis']
            elif 'Dorsiflexors' in words:
                base, alt = 'Dorsiflexors', alt + ['Tibialis anterior', 'Extensor digitorum longus', 'Extensor hallucis longus']
        if base.startswith('Tensor fascia'):
            base, alt = 'Tensor fasciae latae', alt + ['Iliotibial tract']
        if base == 'Adductors':
            alt += ['Adductor longus', 'Adductor brevis', 'Adductor magnus']
        rows_out.append({'muscle': base, 'label': name, 'alt': alt, 'origin': get('origin'), 'insertion': get('insertion'),
                         'innervation': get('innervation'), 'action': get('action')})
json.dump(rows_out, open(out, 'w'), indent=1, ensure_ascii=False)
print(f'{len(rows_out)} muscles -> {out}')
