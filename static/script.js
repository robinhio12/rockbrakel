// Global variables
let players = [];
let scores = {};
let opponents = {};
let shown = false;
let gameStartTime = null;
let gameTimer = null;
let countdownTimer = null;
let previousWinners = {}; // Track previous winners for popup notifications
let openWinnerPopups = new Set(); // Track which jersey popups are currently open

// DOM elements
const playerNameInput = document.getElementById('playerName');
const playerNumberInput = document.getElementById('playerNumber');
const playerPictureInput = document.getElementById('playerPicture');
const registerPlayerBtn = document.getElementById('registerPlayer');
const gameSelect = document.getElementById('gameSelect');
const dynamicFields = document.getElementById('dynamicFields');
const submitScoreBtn = document.getElementById('submitScore');
const opponentsGrid = document.getElementById('opponentsGrid');

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize dark mode
    initializeDarkMode();
    
    // Load all data first
    await loadDopingUsage();
    await loadPlayers();
    await loadScores();
    await loadResults();
    await loadOpponents();
    await loadRankings();
    
    // Now render the dynamic fields with all data loaded
    await renderDynamicFields();
    await checkExistingScoreAndDisableSubmit();
    await checkTournamentResultsAndDisableRegenerate();
    
    // Event listeners
    registerPlayerBtn.addEventListener('click', registerPlayer);
    submitScoreBtn.addEventListener('click', submitScore);
    gameSelect.addEventListener('change', async () => {
        await renderDynamicFields();
        await checkExistingScoreAndDisableSubmit();
    });
    
    // Add event listener for regenerate opponents button
    const regenerateOpponentsBtn = document.getElementById('regenerateOpponents');
    if (regenerateOpponentsBtn) {
        regenerateOpponentsBtn.addEventListener('click', regenerateOpponents);
    }

    // Clear results button
    const clearBtn = document.getElementById('clearResults');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            const ok = await confirmModal('Weet je zeker dat je alle resultaten wil wissen?');
            if (!ok) return;
            try {
                const resp = await fetch('/admin/clear_results', { method: 'POST' });
                if (resp.ok) {
                    showMessage('Alle resultaten zijn gewist', 'success');
                    // Reload all data after clearing
                    await loadScores();
                    await loadResults();
                    await loadDopingUsage();
                    await loadOpponents();
                    await loadRankings();
                    // Re-enable regenerate button since all data is cleared
                    await checkTournamentResultsAndDisableRegenerate();
                } else {
                    showMessage('Wissen mislukt', 'error');
                }
            } catch (e) {
                showMessage('Wissen mislukt', 'error');
            }
        });
    }

    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Test winner popup (for debugging)
    window.testWinnerPopup = function() {
        showWinnerPopup('Cynthia', 'Groene Trui', 72, 1, 'groene_trui');
    };
    
    // Test all jersey popups (for debugging)
    window.testAllPopups = function() {
        showWinnerPopup('Alice', 'Gele Trui', 85, 1, 'gele_trui');
        setTimeout(() => showWinnerPopup('Bob', 'Groene Trui', 72, 2, 'groene_trui'), 2000);
        setTimeout(() => showWinnerPopup('Charlie', 'Bolletjestrui', 68, 3, 'bolletjes_trui'), 4000);
        setTimeout(() => showWinnerPopup('Diana', 'Witte Trui', 91, 4, 'witte_trui'), 6000);
    };
    
    // Force check for new winners (for debugging)
    window.forceCheckWinners = async function() {
        await loadRankings();
    };
    
    // Clear popup tracking (for debugging)
    window.clearPopupSession = function() {
        openWinnerPopups.clear();
        console.log('Popup tracking cleared');
    };
    
    // Test score checking (for debugging)
    window.testScoreChecking = function() {
        console.log('Testing score checking...');
        console.log('Players:', players);
        console.log('Scores:', scores);
        console.log('Opponents:', opponents);
        
        const jerseyGames = {
            'gele_trui': ['touwspringen', 'stoelendans', 'petanque', 'kubb', 'rebus', 'wiskunde'],
            'groene_trui': ['touwspringen', 'stoelendans'],
            'bolletjes_trui': ['petanque', 'kubb'],
            'witte_trui': ['rebus', 'wiskunde']
        };
        
        Object.keys(jerseyGames).forEach(jersey => {
            const games = jerseyGames[jersey];
            const allEntered = checkAllScoresEntered(games);
            console.log(`${jersey}: All scores entered = ${allEntered}`);
        });
    };
    
    // Test close button functionality (for debugging)
    window.testCloseButton = function() {
        showWinnerPopup('Test Player', 'Gele Trui', 85, 1);
        console.log('Test popup shown. Try clicking the close buttons or backdrop.');
    };
});

// Load players from the server
async function loadPlayers() {
    try {
        const response = await fetch('/get_players');
        players = await response.json();
        // Don't call renderDynamicFields here - it will be called after all data is loaded
    } catch (error) {
        console.error('Error loading players:', error);
        showMessage('Fout bij het laden van spelers', 'error');
    }
}

// Load scores from the server
async function loadScores() {
    try {
        const response = await fetch('/get_scores');
        scores = await response.json();
        console.log('Loaded scores:', scores);
    } catch (error) {
        console.error('Error loading scores:', error);
        showMessage('Fout bij het laden van scores', 'error');
    }
}

// Load results from the server
async function loadResults() {
    try {
        const response = await fetch('/get_results');
        const resultsData = await response.json();
        window.gameResults = resultsData;
        console.log('Loaded results:', resultsData);
    } catch (error) {
        console.error('Error loading results:', error);
        window.gameResults = {};
    }
}

// Load opponents from the server
async function loadOpponents() {
    try {
        const response = await fetch('/get_opponents');
        opponents = await response.json();
        displayOpponents();
        // Check tournament results and update regenerate button state
        await checkTournamentResultsAndDisableRegenerate();
    } catch (error) {
        console.error('Error loading opponents:', error);
        showMessage('Fout bij het laden van tegenstanders', 'error');
    }
}

// Load rankings from the server
async function loadRankings() {
    try {
        const response = await fetch('/get_rankings');
        const rankings = await response.json();
        
        // Reload scores and results to ensure we have the latest data for popup checking
        await loadScores();
        await loadResults();
        
        // Check for new winners and show popups
        checkForNewWinners(rankings);
        
        displayRankings(rankings);
    } catch (error) {
        console.error('Error loading rankings:', error);
        showMessage('Fout bij het laden van klassementen', 'error');
    }
}

// Load doping usage data
let dopingUsage = {};

// Check for completed rankings and show winner popups
function checkForNewWinners(rankings) {
    const jerseyTypes = {
        'gele_trui': 'Gele Trui',
        'groene_trui': 'Groene Trui', 
        'bolletjes_trui': 'Bolletjestrui',
        'witte_trui': 'Witte Trui'
    };
    
    // Define which games contribute to each jersey
    const jerseyGames = {
        'gele_trui': ['touwspringen', 'stoelendans', 'petanque', 'kubb', 'rebus', 'wiskunde'], // All games
        'groene_trui': ['touwspringen', 'stoelendans'], // Speed games
        'bolletjes_trui': ['petanque', 'kubb'], // Ball games
        'witte_trui': ['rebus', 'wiskunde'] // Brain games
    };
    
    // Check each jersey type independently
    Object.keys(jerseyTypes).forEach(jerseyKey => {
        if (rankings[jerseyKey] && rankings[jerseyKey].length > 0) {
            const currentWinner = rankings[jerseyKey][0];
            
            // Check if all players have entered scores for the games that contribute to this jersey
            const gamesForJersey = jerseyGames[jerseyKey];
            const allScoresEntered = checkAllScoresEntered(gamesForJersey);
            
            // Show popup if:
            // 1. All scores are entered for this ranking
            // 2. No popup for this specific jersey is currently open
            if (allScoresEntered && 
                !openWinnerPopups.has(jerseyKey)) {
                
                const playerName = currentWinner[1].name;
                const jerseyName = jerseyTypes[jerseyKey];
                const points = currentWinner[1].points;
                const playerId = currentWinner[0];
                
                // Show popup for winner
                showWinnerPopup(playerName, jerseyName, points, playerId, jerseyKey);
                
                // Mark this popup as open
                openWinnerPopups.add(jerseyKey);
            }
        }
    });
}

