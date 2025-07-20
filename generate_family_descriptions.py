import js2py
import requests
import json
import time

# --- Step 1: Execute the JS to extract LANGUAGE_DATA ---
with open('web/data.js', 'r', encoding='utf-8') as f:
    js_code = f.read()

# Evaluate the JS in a JS context
context = js2py.EvalJs()
context.execute(js_code)
language_data = context.LANGUAGE_DATA.to_dict()

# --- Step 2: Extract unique families from the JS object ---
families = set(info[0] for info in language_data.values())

all_classifications = set()
for classifications in language_data.values():
    all_classifications.update(classifications)
all_classifications = sorted(all_classifications)

families = sorted(families)
# --- Step 3: Query Wikipedia API ---
def get_wikipedia_summary(name, is_family=False):
    if is_family:
        page_title = name.replace(" ", "_") + "_languages"
    else:
        page_title = name.replace(" ", "_")
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{page_title}"
    response = requests.get(url)
    time.sleep(1)
    if response.status_code != 200:
        print(f"Skipping {name} (HTTP {response.status_code})")
        return None
    data = response.json()
    description = data.get('extract', '').strip()
    link = data.get('content_urls', {}).get('desktop', {}).get('page')
    if description and link:
        return {"description": description, "link": link}
    return None

# --- Step 4: Build familyDescriptions.js ---
family_descriptions = {}

for family in families:
    result = get_wikipedia_summary(family, is_family=True)
    if result:
        family_descriptions[family] = result

for classification in all_classifications:
    if classification in families:
        continue
    result = get_wikipedia_summary(classification, is_family=False)
    if result:
        family_descriptions[classification] = result

kept_families = set(family_descriptions.keys())
# --- Step 5: Write to JS file ---
with open('web/familyDescriptions.js', 'w', encoding='utf-8') as out:
    out.write("const familyDescriptions = ")
    json.dump(family_descriptions, out, ensure_ascii=False, indent=4)
    out.write(";")

print("\n✅ familyDescriptions.js has been generated successfully.")

# --- Step 6: Filter LANGUAGE_DATA to only families we kept ---
kept_classifications = set(family_descriptions.keys())
cleaned_language_data = {
    lang: [cls for cls in info if cls in kept_classifications]
    for lang, info in language_data.items()
}

cleaned_language_data = {
    lang: info for lang, info in cleaned_language_data.items() if info
}

# --- Step 7: Overwrite data.js with the cleaned data ---
with open('web/data.js', 'w', encoding='utf-8') as out:
    out.write("const LANGUAGE_DATA = ")
    json.dump(cleaned_language_data, out, ensure_ascii=False, indent=4)
    out.write(";")

print("\n✅ data.js has been cleaned and updated to remove skipped families.")

print(f"Original number of languages: {len(language_data)}")
print(f"Filtered number of languages: {len(cleaned_language_data)}")
print("Original families:", sorted(set(info[0] for info in language_data.values())))
print("Kept families:", sorted(kept_families))

