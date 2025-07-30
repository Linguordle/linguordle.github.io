window.addEventListener('DOMContentLoaded', async () => {

const useEasyMode = localStorage.getItem('easyMode') === 'true';
const fullData = typeof LANGUAGE_DATA_FULL !== 'undefined' ? LANGUAGE_DATA_FULL : {};
const easyData = typeof LANGUAGE_DATA_EASY !== 'undefined' ? LANGUAGE_DATA_EASY : {};
const LANGUAGE_DATA = useEasyMode ? easyData : fullData;
const languageList = Object.keys(LANGUAGE_DATA);
const MAX_GUESSES = 15;
const unrelatedNodePositions = {};

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

    const initialTree = buildLowestSharedTree([], targetFamily);
    renderTree(initialTree, []);

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
    if (!relatedGuesses.length) {
        return {
            name: targetFamily[0],
            children: [
                { name: '[Hidden Target]', isTarget: true }
            ]
        };
    }

    // Step 1: Determine shared depth
    const allLineages = relatedGuesses.map(g => g.lineage).concat([targetFamily]);
    let sharedDepth = 0;
    while (
        allLineages.every(path => sharedDepth < path.length && path[sharedDepth] === allLineages[0][sharedDepth])
    ) {
        sharedDepth++;
    }

    const sharedPath = targetFamily.slice(0, sharedDepth);
    let root = { name: sharedPath[0], children: [] };
    let current = root;

    // Build the rest of the shared path (for now)
    const sharedNodes = [root];
    for (let i = 1; i < sharedPath.length; i++) {
        const node = { name: sharedPath[i], children: [] };
        current.children.push(node);
        current = node;
        sharedNodes.push(current);
    }

    // Determine shared lineage segments across guesses/target
    const lineageUsage = {};
    for (const guess of relatedGuesses) {
        for (let i = sharedDepth; i < guess.lineage.length; i++) {
            const key = guess.lineage.slice(0, i + 1).join(' > ');
            lineageUsage[key] = (lineageUsage[key] || 0) + 1;
        }
    }
    for (let i = sharedDepth; i < targetFamily.length; i++) {
        const key = targetFamily.slice(0, i + 1).join(' > ');
        lineageUsage[key] = (lineageUsage[key] || 0) + 1;
    }

    // Determine how far to reveal the target
    let maxTargetDepth = sharedDepth;
    for (const guess of relatedGuesses) {
        let i = sharedDepth;
        while (
            i < guess.lineage.length &&
            i < targetFamily.length &&
            guess.lineage[i] === targetFamily[i]
        ) {
            i++;
        }
        if (i > maxTargetDepth) maxTargetDepth = i;
    }

    // Build target branch
    let targetNode = current;
    for (let i = sharedDepth; i < maxTargetDepth; i++) {
        const level = targetFamily[i];
        const fullPath = targetFamily.slice(0, i + 1).join(' > ');
        if (lineageUsage[fullPath] < 2) break;

        let existing = targetNode.children.find(c => c.name === level);
        if (!existing) {
            existing = { name: level, children: [] };
            targetNode.children.push(existing);
        }
        targetNode = existing;
    }

    if (!relatedGuesses.some(g => g.name === targetLanguage)) {
        targetNode.children.push({ name: '[Hidden Target]', isTarget: true });
    }


    // Add guesses
    for (const guess of relatedGuesses) {
        let guessNode = current;
        for (let i = sharedDepth; i < guess.lineage.length - 1; i++) {
            const level = guess.lineage[i];
            const fullPath = guess.lineage.slice(0, i + 1).join(' > ');
            if (lineageUsage[fullPath] < 2) break;

            let existing = guessNode.children.find(c => c.name === level);
            if (!existing) {
                existing = { name: level, children: [] };
                guessNode.children.push(existing);
            }
            guessNode = existing;
        }
        guessNode.children.push({ name: guess.name, isGuess: true });
    }

    // Step 4: Prune non-root classification nodes with only one child (unless that child is a guess/target)
    function pruneTree(node, isRoot = false) {
        if (!node.children || node.children.length === 0) return node;

        node.children = node.children.map(child => pruneTree(child)).filter(Boolean);

        // Don't prune root, guesses, or targets
        const isLeaf = node.children.length === 0;
        const isSpecial = isRoot || node.isGuess || node.isTarget;

        if (!isSpecial && node.children.length === 1 && !node.children[0].isGuess && !node.children[0].isTarget) {
            // Collapse node by replacing it with its child
            return node.children[0];
        }

        return node;
    }

    return pruneTree(root, true);
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

    let g = svg.select("g.main");
    if (g.empty()) {
        g = svg.append("g").attr("class", "main").attr("transform", `translate(${margin.left},${margin.top})`);
    }

    const treeLayout = d3.tree()
        .size([innerWidth * 0.75, innerHeight])
        .separation((a, b) => {
            const base = (a.parent === b.parent ? 1 : 2);
            const extra = (a.data.name.length + b.data.name.length) / 6;
            return base + extra;
        });

    treeLayout(root);

    const minVerticalGap = 18;
    const depthGroups = d3.group(root.descendants(), d => d.depth);
    for (const [, nodesAtDepth] of depthGroups) {
        nodesAtDepth.sort((a, b) => a.x - b.x);
        nodesAtDepth.forEach((node, idx) => {
            node.y += idx * minVerticalGap;
        });
    }

    const yPositions = root.descendants().map(d => d.y);
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);

    const actualHeight = maxY - minY + margin.top + margin.bottom + 40;
    if (actualHeight > height) {
        height = actualHeight;
        svg.attr("height", height).attr("viewBox", [0, 0, width, height]);
    }

    const tx = d => d.x;
    const ty = d => d.y - minY + 20;

    const linkGroup = g.select("g.links");
    if (linkGroup.empty()) g.append("g").attr("class", "links");

    const nodeGroup = g.select("g.nodes");
    if (nodeGroup.empty()) g.append("g").attr("class", "nodes");

    const linkSelection = g.select("g.links")
        .selectAll("line")
        .data(root.links(), d => d.target.data.name);

    linkSelection.join(
        enter => enter.append("line")
            .attr("x1", d => tx(d.source))
            .attr("y1", d => ty(d.source))
            .attr("x2", d => tx(d.source))
            .attr("y2", d => ty(d.source))
            .attr("stroke", "#333")
            .transition().duration(600)
            .attr("x2", d => tx(d.target))
            .attr("y2", d => ty(d.target)),

        update => update.transition().duration(600)
            .attr("x1", d => tx(d.source))
            .attr("y1", d => ty(d.source))
            .attr("x2", d => tx(d.target))
            .attr("y2", d => ty(d.target)),

        exit => exit.transition().duration(400).style("opacity", 0).remove()
    );

    const nodeSelection = g.select("g.nodes")
        .selectAll("g.node")
        .data(root.descendants(), d => d.data.name);

    const nodeEnter = nodeSelection.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${tx(d)},${ty(d)})`)
        .style("opacity", 0);

    nodeEnter.append("circle")
        .attr("r", 5)
        .attr("fill", d => {
            if (d.data.isTarget && !isRevealed) return '#999';
            return d.children ? 'steelblue' : 'green';
        });

    nodeEnter.append("text")
        .attr("x", 8)
        .attr("dy", "0.32em")
        .text(d => (d.data.isTarget && !isRevealed) ? '???' : d.data.name);

    nodeEnter.transition().duration(600).style("opacity", 1)
        .attr("transform", d => `translate(${tx(d)},${ty(d)})`);

    nodeSelection.transition().duration(600)
        .attr("transform", d => `translate(${tx(d)},${ty(d)})`);

    nodeSelection.exit().transition().duration(400).style("opacity", 0).remove();

    // --- Scattered unrelated guesses to the right ---
    let unrelatedGroup = g.select("g.unrelated");
    if (unrelatedGroup.empty()) unrelatedGroup = g.append("g").attr("class", "unrelated");

    const verticalSpacing = 28;
    const unrelatedData = unrelatedList.map((name, i) => {
        if (!unrelatedNodePositions[name]) {
            const baseX = innerWidth * 1.08;
            const spacingY = 26; // vertical spacing between nodes
            const jitterX = 60;   // small horizontal jitter to keep the "floating" feel

            unrelatedNodePositions[name] = {
                x: baseX + (Math.random() - 0.5) * jitterX,
                y: 40 + i * spacingY
            };

        }
        return { name, ...unrelatedNodePositions[name] };
    });

    const unrelatedNodes = unrelatedGroup.selectAll("g.unrelated-node")
        .data(unrelatedData, d => d.name);

    const unrelatedEnter = unrelatedNodes.enter()
        .append("g")
        .attr("class", "unrelated-node")
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .style("opacity", 0);

    unrelatedEnter.append("circle")
        .attr("r", 6)
        .attr("fill", "crimson");

    unrelatedEnter.append("text")
        .attr("x", 8)
        .attr("dy", "0.32em")
        .text(d => d.name);

    unrelatedEnter.transition().duration(600).style("opacity", 1);

    unrelatedNodes.transition().duration(600)
        .attr("transform", d => `translate(${d.x}, ${d.y})`);

    unrelatedNodes.exit().transition().duration(400).style("opacity", 0).remove();
}

function clearTree() {
    const svg = d3.select("#classification-tree");
    svg.selectAll("*").remove();
}

if (useEasyMode) {
    const notice = document.createElement('div');
    notice.textContent = 'Easy Mode is ON';
    notice.style.color = 'green';
    output.appendChild(notice);
}

});
