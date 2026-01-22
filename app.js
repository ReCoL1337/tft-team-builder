let board = new Array(28).fill(null);
let filteredChampions = [...champions];
let draggedData = null;

function init() {
    renderChampionsList();
    renderBoard();
    document.getElementById('searchInput').addEventListener('input', handleSearch);
}

function renderChampionsList() {
    const list = document.getElementById('championsList');
    
    // Group champions by cost
    const groupedByCost = filteredChampions.reduce((acc, champ) => {
        if (!acc[champ.cost]) acc[champ.cost] = [];
        acc[champ.cost].push(champ);
        return acc;
    }, {});
    
    // Sort costs and render rows
    const sortedCosts = Object.keys(groupedByCost).sort((a, b) => a - b);
    
    list.innerHTML = sortedCosts.map(cost => `
        <div class="cost-row">
            <div class="cost-label">Cost ${cost}</div>
            <div class="champions-row">
                ${groupedByCost[cost].map(champ => `
                    <div class="champion-btn cost-${champ.cost}" 
                         draggable="true" 
                         data-champ="${JSON.stringify(champ).replace(/"/g, '&quot;')}"
                         title="${champ.traits.join(', ')}">
                        <img src="${getChampionIcon(champ.name)}" 
                             alt="${champ.name}" 
                             class="champion-icon"
                             onerror="this.style.display='none';">
                        <span class="champion-name">${champ.name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Re-attach event listeners
    document.querySelectorAll('.champion-btn').forEach(btn => {
        btn.addEventListener('dragstart', (e) => {
            draggedData = {
                type: 'champion',
                champ: JSON.parse(e.currentTarget.getAttribute('data-champ'))
            };
            e.dataTransfer.effectAllowed = 'move';
        });

        btn.addEventListener('click', (e) => {
            const champ = JSON.parse(e.currentTarget.getAttribute('data-champ'));
            const firstEmpty = board.findIndex(slot => slot === null);
            if (firstEmpty !== -1) {
                board[firstEmpty] = champ;
                renderBoard();
            }
        });
    });
}

function renderBoard() {
    const boardEl = document.getElementById('board');

    let html = '<ul class="hexagon-grid-container">';
    for (let i = 0; i < 28; i++) {
        const champ = board[i];

        html += `
        <li class="hexagon" data-slot="${i}" draggable="${champ ? 'true' : 'false'}">
            <div class="hexagon-inner">
                ${champ ? `
                    <span class="hexagon-name">${champ.name}</span>
                    <span class="hexagon-metric-label">${champ.traits.slice(0, 2).join(' ')}</span>
                    <span class="hexagon-featured-score">${champ.cost}</span>
                ` : `
                    <span class="hexagon-name">&nbsp;</span>
                    <span class="hexagon-metric-label">&nbsp;</span>
                    <span class="hexagon-featured-score">&nbsp;</span>
                `}
            </div>
        </li>`;
    }
    html += '</ul>';

    boardEl.innerHTML = html;

    document.querySelectorAll('.hexagon').forEach(slot => {
        slot.addEventListener('dragover', handleDragOver);
        slot.addEventListener('dragleave', handleDragLeave);
        slot.addEventListener('drop', handleDrop);
        slot.addEventListener('dragstart', handleSlotDragStart);
        slot.addEventListener('contextmenu', handleRightClick);
    });

    updateSynergies();
    updateStats();
}

