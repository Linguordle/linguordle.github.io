import js2py
import requests
from bs4 import BeautifulSoup
import re
import json
import time

# Load LANGUAGE_DATA from your existing data.js
with open('web/data.js', 'r', encoding='utf-8') as f:
    js_code = f.read()

context = js2py.EvalJs()
context.execute(js_code)
language_data = context.LANGUAGE_DATA_FULL.to_dict()

def extract_speakers_from_infobox(html):
    soup = BeautifulSoup(html, 'html.parser')
    infobox = soup.find('table', class_='infobox')

    if not infobox:
        return 0

    rows = infobox.find_all('tr')
    for row in rows:
        header = row.find('th')
        if header and 'speakers' in header.text.lower():
            cell = row.find('td')
            if cell:
                text = cell.get_text(separator=' ', strip=True)

                # Look for "million", "billion", or large numbers
                match = re.search(r'([\d,.]+)\s*(million|billion)?', text, re.IGNORECASE)
                if match:
                    num_str = match.group(1).replace(',', '').strip()
                    scale = match.group(2)
                    try:
                        number = float(num_str)
                        if scale:
                            scale = scale.lower()
                            if scale == 'million':
                                return int(number * 1_000_000)
                            elif scale == 'billion':
                                return int(number * 1_000_000_000)
                        elif number >= 1_000_000:
                            return int(number)
                    except ValueError:
                        pass
    return 0


def get_speaker_count(lang_name):
    page_title = lang_name.replace(' ', '_') + '_languages'
    url = f"https://en.wikipedia.org/wiki/{page_title}"
    response = requests.get(url)
    time.sleep(1)
    if response.status_code != 200:
        print(f"Skipping {lang_name} (HTTP {response.status_code})")
        return 0

    return extract_speakers_from_infobox(response.text)


easy_data = {}
for lang, classification in language_data.items():
    speakers = get_speaker_count(lang)
    if speakers >= 1_000_000:
        easy_data[lang] = classification
        print(f"{lang}: {speakers} speakers")
        
# Output to data_easy.js
with open('web/data_easy.js', 'w', encoding='utf-8') as out:
    out.write("const LANGUAGE_DATA_EASY = ")
    json.dump(easy_data, out, ensure_ascii=False, indent=4)
    out.write(";")

print("\n✅ data_easy.js has been generated successfully.")
print(f"Total languages in Easy Mode: {len(easy_data)}")
