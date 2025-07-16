const fuse = new Fuse(languageList, {
    threshold: 0.4,
    includeScore: true,
    keys: []
});

function getDailyLanguage() {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const languageList = Object.keys(LANGUAGE_DATA);
    const index = seed % languageList.length;
    return languageList[index];
}

function startNewGame() {
    const targetLanguage = getDailyLanguage();
    const targetFamily = LANGUAGE_DATA[targetLanguage][0];
    
    document.getElementById('familyHint').textContent = `Family: ${targetFamily}`;
    output.textContent = '';
    guessesLeft = MAX_GUESSES;
    updateGuessesDisplay();
    
    window.currentTargetLanguage = targetLanguage; // store for later guesses
}

const input = document.getElementById('guess-input');
const suggestionsList = document.getElementById('suggestions');
const output = document.getElementById('output');

document.getElementById('guess-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleGuess();
    suggestionsList.innerHTML = '';
});

input.addEventListener('input', () => {
    const results = fuse.search(input.value).slice(0, 5);
    suggestionsList.innerHTML = '';
    results.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.item;
        li.addEventListener('click', () => {
            input.value = result.item;
            suggestionsList.innerHTML = '';
            input.focus();
        });
        suggestionsList.appendChild(li);
    });
});

function handleGuess() {
    const guess = input.value.trim();
    if (guess === window.currentTargetLanguage) {
        output.textContent = `Correct! The answer was ${window.currentTargetLanguage}.`;
    } else {
        return;
    }
    if (!LANGUAGE_DATA[guess]) {
        output.textContent = `"${guess}" is not a recognized language in this game.`;
        return;
    }

    // Example feedback for testing:
    output.textContent = `You guessed: ${guess}. Classification: ${LANGUAGE_DATA[guess].join(" → ")}`;
    input.value = '';
}