function handleRightClick(e) {
    e.preventDefault();
    const slotEl = e.target.closest('.hexagon');
    if (!slotEl) return;
    
    const slotIdx = parseInt(slotEl.getAttribute('data-slot'), 10);
    if (board[slotIdx]) {
        board[slotIdx] = null;
        renderBoard();
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const slot = e.target.closest('.hexagon');
    if (slot) slot.classList.add('drag-over');
}

function handleDragLeave(e) {
    const slot = e.target.closest('.hexagon');
    if (slot) slot.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const slotEl = e.target.closest('.hexagon');
    if (!slotEl) return;
    slotEl.classList.remove('drag-over');

    const targetSlot = parseInt(slotEl.getAttribute('data-slot'), 10);

    if (draggedData?.type === 'champion') {
        board[targetSlot] = draggedData.champ;
    } else if (draggedData?.type === 'slot') {
        const sourceSlot = draggedData.slot;
        const tmp = board[targetSlot];
        board[targetSlot] = board[sourceSlot];
        board[sourceSlot] = tmp;
    }

    renderBoard();
}

function handleSlotDragStart(e) {
    const slotEl = e.target.closest('.hexagon');
    if (!slotEl) {
        e.preventDefault();
        return;
    }
    const slotIdx = parseInt(slotEl.getAttribute('data-slot'), 10);
    if (board[slotIdx]) {
        draggedData = { type: 'slot', slot: slotIdx };
        e.dataTransfer.effectAllowed = 'move';
        slotEl.classList.add('dragging');
    } else {
        e.preventDefault();
    }
}

function clearBoard() {
    board = new Array(28).fill(null);
    renderBoard();
}

function updateSynergies() {
    const container = document.getElementById('synergiesContainer');
    const activeChamps = board.filter(c => c !== null);

    if (activeChamps.length === 0) {
        container.innerHTML = '<div class="empty-state">Add champions to see synergies</div>';
        return;
    }

    // Get unique champions only
    const uniqueChamps = [];
    const seenNames = new Set();
    
    activeChamps.forEach(champ => {
        if (!seenNames.has(champ.name)) {
            uniqueChamps.push(champ);
            seenNames.add(champ.name);
        }
    });

    const traitCounts = {};
    uniqueChamps.forEach(champ => {
        champ.traits.forEach(trait => {
            traitCounts[trait] = (traitCounts[trait] || 0) + 1;
        });
    });

    const synergiesHtml = Object.entries(traitCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([trait, count]) => {
            const synergy = synergies[trait];
            const thresholds = synergy ? synergy.thresholds : [];
            const activeLevel = thresholds.findIndex(t => count >= t) + 1;
            const activeClass = activeLevel > 0 ? `active-${activeLevel}` : 'inactive';

            return `<div class="synergy-badge ${activeClass}">
                ${trait}
                <span class="synergy-level">
                  ${count}/${thresholds[thresholds.length - 1] || count}
                </span>
            </div>`;
        }).join('');

    container.innerHTML = `<div class="synergy-grid">${synergiesHtml}</div>`;
}

function updateStats() {
    const container = document.getElementById('statsContainer');
    const activeChamps = board.filter(c => c !== null);

    if (activeChamps.length === 0) {
        container.innerHTML = '<div class="empty-state">No champions selected</div>';
        return;
    }

    const totalCost = activeChamps.reduce((sum, c) => sum + c.cost, 0);
    const avgCost = (totalCost / activeChamps.length).toFixed(1);
    const costBreakdown = [1, 2, 3, 4, 5]
        .map(cost => {
            const count = activeChamps.filter(c => c.cost === cost).length;
            return count > 0 ? `${cost}★: ${count}` : null;
        })
        .filter(Boolean)
        .join(' | ');

    container.innerHTML = `
        <div class="stat-row">
            <span class="stat-label">Champions</span>
            <span class="stat-value">${activeChamps.length}/28</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Total Cost</span>
            <span class="stat-value">${totalCost}g</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Avg Cost</span>
            <span class="stat-value">${avgCost}★</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Cost Breakdown</span>
            <span class="stat-value">${costBreakdown}</span>
        </div>
    `;
}

function saveTeam() {
    const teamName = prompt('Enter team name:');
    if (teamName && teamName.trim()) {
        const teams = JSON.parse(localStorage.getItem('tftTeams')) || {};
        teams[teamName] = {
            board: board.map(c => c ? c.name : null),
            savedAt: new Date().toLocaleString()
        };
        localStorage.setItem('tftTeams', JSON.stringify(teams));
        alert('Team saved!');
    }
}

function loadTeam() {
    const teams = JSON.parse(localStorage.getItem('tftTeams')) || {};
    const teamNames = Object.keys(teams);

    if (teamNames.length === 0) {
        alert('No saved teams');
        return;
    }

    const name = prompt(
        'Available teams:\n' + teamNames.join('\n') +
        '\n\nEnter team name to load:'
    );
    if (name && teams[name]) {
        board = teams[name].board.map(champName => {
            if (!champName) return null;
            return champions.find(c => c.name === champName);
        });
        renderBoard();
    }
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    filteredChampions = champions.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.traits.some(t => t.toLowerCase().includes(query))
    );
    renderChampionsList();
}

document.addEventListener('DOMContentLoaded', init);