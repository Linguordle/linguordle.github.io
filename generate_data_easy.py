import js2py
import requests
import re
import json
import time

# Load LANGUAGE_DATA from your existing data.js
with open('web/data.js', 'r', encoding='utf-8') as f:
    js_code = f.read()

context = js2py.EvalJs()
context.execute(js_code)
language_data = context.LANGUAGE_DATA_FULL.to_dict()


language_names_in_data = set(language_data.keys())

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

wikidata_names = {entry['languageLabel']['value'] for entry in results}

# Build the EASY dataset
easy_data = {
    lang: classification
    for lang, classification in language_data.items()
    if lang in wikidata_names
}

# Output to data_easy.js
with open('web/data_easy.js', 'w', encoding='utf-8') as out:
    out.write("const LANGUAGE_DATA_EASY = ")
    json.dump(easy_data, out, ensure_ascii=False, indent=4)
    out.write(";")

print("\n✅ data_easy.js has been generated successfully.")
print(f"Total languages in Easy Mode: {len(easy_data)}")
