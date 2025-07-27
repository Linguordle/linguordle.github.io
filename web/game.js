window.addEventListener('DOMContentLoaded', async () => {
    
const useEasyMode = localStorage.getItem('easyMode') === 'true';
const fullData = typeof LANGUAGE_DATA_FULL !== 'undefined' ? LANGUAGE_DATA_FULL : {};
const easyData = typeof LANGUAGE_DATA_EASY !== 'undefined' ? LANGUAGE_DATA_EASY : {};
const LANGUAGE_DATA = useEasyMode ? easyData : fullData;
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
    threshold: 0.4,
    distance: 100,
    keys: []
});

button.addEventListener('click', handleGuess);
input.addEventListener('keydown', handleKeyNavigation);
input.addEventListener('input', showAutocompleteSuggestions);

await startNewGame();

async function getDailyLanguage() {
    const res = await fetch('daily-language.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load daily language.');
    const data = await res.json();
    return data.language;
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

async function startNewGame() {
    targetLanguage = await getDailyLanguage();
    targetFamily = LANGUAGE_DATA[targetLanguage];
    updateFamilyHint(targetFamily[0]);
    output.innerHTML = '';
    guessesLeft = MAX_GUESSES;
    guessedLanguages.clear();
    relatedGuesses = [];
    unrelatedGuesses = [];
    updateGuessesDisplay();
    clearAutocompleteSuggestions();
    clearTree();
    input.disabled = false;
    button.disabled = false;
    input.value = '';

    if (checkIfAlreadyPlayed()) return;
}

function updateFamilyHint(familyName) {
    const familyInfo = familyDescriptions[familyName];
    const familyHintElement = document.getElementById('familyHint');
    const label = "Family";

    if (!familyInfo) {
        familyHintElement.innerHTML = `${label}: ${familyName}`;
        return;
    }

    familyHintElement.innerHTML = `
        <strong>${label}: ${familyName}</strong><br>
        <p style="font-size: 0.9rem; line-height: 1.2;">${familyInfo.description}</p>
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

let relatedGuesses = [];   
let unrelatedGuesses = []; 

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
    const sharedPath = getSharedPath(guess, targetLanguage);

    if (sharedPath.length === 0) {
        unrelatedGuesses.push(guess);
        appendOutputLine(`Guess: ${guess} → No common ancestry found.`);
        updateUnrelatedGuessesDisplay(unrelatedGuesses);
    } else {
        relatedGuesses.push({
            name: guess,
            lineage: LANGUAGE_DATA[guess],
            sharedPath
        });

        const deepest = sharedPath[sharedPath.length - 1];
        appendOutputLine(`Guess: ${guess} → Common ancestor: ${deepest}`);
        updateFamilyHint(deepest);
    }

    guessesLeft--;
    updateGuessesDisplay();

    if (guess === targetLanguage) {
        appendOutputLine(`🎉 Correct! The answer was "${targetLanguage}".`);
        saveWinState();
        renderTree(buildLowestSharedTree(relatedGuesses, targetFamily));
        updateUnrelatedGuessesDisplay(unrelatedGuesses);
        disableInput();
        clearAutocompleteSuggestions();
        return;
    }

    if (guessesLeft <= 0) {
        appendOutputLine(`❌ Out of guesses! The answer was "${targetLanguage}".`);
        saveLossState();
        renderTree(buildLowestSharedTree(relatedGuesses, targetFamily));
        updateUnrelatedGuessesDisplay(unrelatedGuesses);
        disableInput();
        clearAutocompleteSuggestions();
        return;
    }

    if (relatedGuesses.length > 0) {
        renderTree(buildLowestSharedTree(relatedGuesses, targetFamily));
    }

    input.value = '';
    clearAutocompleteSuggestions();
}

function getSharedPath(guess, target) {
    const guessTree  = LANGUAGE_DATA[guess];
    const targetTree = LANGUAGE_DATA[target];

    let i = 0;
    while (i < guessTree.length && i < targetTree.length && guessTree[i] === targetTree[i]) {
        i++;
    }
    return guessTree.slice(0, i); 
}

function buildLowestSharedTree(relatedGuesses, targetFamily) {
    if (!relatedGuesses.length) return null;

    const familyName = targetFamily[0];
    const groups = new Map();

    relatedGuesses.forEach(g => {
        if (!g.sharedPath || !g.sharedPath.length) return;
        const deepest = g.sharedPath[g.sharedPath.length - 1];
        if (!groups.has(deepest)) {
            groups.set(deepest, { name: deepest, children: [] });
        }
        groups.get(deepest).children.push({ name: g.name, isGuess: true });
    });

    return {
        name: familyName,
        children: Array.from(groups.values())
    };
}

function renderTree(data) {
    const svg = d3.select("#classification-tree");
    svg.selectAll("*").remove();
    if (!data) return;

    const width = +svg.attr("width");
    const height = +svg.attr("height");

    const root = d3.hierarchy(data);
    const treeLayout = d3.tree().size([width - 40, height - 40]);
    treeLayout(root);

    svg.selectAll('line')
        .data(root.links())
        .enter()
        .append('line')
        .attr('x1', d => d.source.x + 20)
        .attr('y1', d => d.source.y + 20)
        .attr('x2', d => d.target.x + 20)
        .attr('y2', d => d.target.y + 20)
        .attr('stroke', 'black');

    svg.selectAll('circle')
        .data(root.descendants())
        .enter()
        .append('circle')
        .attr('cx', d => d.x + 20)
        .attr('cy', d => d.y + 20)
        .attr('r', 5)
        .attr('fill', d => d.children ? 'steelblue' : 'green');

    svg.selectAll('text')
        .data(root.descendants())
        .enter()
        .append('text')
        .attr('x', d => d.x + 25)
        .attr('y', d => d.y + 25)
        .text(d => d.data.name);
}

function clearTree() {
    const svg = d3.select("#classification-tree");
    svg.selectAll("*").remove();
}

function updateUnrelatedGuessesDisplay(list) {
    const div = document.getElementById('unrelated-guesses');
    if (!div) return;
    div.innerHTML = `
        <strong>Unrelated guesses:</strong>
        <ul>${list.map(g => `<li>${g}</li>`).join('')}</ul>
    `;
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
        handleGuess();
    }
}

function updateHighlight(items) {
    items.forEach(item => item.classList.remove('highlighted'));
    if (highlightIndex >= 0) {
        items[highlightIndex].classList.add('highlighted');
    }
}

if (useEasyMode) {
    const notice = document.createElement('div');
    notice.textContent = 'Easy Mode is ON';
    notice.style.color = 'green';
    output.appendChild(notice);
}

});
