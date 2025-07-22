import js2py
import requests
import json
from pathlib import Path

DATA_JS_PATH = Path('web/data.js')
OUTPUT_JS_PATH = Path('web/data_easy.js')

# Load LANGUAGE_DATA from your existing data.js
with open(DATA_JS_PATH, 'r', encoding='utf-8') as f:
    js_code = f.read()

context = js2py.EvalJs()
context.execute(js_code)
language_data = context.LANGUAGE_DATA.to_dict()

# List of your languages
language_names_in_data = set(language_data.keys())

# Query Wikidata for languages > 1 million speakers
query = """
SELECT ?languageLabel ?speakers WHERE {
  ?language wdt:P31 wd:Q34770;
            wdt:P1098 ?speakers.
  FILTER(?speakers > 1000000)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
"""

url = 'https://query.wikidata.org/sparql'
headers = {'Accept': 'application/sparql-results+json'}
response = requests.get(url, params={'query': query}, headers=headers)
results = response.json()['results']['bindings']

# Collect languages with > 1M speakers (exact names only)
wikidata_names = {entry['languageLabel']['value'] for entry in results}

# Filter your existing data to only languages with exact match in Wikidata's list
easy_data = {
    lang: classification
    for lang, classification in language_data.items()
    if lang in wikidata_names
}

# Write data_easy.js
with open(OUTPUT_JS_PATH, 'w', encoding='utf-8') as out:
    out.write("const LANGUAGE_DATA_EASY = ")
    json.dump(easy_data, out, ensure_ascii=False, indent=4)
    out.write(";")

print(f"\n✅ data_easy.js written with {len(easy_data)} languages.")
