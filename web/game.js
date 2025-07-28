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

let relatedGuesses = [];    // [{ name, lineage, sharedPath }]
let unrelatedGuesses = [];  // [ "Basque", ... ]
let lastTreeData = null;    // keep last rendered related tree for resizing
let isRevealed = false;     // Show target language name after win/loss

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

// Re-render the tree responsively
window.addEventListener('resize', () => {
    if (lastTreeData) renderTree(lastTreeData, unrelatedGuesses);
});

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
        isRevealed = true; // Show target if returning to game after finishing
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
    try {
        targetLanguage = await getDailyLanguage();
    } catch (e) {
        appendOutputLine('⚠️ Could not load today\'s language. Please try again later.');
        disableInput();
        return;
    }

    targetFamily = LANGUAGE_DATA[targetLanguage];
    updateFamilyHint(targetFamily[0]);
    output.innerHTML = '';
    guessesLeft = MAX_GUESSES;
    guessedLanguages.clear();
    relatedGuesses = [];
    unrelatedGuesses = [];
    lastTreeData = null;
    isRevealed = false;
    updateGuessesDisplay();
    clearAutocompleteSuggestions();
    input.disabled = false;
    button.disabled = false;
    input.value = '';

    clearTree();

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
    theDateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    localStorage.setItem('lastGameDate', theDateKey);
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
        isRevealed = true;
        const treeData = buildLowestSharedTree(relatedGuesses, targetFamily);
        if (treeData) renderTree(treeData, unrelatedGuesses);
        else clearTree();
        disableInput();
        clearAutocompleteSuggestions();
        return;
    }

    if (guessesLeft <= 0) {
        appendOutputLine(`❌ Out of guesses! The answer was "${targetLanguage}".`);
        saveLossState();
        isRevealed = true;
        const treeData = buildLowestSharedTree(relatedGuesses, targetFamily);
        if (treeData) renderTree(treeData, unrelatedGuesses);
        else clearTree();
        disableInput();
        clearAutocompleteSuggestions();
        return;
    }

    const treeData = buildLowestSharedTree(relatedGuesses, targetFamily);
    if (treeData) renderTree(treeData, unrelatedGuesses);
    else clearTree();

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
    const familyName = targetFamily[0];

    // If there are no related guesses yet, just show the family without the target (hidden)
    if (!relatedGuesses.length) {
        return {
            name: familyName,
            children: [
                { name: targetLanguage, isTarget: true }
            ]
        };
    }

    // Build the tree hierarchy step by step
    let root = { name: familyName, children: [] };

    // Find the deepest shared classification among guesses
    let deepestSharedNode = null;
    const groups = new Map();

    relatedGuesses.forEach(g => {
        if (!g.sharedPath || !g.sharedPath.length) return;
        const deepest = g.sharedPath[g.sharedPath.length - 1];
        if (!groups.has(deepest)) {
            groups.set(deepest, { name: deepest, children: [] });
        }
        groups.get(deepest).children.push({ name: g.name, isGuess: true });
        deepestSharedNode = deepest;
    });

    // Convert groups to children
    root.children = Array.from(groups.values());

    // Find the node where we should attach the target language
    if (deepestSharedNode) {
        const targetNode = root.children.find(child => child.name === deepestSharedNode);
        if (targetNode) {
            targetNode.children.push({ name: targetLanguage, isTarget: true });
        } else {
            // If we didn't find it (edge case), attach directly under root
            root.children.push({ name: targetLanguage, isTarget: true });
        }
    } else {
        root.children.push({ name: targetLanguage, isTarget: true });
    }

    return root;
}

function renderTree(data, unrelatedList = []) {
    lastTreeData = data;

    const container = document.getElementById('tree-container');
    const width = container.clientWidth;

    const root = d3.hierarchy(data);
    const estimatedNodes = root.descendants().length + unrelatedList.length + 3;
    let height = Math.max(400, 24 * estimatedNodes);

    const margin = { top: 20, right: 160, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select("#classification-tree")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("preserveAspectRatio", "xMidYMid meet");

    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Tree layout ---
    const treeLayout = d3.tree()
        .size([innerWidth * 0.75, innerHeight])
        .separation((a, b) => {
            const base = (a.parent === b.parent ? 1 : 2);
            const extra = (a.data.name.length + b.data.name.length) / 6;
            return base + extra;
        });

    treeLayout(root);

    // --- Spread nodes with same depth ---
    const minVerticalGap = 18;
    const depthGroups = d3.group(root.descendants(), d => d.depth);
    for (const [, nodesAtDepth] of depthGroups) {
        nodesAtDepth.sort((a, b) => a.x - b.x);
        nodesAtDepth.forEach((node, idx) => {
            node.y += idx * minVerticalGap;
        });
    }

    // --- Rescale Y positions to fit in container ---
    const yPositions = root.descendants().map(d => d.y);
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);

    const actualHeight = maxY - minY + margin.top + margin.bottom + 40;
    if (actualHeight > height) {
        height = actualHeight;
        svg.attr("height", height)
           .attr("viewBox", [0, 0, width, height]);
    }

    const tx = d => d.x;
    const ty = d => d.y - minY + 20; // shift upward so everything fits

    // --- Links ---
    g.append("g")
        .selectAll("line")
        .data(root.links())
        .enter()
        .append("line")
        .attr("x1", d => tx(d.source))
        .attr("y1", d => ty(d.source))
        .attr("x2", d => tx(d.target))
        .attr("y2", d => ty(d.target))
        .attr("stroke", "#333");

    // --- Nodes ---
    const nodes = g.append("g")
        .selectAll("g.node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${tx(d)},${ty(d)})`);

    nodes.append("circle")
        .attr("r", 5)
        .attr("fill", d => {
            if (d.data.isTarget && !isRevealed) return '#999';
            return d.children ? 'steelblue' : 'green';
        });

    nodes.append("text")
        .attr("x", 8)
        .attr("dy", "0.32em")
        .text(d => (d.data.isTarget && !isRevealed) ? '???' : d.data.name);

        // --- Scattered unrelated guesses to the right ---
    if (unrelatedList.length) {
        const unrelatedGroup = g.append("g").attr("class", "unrelated");

        unrelatedList.forEach((name, i) => {
            const angle = Math.random() * 2 * Math.PI;
            const radius = 80 + Math.random() * 60;
            const centerX = innerWidth * 0.88;
            const centerY = innerHeight / 2;

            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const nodeGroup = unrelatedGroup.append("g")
                .attr("transform", `translate(${x}, ${y})`);

            nodeGroup.append("circle")
                .attr("r", 6)
                .attr("fill", "crimson");

            nodeGroup.append("text")
                .attr("x", 8)
                .attr("dy", "0.32em")
                .text(name);
        });

        unrelatedGroup.append("text")
            .attr("x", innerWidth * 0.88)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .text("Unrelated guesses");
    }
}

function clearTree() {
    const svg = d3.select("#classification-tree");
    svg.selectAll("*").remove();
}

// No-op now; unrelated guesses are rendered in the SVG
function updateUnrelatedGuessesDisplay() {}

if (useEasyMode) {
    const notice = document.createElement('div');
    notice.textContent = 'Easy Mode is ON';
    notice.style.color = 'green';
    output.appendChild(notice);
}

});
