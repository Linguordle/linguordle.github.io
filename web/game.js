const languageList = Object.keys(LANGUAGE_DATA);
const fuse = new Fuse(languageList, {
    threshold: 0.4,
    includeScore: true,
    keys: []
});
const targetLanguage = languageList[Math.floor(Math.random() * languageList.length)];
const targetFamily = LANGUAGE_DATA[targetLanguage][0];

// Display the family as a hint
document.getElementById('familyHint').textContent = `Family: ${targetFamily}`;

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
    if (!guess) return;

    if (!LANGUAGE_DATA[guess]) {
        output.textContent = `"${guess}" is not a recognized language in this game.`;
        return;
    }

    // Example feedback for testing:
    output.textContent = `You guessed: ${guess}. Classification: ${LANGUAGE_DATA[guess].join(" → ")}`;
    input.value = '';
}
