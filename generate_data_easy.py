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

# Function to extract number of speakers from Wikipedia summary
def get_speaker_count(lang_name):
    page_title = lang_name.replace(' ', '_')
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{page_title}"
    response = requests.get(url)
    time.sleep(1)
    if response.status_code != 200:
        print(f"Skipping {lang_name} (HTTP {response.status_code})")
        return False
    data = response.json()
    extract = data.get('extract', '').lower()
    return 'million' in extract or 'billion' in extract

# Build the EASY dataset
easy_data = {}
for lang, classification in language_data.items():
    if get_speaker_count(lang):
        easy_data[lang] = classification
        print(f"Included {lang}")

# Output to data_easy.js
with open('web/data_easy.js', 'w', encoding='utf-8') as out:
    out.write("const LANGUAGE_DATA_EASY = ")
    json.dump(easy_data, out, ensure_ascii=False, indent=4)
    out.write(";")

print("\n✅ data_easy.js has been generated successfully.")
print(f"Total languages in Easy Mode: {len(easy_data)}")
