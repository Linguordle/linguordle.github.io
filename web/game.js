const languageList = Object.keys(LANGUAGE_DATA);
const MAX_GUESSES = 15;
let guessesLeft = MAX_GUESSES;
let targetLanguage = '';
let targetFamily = '';

const input = document.getElementById('guessInput');
const button = document.getElementById('guessButton');
const output = document.getElementById('output');
const guessesLeftDisplay = document.getElementById('guessesLeft');
const familyHint = document.getElementById('familyHint');
const autocompleteList = document.getElementById('autocomplete-list');

startNewGame();
button.addEventListener('click', handleGuess);
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleGuess();
    }
});

input.addEventListener('input', showAutocompleteSuggestions);

function getDailyLanguage() {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const index = seed % languageList.length;
    return languageList[index];
}

function startNewGame() {
    targetLanguage = getDailyLanguage();
    targetFamily = LANGUAGE_DATA[targetLanguage][0];

    familyHint.textContent = `Family: ${targetFamily}`;
    output.textContent = '';
    guessesLeft = MAX_GUESSES;
    updateGuessesDisplay();
}

function handleGuess() {
    const guess = input.value.trim();
    if (!guess) return;

    if (!LANGUAGE_DATA[guess]) {
        output.textContent = `"${guess}" is not a valid language in this game.`;
        return;
    }

    guessesLeft--;
    updateGuessesDisplay();

    if (guess === targetLanguage) {
        output.textContent = `🎉 Correct! The answer was "${targetLanguage}".`;
        disableInput();
        return;
    }

    if (guessesLeft <= 0) {
        output.textContent = `❌ Out of guesses! The answer was "${targetLanguage}".`;
        disableInput();
        return;
    }

    const commonAncestor = findCommonAncestor(guess, targetLanguage);
    output.textContent = `Common ancestor: ${commonAncestor}`;
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
    if (i === 0) return '(none)';
    return guessTree.slice(0, i).join(' → ');
}

function updateGuessesDisplay() {
    guessesLeftDisplay.textContent = `Guesses Left: ${guessesLeft}`;
}

function disableInput() {
    input.disabled = true;
    button.disabled = true;
}

function showAutocompleteSuggestions() {
    clearAutocompleteSuggestions();
    const value = input.value.toLowerCase();
    if (!value) return;

    const matches = languageList.filter(lang =>
        lang.toLowerCase().startsWith(value)
    ).slice(0, 10); // limit suggestions to 10

    matches.forEach(match => {
        const item = document.createElement('div');
        item.textContent = match;
        item.classList.add('autocomplete-item');
        item.addEventListener('click', () => {
            input.value = match;
            clearAutocompleteSuggestions();
            input.focus();
        });
        autocompleteList.appendChild(item);
    });
}

function clearAutocompleteSuggestions() {
    autocompleteList.innerHTML = '';
}
