import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'url';

// Set paths relative to script
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, 'web/data.js'); // your actual data.js
const outputPath = path.resolve(__dirname, 'web/daily-language.json');

// Import the data.js indirectly by evaluating it
const dataContent = fs.readFileSync(dataPath, 'utf8');
const sandbox = {};
const moduleWrapper = `(function() { ${dataContent}; return { full: LANGUAGE_DATA_FULL, easy: LANGUAGE_DATA_EASY }; })()`;
const { full, easy } = eval(moduleWrapper);

// Use full dataset
const languageList = Object.keys(full);

// Get today's date in YYYY-MM-DD
const today = new Date().toISOString().slice(0, 10);

// If already picked today, do nothing
let existing;
try {
  existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  if (existing.date === today) {
    console.log('Already picked for today:', existing.language);
    process.exit(0);
  }
} catch (_) {}

const index = crypto.randomInt(languageList.length);
const language = languageList[index];

const payload = {
  date: today,
  language
};

fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
console.log('Picked new daily language:', language);
