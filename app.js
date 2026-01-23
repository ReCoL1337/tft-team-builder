let board = new Array(28).fill(null);
let filteredChampions = [...champions];
let draggedData = null;
let searchTimeout;

function init() {
    renderChampionsList();
    renderBoard();

    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => handleSearch(e), 200);
    });

    setupChampionsListListeners();
}

function setupChampionsListListeners() {
    const list = document.getElementById('championsList');

    list.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('champion-btn')) {
            draggedData = {
                type: 'champion',
                champ: JSON.parse(e.target.getAttribute('data-champ'))
            };
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    list.addEventListener('click', (e) => {
        const btn = e.target.closest('.champion-btn');
        if (btn) {
            const champ = JSON.parse(btn.getAttribute('data-champ'));
            const firstEmpty = board.findIndex(slot => slot === null);
            if (firstEmpty !== -1) {
                board[firstEmpty] = champ;
                renderBoard();
            }
        }
    });
}

function renderChampionsList() {
    const list = document.getElementById('championsList');

    const groupedByCost = filteredChampions.reduce((acc, champ) => {
        if (!acc[champ.cost]) acc[champ.cost] = [];
        acc[champ.cost].push(champ);
        return acc;
    }, {});

    const sortedCosts = Object.keys(groupedByCost).sort((a, b) => a - b);

    list.innerHTML = sortedCosts.map(cost => `
        <div class="cost-row">
            <div class="cost-label">${cost} Cost</div>
            <div class="champions-row">
                ${groupedByCost[cost].map(champ => `
                    <div class="champion-btn cost-${champ.cost}" 
                         draggable="true" 
                         data-champ="${JSON.stringify(champ).replace(/"/g, '&quot;')}"
                         title="${champ.name} - ${champ.traits.join(', ')}">
                        <img src="${getChampionIcon(champ.name)}" 
                             alt="${champ.name}" 
                             class="champion-icon"
                             onerror="this.style.display='none';">
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderBoard() {
    const boardEl = document.getElementById('board');
    let html = '<ul class="hexagon-grid-container">';

    for (let i = 0; i < 28; i++) {
        const champ = board[i];
        html += `<li class="hexagon ${champ ? 'has-champion-outer cost-' + champ.cost : ''}" data-slot="${i}" draggable="${champ ? 'true' : 'false'}">
            <div class="hexagon-inner ${champ ? 'has-champion cost-' + champ.cost : ''}">
                ${champ ? `
                    <img src="${getChampionIcon(champ.name)}" alt="${champ.name}" class="board-champion-icon" onerror="this.style.display='none'">
                ` : ''}
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
    //updateStats();
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

  const uniqueChamps = [...new Map(activeChamps.map(c => [c.name, c])).values()];

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
      if (!synergy) return '';
      
      const thresholds = synergy.thresholds;
      
      let currentThresholdIndex = -1;
      let displayThreshold = thresholds[0];
      
      for (let i = 0; i < thresholds.length; i++) {
        if (count >= thresholds[i]) {
          currentThresholdIndex = i;
          displayThreshold = thresholds[i];
        } else {
          displayThreshold = thresholds[i];
          break;
        }
      }

      const activeClass = currentThresholdIndex >= 0 
        ? `active-${Math.min(currentThresholdIndex + 1, 3)}` 
        : 'inactive';

      return `<div class="synergy-badge ${activeClass}">
        ${trait}
        <span class="synergy-level">${count}/${displayThreshold}</span>
      </div>`;
    })
    .join('');

  container.innerHTML = synergiesHtml;
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
    `;
}

function toggleSavePanel() {
    const panel = document.getElementById('savePanel');
    panel.style.display = 'flex';
    document.getElementById('teamNameInput').value = '';
    document.getElementById('teamNameInput').focus();
}

function closeSavePanel() {
    document.getElementById('savePanel').style.display = 'none';
}

function saveTeamConfirm() {
    const teamName = document.getElementById('teamNameInput').value.trim();
    if (!teamName) {
        return;
    }
    const teams = JSON.parse(localStorage.getItem('teams') || '{}');
    teams[teamName] = board;
    localStorage.setItem('teams', JSON.stringify(teams));
    closeSavePanel();
}

function toggleLoadPanel() {
    const panel = document.getElementById('loadPanel');
    const teams = JSON.parse(localStorage.getItem('teams') || '{}');

    const list = document.getElementById('savedTeamsList');

    if (Object.keys(teams).length === 0) {
        list.innerHTML = '<div class="empty-state">No saved teams</div>';
        panel.style.display = 'flex';
        return;
    }

    list.innerHTML = Object.keys(teams).map(name => {
        const escapedName = name.replace(/'/g, "\\'");
        return `
        <div class="saved-team-item">
            <span class="team-name">${name}</span>
            <div class="team-actions">
                <button class="btn btn-small" onclick="loadTeamByName('${escapedName}')">Load</button>
                <button class="btn btn-small btn-danger" onclick="deleteTeam('${escapedName}')">Delete</button>
            </div>
        </div>
    `;
    }).join('');

    panel.style.display = 'flex';
}

function closeLoadPanel() {
    document.getElementById('loadPanel').style.display = 'none';
}

function loadTeamByName(name) {
    const teams = JSON.parse(localStorage.getItem('teams') || '{}');
    if (teams[name]) {
        board = teams[name];
        renderBoard();
        closeLoadPanel();
    }
}

function deleteTeam(name) {
    const teams = JSON.parse(localStorage.getItem('teams') || '{}');
    delete teams[name];
    localStorage.setItem('teams', JSON.stringify(teams));
    if (Object.keys(teams).length === 0) {
        closeLoadPanel();
    } else {
        toggleLoadPanel();
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