import re
import json
import requests

# --- Step 1: Extract unique families from data.js ---
with open('data.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

# Match 'family': 'Some Family Name'
families = set(re.findall(r'family:\s*["\'](.*?)["\']', js_content))
families = sorted(families)

# --- Step 2: Query Wikipedia API ---
def get_wikipedia_summary(family):
    # Heuristic: Most Wikipedia pages for families are "{Family} languages"
    page_title = family.replace(" ", "_") + "_languages"
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{page_title}"
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Skipping {family} (not found)")
        return None
    data = response.json()
    description = data.get('extract', '').strip()
    link = data.get('content_urls', {}).get('desktop', {}).get('page')
    if description and link:
        return { "description": description, "link": link }
    return None

# --- Step 3: Collect descriptions ---
family_descriptions = {}

for family in families:
    result = get_wikipedia_summary(family)
    if result:
        family_descriptions[family] = result

# --- Step 4: Write JS file ---
with open('familyDescriptions.js', 'w', encoding='utf-8') as out:
    out.write("const familyDescriptions = ")
    json.dump(family_descriptions, out, ensure_ascii=False, indent=4)
    out.write(";")