// Check if all players have entered scores for the specified games
function checkAllScoresEntered(games) {
    if (!players || players.length === 0) {
        return false;
    }
    
    // Get results data from the backend
    const results = window.gameResults || {};
    
    for (const game of games) {
        if (game === 'stoelendans') {
            // For stoelendans, check if the ordering is complete (should include all players)
            if (!results[game] || !Array.isArray(results[game]) || results[game].length === 0) {
                return false;
            }
            // Check if all players are in the ordering
            const playerIds = players.map(p => p.id);
            const orderingIds = results[game].map(p => parseInt(p));
            const allPlayersIncluded = playerIds.every(id => orderingIds.includes(id));
            if (!allPlayersIncluded) {
                return false;
            }
        } else if (game === 'petanque' || game === 'kubb') {
            // For tournament games, check if tournament is complete
            if (!results[game] || !Array.isArray(results[game]) || results[game].length === 0) {
                return false;
            }
            // Check if tournament has final standings
            if (!opponents[game] || !Array.isArray(opponents[game])) {
                return false;
            }
            // For now, assume tournament is complete if there are any results
            // This could be enhanced to check actual tournament completion
        } else {
            // For individual games (touwspringen, rebus, wiskunde), check if all players have scores
            if (!results[game] || typeof results[game] !== 'object') {
                return false;
            }
            
            const playerIds = players.map(p => p.id);
            const scoreKeys = Object.keys(results[game]);
            
            // Check if all players have scores (accounting for string vs number keys)
            const allPlayersHaveScores = playerIds.every(id => 
                scoreKeys.includes(id.toString()) || scoreKeys.includes(id)
            );
            
            if (!allPlayersHaveScores) {
                return false;
            }
        }
    }
    
    return true;
}

// Show winner popup
function showWinnerPopup(playerName, jerseyName, points, playerId, jerseyKey) {
    // Get player picture
    const player = players.find(p => p.id === playerId);
    const playerPictureUrl = player && player.picture ? `/player_picture/${player.picture}` : '/static/player_pictures/player_1.png';
    
    // Get jersey image based on jersey name
    let jerseyImageUrl = '/static/witte trui.png'; // default
    if (jerseyName === 'Gele Trui') {
        jerseyImageUrl = '/static/gele trui.png';
    } else if (jerseyName === 'Groene Trui') {
        jerseyImageUrl = '/static/groene trui.png';
    } else if (jerseyName === 'Bolletjestrui') {
        jerseyImageUrl = '/static/bolletjes trui.png';
    } else if (jerseyName === 'Witte Trui') {
        jerseyImageUrl = '/static/witte trui.png';
    }
    
    // Create popup HTML with enhanced design
    const popupHTML = `
        <div id="winnerPopup_${jerseyKey}" class="modal-backdrop winner-popup-backdrop">
            <div class="modal winner-modal">
                <div class="winner-content">
                    <div class="winner-header">
                        <h2>🎉 Nieuwe Winnaar! 🎉</h2>
                        <button id="winnerPopupClose_${jerseyKey}" class="winner-close-btn">&times;</button>
                    </div>
                    
                    <div class="winner-body">
                        <div class="jersey-section">
                            <img src="${jerseyImageUrl}" alt="${jerseyName}" class="jersey-image">
                            <h3 class="jersey-name">${jerseyName}</h3>
                        </div>
                        
                        <div class="winner-section">
                            <div class="winner-picture-container">
                                <img src="${playerPictureUrl}" alt="${playerName}" class="winner-picture">
                            </div>
                            <div class="winner-details">
                                <h3 class="winner-name">${playerName}</h3>
                                <p class="winner-number">#${player ? player.number : '?'}</p>
                                <div class="winner-score">
                                    <span class="score-label">Score:</span>
                                    <span class="score-value">${points} punten</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="winner-footer">
                        <button id="winnerPopupCloseBtn_${jerseyKey}" class="btn btn-primary winner-close-button">
                            Gefeliciteerd! 🎊
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add popup to page
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    
    // Add event listeners to close buttons
    const closePopup = () => {
        const popup = document.getElementById(`winnerPopup_${jerseyKey}`);
        if (popup) {
            popup.classList.add('fade-out');
            setTimeout(() => {
                if (popup && popup.parentNode) {
                    popup.remove();
                }
                // Remove from open popups tracking
                openWinnerPopups.delete(jerseyKey);
            }, 300);
        }
    };
    
    // Wait a moment for DOM to be ready, then add event listeners
    setTimeout(() => {
        const closeBtn = document.getElementById(`winnerPopupClose_${jerseyKey}`);
        const closeBtn2 = document.getElementById(`winnerPopupCloseBtn_${jerseyKey}`);
        const popup = document.getElementById(`winnerPopup_${jerseyKey}`);
        
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePopup();
            });
        }
        
        if (closeBtn2) {
            closeBtn2.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePopup();
            });
        }
        
        if (popup) {
            popup.addEventListener('click', (e) => {
                if (e.target.id === `winnerPopup_${jerseyKey}`) {
                    closePopup();
                }
            });
        }
    }, 100);
    
    // Auto-close after 8 seconds
    setTimeout(() => {
        const popup = document.getElementById(`winnerPopup_${jerseyKey}`);
        if (popup) {
            closePopup();
        }
    }, 8000);
}

// Show brain game popup with results
function showBrainGamePopup(game, correctAnswers, time) {
    const gameName = game === 'wiskunde' ? 'Wiskunde' : 'Rebus';
    const popupId = `brainGamePopup_${Date.now()}`;
    
    // Create popup HTML
    const popupHTML = `
        <div id="${popupId}" class="modal-backdrop brain-game-popup-backdrop">
            <div class="modal brain-game-modal">
                <div class="brain-game-content">
                    <div class="brain-game-header">
                        <h2>🎯 ${gameName} Resultaten</h2>
                        <button id="brainGamePopupClose_${popupId}" class="brain-game-close-btn">&times;</button>
                    </div>
                    
                    <div class="brain-game-body">
                        <div class="result-section">
                            <div class="result-item">
                                <span class="result-label">Correcte antwoorden:</span>
                                <span class="result-value correct-answers">${correctAnswers}/10</span>
                            </div>
                            <div class="result-item">
                                <span class="result-label">Tijd:</span>
                                <span class="result-value time">${time.toFixed(2)} seconden</span>
                            </div>
                        </div>
                        
                        <div class="performance-indicator">
                            ${correctAnswers >= 8 ? '🏆 Uitstekend!' : 
                              correctAnswers >= 6 ? '👍 Goed gedaan!' : 
                              correctAnswers >= 4 ? '😊 Niet slecht!' : 
                              '💪 Blijf oefenen!'}
                        </div>
                    </div>
                    
                    <div class="brain-game-footer">
                        <button id="brainGamePopupCloseBtn_${popupId}" class="btn btn-primary brain-game-close-button">
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add popup to page
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    
    // Add event listeners to close buttons
    const closePopup = () => {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.classList.add('fade-out');
            setTimeout(() => {
                if (popup && popup.parentNode) {
                    popup.remove();
                }
            }, 300);
        }
    };
    
    // Wait a moment for DOM to be ready, then add event listeners
    setTimeout(() => {
        const closeBtn = document.getElementById(`brainGamePopupClose_${popupId}`);
        const closeBtn2 = document.getElementById(`brainGamePopupCloseBtn_${popupId}`);
        const popup = document.getElementById(popupId);
        
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePopup();
            });
        }
        
        if (closeBtn2) {
            closeBtn2.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePopup();
            });
        }
        
        if (popup) {
            popup.addEventListener('click', (e) => {
                if (e.target.id === popupId) {
                    closePopup();
                }
            });
        }
    }, 100);
    
    // Auto-close after 6 seconds
    setTimeout(() => {
        const popup = document.getElementById(popupId);
        if (popup) {
            closePopup();
        }
    }, 6000);
}

async function loadDopingUsage() {
    try {
        const response = await fetch('/get_doping_usage');
        dopingUsage = await response.json();
        console.log('Loaded doping usage data:', dopingUsage);
    } catch (error) {
        console.error('Error loading doping usage:', error);
        dopingUsage = {};
    }
}

