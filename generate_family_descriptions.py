import json
import re
import requests

# --- Step 1: Read and Parse data.js ---
with open('web/data.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

# Extract the object inside LANGUAGE_DATA
match = re.search(r'const LANGUAGE_DATA\s*=\s*({.*});', js_content, re.DOTALL)
if not match:
    raise ValueError("Couldn't extract LANGUAGE_DATA object from data.js")

# Convert JS-like object into valid JSON
data_str = match.group(1)
data_str = re.sub(r'(\w+):', r'"\1":', data_str)  # Ensure keys are quoted
data_str = data_str.replace("'", '"')  # Convert single quotes to double quotes if needed

language_data = json.loads(data_str)

# --- Step 2: Extract Unique Family Names ---
families = sorted(set(info[0] for info in language_data.values()))

print(f"Extracted families: {families}")

# --- Step 3: Query Wikipedia API for Each Family ---
def get_wikipedia_summary(family):
    page_title = family.replace(" ", "_") + "_languages"
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

# --- Step 4: Build the Final Dictionary ---
family_descriptions = {}

for family in families:
    result = get_wikipedia_summary(family)
    if result:
        family_descriptions[family] = result

# --- Step 5: Write to familyDescriptions.js ---
with open('web/familyDescriptions.js', 'w', encoding='utf-8') as out:
    out.write("const familyDescriptions = ")
    json.dump(family_descriptions, out, ensure_ascii=False, indent=4)
    out.write(";")

print("\nfamilyDescriptions.js has been generated successfully.")
