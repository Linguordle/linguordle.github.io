import js2py
import requests
import json

# --- Step 1: Execute the JS to extract LANGUAGE_DATA ---
with open('web/data.js', 'r', encoding='utf-8') as f:
    js_code = f.read()

# Evaluate the JS in a JS context
context = js2py.EvalJs()
context.execute(js_code)
language_data = context.LANGUAGE_DATA.to_dict()

# --- Step 2: Extract unique families from the JS object ---
families = sorted(set(info[0] for info in language_data.values()))
print(f"Extracted families: {families}")

# --- Step 3: Query Wikipedia API ---
def get_wikipedia_summary(family):
    page_title = family.replace(" ", "_")
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{page_title}"
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Skipping {family} (HTTP {response.status_code})")
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
    result = get_wikipedia_summary(family)
    if result:
        family_descriptions[family] = result

# --- Step 5: Write to JS file ---
with open('web/familyDescriptions.js', 'w', encoding='utf-8') as out:
    out.write("const familyDescriptions = ")
    json.dump(family_descriptions, out, ensure_ascii=False, indent=4)
    out.write(";")

print("\n✅ familyDescriptions.js has been generated successfully.")
