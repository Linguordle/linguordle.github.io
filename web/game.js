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

let relatedGuesses = [];   // [{ name, lineage, sharedPath }]
let unrelatedGuesses = []; // [ "Basque", ... ]

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
    input.disabled = false;
    button.disabled = false;
    input.value = '';
    
    if (checkIfAlreadyPlayed()) return;
}

function updateFamilyHint(classificationName) {
    const info = familyDescriptions[classificationName];
    const label = (classificationName === targetFamily[0]) ? "Family" : "Shared Classification";
    
    if (!info) {
        familyHint.innerHTML = `${label}: ${classificationName}`;
        return;
    }
    familyHint.innerHTML = `
        <strong>${label}: ${classificationName}</strong><br>
        <p style="font-size: 0.9rem; line-height: 1.3;">${info.description}</p>
        <a href="${info.link}" target="_blank" rel="noopener noreferrer">(Wikipedia)</a>
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
    const sharedPath = getSharedPath(guess, targetLanguage);

    if (sharedPath.length === 0) {
        unrelatedGuesses.push(guess);
        appendOutputLine(`Guess: ${guess} → No common ancestry found.`);
    } else {
        relatedGuesses.push({ name: guess, lineage: LANGUAGE_DATA[guess], sharedPath });
        const deepest = sharedPath[sharedPath.length - 1];
        appendOutputLine(`Guess: ${guess} → Common ancestor: ${deepest}`);
        updateFamilyHint(deepest);
    }

    guessesLeft--;
    updateGuessesDisplay();

    if (guess === targetLanguage) {
        appendOutputLine(`🎉 Correct! The answer was "${targetLanguage}".`);
        saveWinState();
        const treeData = buildLowestSharedTree(relatedGuesses, targetFamily);
        if (treeData) {
            renderTree(treeData, unrelatedGuesses);
        } else {
            clearTree();
        }
        disableInput();
        clearAutocompleteSuggestions();
        return;
    }

    if (guessesLeft <= 0) {
        appendOutputLine(`❌ Out of guesses! The answer was "${targetLanguage}".`);
        saveLossState();
        const treeData = buildLowestSharedTree(relatedGuesses, targetFamily);
        if (treeData) {
            renderTree(treeData, unrelatedGuesses);
        } else {
            clearTree();
        }
        disableInput();
        clearAutocompleteSuggestions();
        return;
    }

    const treeData = buildLowestSharedTree(relatedGuesses, targetFamily);
    if (treeData) {
        renderTree(treeData, unrelatedGuesses);
    } else {
        // Clear tree if you want when nothing related yet
        clearTree();
    }
    input.value = '';
    clearAutocompleteSuggestions();
}

function getSharedPath(guess, target) {
    const guessTree = LANGUAGE_DATA[guess];
    const targetTree = LANGUAGE_DATA[target];
    let i = 0;
    while (i < guessTree.length && i < targetTree.length && guessTree[i] === targetTree[i]) i++;
    return guessTree.slice(0, i);
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
        if (e.key === 'Enter') handleGuess();
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
    if (highlightIndex >= 0) items[highlightIndex].classList.add('highlighted');
}

function buildLowestSharedTree(relatedGuesses, targetFamily) {
    if (!relatedGuesses.length) return null;

    const familyName = targetFamily[0]; // Top-level family
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

function renderTree(data, unrelated = []) {
    const svg = d3.select("#classification-tree");
    svg.selectAll("*").remove();

    const root = d3.hierarchy(data);
    const treeLayout = d3.tree().nodeSize([100, 70]); 
    treeLayout(root);

    // Find bounds of nodes
    const nodes = root.descendants();
    const xExtent = d3.extent(nodes, d => d.x);
    const yExtent = d3.extent(nodes, d => d.y);

    // Shift nodes so that x starts at 0 (removes extra left space)
    const xShift = -xExtent[0] + 20; // small left padding
    nodes.forEach(d => {
        d.x += xShift;
    });

    const maxLabelLength = d3.max(nodes, d => d.data.name.length);
    const labelPadding = maxLabelLength * 6 + 30;

    const treeWidth = (xExtent[1] - xExtent[0]) + labelPadding + 40;
    const treeHeight = (yExtent[1] - yExtent[0]) + 100;

    svg.attr("viewBox", `0 ${yExtent[0] - 50} ${treeWidth} ${treeHeight}`);
    svg.attr("preserveAspectRatio", "xMidYMid meet");

    const fontSize = Math.max(12, Math.min(20, treeWidth / 40));

    // Links
    svg.append("g")
        .selectAll('line')
        .data(root.links())
        .enter()
        .append('line')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
        .attr('stroke', 'black');

    // Nodes
    svg.append("g")
        .selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', 6)
        .attr('fill', d => d.children ? 'steelblue' : 'green');

    // Labels
    svg.append("g")
        .selectAll('text')
        .data(nodes)
        .enter()
        .append('text')
        .attr('x', d => d.x + 10)
        .attr('y', d => d.y + 4)
        .text(d => d.data.name)
        .attr('font-size', `${fontSize}px`)
        .attr('font-family', 'IBM Plex Sans, sans-serif')
        .attr('dominant-baseline', 'middle');

    // Unrelated guesses on the right
    const unrelatedGroup = svg.append("g")
        .attr("transform", `translate(${treeWidth - labelPadding}, ${yExtent[0] + 20})`);

    unrelatedGroup.append("text")
        .text("Unrelated guesses:")
        .attr("font-weight", "bold")
        .attr("font-size", `${fontSize}px`);

    unrelatedGroup.selectAll(".unrelated-text")
        .data(unrelated)
        .enter()
        .append("text")
        .attr("class", "unrelated-text")
        .attr("x", 0)
        .attr("y", (d, i) => (i + 1) * (fontSize + 5))
        .text(d => `- ${d}`)
        .attr("font-size", `${fontSize * 0.9}px`);
}

window.addEventListener('resize', () => {
    const treeData = buildLowestSharedTree(relatedGuesses, targetFamily);
    renderTree(treeData, unrelatedGuesses);
});
    
if (useEasyMode) {
    const notice = document.createElement('div');
    notice.textContent = 'Easy Mode is ON';
    notice.style.color = 'green';
    output.appendChild(notice);
}

});