// Initialize doping checkboxes based on usage
function initializeDopingCheckboxes(game) {
    if (!dopingUsage) {
        console.log('No doping usage data available');
        return;
    }
    
    console.log('Initializing doping checkboxes for game:', game);
    console.log('Current doping usage:', dopingUsage);
    
    if (game === 'stoelendans') {
        // Handle multiple player checkboxes for Stoelendans
        players.forEach(player => {
            const checkbox = document.getElementById(`${game}Doping_${player.id}`);
            if (checkbox) {
                // Disable checkbox if player has already used doping
                if (player.id in dopingUsage) {
                    console.log(`Disabling doping for player ${player.name} (ID: ${player.id}) - used in: ${dopingUsage[player.id]}`);
                    checkbox.disabled = true;
                    checkbox.checked = false;
                    // Add visual indication
                    const label = checkbox.parentElement;
                    if (label) {
                        label.style.opacity = '0.5';
                        label.title = `Doping al gebruikt voor ${dopingUsage[player.id]}`;
                    }
                } else {
                    checkbox.disabled = false;
                    checkbox.checked = false;
                    const label = checkbox.parentElement;
                    if (label) {
                        label.style.opacity = '1';
                        label.title = '';
                    }
                }
            }
        });
    } else if (game === 'petanque' || game === 'kubb') {
        // Handle tournament doping checkboxes
        const doping1Checkbox = document.getElementById('doping1');
        const doping2Checkbox = document.getElementById('doping2');
        const matchSelect = document.getElementById('matchSelect');
        
        if (doping1Checkbox && doping2Checkbox && matchSelect) {
            // Initially disable both checkboxes until a match is selected
            doping1Checkbox.disabled = true;
            doping2Checkbox.disabled = true;
            doping1Checkbox.checked = false;
            doping2Checkbox.checked = false;
            
            // Add event listener to match select to update doping checkboxes
            matchSelect.addEventListener('change', function() {
                const idx = parseInt(this.value);
                if (idx >= 0) {
                    // Get the current matches from the tournament
                    fetch(`/get_tournament/${game}`).then(response => response.json()).then(tournament => {
                        const currentMatches = tournament.rounds[tournament.current_round];
                        const selectedMatch = currentMatches[idx];
                        
                        if (selectedMatch) {
                            const player1Id = selectedMatch.player1.id;
                            const player2Id = selectedMatch.player2 ? selectedMatch.player2.id : null;
                            const currentRound = tournament.current_round;
                            
                            // Check if this is round 1 (doping only allowed in round 1)
                            const isRound1 = currentRound === 0;
                            
                            // Check doping usage for player 1
                            if (player1Id in dopingUsage) {
                                doping1Checkbox.disabled = true;
                                doping1Checkbox.checked = false;
                                doping1Checkbox.parentElement.style.opacity = '0.5';
                                doping1Checkbox.parentElement.title = `Doping al gebruikt voor ${dopingUsage[player1Id]}`;
                            } else if (!isRound1) {
                                // Disable doping if not in round 1
                                doping1Checkbox.disabled = true;
                                doping1Checkbox.checked = false;
                                doping1Checkbox.parentElement.style.opacity = '0.5';
                                doping1Checkbox.parentElement.title = 'Doping kan alleen in ronde 1 gebruikt worden';
                            } else {
                                doping1Checkbox.disabled = false;
                                doping1Checkbox.checked = false;
                                doping1Checkbox.parentElement.style.opacity = '1';
                                doping1Checkbox.parentElement.title = '';
                            }
                            
                            // Check doping usage for player 2 (if exists)
                            if (player2Id && player2Id in dopingUsage) {
                                doping2Checkbox.disabled = true;
                                doping2Checkbox.checked = false;
                                doping2Checkbox.parentElement.style.opacity = '0.5';
                                doping2Checkbox.parentElement.title = `Doping al gebruikt voor ${dopingUsage[player2Id]}`;
                            } else if (player2Id && !isRound1) {
                                // Disable doping if not in round 1
                                doping2Checkbox.disabled = true;
                                doping2Checkbox.checked = false;
                                doping2Checkbox.parentElement.style.opacity = '0.5';
                                doping2Checkbox.parentElement.title = 'Doping kan alleen in ronde 1 gebruikt worden';
                            } else if (player2Id) {
                                doping2Checkbox.disabled = false;
                                doping2Checkbox.checked = false;
                                doping2Checkbox.parentElement.style.opacity = '1';
                                doping2Checkbox.parentElement.title = '';
                            } else {
                                // This is a bye match, disable player 2 doping
                                doping2Checkbox.disabled = true;
                                doping2Checkbox.checked = false;
                                doping2Checkbox.parentElement.style.opacity = '0.5';
                                doping2Checkbox.parentElement.title = 'BYE wedstrijd';
                            }
                        }
                    });
                }
            });
        }
    } else {
        // Handle single doping checkbox for other games
        const checkbox = document.getElementById(`${game}Doping`);
        if (checkbox) {
            // Check if any player is currently selected and has used doping
            const playerSelect = document.getElementById(game === 'touwspringen' ? 'tsPlayer' : 'bwPlayer');
            if (playerSelect && playerSelect.value) {
                const selectedPlayerId = parseInt(playerSelect.value);
                if (selectedPlayerId && selectedPlayerId in dopingUsage) {
                    console.log(`Disabling doping for selected player (ID: ${selectedPlayerId}) - used in: ${dopingUsage[selectedPlayerId]}`);
                    checkbox.disabled = true;
                    checkbox.checked = false;
                    checkbox.parentElement.style.opacity = '0.5';
                    checkbox.parentElement.title = `Doping al gebruikt voor ${dopingUsage[selectedPlayerId]}`;
                } else {
                    checkbox.disabled = false;
                    checkbox.checked = false;
                    checkbox.parentElement.style.opacity = '1';
                    checkbox.parentElement.title = '';
                }
            } else {
                // No player selected, disable the checkbox
                checkbox.disabled = true;
                checkbox.checked = false;
                checkbox.parentElement.style.opacity = '0.5';
                checkbox.parentElement.title = 'Selecteer eerst een speler';
            }
        }
    }
}

