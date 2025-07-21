window.addEventListener('DOMContentLoaded', () => {

const languageList = Object.keys(LANGUAGE_DATA);
const MAX_GUESSES = 15;
let guessesLeft = MAX_GUESSES;
let targetLanguage = '';
let targetFamily = [];
let guessedLanguages = new Set();
let highlightIndex = -1;

const input = document.getElementById('guessInput');
const button = document.getElementById('guessButton');
const output = document.getElementById('output');
const guessesLeftDisplay = document.getElementById('guessesLeft');
const familyHint = document.getElementById('familyHint');
const autocompleteList = document.getElementById('autocomplete-list');

const fuse = new Fuse(languageList, {
    threshold: 0.4,    // lower = stricter, higher = fuzzier
    distance: 100,     // how far apart characters can be
    keys: []           // we're just searching strings, not objects
});

startNewGame();
button.addEventListener('click', handleGuess);
input.addEventListener('keydown', handleKeyNavigation);
input.addEventListener('input', showAutocompleteSuggestions);

function getDailyLanguage() {
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10); // YYYY-MM-DD

    // Simple hash function (djb2)
    let hash = 5381;
    for (let i = 0; i < dateString.length; i++) {
        hash = ((hash << 5) + hash) + dateString.charCodeAt(i); // hash * 33 + char
    }

    const index = Math.abs(hash) % languageList.length;
    return languageList[index];
}

function checkIfAlreadyPlayed() {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const savedDate = localStorage.getItem('lastGameDate');
    const result = localStorage.getItem('lastGameResult');

    if (savedDate === dateKey) {
        if (result === 'win') {
            appendOutputLine(`🎉 You already solved today's language: "${targetLanguage}".`);
        } else if (result === 'loss') {
            appendOutputLine(`❌ You already ran out of guesses today. The answer was "${targetLanguage}".`);
        }
        disableInput();
        return true;
    }
    return false;
}

function startNewGame() {
    targetLanguage = getDailyLanguage();
    targetFamily = LANGUAGE_DATA[targetLanguage];
    updateFamilyHint(targetFamily[0]);
    output.innerHTML = '';
    guessesLeft = MAX_GUESSES;
    guessedLanguages.clear();
    updateGuessesDisplay();
    clearAutocompleteSuggestions();
    input.disabled = false;
    button.disabled = false;
    input.value = '';

    if (checkIfAlreadyPlayed()) return;
}

function updateFamilyHint(familyName) {
    const familyInfo = familyDescriptions[familyName];
    const familyHintElement = document.getElementById('familyHint');
    const isFamily = familyName === targetFamily[0];
    const label = isFamily ? "Family" : "Shared Classification";
    
    if (!familyInfo) {
        familyHintElement.innerHTML = `${label}: ${familyName}`;
        return;
    }

    familyHintElement.innerHTML = `
        <strong>${label}: ${familyName}</strong><br>
        ${familyInfo.description}
        <a href="${familyInfo.link}" target="_blank" rel="noopener noreferrer"> (Wikipedia)</a>
    `;
}

function saveWinState() {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    localStorage.setItem('lastGameDate', dateKey);
    localStorage.setItem('lastGameResult', 'win');
}

function saveLossState() {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    localStorage.setItem('lastGameDate', dateKey);
    localStorage.setItem('lastGameResult', 'loss');
}

function handleGuess() {
    const guess = input.value.trim();
    if (!guess) return;

    if (!LANGUAGE_DATA[guess]) {
        appendOutputLine(`"${guess}" is not a valid language in this game.`);
        return;
    }

    if (guessedLanguages.has(guess)) {
        appendOutputLine(`"${guess}" has already been guessed.`);
        return;
    }

    guessedLanguages.add(guess);
    guessesLeft--;
    updateGuessesDisplay();

    if (guess === targetLanguage) {
        appendOutputLine(`🎉 Correct! The answer was "${targetLanguage}".`);
        saveWinState();
        disableInput();
        return;
    }

    if (guessesLeft <= 0) {
        appendOutputLine(`❌ Out of guesses! The answer was "${targetLanguage}".`);
        saveLossState();
        disableInput();
        return;
    }

    const commonAncestor = findCommonAncestor(guess, targetLanguage);
    if (!commonAncestor) {
        appendOutputLine(`Guess: ${guess} → No common ancestry found.`);
    } else {
        appendOutputLine(`Guess: ${guess} → Common ancestor: ${commonAncestor}`);
        updateFamilyHint(commonAncestor);
    }
    input.value = '';
    clearAutocompleteSuggestions();
}

function findCommonAncestor(guess, target) {
    const guessTree = LANGUAGE_DATA[guess];
    const targetTree = LANGUAGE_DATA[target];

    let i = 0;
    while (i < guessTree.length && i < targetTree.length && guessTree[i] === targetTree[i]) {
        i++;
    }
    if (i === 0) return null;
    return guessTree[i - 1];
}

function updateGuessesDisplay() {
    guessesLeftDisplay.textContent = `Guesses Left: ${guessesLeft}`;
}

function disableInput() {
    input.disabled = true;
    button.disabled = true;
    clearAutocompleteSuggestions();
}

function appendOutputLine(text) {
    const line = document.createElement('div');
    line.textContent = text;
    output.appendChild(line);
}

function clearAutocompleteSuggestions() {
    autocompleteList.innerHTML = '';
    highlightIndex = -1;
}

function showAutocompleteSuggestions() {
    clearAutocompleteSuggestions();
    const value = input.value.trim();
    if (!value) return;

    const results = fuse.search(value, { limit: 10 });

    results.forEach((result, index) => {
        const match = result.item;
        if (guessedLanguages.has(match)) return;

        const item = document.createElement('div');
        item.textContent = match;
        item.classList.add('autocomplete-item');
        item.dataset.index = index;
        item.addEventListener('click', () => {
            input.value = match;
            clearAutocompleteSuggestions();
            input.focus();
        });
        autocompleteList.appendChild(item);
    });
    highlightIndex = -1;
}
    
function handleKeyNavigation(e) {
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    if (!items.length) {
        if (e.key === 'Enter') {
            handleGuess();
        }
        return;
    }
    if (e.key === 'ArrowDown') {
        highlightIndex = (highlightIndex + 1) % items.length;
        updateHighlight(items);
        e.preventDefault();
    } else if (e.key === 'ArrowUp') {
        highlightIndex = (highlightIndex - 1 + items.length) % items.length;
        updateHighlight(items);
        e.preventDefault();
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
        input.value = items[highlightIndex].textContent;
        clearAutocompleteSuggestions();
        e.preventDefault();
    }
}

function updateHighlight(items) {
    items.forEach(item => item.classList.remove('highlighted'));
    if (highlightIndex >= 0) {
        items[highlightIndex].classList.add('highlighted');
    }
}

});
