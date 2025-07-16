from pyglottolog import Glottolog
import json
import os

g = Glottolog('glottolog')

LANGUAGE_DATA = {}

EXCLUDED_CATEGORIES = {
    'Artificial Language',
    'Pidgin',
    'Sign Language',
    'Unattested',
    'Mixed Language',
    'Speech Register',
    'Unclassifiable',
    'Bookkeeping'
}

EXCLUDED_ENDANGERMENT_STATUSES = {
    'extinct',
    'dormant'
}

for lang in g.languoids():
    if lang.level.name != 'language':
        continue
    if lang.category in EXCLUDED_CATEGORIES:
        continue
    if not lang.family:
        continue
    if not lang.macroareas:
        continue

    # Read md.ini endangerment status manually
    status = None
    if 'endangerment' in lang.cfg.sections():
        status = lang.cfg.get('endangerment', 'status', fallback=None)
        if status:
            status = status.lower()
            if status in EXCLUDED_ENDANGERMENT_STATUSES:
                continue

    # Build ancestry
    tree = []
    current = lang
    while current:
        if current.level.name in ('family', 'language'):
            tree.insert(0, current.name)
        current = current.parent

    LANGUAGE_DATA[lang.name] = tree

os.makedirs('web', exist_ok=True)
with open('web/data.js', 'w', encoding='utf-8') as f:
    f.write('const LANGUAGE_DATA = ')
    json.dump(LANGUAGE_DATA, f, ensure_ascii=False, indent=2)
    f.write(';')