// Register a new player
async function registerPlayer() {
    const name = playerNameInput.value.trim();
    const number = playerNumberInput.value;
    const picture = playerPictureInput.files[0];
    
    if (!name || !number) {
        showMessage('Vul alle velden in', 'error');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('number', number);
        if (picture) {
            formData.append('picture', picture);
        }
        
        const response = await fetch('/register_player', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(result.message, 'success');
            playerNameInput.value = '';
            playerNumberInput.value = '';
            playerPictureInput.value = '';
            await loadPlayers();
            await loadOpponents();
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('Error registering player:', error);
        showMessage('Fout bij het registreren van speler', 'error');
    }
}



// Render dynamic fields based on selected game
async function renderDynamicFields() {
    if (!dynamicFields) return;
    dynamicFields.innerHTML = '';
    const game = gameSelect ? gameSelect.value : '';
    if (!game) return;
    
    // Reload doping usage data
    await loadDopingUsage();

    // Use all players for all games
    let filteredPlayers = players;
    
            // Initialize doping checkboxes after loading doping usage data
        // Note: For tournament games, this will be called after the tournament fields are rendered
        if (game !== 'petanque' && game !== 'kubb') {
            initializeDopingCheckboxes(game);
        }
    
    const playerOptions = filteredPlayers
        .map(p => `<option value="${p.id}">${p.number} - ${p.name}</option>`) 
        .join('');

    if (game === 'touwspringen') {
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Speler</label>
                <select id="tsPlayer"><option value="">Selecteer</option>${playerOptions}</select>
            </div>
            <div class="form-group">
                <label>Aantal sprongen in 30 seconden</label>
                <input id="tsJumps" type="number" min="0" placeholder="0">
            </div>
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="tsDoping"> Doping gebruiken (verdubbelt punten)
                </label>
                <small class="doping-warning">Let op: Doping kan maar één keer gebruikt worden over alle spellen!</small>
            </div>
        `;
        // Initialize doping checkbox
        initializeDopingCheckboxes('ts');
        
        // Add event listener for player selection
        const playerSelect = document.getElementById('tsPlayer');
        const dopingCheckbox = document.getElementById('tsDoping');
        if (playerSelect && dopingCheckbox) {
            playerSelect.addEventListener('change', async function() {
                const selectedPlayerId = parseInt(this.value);
                if (selectedPlayerId && selectedPlayerId in dopingUsage) {
                    dopingCheckbox.disabled = true;
                    dopingCheckbox.checked = false;
                    dopingCheckbox.parentElement.style.opacity = '0.5';
                    dopingCheckbox.parentElement.title = `Doping al gebruikt voor ${dopingUsage[selectedPlayerId]}`;
                } else {
                    dopingCheckbox.disabled = false;
                    dopingCheckbox.parentElement.style.opacity = '1';
                    dopingCheckbox.parentElement.title = '';
                }
                
                // Check for existing score and disable submit button if needed
                await checkExistingScoreAndDisableSubmit();
            });
        }
    } else if (game === 'stoelendans') {
        // Check if device is mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        
        if (isMobile) {
            // Mobile interface with dropdowns
            const playerOptions = players
                .map(p => `<option value="${p.id}">${p.number} - ${p.name}</option>`) 
                .join('');
            
            const positionSelects = players.map((_, index) => `
                <div class="form-group">
                    <label>Positie ${index + 1}:</label>
                    <select class="position-select" data-position="${index}">
                        <option value="">Selecteer speler</option>
                        ${playerOptions}
                    </select>
                </div>
            `).join('');
            
            dynamicFields.innerHTML = `
                <div class="form-group">
                    <label>Selecteer de volgorde van spelers (1 = winnaar)</label>
                    <div id="mobileStoelendans">
                        ${positionSelects}
                    </div>
                    <small style="color:#6c757d">Selecteer voor elke positie de juiste speler.</small>
                </div>
                <div class="form-group">
                    <label>Doping voor spelers (verdubbelt punten):</label>
                    <small class="doping-warning">Let op: Doping kan maar één keer gebruikt worden over alle spellen per speler!</small>
                    <div id="sdDopingPlayers" class="doping-players-list">
                        ${players.map(player => `
                            <label class="checkbox-label">
                                <input type="checkbox" id="sdDoping_${player.id}" value="${player.id}"> 
                                ${player.name} (#${player.number})
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
            
            // Initialize mobile stoelendans functionality
            initMobileStoelendans();
        } else {
            // Desktop interface with drag-and-drop
            const items = players
                .map(p => `<li class="sd-item" draggable="true" data-id="${p.id}">${p.name} (#${p.number})</li>`) 
                .join('');
            const playerOptions = players
                .map(p => `<option value="${p.id}">${p.number} - ${p.name}</option>`) 
                .join('');
            dynamicFields.innerHTML = `
                <div class="form-group">
                    <label>Sleep om te sorteren (bovenaan = winnaar)</label>
                    <ul id="sdList" class="dnd-list">${items}</ul>
                    <small style="color:#6c757d">Sleep spelers in de juiste volgorde van 1 → laatste.</small>
                </div>
                <div class="form-group">
                    <label>Doping voor spelers (verdubbelt punten):</label>
                    <small class="doping-warning">Let op: Doping kan maar één keer gebruikt worden over alle spellen per speler!</small>
                    <div id="sdDopingPlayers" class="doping-players-list">
                        ${players.map(player => `
                            <label class="checkbox-label">
                                <input type="checkbox" id="sdDoping_${player.id}" value="${player.id}"> 
                                ${player.name} (#${player.number})
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
            initDndList();
        }
        
        // Initialize doping checkboxes with usage status
        initializeDopingCheckboxes('stoelendans');
    } else if (game === 'petanque' || game === 'kubb') {
        // Check if tournament exists, if not show tournament generation
        checkTournamentStatus(game).then(hasTournament => {
            if (hasTournament) {
                renderTournamentFields(game);
            } else {
                dynamicFields.innerHTML = `
                    <div class="form-group">
                        <p>Geen toernooi gevonden voor ${game === 'petanque' ? 'Petanque' : 'Kubb'}.</p>
                        <button id="generateTournament" class="btn btn-primary">Genereer Toernooi</button>
                    </div>
                `;
                
                document.getElementById('generateTournament').addEventListener('click', () => {
                    generateTournament(game);
                });
            }
        });
    } else if (game === 'wiskunde') {
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Speler</label>
                <select id="bwPlayer"><option value="">Selecteer</option>${playerOptions}</select>
            </div>
            
            <div class="questions-section">
                <h4>Wiskunde Vragen</h4>
                
                <div class="question-item">
                    <h5>Oefening 1. Algebra — Eenvoudig stelsel</h5>
                    <p>Los het volgende stelsel van vergelijkingen op:</p>
                    <p>(1) 2x + y = 11</p>
                    <p>(2) x − y = 1</p>
                    <p>Bepaal de waarden van x en y die beide vergelijkingen tegelijkertijd vervullen.</p>
                    <div class="form-group">
                        <label>Waarde van x:</label>
                        <input id="ans1_x" type="text" placeholder="x">
                    </div>
                    <div class="form-group">
                        <label>Waarde van y:</label>
                        <input id="ans1_y" type="text" placeholder="y">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Oefening 2. Analyse — Maximale winst</h5>
                    <p>Een bedrijf heeft een winstfunctie W(x) = −2x² + 80x − 300, waarbij x het aantal geproduceerde producten voorstelt.</p>
                    <p>Bepaal bij welk productieniveau x de winst maximaal is en bereken ook de waarde van deze maximale winst.</p>
                    <div class="form-group">
                        <label>Productieniveau x:</label>
                        <input id="ans2_x" type="text" placeholder="x">
                    </div>
                    <div class="form-group">
                        <label>Maximale winst W(x):</label>
                        <input id="ans2_wx" type="text" placeholder="W(x)">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Oefening 3. Analyse — Bepaalde integraal</h5>
                    <p>Bereken de waarde van de volgende integraal:</p>
                    <p>∫ van 1 tot 3 (x² + 1) dx</p>
                    <p>Werk de primitieve functie uit en bereken vervolgens de waarde met de gegeven grenzen en rond af naar beneden naar het dichtste gehele getal.</p>
                    <div class="form-group">
                        <label>Antwoord 3:</label>
                        <input id="ans3" type="text" placeholder="antwoord 3">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Oefening 4. Kansboom — 2 trekken, dezelfde kleur</h5>
                    <p>Een urn bevat 4 groene knikkers, 3 blauwe knikkers en 2 gele knikkers (totaal 9 knikkers).</p>
                    <p>Je trekt twee knikkers zonder terugleggen.</p>
                    <p>Bereken de kans dat beide knikkers dezelfde kleur hebben. Antwoord met een breuk.</p>    
                    <div class="form-group">
                        <label>Antwoord 4:</label>
                        <input id="ans4" type="text" placeholder="antwoord 4">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Oefening 5. Kansboom — 2 trekken, minstens één gele</h5>
                    <p>Een urn bevat 3 groene knikkers, 3 blauwe knikkers en 3 gele knikkers (totaal 9 knikkers).</p>
                    <p>Je trekt twee knikkers zonder terugleggen.</p>
                    <p>Bereken de kans dat er minstens één gele knikker wordt getrokken. Antwoord met een breuk.</p>
                    <div class="form-group">
                        <label>Antwoord 5:</label>
                        <input id="ans5" type="text" placeholder="antwoord 5">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Oefening 6. Integraal — Onbepaald</h5>
                    <p>Bepaal de onbepaalde integraal van de functie. Gebruik ^ om een macht aan te geven:</p>
                    <p>∫ (6x² − 4x + 1) dx</p>
                    <div class="form-group">
                        <label>Antwoord 6:</label>
                        <input id="ans6" type="text" placeholder="antwoord 6">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Oefening 7. Deling — Gewone deling</h5>
                    <p>Bereken het resultaat van de volgende deling. Antwoord met een geheel getal  :</p>
                    <p>672 ÷ 16</p>
                    <div class="form-group">
                        <label>Antwoord 7:</label>
                        <input id="ans7" type="text" placeholder="antwoord 7">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Oefening 8. Afgeleide — Polynoom</h5>
                    <p>Bepaal de afgeleide f'(x) voor de volgende functie. Gebruik ^ om een macht aan te geven:</p>
                    <p>f(x) = x³ − 5x² + 4x − 7</p>
                    <div class="form-group">
                        <label>Antwoord 8:</label>
                        <input id="ans8" type="text" placeholder="antwoord 8">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Oefening 9. Afgeleide — Wortelfunctie</h5>
                    <p>Bepaal de afgeleide g'(x) voor de volgende functie. Gebruik ^ om een macht aan te geven:</p>
                    <p>g(x) = √(x + 1)</p>
                    <p>Opmerking: het domein is x > −1.</p>
                    <div class="form-group">
                        <label>Antwoord 9:</label>
                        <input id="ans9" type="text" placeholder="antwoord 9">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Oefening 10. Rekenen — Vermenigvuldigen</h5>
                    <p>Bereken het product:</p>
                    <p>387 × 24</p>
                    <p>Werk dit eventueel uit via distributiviteit.</p>
                    <div class="form-group">
                        <label>Antwoord 10:</label>
                        <input id="ans10" type="text" placeholder="antwoord 10">
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="bwDoping"> Doping gebruiken (verdubbelt punten)
                </label>
                <small class="doping-warning">Let op: Doping kan maar één keer gebruikt worden over alle spellen!</small>
            </div>
        `;
        
        // Initialize doping checkbox
        initializeDopingCheckboxes('bw');
        
        // Add event listener for player selection to start countdown and check doping
        const playerSelect = document.getElementById('bwPlayer');
        const dopingCheckbox = document.getElementById('bwDoping');
        playerSelect.addEventListener('change', async function() {
            if (this.value) {
                startGameCountdown('wiskunde');
                
                // Check doping usage for selected player
                const selectedPlayerId = parseInt(this.value);
                if (selectedPlayerId && selectedPlayerId in dopingUsage) {
                    dopingCheckbox.disabled = true;
                    dopingCheckbox.checked = false;
                    dopingCheckbox.parentElement.style.opacity = '0.5';
                    dopingCheckbox.parentElement.title = `Doping al gebruikt voor ${dopingUsage[selectedPlayerId]}`;
                } else {
                    dopingCheckbox.disabled = false;
                    dopingCheckbox.parentElement.style.opacity = '1';
                    dopingCheckbox.parentElement.title = '';
                }
                
                // Check for existing score and disable submit button if needed
                await checkExistingScoreAndDisableSubmit();
            }
        });
    } else if (game === 'rebus') {
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Speler</label>
                <select id="bwPlayer"><option value="">Selecteer</option>${playerOptions}</select>
            </div>
            
            <div class="questions-section">
                <h4>Rebus Vragen</h4>
                
                <div class="question-item">
                    <h5>Vraag 1</h5>
                    <img src="/static/rebus_images/vraag 1.png" alt="Rebus 1" class="rebus-image">
                    <div class="form-group">
                        <label>Antwoord 1:</label>
                        <input id="ans1" type="text" placeholder="antwoord 1">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Vraag 2</h5>
                    <img src="/static/rebus_images/vraag 2.png" alt="Rebus 2" class="rebus-image">
                    <div class="form-group">
                        <label>Antwoord 2:</label>
                        <input id="ans2" type="text" placeholder="antwoord 2">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Vraag 3</h5>
                    <img src="/static/rebus_images/vraag 3.png" alt="Rebus 3" class="rebus-image">
                    <div class="form-group">
                        <label>Antwoord 3:</label>
                        <input id="ans3" type="text" placeholder="antwoord 3">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Vraag 4</h5>
                    <img src="/static/rebus_images/vraag 4.png" alt="Rebus 4" class="rebus-image">
                    <div class="form-group">
                        <label>Antwoord 4:</label>
                        <input id="ans4" type="text" placeholder="antwoord 4">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Vraag 5</h5>
                    <img src="/static/rebus_images/vraag 5.png" alt="Rebus 5" class="rebus-image">
                    <div class="form-group">
                        <label>Antwoord 5:</label>
                        <input id="ans5" type="text" placeholder="antwoord 5">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Vraag 6</h5>
                    <img src="/static/rebus_images/vraag 6.png" alt="Rebus 6" class="rebus-image">
                    <div class="form-group">
                        <label>Antwoord 6:</label>
                        <input id="ans6" type="text" placeholder="antwoord 6">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Vraag 7</h5>
                    <img src="/static/rebus_images/vraag 7.png" alt="Rebus 7" class="rebus-image">
                    <div class="form-group">
                        <label>Antwoord 7:</label>
                        <input id="ans7" type="text" placeholder="antwoord 7">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Vraag 8</h5>
                    <img src="/static/rebus_images/vraag 8.png" alt="Rebus 8" class="rebus-image">
                    <div class="form-group">
                        <label>Antwoord 8:</label>
                        <input id="ans8" type="text" placeholder="antwoord 8">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Vraag 9</h5>
                    <img src="/static/rebus_images/vraag 9.png" alt="Rebus 9" class="rebus-image">
                    <div class="form-group">
                        <label>Antwoord 9:</label>
                        <input id="ans9" type="text" placeholder="antwoord 9">
                    </div>
                </div>
                
                <div class="question-item">
                    <h5>Vraag 10</h5>
                    <img src="/static/rebus_images/vraag 10.png" alt="Rebus 10" class="rebus-image">
                    <div class="form-group">
                        <label>Snoepjesbox:</label>
                        <input id="ans10a" type="text" placeholder="Henri, Maya, Ona, of Esmee">
                    </div>
                    <div class="form-group">
                        <label>Animator:</label>
                        <input id="ans10b" type="text" placeholder="Henri, Maya, Ona, of Esmee">
                    </div>
                    <div class="form-group">
                        <label>Fotograaf:</label>
                        <input id="ans10c" type="text" placeholder="Henri, Maya, Ona, of Esmee">
                    </div>
                    <div class="form-group">
                        <label>Hartendief:</label>
                        <input id="ans10d" type="text" placeholder="Henri, Maya, Ona, of Esmee">
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="bwDoping"> Doping gebruiken (verdubbelt punten)
                </label>
                <small class="doping-warning">Let op: Doping kan maar één keer gebruikt worden over alle spellen!</small>
            </div>
        `;
        
        // Initialize doping checkbox
        initializeDopingCheckboxes('bw');
        
        // Add event listener for player selection to start countdown and check doping
        const playerSelect = document.getElementById('bwPlayer');
        const dopingCheckbox = document.getElementById('bwDoping');
        playerSelect.addEventListener('change', async function() {
            if (this.value) {
                startGameCountdown('rebus');
                
                // Check doping usage for selected player
                const selectedPlayerId = parseInt(this.value);
                if (selectedPlayerId && selectedPlayerId in dopingUsage) {
                    dopingCheckbox.disabled = true;
                    dopingCheckbox.checked = false;
                    dopingCheckbox.parentElement.style.opacity = '0.5';
                    dopingCheckbox.parentElement.title = `Doping al gebruikt voor ${dopingUsage[selectedPlayerId]}`;
                } else {
                    dopingCheckbox.disabled = false;
                    dopingCheckbox.parentElement.style.opacity = '1';
                    dopingCheckbox.parentElement.title = '';
                }
                
                // Check for existing score and disable submit button if needed
                await checkExistingScoreAndDisableSubmit();
            }
        });
    }
}

// (Deprecated) updatePlayerSelect removed; dynamic fields render options instead

// Display opponents
async function displayOpponents() {
    opponentsGrid.innerHTML = '';
    
    // Add game selector
    const gameSelector = document.createElement('div');
    gameSelector.className = 'game-selector';
    gameSelector.innerHTML = `
        <label for="opponentGameSelect">Selecteer spel:</label>
        <select id="opponentGameSelect">
            <option value="">Kies een spel</option>
            <option value="petanque">Petanque</option>
            <option value="kubb">Kubb</option>
        </select>
    `;
    opponentsGrid.appendChild(gameSelector);
    
    // Add instruction text
    const instructionText = document.createElement('div');
    instructionText.className = 'instruction-text';
    instructionText.innerHTML = `
        <p><strong>Instructies:</strong></p>
        <ul>
            <li>Selecteer "Petanque" of "Kubb" uit de dropdown om de toernooien te bekijken</li>
            <li>Klik op "Nieuwe Tegenstanders Genereren" om nieuwe toernooien te maken</li>
            <li>Voor andere spellen worden automatisch tegenstanders gegenereerd</li>
        </ul>
    `;
    opponentsGrid.appendChild(instructionText);
    
    const gameSelect = document.getElementById('opponentGameSelect');
    gameSelect.addEventListener('change', async (e) => {
        const selectedGame = e.target.value;
        if (selectedGame) {
            await displayTournamentMatches(selectedGame);
        } else {
            // Keep the game selector and instruction text
            opponentsGrid.innerHTML = '';
            opponentsGrid.appendChild(gameSelector);
            opponentsGrid.appendChild(instructionText);
        }
    });
}

async function displayTournamentMatches(game) {
    try {
        const response = await fetch(`/get_tournament_matches/${game}`);
        if (!response.ok) {
            opponentsGrid.innerHTML = `
                <div class="game-selector">
                    <label for="opponentGameSelect">Selecteer spel:</label>
                    <select id="opponentGameSelect">
                        <option value="">Kies een spel</option>
                        <option value="petanque">Petanque</option>
                        <option value="kubb">Kubb</option>
                    </select>
                </div>
                <p class="loading">Geen toernooi gevonden voor ${game === 'petanque' ? 'Petanque' : 'Kubb'}. Genereer eerst een toernooi.</p>
            `;
            return;
        }
        
        const data = await response.json();
        const matches = data.matches;
        const currentRound = data.current_round;
        const totalRounds = data.total_rounds;
        
        // Clear existing content except game selector
        const gameSelector = opponentsGrid.querySelector('.game-selector');
        opponentsGrid.innerHTML = '';
        opponentsGrid.appendChild(gameSelector);
        
        // Add tournament info
        const tournamentInfo = document.createElement('div');
        tournamentInfo.className = 'tournament-info';
        tournamentInfo.innerHTML = `
            <h3>${getGameDisplayName(game)} Toernooi</h3>
            <p><strong>Huidige ronde:</strong> ${currentRound} van ${totalRounds}</p>
        `;
        opponentsGrid.appendChild(tournamentInfo);
        
        // Group matches by round
        const matchesByRound = {};
        matches.forEach(match => {
            if (!matchesByRound[match.round]) {
                matchesByRound[match.round] = [];
            }
            matchesByRound[match.round].push(match);
        });
        
        // Display matches by round
        Object.keys(matchesByRound).sort((a, b) => parseInt(a) - parseInt(b)).forEach(round => {
            const roundMatches = matchesByRound[round];
            const roundSection = document.createElement('div');
            roundSection.className = 'tournament-round';
            roundSection.innerHTML = `<h4>Ronde ${round}</h4>`;
            
            roundMatches.forEach((match, index) => {
                const matchCard = document.createElement('div');
                matchCard.className = 'tournament-match';
                
                const p1 = players.find(p => p.id === match.player1.id);
                const p2 = match.player2 ? players.find(p => p.id === match.player2.id) : null;
                const p1Name = p1 ? `${p1.name} (#${p1.number})` : 'Onbekend';
                const p2Name = p2 ? `${p2.name} (#${p2.number})` : (match.player2 ? 'Onbekend' : 'BYE');
                
                let status = '';
                if (match.completed) {
                    const winner = players.find(p => p.id === match.winner);
                    const winnerName = winner ? winner.name : 'Onbekend';
                    status = `<span class="match-result">Winnaar: ${winnerName}</span>`;
                } else {
                    status = '<span class="match-status pending">Nog niet gespeeld</span>';
                }
                
                const dopingInfo = [];
                if (match.doping1) dopingInfo.push(`${p1Name} (doping)`);
                if (match.doping2) dopingInfo.push(`${p2Name} (doping)`);
                const dopingText = dopingInfo.length > 0 ? `<small class="doping-info">Doping: ${dopingInfo.join(', ')}</small>` : '';
                
                matchCard.innerHTML = `
                    <div class="match-players">
                        <p><strong>${p1Name}</strong> vs <strong>${p2Name}</strong></p>
                        ${dopingText}
                    </div>
                    ${status}
                `;
                
                roundSection.appendChild(matchCard);
            });
            
            opponentsGrid.appendChild(roundSection);
        });
        
    } catch (error) {
        console.error('Error displaying tournament matches:', error);
        opponentsGrid.innerHTML = '<p class="loading">Fout bij laden toernooi wedstrijden</p>';
    }
}

// Display rankings
function displayRankings(rankings) {
    // Gele Trui (Overall)
    const geleTruiRanking = document.getElementById('geleTruiRanking');
    geleTruiRanking.innerHTML = '';
    
    if (rankings.gele_trui && rankings.gele_trui.length > 0) {
        rankings.gele_trui.forEach((player, index) => {
            const rankingItem = document.createElement('div');
            rankingItem.className = 'ranking-item';
            const playerObj = players.find(p => p.id === player[0]);
            const pictureUrl = playerObj && playerObj.picture ? `/player_picture/${playerObj.picture}` : '/static/witte%20trui.png';
            rankingItem.innerHTML = `
                <span class="ranking-position">${index + 1}</span>
                <div class="ranking-player-info">
                    <img src="${pictureUrl}" alt="${player[1].name}" class="ranking-player-picture">
                    <span class="ranking-name">${player[1].name} (#${player[1].number})</span>
                </div>
                <span class="ranking-points">${player[1].points} pts</span>
            `;
            geleTruiRanking.appendChild(rankingItem);
        });
    } else {
        geleTruiRanking.innerHTML = '<p class="loading">Nog geen scores ingevoerd</p>';
    }
    
    // Groene Trui (Speed Games)
    const groeneTruiRanking = document.getElementById('groeneTruiRanking');
    groeneTruiRanking.innerHTML = '';
    
    if (rankings.groene_trui && rankings.groene_trui.length > 0) {
        rankings.groene_trui.forEach((player, index) => {
            const rankingItem = document.createElement('div');
            rankingItem.className = 'ranking-item';
            const playerObj = players.find(p => p.id === player[0]);
            const pictureUrl = playerObj && playerObj.picture ? `/player_picture/${playerObj.picture}` : '/static/groene%20trui.png';
            rankingItem.innerHTML = `
                <span class="ranking-position">${index + 1}</span>
                <div class="ranking-player-info">
                    <img src="${pictureUrl}" alt="${player[1].name}" class="ranking-player-picture">
                    <span class="ranking-name">${player[1].name} (#${player[1].number})</span>
                </div>
                <span class="ranking-points">${player[1].points} pts</span>
            `;
            groeneTruiRanking.appendChild(rankingItem);
        });
    } else {
        groeneTruiRanking.innerHTML = '<p class="loading">Nog geen scores ingevoerd</p>';
    }
    
    // Bolletjestrui (Ball Games)
    const bolletjesTruiRanking = document.getElementById('bolletjesTruiRanking');
    bolletjesTruiRanking.innerHTML = '';
    
    if (rankings.bolletjes_trui && rankings.bolletjes_trui.length > 0) {
        rankings.bolletjes_trui.forEach((player, index) => {
            const rankingItem = document.createElement('div');
            rankingItem.className = 'ranking-item';
            const playerObj = players.find(p => p.id === player[0]);
            const pictureUrl = playerObj && playerObj.picture ? `/player_picture/${playerObj.picture}` : '/static/bolletjes%20trui.png';
            rankingItem.innerHTML = `
                <span class="ranking-position">${index + 1}</span>
                <div class="ranking-player-info">
                    <img src="${pictureUrl}" alt="${player[1].name}" class="ranking-player-picture">
                    <span class="ranking-name">${player[1].name} (#${player[1].number})</span>
                </div>
                <span class="ranking-points">${player[1].points} pts</span>
            `;
            bolletjesTruiRanking.appendChild(rankingItem);
        });
    } else {
        bolletjesTruiRanking.innerHTML = '<p class="loading">Nog geen scores ingevoerd</p>';
    }
    
    // Witte Trui (Brain Games)
    const witteTruiRanking = document.getElementById('witteTruiRanking');
    witteTruiRanking.innerHTML = '';
    
    if (rankings.witte_trui && rankings.witte_trui.length > 0) {
        rankings.witte_trui.forEach((player, index) => {
            const rankingItem = document.createElement('div');
            rankingItem.className = 'ranking-item';
            const playerObj = players.find(p => p.id === player[0]);
            const pictureUrl = playerObj && playerObj.picture ? `/player_picture/${playerObj.picture}` : '/static/witte%20trui.png';
            rankingItem.innerHTML = `
                <span class="ranking-position">${index + 1}</span>
                <div class="ranking-player-info">
                    <img src="${pictureUrl}" alt="${player[1].name}" class="ranking-player-picture">
                    <span class="ranking-name">${player[1].name} (#${player[1].number})</span>
                </div>
                <span class="ranking-points">${player[1].points} pts</span>
            `;
            witteTruiRanking.appendChild(rankingItem);
        });
    } else {
        witteTruiRanking.innerHTML = '<p class="loading">Nog geen scores ingevoerd</p>';
    }
}



// Get display name for games
function getGameDisplayName(game) {
    const gameNames = {
        'touwspringen': 'Touwspringen',
        'stoelendans': 'Stoelendans',
        'petanque': 'Petanque',
        'kubb': 'Kubb',
        'rebus': 'Rebus',
        'wiskunde': 'Wiskunde'
    };
    return gameNames[game] || game;
}

// Show message to user
function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    // Insert at the top of the main content
    const main = document.querySelector('.main');
    if (main) {
        main.insertBefore(messageDiv, main.firstChild);
    } else {
        // Fallback: append to body
        document.body.appendChild(messageDiv);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Initialize drag-and-drop for Stoelendans list
function initDndList() {
    const list = document.getElementById('sdList');
    if (!list) return;
    let draggingEl = null;
    list.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.sd-item');
        if (!target) return;
        draggingEl = target;
        target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    list.addEventListener('dragend', (e) => {
        const target = e.target.closest('.sd-item');
        if (target) target.classList.remove('dragging');
        draggingEl = null;
    });
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const after = getDragAfterElement(list, e.clientY);
        if (!after) {
            list.appendChild(draggingEl);
        } else {
            list.insertBefore(draggingEl, after);
        }
    });
    function getDragAfterElement(container, y) {
        const els = [...container.querySelectorAll('.sd-item:not(.dragging)')];
        return els.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

// Initialize mobile interface for Stoelendans
function initMobileStoelendans() {
    const selects = document.querySelectorAll('.position-select');
    const usedPlayers = new Set();
    
    selects.forEach(select => {
        select.addEventListener('change', function() {
            const selectedValue = this.value;
            const previousValue = this.dataset.previousValue;
            
            // Remove previous selection from used players
            if (previousValue) {
                usedPlayers.delete(previousValue);
            }
            
            // Add new selection to used players
            if (selectedValue) {
                usedPlayers.add(selectedValue);
            }
            
            // Update dataset
            this.dataset.previousValue = selectedValue;
            
            // Update other selects to disable used players
            selects.forEach(otherSelect => {
                if (otherSelect !== this) {
                    Array.from(otherSelect.options).forEach(option => {
                        if (option.value && option.value !== otherSelect.value) {
                            option.disabled = usedPlayers.has(option.value);
                        }
                    });
                }
            });
        });
    });
}

// Simple confirm modal that returns a Promise<boolean>
function confirmModal(message) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <h4>Bevestigen</h4>
            <p>${message}</p>
            <div class="modal-actions">
                <button id="modalNo" class="btn">Nee</button>
                <button id="modalYes" class="btn btn-primary">Ja</button>
            </div>
        `;
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        const cleanup = () => backdrop.remove();
        modal.querySelector('#modalYes').addEventListener('click', () => { cleanup(); resolve(true); });
        modal.querySelector('#modalNo').addEventListener('click', () => { cleanup(); resolve(false); });
    });
}

// Confirmation popup for score submission
function showConfirmationPopup(message) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <h4>Score Invoeren</h4>
            <p>${message}</p>
            <div class="modal-actions">
                <button id="confirmNo" class="btn">Annuleren</button>
                <button id="confirmYes" class="btn btn-primary">Bevestigen</button>
            </div>
        `;
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        const cleanup = () => backdrop.remove();
        modal.querySelector('#confirmYes').addEventListener('click', () => { cleanup(); resolve(true); });
        modal.querySelector('#confirmNo').addEventListener('click', () => { cleanup(); resolve(false); });
    });
}

// Regenerate opponents
async function regenerateOpponents() {
    try {
        // For Kubb & Petanque, we need to regenerate tournaments instead of opponents
        const regeneratePromises = [];
        
        // Always try to regenerate tournaments for Kubb & Petanque
        regeneratePromises.push(
            fetch('/generate_tournament/kubb', { method: 'POST' })
                .then(response => response.ok ? 'Kubb' : null)
        );
        
        regeneratePromises.push(
            fetch('/generate_tournament/petanque', { method: 'POST' })
                .then(response => response.ok ? 'Petanque' : null)
        );
        
        // Also regenerate old-style opponents for other games
        regeneratePromises.push(
            fetch('/regenerate_opponents', { method: 'POST' })
                .then(response => response.ok ? 'other' : null)
        );
        
        const results = await Promise.all(regeneratePromises);
        const successful = results.filter(result => result !== null).filter(result => result !== 'other');
        
        if (successful.length > 0) {
            await loadOpponents();
            const regeneratedItems = successful.join(', ');
            showMessage(`Nieuwe ${regeneratedItems} succesvol gegenereerd! Selecteer een spel uit de dropdown om de toernooien te bekijken.`, 'success');
        } else {
            showMessage('Fout bij het genereren van nieuwe tegenstanders', 'error');
        }
    } catch (error) {
        console.error('Error regenerating opponents:', error);
        showMessage('Fout bij het genereren van nieuwe tegenstanders', 'error');
    }
}

// Tournament management functions
async function checkTournamentStatus(game) {
    try {
        const response = await fetch(`/get_tournament/${game}`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function generateTournament(game) {
    try {
        const response = await fetch(`/generate_tournament/${game}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showMessage(`Toernooi voor ${game} succesvol gegenereerd!`, 'success');
            renderDynamicFields(); // Refresh the form
        } else {
            showMessage('Fout bij genereren toernooi', 'error');
        }
    } catch (error) {
        console.error('Error generating tournament:', error);
        showMessage('Fout bij genereren toernooi', 'error');
    }
}

async function renderTournamentFields(game) {
    try {
        const response = await fetch(`/get_tournament/${game}`);
        if (!response.ok) {
            dynamicFields.innerHTML = '<p class="loading">Fout bij laden toernooi</p>';
            return;
        }
        
        const tournament = await response.json();
        const currentRound = tournament.current_round;
        const currentMatches = tournament.rounds[currentRound] || [];
        
        if (currentMatches.length === 0) {
            dynamicFields.innerHTML = '<p>Toernooi is voltooid!</p>';
            return;
        }
        
        const matchOptions = currentMatches.map((match, idx) => {
            const p1 = players.find(p => p.id === match.player1.id);
            const p2 = match.player2 ? players.find(p => p.id === match.player2.id) : null;
            const p1Name = p1 ? `${p1.name} (#${p1.number})` : 'Onbekend';
            const p2Name = p2 ? `${p2.name} (#${p2.number})` : (match.player2 ? 'Onbekend' : 'BYE');
            return `<option value="${idx}">Wedstrijd ${idx + 1}: ${p1Name} vs ${p2Name}</option>`;
        }).join('');
        
        const dopingWarning = currentRound === 0 ? 
            '<small class="doping-warning">Let op: Doping kan maar één keer gebruikt worden over alle spellen!</small>' :
            '<small class="doping-warning" style="color: #e74c3c;">Doping kan alleen in ronde 1 gebruikt worden!</small>';
            
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Wedstrijd (Ronde ${currentRound + 1})</label>
                <select id="matchSelect">${matchOptions}</select>
            </div>
            <div class="form-group">
                <label>Doping Speler 1</label>
                <label class="checkbox-label">
                    <input type="checkbox" id="doping1"> Doping gebruiken (verdubbelt punten)
                </label>
                ${dopingWarning}
            </div>
            <div class="form-group">
                <label>Doping Speler 2</label>
                <label class="checkbox-label">
                    <input type="checkbox" id="doping2"> Doping gebruiken (verdubbelt punten)
                </label>
                ${dopingWarning}
            </div>
            <div class="form-group">
                <label>Winnaar</label>
                <select id="matchWinner"></select>
            </div>
        `;
        
        const matchSelect = document.getElementById('matchSelect');
        const matchWinner = document.getElementById('matchWinner');
        
        const fillWinnerOptions = () => {
            const idx = parseInt(matchSelect.value);
            const match = currentMatches[idx];
            if (!match) return;
            
            const p1 = players.find(p => p.id === match.player1.id);
            const p2 = match.player2 ? players.find(p => p.id === match.player2.id) : null;
            
            let options = `<option value="">Selecteer winnaar</option>
                <option value="${match.player1.id}">${p1 ? p1.name : 'Onbekend'} (#${p1 ? p1.number : '?'})</option>`;
            
            if (match.player2) {
                options += `<option value="${match.player2.id}">${p2 ? p2.name : 'Onbekend'} (#${p2 ? p2.number : '?'})</option>`;
            }
            
            matchWinner.innerHTML = options;
        };
        
        matchSelect.addEventListener('change', fillWinnerOptions);
        fillWinnerOptions();
        
        // Initialize doping checkboxes for tournament games
        initializeDopingCheckboxes(game);
        
    } catch (error) {
        console.error('Error rendering tournament fields:', error);
        dynamicFields.innerHTML = '<p class="loading">Fout bij laden toernooi</p>';
    }
}

// Submit tournament match results
async function submitTournamentMatch(game) {
    const matchSelect = document.getElementById('matchSelect');
    const doping1 = document.getElementById('doping1');
    const doping2 = document.getElementById('doping2');
    const matchWinner = document.getElementById('matchWinner');
    
    if (!matchSelect.value || !matchWinner.value) {
        showMessage('Vul alle velden in', 'error');
        return;
    }
    
    try {
        const response = await fetch('/get_tournament/' + game);
        const tournament = await response.json();
        const currentMatches = tournament.rounds[tournament.current_round];
        const selectedMatch = currentMatches[parseInt(matchSelect.value)];
        
        const winner_id = parseInt(matchWinner.value);
        let loser_id;
        if (selectedMatch.player2) {
            loser_id = winner_id === selectedMatch.player1.id ? selectedMatch.player2.id : selectedMatch.player1.id;
        } else {
            // This is a bye match, no loser
            loser_id = null;
        }
        
        const payload = {
            game: game,
            match_id: selectedMatch.match_id,
            winner_id: winner_id,
            loser_id: loser_id || 0, // Use 0 if loser_id is null (bye match)
            doping1: doping1.checked,
            doping2: doping2.checked
        };
        
        const submitResponse = await fetch('/submit_tournament_match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (submitResponse.ok) {
            showMessage('Wedstrijd resultaat succesvol opgeslagen', 'success');
            // Clear form
            doping1.checked = false;
            doping2.checked = false;
            matchWinner.value = '';
            // Refresh rankings
            await loadRankings();
            // Reload doping usage and re-initialize checkboxes
            await loadDopingUsage();
            initializeDopingCheckboxes(game);
            // Refresh tournament fields
            renderTournamentFields(game);
            // Refresh opponents view
            await loadOpponents();
            // Check for existing scores and update submit button state
            await checkExistingScoreAndDisableSubmit();
            // Check tournament results and update regenerate button state
            await checkTournamentResultsAndDisableRegenerate();
        } else {
            const errorResult = await submitResponse.json();
            if (errorResult.doping_error) {
                // Show doping error as a popup instead of generic error
                showMessage(errorResult.message, 'error');
            } else {
                showMessage(errorResult.message || 'Fout bij opslaan wedstrijd', 'error');
            }
        }
    } catch (error) {
        console.error('Error submitting tournament match:', error);
        showMessage('Fout bij opslaan wedstrijd', 'error');
    }
}

// Countdown and time tracking functions for Wiskunde and Rebus games
function startGameCountdown(game) {
    // Clear any existing timers
    if (countdownTimer) clearInterval(countdownTimer);
    if (gameTimer) clearInterval(gameTimer);
    
    // Show countdown modal
    showCountdownModal(game);
}

function showCountdownModal(game) {
    // Create modal HTML
    const modalHTML = `
        <div id="countdownModal" class="modal-backdrop">
            <div class="modal">
                <div class="countdown-container">
                    <h2>${game === 'wiskunde' ? 'Wiskunde' : 'Rebus'} Spel</h2>
                    <div id="countdownText" class="countdown-text">
                        <p><strong>Let op:</strong> Vernieuw je scherm niet tijdens het spel!</p>
                        <p>Het spel start over:</p>
                        <div id="countdownNumber" class="countdown-number">3</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Start countdown
    let countdown = 3;
    const countdownNumber = document.getElementById('countdownNumber');
    
    countdownTimer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            countdownNumber.textContent = countdown;
        } else {
            // Start the game and close modal
            clearInterval(countdownTimer);
            closeCountdownModal();
            startGameTimer(game);
        }
    }, 1000);
}

function startGameTimer(game) {
    gameStartTime = Date.now();
    
    // Create a small timer display in the top-right corner
    const timerDisplay = document.createElement('div');
    timerDisplay.id = 'backgroundTimer';
    timerDisplay.className = 'background-timer';
    timerDisplay.innerHTML = `
        <div class="timer-label">${game === 'wiskunde' ? 'Wiskunde' : 'Rebus'} Timer</div>
        <div class="timer-value">0.00</div>
    `;
    document.body.appendChild(timerDisplay);
    
    gameTimer = setInterval(() => {
        const elapsed = (Date.now() - gameStartTime) / 1000;
        const timerValue = timerDisplay.querySelector('.timer-value');
        if (timerValue) {
            timerValue.textContent = elapsed.toFixed(2);
        }
    }, 10); // Update every 10ms for smooth display
}

function stopGameTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    
    // Remove the background timer display
    const backgroundTimer = document.getElementById('backgroundTimer');
    if (backgroundTimer) {
        backgroundTimer.remove();
    }
    
    if (gameStartTime) {
        const elapsed = (Date.now() - gameStartTime) / 1000;
        gameStartTime = null;
        return elapsed;
    }
    return 0;
}

function closeCountdownModal() {
    const modal = document.getElementById('countdownModal');
    if (modal) {
        modal.remove();
    }
}

// Modify submitScore to handle automatic time calculation for Wiskunde and Rebus
async function submitScore() {
    const game = gameSelect.value;
    if (!game) {
        showMessage('Selecteer een spel', 'error');
        return;
    }

    // Show confirmation popup before submitting
    const confirmed = await showConfirmationPopup('Weet je zeker dat je deze score wilt invoeren?');
    if (!confirmed) {
        return;
    }

    let payload = { game: game };

    try {
        if (game === 'touwspringen') {
            const player = document.getElementById('tsPlayer').value;
            const jumps = document.getElementById('tsJumps').value;
            const doping = document.getElementById('tsDoping').checked;
            
            if (!player || jumps === '') {
                showMessage('Vul alle velden in', 'error');
                return;
            }
            
            payload.player_id = parseInt(player);
            payload.jumps = parseInt(jumps);
            payload.doping = doping;
        } else if (game === 'stoelendans') {
            // Check if device is mobile
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
            
            let ranking = [];
            
            if (isMobile) {
                // Mobile interface: get ranking from dropdowns
                const selects = document.querySelectorAll('.position-select');
                ranking = Array.from(selects).map(select => parseInt(select.value)).filter(id => !isNaN(id));
                
                if (ranking.length === 0) {
                    showMessage('Selecteer de volgorde van spelers', 'error');
                    return;
                }
                
                // Check if all positions are filled
                if (ranking.length !== players.length) {
                    showMessage('Vul alle posities in', 'error');
                    return;
                }
            } else {
                // Desktop interface: get ranking from drag-and-drop list
                const list = document.getElementById('sdList');
                const items = Array.from(list.children);
                ranking = items.map(item => parseInt(item.dataset.id));
                
                if (ranking.length === 0) {
                    showMessage('Sleep spelers in de juiste volgorde', 'error');
                    return;
                }
            }
            
            // Get all selected doping players
            const dopingPlayers = [];
            players.forEach(player => {
                const checkbox = document.getElementById(`sdDoping_${player.id}`);
                if (checkbox && checkbox.checked) {
                    dopingPlayers.push(player.id);
                }
            });
            
            payload.ordering = ranking;
            payload.doping = dopingPlayers.length > 0;
            payload.doping_players = dopingPlayers;
        } else if (game === 'petanque' || game === 'kubb') {
            // Handle tournament matches
            await submitTournamentMatch(game);
            return; // Exit early as tournament submission handles everything
        } else if (game === 'wiskunde' || game === 'rebus') {
            const player = document.getElementById('bwPlayer').value;
            const doping = document.getElementById('bwDoping').checked;
            
            if (!player) {
                showMessage('Selecteer een speler', 'error');
                return;
            }
            
            // Stop the timer and get elapsed time
            const elapsedTime = stopGameTimer();
            closeCountdownModal();
            
            payload.player_id = parseInt(player);
            payload.time = elapsedTime;
            payload.doping = doping;
            
            // Collect answers
            const answers = [];
            if (game === 'rebus') {
                // For rebus, handle question 10 specially
                for (let i = 1; i <= 9; i++) {
                    const val = document.getElementById(`ans${i}`).value;
                    answers.push(val || '');
                }
                // Handle question 10 with multiple answers
                const ans10a = document.getElementById('ans10a').value;
                const ans10b = document.getElementById('ans10b').value;
                const ans10c = document.getElementById('ans10c').value;
                const ans10d = document.getElementById('ans10d').value;
                answers.push(`${ans10a},${ans10b},${ans10c},${ans10d}`);
            } else {
                // For wiskunde, handle questions 1 and 2 specially
                // Question 1: x and y values
                const ans1_x = document.getElementById('ans1_x').value;
                const ans1_y = document.getElementById('ans1_y').value;
                answers.push(`${ans1_x},${ans1_y}`);
                
                // Question 2: x and W(x) values
                const ans2_x = document.getElementById('ans2_x').value;
                const ans2_wx = document.getElementById('ans2_wx').value;
                answers.push(`${ans2_x},${ans2_wx}`);
                
                // Questions 3-10: normal handling
                for (let i = 3; i <= 10; i++) {
                    const val = document.getElementById(`ans${i}`).value;
                    answers.push(val || '');
                }
            }
            
            payload.answers = answers;
        }
    } catch (e) {
        showMessage('Vul alle velden correct in', 'error');
        return;
    }

    try {
        let response = await fetch('/submit_game_results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let result = await response.json();
        if (response.ok && result.success) {
            showMessage(result.message, 'success');
            
            // Show popup for brain games with correct answers and time
            if ((game === 'rebus' || game === 'wiskunde') && result.correct_answers !== undefined && result.time !== undefined) {
                showBrainGamePopup(game, result.correct_answers, result.time);
            }
            
            await loadRankings();
            await loadDopingUsage(); // Reload doping usage after submission
            // Re-initialize doping checkboxes with updated data
            const currentGame = gameSelect.value;
            if (currentGame) {
                initializeDopingCheckboxes(currentGame);
            }
            // Check for existing scores and update submit button state
            await checkExistingScoreAndDisableSubmit();
            // Check tournament results and update regenerate button state
            await checkTournamentResultsAndDisableRegenerate();
        } else if (result.doping_error) {
            // Show doping error as a popup instead of generic error
            showMessage(result.message, 'error');
        } else {
            showMessage(result.message || 'Fout bij opslaan', 'error');
        }
    } catch (error) {
        console.error('Error submitting results:', error);
        showMessage('Fout bij het invoeren van resultaten', 'error');
    }
}

// Check tournament results and disable regenerate button if needed
async function checkTournamentResultsAndDisableRegenerate() {
    const regenerateButton = document.getElementById('regenerateOpponents');
    if (!regenerateButton) return;
    
    try {
        const response = await fetch('/check_tournament_results');
        if (response.ok) {
            const result = await response.json();
            
            // Enable button if at least one game can be regenerated
            if (result.can_regenerate_kubb || result.can_regenerate_petanque) {
                regenerateButton.disabled = false;
                regenerateButton.textContent = 'Nieuwe Tegenstanders Genereren';
                regenerateButton.title = '';
            } else {
                regenerateButton.disabled = true;
                regenerateButton.textContent = 'Tegenstanders kunnen niet meer gegenereerd worden';
                regenerateButton.title = 'Er zijn al resultaten ingevoerd voor beide toernooien';
            }
        }
    } catch (error) {
        console.error('Error checking tournament results:', error);
    }
}

// Check if a score already exists and disable submit button accordingly
async function checkExistingScoreAndDisableSubmit() {
    const game = gameSelect.value;
    if (!game) return;
    
    const submitButton = document.querySelector('button[onclick="submitScore()"]');
    if (!submitButton) return;
    
    try {
        // For stoelendans, check if any result exists (it's a single result for all players)
        if (game === 'stoelendans') {
            const response = await fetch('/check_existing_score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: game, player_id: 1 }) // player_id doesn't matter for stoelendans
            });
            const result = await response.json();
            
            if (result.success && result.exists) {
                submitButton.disabled = true;
                submitButton.textContent = 'Score al ingevoerd';
                submitButton.title = 'Er is al een score ingevoerd voor dit spel';
            } else {
                submitButton.disabled = false;
                submitButton.textContent = 'Score Invoeren';
                submitButton.title = '';
            }
            return;
        }
        
        // For other games, check if the selected player already has a score
        let playerId = null;
        
        if (game === 'touwspringen') {
            const playerSelect = document.getElementById('tsPlayer');
            if (playerSelect && playerSelect.value) {
                playerId = parseInt(playerSelect.value);
            }
        } else if (game === 'rebus' || game === 'wiskunde') {
            const playerSelect = document.getElementById('bwPlayer');
            if (playerSelect && playerSelect.value) {
                playerId = parseInt(playerSelect.value);
            }
        }
        
        if (playerId) {
            const response = await fetch('/check_existing_score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: game, player_id: playerId })
            });
            const result = await response.json();
            
            if (result.success && result.exists) {
                submitButton.disabled = true;
                submitButton.textContent = 'Score al ingevoerd';
                submitButton.title = 'Er is al een score ingevoerd voor deze speler';
            } else {
                submitButton.disabled = false;
                submitButton.textContent = 'Score Invoeren';
                submitButton.title = '';
            }
        } else {
            // No player selected, disable submit button
            submitButton.disabled = true;
            submitButton.textContent = 'Score Invoeren';
            submitButton.title = 'Selecteer eerst een speler';
        }
    } catch (error) {
        console.error('Error checking existing score:', error);
    }
}

    // Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Dark mode functionality
function initializeDarkMode() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
        document.body.classList.add('dark-mode');
        updateDarkModeToggle(true);
    }
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    updateDarkModeToggle(isDark);
}

function updateDarkModeToggle(isDark) {
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) {
        const darkIcon = toggle.querySelector('.dark-mode-icon');
        const lightIcon = toggle.querySelector('.light-mode-icon');
        
        if (isDark) {
            darkIcon.style.display = 'none';
            lightIcon.style.display = 'inline';
        } else {
            darkIcon.style.display = 'inline';
            lightIcon.style.display = 'none';
        }
    }
}