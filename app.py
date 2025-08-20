from flask import Flask, render_template, request, jsonify, redirect, url_for, send_from_directory
import json
from datetime import datetime
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configure upload folder
UPLOAD_FOLDER = 'static/player_pictures'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_player_picture(file, player_id):
    """Save uploaded player picture and return filename"""
    if file and allowed_file(file.filename):
        # Get file extension
        ext = file.filename.rsplit('.', 1)[1].lower()
        # Create filename: player_{id}.{ext}
        filename = f"player_{player_id}.{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        return filename
    return None

# Scoring system: 25-22-19-15-12-8-7-6-5-4-3-2-1-0-0-0
SCORING_POINTS = [25, 22, 19, 15, 12, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0]

# Tournament scoring for knock-out system (Kubb & Petanque)
# Points based on round elimination: Final winner=25, Final loser=22, Semi-final losers=15, Quarter-final losers=8, 1/16 losers=4, 1/32 losers=0
TOURNAMENT_SCORING = {
    'final_winner': 25,
    'final_loser': 22,
    'semi_final_losers': 15,
    'quarter_final_losers': 8,
    'round_of_16_losers': 4,
    'round_of_32_losers': 0
}

# Game categories
GAME_CATEGORIES = {
    'speed_games': ['touwspringen', 'stoelendans'],
    'ball_games': ['petanque', 'kubb'],
    'brain_games': ['rebus', 'wiskunde']
}

# Data storage (in a real app, you'd use a database)
players = []
scores = {}
opponents = {}
# New: store raw results per game to compute positions dynamically
results = {}
# New: admin-provided answer keys for brain games
answer_keys = {
    'rebus': ['Rock Brakel', 'Overbevolkt', 'Omloop het nieuwsblad', 'Kopgroep', 'de', 'Peloton', '59', 'b', '1', 'Henri,Maya,Ona,Esmee'],
    'wiskunde': []
}
# Track dismissed winner popups
dismissed_winners = set()

# Tournament structures for Kubb & Petanque (no loser bracket)
tournaments = {
    'petanque': {
        'rounds': [],
        'current_round': 0,
        'final_standings': [],
        'num_rounds': 0,
        'bye_players': []  # Track players who had bye to prevent consecutive byes
    },
    'kubb': {
        'rounds': [],
        'current_round': 0,
        'final_standings': [],
        'num_rounds': 0,
        'bye_players': []  # Track players who had bye to prevent consecutive byes
    }
}

# Track doping usage per player across all games (can only be used once)
doping_usage = {}  # {player_id: game_name} if player has used doping for that game

def load_data():
    """Load data from JSON files if they exist"""
    global players, scores, opponents, results, answer_keys, tournaments, doping_usage
    
    if os.path.exists('data/players.json'):
        with open('data/players.json', 'r', encoding='utf-8') as f:
            players = json.load(f)
            # Ensure all players have a picture field for backward compatibility
            for player in players:
                if 'picture' not in player:
                    player['picture'] = None
    
    if os.path.exists('data/scores.json'):
        with open('data/scores.json', 'r', encoding='utf-8') as f:
            scores = json.load(f)
    
    if os.path.exists('data/opponents.json'):
        with open('data/opponents.json', 'r', encoding='utf-8') as f:
            opponents = json.load(f)
    
    if os.path.exists('data/results.json'):
        with open('data/results.json', 'r', encoding='utf-8') as f:
            results = json.load(f)
    
    if os.path.exists('data/answer_keys.json'):
        with open('data/answer_keys.json', 'r', encoding='utf-8') as f:
            loaded_answer_keys = json.load(f)
            # Merge with hardcoded answers, preserving hardcoded ones
            for game, answers in loaded_answer_keys.items():
                if game not in answer_keys or not answer_keys[game]:
                    answer_keys[game] = answers
    
    # Load tournament data
    if os.path.exists('data/tournaments.json'):
        with open('data/tournaments.json', 'r', encoding='utf-8') as f:
            tournaments = json.load(f)
    
    # Load doping usage data
    if os.path.exists('data/doping_usage.json'):
        with open('data/doping_usage.json', 'r', encoding='utf-8') as f:
            doping_usage_raw = json.load(f)
            # Convert string keys to integers
            doping_usage = {int(k): v for k, v in doping_usage_raw.items()}

def save_data():
    """Save data to JSON files"""
    os.makedirs('data', exist_ok=True)
    
    with open('data/players.json', 'w', encoding='utf-8') as f:
        json.dump(players, f, ensure_ascii=False, indent=2)
    
    with open('data/scores.json', 'w', encoding='utf-8') as f:
        json.dump(scores, f, ensure_ascii=False, indent=2)
    
    with open('data/opponents.json', 'w', encoding='utf-8') as f:
        json.dump(opponents, f, ensure_ascii=False, indent=2)
    
    with open('data/results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    with open('data/answer_keys.json', 'w', encoding='utf-8') as f:
        json.dump(answer_keys, f, ensure_ascii=False, indent=2)
    
    # Save tournament data
    with open('data/tournaments.json', 'w', encoding='utf-8') as f:
        json.dump(tournaments, f, ensure_ascii=False, indent=2)
    
    # Save doping usage data
    with open('data/doping_usage.json', 'w', encoding='utf-8') as f:
        json.dump(doping_usage, f, ensure_ascii=False, indent=2)

def _ensure_results_structures():
    """Initialize default structures for results per game."""
    global results
    if not isinstance(results, dict):
        results = {}
    # Initialize structures for each game
    results.setdefault('touwspringen', {})            # {player_id: time_seconds}
    results.setdefault('stoelendans', [])             # [player_id, ...] winner -> loser
    results.setdefault('petanque', [])                # [{winner: id, loser: id}, ...]
    results.setdefault('kubb', [])                    # [{winner: id, loser: id}, ...]
    # Brain games: {player_id: {answers: [10 strings], time_seconds_total: float}}
    results.setdefault('rebus', {})
    results.setdefault('wiskunde', {})

def _ensure_answer_keys():
    """Ensure answer keys exist for brain games."""
    global answer_keys
    if not isinstance(answer_keys, dict):
        answer_keys = {}
    answer_keys.setdefault('rebus', [])
    answer_keys.setdefault('wiskunde', [])

def _compute_positions_from_results():
    """Compute per-game positions (1..N) from raw results."""
    _ensure_results_structures()
    _ensure_answer_keys()
    positions = {}

    # Touwspringen: higher jump count is better (in 30 seconds)
    ts = results.get('touwspringen', {})
    if ts:
        sorted_ids = sorted(ts.items(), key=lambda kv: kv[1], reverse=True)
        positions['touwspringen'] = {int(pid): idx + 1 for idx, (pid, _) in enumerate(sorted_ids)}

    # Stoelendans: ordering is winner to loser
    sd = results.get('stoelendans', [])
    if sd:
        positions['stoelendans'] = {int(pid): idx + 1 for idx, pid in enumerate(sd)}

    # Petanque & Kubb: use tournament standings if available
    for game in ['petanque', 'kubb']:
        if game in tournaments and tournaments[game]['final_standings']:
            # Use tournament standings
            standings = tournaments[game]['final_standings']
            positions[game] = {int(s['player_id']): s['position'] for s in standings}
        else:
            # Fallback to old system for backward compatibility
            matches = results.get(game, [])
            if matches:
                wins = {}
                for m in matches:
                    w = int(m.get('winner'))
                    l = int(m.get('loser'))
                    wins[w] = wins.get(w, 0) + 1
                    wins.setdefault(l, wins.get(l, 0))
                # Sort by wins desc then by player number asc for stability
                player_num_map = {p['id']: p['number'] for p in players}
                sorted_ids = sorted(wins.items(), key=lambda kv: (-kv[1], player_num_map.get(int(kv[0]), 0)))
                positions[game] = {int(pid): idx + 1 for idx, (pid, _) in enumerate(sorted_ids)}

    # Rebus & Wiskunde: more correct is better, tie-breaker lower time
    for game in ['rebus', 'wiskunde']:
        raw = results.get(game, {})
        if raw:
            key = answer_keys.get(game, [])
            computed = []  # list of tuples (player_id, correct_count, time_seconds_total)
            for pid_str, data in raw.items():
                try:
                    pid = int(pid_str)
                except Exception:
                    pid = int(pid_str) if isinstance(pid_str, int) else pid_str
                correct_count = 0
                time_total = 0.0
                if isinstance(data, dict):
                    # New structure
                    answers = data.get('answers')
                    if isinstance(answers, list) and isinstance(key, list) and len(key) == 10 and len(answers) == 10:
                        for i, (a, b) in enumerate(zip(answers, key)):
                            if i == 0 and game == 'wiskunde':  # Question 1 for wiskunde (x,y)
                                # Handle x,y values for question 1
                                if str(a).strip() and str(b).strip():
                                    user_answers = str(a).split(',')
                                    correct_answers = str(b).split(',')
                                    if len(user_answers) == 2 and len(correct_answers) == 2:
                                        # Check if both x and y are correct
                                        if (user_answers[0].strip().lower() == correct_answers[0].strip().lower() and
                                            user_answers[1].strip().lower() == correct_answers[1].strip().lower()):
                                            correct_count += 1
                            elif i == 1 and game == 'wiskunde':  # Question 2 for wiskunde (x,W(x))
                                # Handle x,W(x) values for question 2
                                if str(a).strip() and str(b).strip():
                                    user_answers = str(a).split(',')
                                    correct_answers = str(b).split(',')
                                    if len(user_answers) == 2 and len(correct_answers) == 2:
                                        # Check if both x and W(x) are correct
                                        if (user_answers[0].strip().lower() == correct_answers[0].strip().lower() and
                                            user_answers[1].strip().lower() == correct_answers[1].strip().lower()):
                                            correct_count += 1
                            elif i == 9 and game == 'rebus':  # Question 10 for rebus
                                # Handle multiple answers for question 10
                                if str(a).strip() and str(b).strip():
                                    user_answers = str(a).split(',')
                                    correct_answers = str(b).split(',')
                                    if len(user_answers) == 4 and len(correct_answers) == 4:
                                        # Check if all 4 answers are correct (order doesn't matter)
                                        user_set = set(ans.strip().lower() for ans in user_answers)
                                        correct_set = set(ans.strip().lower() for ans in correct_answers)
                                        if user_set == correct_set:
                                            correct_count += 1
                            else:
                                # Normal answer comparison
                                if str(a).strip().lower() == str(b).strip().lower():
                                    correct_count += 1
                    # Fallback legacy fields
                    if 'correct' in data:
                        try:
                            correct_count = int(data.get('correct', correct_count))
                        except Exception:
                            pass
                    if 'time_seconds_total' in data:
                        try:
                            time_total = float(data.get('time_seconds_total', 0.0))
                        except Exception:
                            pass
                    elif 'time_seconds' in data:
                        try:
                            time_total = float(data.get('time_seconds', 0.0))
                        except Exception:
                            pass
                computed.append((pid, correct_count, time_total))
            # Sort by correct desc, then time asc
            computed.sort(key=lambda t: (-t[1], t[2]))
            positions[game] = {int(pid): idx + 1 for idx, (pid, _, __) in enumerate(computed)}

    return positions

def calculate_ranking(game_type=None):
    """Calculate rankings for a specific game type or overall"""
    if game_type is None:
        # For overall ranking, sum the points from all category rankings
        category_rankings = {}
        for category in GAME_CATEGORIES.keys():
            category_rankings[category] = calculate_category_ranking(category)
        
        # Sum points across all categories
        player_points = {}
        for player in players:
            player_id = player['id']
            total_points = 0
            
            for category, rankings in category_rankings.items():
                for rank_player_id, rank_info in rankings:
                    if rank_player_id == player_id:
                        total_points += rank_info['points']
                        break
            
            player_points[player_id] = {
                'name': player['name'],
                'number': player['number'],
                'points': total_points
            }
        
        # Sort by points (descending)
        sorted_players = sorted(player_points.items(), key=lambda x: x[1]['points'], reverse=True)
        return sorted_players
    else:
        # For specific game type, calculate directly
        player_points = {}
        computed_positions = _compute_positions_from_results()
        
        for player in players:
            player_id = player['id']
            total_points = 0
            
            if player_id in computed_positions.get(game_type, {}):
                position = computed_positions[game_type][player_id]
                if game_type in ['petanque', 'kubb']:
                    # Tournament scoring for Kubb & Petanque
                    # Get points from tournament final standings
                    if game_type in tournaments and tournaments[game_type]['final_standings']:
                        for standing in tournaments[game_type]['final_standings']:
                            if standing['player_id'] == player_id:
                                base_points = standing['points']
                                # Apply doping multiplier if used for this game
                                if player_id in doping_usage and doping_usage[player_id] == game_type:
                                    base_points *= 2
                                total_points = base_points
                                break
                else:
                    # Standard scoring for other games
                    if position <= len(SCORING_POINTS):
                        base_points = SCORING_POINTS[position - 1]
                        # Apply doping multiplier if used for this game
                        if player_id in doping_usage and doping_usage[player_id] == game_type:
                            base_points *= 2
                        total_points = base_points
            
            player_points[player_id] = {
                'name': player['name'],
                'number': player['number'],
                'points': total_points
            }
        
        # Sort by points (descending)
        sorted_players = sorted(player_points.items(), key=lambda x: x[1]['points'], reverse=True)
        return sorted_players

def calculate_category_ranking(category):
    """Calculate rankings for a specific category of games"""
    player_points = {}
    computed_positions = _compute_positions_from_results()
    
    for player in players:
        player_id = player['id']
        total_points = 0
        
        for game in GAME_CATEGORIES[category]:
            game_positions = computed_positions.get(game, {})
            if player_id in game_positions:
                position = game_positions[player_id]
                if game in ['petanque', 'kubb']:
                    # Tournament scoring for Kubb & Petanque
                    # Get points from tournament final standings
                    if game in tournaments and tournaments[game]['final_standings']:
                        for standing in tournaments[game]['final_standings']:
                            if standing['player_id'] == player_id:
                                base_points = standing['points']
                                # Apply doping multiplier if used for this game
                                if player_id in doping_usage and doping_usage[player_id] == game:
                                    base_points *= 2
                                total_points += base_points
                                break
                else:
                    # Standard scoring for other games
                    if position <= len(SCORING_POINTS):
                        base_points = SCORING_POINTS[position - 1]
                        # Apply doping multiplier if used for this game
                        if player_id in doping_usage and doping_usage[player_id] == game:
                            base_points *= 2
                        total_points += base_points
        
        player_points[player_id] = {
            'name': player['name'],
            'number': player['number'],
            'points': total_points
        }
    
    # Sort by points (descending)
    sorted_players = sorted(player_points.items(), key=lambda x: x[1]['points'], reverse=True)
    
    # Handle tie-breakers for ball games (bolletjestrui)
    if category == 'ball_games':
        sorted_players = apply_ball_games_tiebreaker(sorted_players, computed_positions)
    
    return sorted_players

def apply_ball_games_tiebreaker(sorted_players, computed_positions):
    """Apply tie-breaker for ball games using Petanque rankings"""
    # Group players by points
    points_groups = {}
    for player_id, player_info in sorted_players:
        points = player_info['points']
        if points not in points_groups:
            points_groups[points] = []
        points_groups[points].append((player_id, player_info))
    
    # Sort each group by Petanque ranking (if tied)
    final_sorted = []
    for points in sorted(points_groups.keys(), reverse=True):
        group = points_groups[points]
        if len(group) > 1:
            # Apply Petanque tie-breaker
            group_sorted = sorted(group, key=lambda x: computed_positions.get('petanque', {}).get(x[0], float('inf')))
            final_sorted.extend(group_sorted)
        else:
            final_sorted.extend(group)
    
    return final_sorted

def generate_opponents():
    """Generate opponent pairs only for petanque and kubb, ensuring different opponents per game."""
    global opponents
    games = ['petanque', 'kubb']
    
    # Clear existing opponents to regenerate
    opponents = {}
    
    for game in games:
        opponents[game] = []
        
        # Create a copy of players for this game
        available_players = players.copy()
        
        # Shuffle players to randomize matchups
        import random
        random.shuffle(available_players)
        
        # Create pairs ensuring each player plays exactly once
        while len(available_players) >= 2:
            player1 = available_players.pop(0)
            player2 = available_players.pop(0)
            
            opponents[game].append({
                'player1': player1['id'],
                'player1_name': player1['name'],
                'player1_number': player1['number'],
                'player2': player2['id'],
                'player2_name': player2['name'],
                'player2_number': player2['number']
            })
        
        # If there's an odd number of players, the last player gets a bye
        if len(available_players) == 1:
            last_player = available_players[0]
            opponents[game].append({
                'player1': last_player['id'],
                'player1_name': last_player['name'],
                'player1_number': last_player['number'],
                'player2': None,
                'player2_name': 'BYE',
                'player2_number': None
            })

def generate_tournament(game):
    """Generate a complete knock-out tournament for Kubb or Petanque (no loser bracket)"""
    global tournaments
    
    if game not in ['petanque', 'kubb']:
        return False
    
    # Get all players
    available_players = players.copy()
    
    # Shuffle players for random seeding
    import random
    random.shuffle(available_players)
    
    # Calculate number of rounds needed
    num_players = len(available_players)
    num_rounds = 1
    while (2 ** num_rounds) < num_players:
        num_rounds += 1
    
    # Initialize tournament structure
    tournament = {
        'rounds': [],
        'current_round': 0,
        'final_standings': [],
        'num_rounds': num_rounds,
        'bye_players': []  # Track players who had bye to prevent consecutive byes
    }
    
    # Generate first round matches
    first_round = []
    for i in range(0, len(available_players), 2):
        if i + 1 < len(available_players):
            # Normal match between two players
            match = {
                'match_id': f"{game}_r1_m{i//2}",
                'player1': available_players[i],
                'player2': available_players[i + 1],
                'winner': None,
                'loser': None,
                'doping1': False,
                'doping2': False,
                'completed': False
            }
            first_round.append(match)
        else:
            # Odd number of players - last player gets a bye and advances automatically
            bye_match = {
                'match_id': f"{game}_r1_m{i//2}",
                'player1': available_players[i],
                'player2': None,  # No opponent
                'winner': available_players[i]['id'],  # Automatically wins
                'loser': None,
                'doping1': False,
                'doping2': False,
                'completed': True  # Already completed
            }
            first_round.append(bye_match)
            # Track this player as having had a bye
            tournament['bye_players'].append(available_players[i]['id'])
    
    tournament['rounds'].append(first_round)
    
    # Store tournament
    tournaments[game] = tournament
    
    return True

def advance_tournament(game, match_id, winner_id, loser_id, doping1=False, doping2=False):
    """Advance tournament after a match is completed"""
    global tournaments, doping_usage
    
    if game not in tournaments:
        return False
    
    tournament = tournaments[game]
    current_round = tournament['current_round']
    
    # Find and update the match
    match_found = False
    for match in tournament['rounds'][current_round]:
        if match['match_id'] == match_id:
            # Skip if this is a bye match that's already completed
            if match['completed'] and match['player2'] is None:
                match_found = True
                break
                
            match['winner'] = winner_id
            match['loser'] = loser_id
            match['doping1'] = doping1
            match['doping2'] = doping2
            match['completed'] = True
            match_found = True
            break
    
    if not match_found:
        return False
    
    # Track doping usage (can only be used once across all games)
    # For tournaments, doping can only be used in round 1
    if doping1:
        if winner_id in doping_usage:
            return False  # Player already used doping
        if current_round > 0:
            return False  # Doping can only be used in round 1
        doping_usage[winner_id] = game
    if doping2:
        if loser_id in doping_usage:
            return False  # Player already used doping
        if current_round > 0:
            return False  # Doping can only be used in round 1
        doping_usage[loser_id] = game
    
    # Check if current round is complete
    current_round_matches = tournament['rounds'][current_round]
    if all(match['completed'] for match in current_round_matches):
        # Advance to next round
        if current_round < tournament['num_rounds'] - 1:
            next_round = generate_next_round(tournament, current_round)
            if next_round:
                tournament['rounds'].append(next_round)
                tournament['current_round'] += 1
        else:
            # Tournament complete, generate final standings
            generate_final_standings(tournament)
    
    return True

def generate_next_round(tournament, current_round):
    """Generate the next round of the tournament with bye prevention"""
    current_matches = tournament['rounds'][current_round]
    next_round = []
    
    # Get all winners from current round
    winners = []
    for match in current_matches:
        if match['winner']:
            winners.append(match['winner'])
    
    # If odd number of winners, we need to give someone a bye
    # But we can't give a bye to someone who already had one
    if len(winners) % 2 == 1:
        # Find a player who hasn't had a bye yet
        eligible_for_bye = [w for w in winners if w not in tournament['bye_players']]
        
        if eligible_for_bye:
            # Give bye to the first eligible player
            bye_player = eligible_for_bye[0]
            tournament['bye_players'].append(bye_player)
            
            # Remove bye player from winners list for normal matchmaking
            winners.remove(bye_player)
            
            # Create bye match
            bye_match = {
                'match_id': f"r{current_round + 2}_bye",
                'player1': {'id': bye_player},
                'player2': None,  # No opponent
                'winner': bye_player,  # Automatically wins
                'loser': None,
                'doping1': False,
                'doping2': False,
                'completed': True  # Already completed
            }
            next_round.append(bye_match)
    
    # Generate normal matches for remaining players
    for i in range(0, len(winners), 2):
        if i + 1 < len(winners):
            # Normal match between two winners
            next_match = {
                'match_id': f"r{current_round + 2}_m{i//2}",
                'player1': {'id': winners[i]},
                'player2': {'id': winners[i + 1]},
                'winner': None,
                'loser': None,
                'doping1': False,
                'doping2': False,
                'completed': False
            }
            next_round.append(next_match)
    
    return next_round

def generate_final_standings(tournament):
    """Generate final standings based on tournament results with new scoring system"""
    standings = []
    
    # Get the final match
    if tournament['rounds'][-1]:
        final_match = tournament['rounds'][-1][0]
        
        # Final winner gets 25 points
        if final_match['winner']:
            standings.append({
                'player_id': final_match['winner'],
                'position': 1,
                'points': TOURNAMENT_SCORING['final_winner']
            })
        
        # Final loser gets 22 points
        if final_match['loser']:
            standings.append({
                'player_id': final_match['loser'],
                'position': 2,
                'points': TOURNAMENT_SCORING['final_loser']
            })
    
    # Calculate points for players eliminated in earlier rounds
    # We need to track when each player was eliminated
    eliminated_players = {}
    
    # Go through all rounds to find when each player was eliminated
    for round_idx, round_matches in enumerate(tournament['rounds']):
        for match in round_matches:
            if match['completed'] and match['loser']:
                eliminated_players[match['loser']] = round_idx
    
    # Assign points based on elimination round
    for player_id, elimination_round in eliminated_players.items():
        # Skip final winner and loser (already handled above)
        if player_id in [final_match['winner'], final_match['loser']]:
            continue
            
        # Determine points based on elimination round
        if elimination_round == len(tournament['rounds']) - 2:  # Semi-final
            points = TOURNAMENT_SCORING['semi_final_losers']
        elif elimination_round == len(tournament['rounds']) - 3:  # Quarter-final
            points = TOURNAMENT_SCORING['quarter_final_losers']
        elif elimination_round == len(tournament['rounds']) - 4:  # Round of 16
            points = TOURNAMENT_SCORING['round_of_16_losers']
        else:  # Earlier rounds (Round of 32, etc.)
            points = TOURNAMENT_SCORING['round_of_32_losers']
        
        standings.append({
            'player_id': player_id,
            'position': len(standings) + 1,
            'points': points
        })
    
    # Sort by points (descending) and then by position
    standings.sort(key=lambda x: (-x['points'], x['position']))
    
    # Update positions after sorting
    for i, standing in enumerate(standings):
        standing['position'] = i + 1
    
    tournament['final_standings'] = standings

def all_scores_in(category=None):
    no_players = len(players)
    scored = 0
    if category is None:
        game_count = 6
        if no_players == 0 or game_count == 0:
            return False
        expected = no_players * game_count
        scored=len([v for lst in results.values() for v in lst])

    else:
        game_count = len(GAME_CATEGORIES[category])
        if no_players == 0 or game_count == 0:
            return False
        expected = no_players * game_count
        for game in GAME_CATEGORIES[category]:
            scored+=len(results[game])

    return scored == expected

def get_category_winner(category):
    """Get the winner of a specific category if all scores are in"""
    if not all_scores_in(category):
        return None
    
    rankings = calculate_category_ranking(category)
    if rankings and len(rankings) > 0:
        winner_data = rankings[0]
        winner_id = winner_data[0]
        winner_info = winner_data[1]
        
        # Find the player object to get picture
        player_obj = next((p for p in players if p['id'] == winner_id), None)
        
        return {
            'id': winner_id,
            'name': winner_info['name'],
            'number': winner_info['number'],
            'points': winner_info['points'],
            'picture': player_obj.get('picture') if player_obj else None,
            'category': category
        }
    return None

def get_overall_winner():
    """Get the overall winner if all scores are in"""
    if not all_scores_in():
        return None
    
    rankings = calculate_ranking()
    if rankings and len(rankings) > 0:
        winner_data = rankings[0]
        winner_id = winner_data[0]
        winner_info = winner_data[1]
        
        # Find the player object to get picture
        player_obj = next((p for p in players if p['id'] == winner_id), None)
        
        return {
            'id': winner_id,
            'name': winner_info['name'],
            'number': winner_info['number'],
            'points': winner_info['points'],
            'picture': player_obj.get('picture') if player_obj else None,
            'category': 'overall'
        }
    return None

@app.route('/')
def index():
    """Main page with all sections"""
    load_data()
    return render_template('index.html', 
                         players=players, 
                         scores=scores, 
                         opponents=opponents,
                         games=['touwspringen', 'stoelendans', 'petanque', 'kubb', 'rebus', 'wiskunde'])

@app.route('/register_player', methods=['POST'])
def register_player():
    """Register a new player"""
    # Check if it's a multipart form (file upload) or JSON
    if request.content_type and 'multipart/form-data' in request.content_type:
        # Handle file upload
        name = request.form.get('name', '').strip()
        number = request.form.get('number')
        picture = request.files.get('picture')
        
        if not name or not number:
            return jsonify({'success': False, 'message': 'Naam en startnummer zijn verplicht'})
        
        # Check if number already exists
        if any(p['number'] == int(number) for p in players):
            return jsonify({'success': False, 'message': 'Dit startnummer is al in gebruik'})
        
        # Create new player
        player_id = len(players) + 1
        new_player = {
            'id': player_id,
            'name': name,
            'number': int(number),
            'registered_at': datetime.now().isoformat(),
            'picture': None
        }
        
        # Save picture if provided
        if picture:
            filename = save_player_picture(picture, player_id)
            if filename:
                new_player['picture'] = filename
        
        players.append(new_player)
        save_data()
        
        return jsonify({'success': True, 'message': f'Speler {name} succesvol geregistreerd', 'player': new_player})
    else:
        # Handle JSON request (backward compatibility)
        data = request.get_json()
        name = data.get('name', '').strip()
        number = data.get('number')
        
        if not name or not number:
            return jsonify({'success': False, 'message': 'Naam en startnummer zijn verplicht'})
        
        # Check if number already exists
        if any(p['number'] == number for p in players):
            return jsonify({'success': False, 'message': 'Dit startnummer is al in gebruik'})
        
        # Create new player
        player_id = len(players) + 1
        new_player = {
            'id': player_id,
            'name': name,
            'number': number,
            'registered_at': datetime.now().isoformat(),
            'picture': None
        }
        
        players.append(new_player)
        save_data()
        
        return jsonify({'success': True, 'message': f'Speler {name} succesvol geregistreerd', 'player': new_player})

@app.route('/player_picture/<filename>')
def player_picture(filename):
    """Serve player pictures"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/submit_game_results', methods=['POST'])
def submit_game_results():
    """Submit results for a specific game with game-specific payloads."""
    load_data()
    _ensure_results_structures()
    data = request.get_json()
    game = data.get('game')
    if not game:
        return jsonify({'success': False, 'message': 'Spel is verplicht'}), 400

    try:
        overwrite = bool(data.get('overwrite', False))
        if game == 'touwspringen':
            player_id = int(data.get('player_id'))
            jumps = int(data.get('jumps'))
            doping = data.get('doping', False)
            # Check if player already has a score for this game
            if str(player_id) in results['touwspringen'] or player_id in results['touwspringen']:
                if not overwrite:
                    return jsonify({'success': False, 'needs_overwrite': True, 'message': 'Er bestaat al een score voor deze speler voor dit spel'}), 409
            results['touwspringen'][player_id] = jumps
            # Track doping usage
            if doping:
                if player_id in doping_usage:
                    return jsonify({'success': False, 'doping_error': True, 'message': f'Speler heeft al doping gebruikt voor {doping_usage[player_id]}'}), 200
                doping_usage[player_id] = game
        elif game == 'stoelendans':
            ordering = data.get('ordering', [])
            doping = data.get('doping', False)
            doping_players = data.get('doping_players', [])
            ordering = [int(pid) for pid in ordering]
            # Check if already set
            if results['stoelendans'] and not overwrite:
                return jsonify({'success': False, 'needs_overwrite': True, 'message': 'Er bestaat al een volgorde voor stoelendans'}), 409
            results['stoelendans'] = ordering
            # Track doping usage for selected players
            if doping:
                for player_id in doping_players:
                    player_id_int = int(player_id)
                    if str(player_id) in list(doping_usage.keys()):
                        return jsonify({'success': False, 'doping_error': True, 'message': f'Speler heeft al doping gebruikt voor speler met nummer {player_id_int}'}), 200
                    doping_usage[player_id_int] = game
        elif game in ['petanque', 'kubb']:
            # These games now use the tournament system, not direct submission
            return jsonify({'success': False, 'message': 'Kubb en Petanque gebruiken het toernooi systeem. Gebruik de toernooi interface.'}), 400
        elif game in ['rebus', 'wiskunde']:
            player_id = int(data.get('player_id'))
            answers = data.get('answers')
            time_seconds_total = data.get('time_seconds_total')
            time = data.get('time')  # New automatic time parameter
            doping = data.get('doping', False)
            
            # Backward compatibility: allow correct/time pair
            if answers is None:
                answers = []
            if time_seconds_total is None and time is not None:
                time_seconds_total = time
            if time_seconds_total is None:
                time_seconds_total = data.get('time_seconds')
            if not isinstance(answers, list):
                return jsonify({'success': False, 'message': 'Antwoorden moeten een lijst zijn'}), 400
            if time_seconds_total is None:
                return jsonify({'success': False, 'message': 'Totale tijd is verplicht'}), 400
            
            # Check if player already has a result for this game
            if str(player_id) in results[game] or player_id in results[game]:
                if not overwrite:
                    return jsonify({'success': False, 'needs_overwrite': True, 'message': 'Er bestaat al een resultaat voor deze speler voor dit spel'}), 409
            
            # Calculate correct answers for popup display
            correct_answers = 0
            if game in answer_keys and len(answers) == len(answer_keys[game]):
                for i, (user_answer, correct_answer) in enumerate(zip(answers, answer_keys[game])):
                    if game == 'rebus' and i == 9:  # Special handling for rebus question 10
                        # Split the comma-separated answers
                        user_parts = [part.strip().lower() for part in user_answer.split(',')]
                        correct_parts = [part.strip().lower() for part in correct_answer.split(',')]
                        if len(user_parts) == len(correct_parts) and all(u in correct_parts for u in user_parts):
                            correct_answers += 1
                    elif game == 'wiskunde' and i in [0, 1]:  # Special handling for wiskunde questions 1 and 2
                        # Split the comma-separated answers
                        user_parts = [part.strip().lower() for part in user_answer.split(',')]
                        correct_parts = [part.strip().lower() for part in correct_answer.split(',')]
                        if len(user_parts) == len(correct_parts) and all(u in correct_parts for u in user_parts):
                            correct_answers += 1
                    else:
                        # Case-insensitive comparison for other answers
                        if user_answer.strip().lower() == correct_answer.strip().lower():
                            correct_answers += 1
            
            results[game][player_id] = {
                'answers': answers,
                'time_seconds_total': float(time_seconds_total),
                'correct_answers': correct_answers  # Store for popup display
            }
            # Track doping usage
            if doping:
                if player_id in doping_usage:
                    return jsonify({'success': False, 'doping_error': True, 'message': f'Speler heeft al doping gebruikt voor {doping_usage[player_id]}'}), 200
                doping_usage[player_id] = game
            
            # Automatically set Robin and Arnaud's scores to 0 for these games
            robin_arnaud_ids = []
            for player in players:
                if player['name'] in ['Robin', 'Arnaud']:
                    robin_arnaud_ids.append(player['id'])
            
            for excluded_id in robin_arnaud_ids:
                if excluded_id not in results[game]:
                    results[game][excluded_id] = {
                        'answers': [''] * 10,  # Empty answers
                        'time_seconds_total': 0.0,  # Zero time
                        'correct_answers': 0
                    }
        else:
            return jsonify({'success': False, 'message': 'Onbekend spel'}), 400
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'Ongeldige waarden'}), 400

    save_data()
    
    # Return additional info for brain games popup
    if game in ['rebus', 'wiskunde']:
        player_result = results[game][player_id]
        return jsonify({
            'success': True, 
            'message': 'Resultaten succesvol opgeslagen',
            'correct_answers': player_result.get('correct_answers', 0),
            'time': player_result.get('time_seconds_total', 0)
        })
    
    return jsonify({'success': True, 'message': 'Resultaten succesvol opgeslagen'})

@app.route('/admin/set_answer_key', methods=['POST'])
def set_answer_key():
    """Admin: set answer key for a brain game (10 answers)."""
    load_data()
    _ensure_answer_keys()
    data = request.get_json()
    game = data.get('game')
    answers = data.get('answers')
    if game not in ['rebus', 'wiskunde']:
        return jsonify({'success': False, 'message': 'Ongeldig spel'}), 400
    if not isinstance(answers, list) or len(answers) != 10:
        return jsonify({'success': False, 'message': 'Antwoorden moeten 10 items bevatten'}), 400
    answer_keys[game] = [str(a) for a in answers]
    save_data()
    return jsonify({'success': True})

@app.route('/admin/get_answer_key')
def get_answer_key():
    load_data()
    game = request.args.get('game')
    if game not in ['rebus', 'wiskunde']:
        return jsonify({'success': False, 'message': 'Ongeldig spel'}), 400
    return jsonify({'success': True, 'answers': answer_keys.get(game, [])})

@app.route('/admin/clear_results', methods=['POST'])
def clear_results():
    """Admin: clear all stored results (and legacy scores) after confirmation."""
    load_data()
    global results, scores
    results = {}
    scores = {}
    # Recreate empty structures
    _ensure_results_structures()
    save_data()
    return jsonify({'success': True, 'message': 'Alle resultaten zijn gewist'})

@app.route('/get_rankings')
def get_rankings():
    """Get all rankings"""
    load_data()
    rankings = {
        'gele_trui': calculate_ranking(),  # Overall ranking
        'groene_trui': calculate_category_ranking('speed_games'),
        'bolletjes_trui': calculate_category_ranking('ball_games'),
        'witte_trui': calculate_category_ranking('brain_games')
    }
    
    return jsonify(rankings)

@app.route('/get_doping_usage')
def get_doping_usage():
    """Get doping usage information for frontend"""
    load_data()
    return jsonify(doping_usage)

@app.route('/get_opponents')
def get_opponents():
    """Get opponent pairs"""
    load_data()
    # Only generate if missing or empty for petanque/kubb
    missing = False
    for g in ['petanque', 'kubb']:
        if g not in opponents or not opponents.get(g):
            missing = True
            break
    if missing:
        generate_opponents()
        save_data()
    return jsonify(opponents)

@app.route('/get_players')
def get_players():
    """Get all registered players"""
    load_data()
    return jsonify(players)

@app.route('/get_scores')
def get_scores():
    """Get all scores data"""
    load_data()
    return jsonify(scores)

@app.route('/get_results')
def get_results():
    """Get all results data"""
    load_data()
    return jsonify(results)

@app.route('/regenerate_opponents', methods=['POST'])
def regenerate_opponents():
    """Regenerate opponent pairs for all games"""
    load_data()
    generate_opponents()
    save_data()
    return jsonify({'success': True, 'message': 'Tegenstanders succesvol opnieuw gegenereerd'})

@app.route('/generate_tournament/<game>', methods=['POST'])
def generate_tournament_route(game):
    """Generate a new tournament for Kubb or Petanque"""
    load_data()
    if game not in ['petanque', 'kubb']:
        return jsonify({'success': False, 'message': 'Ongeldig spel'}), 400
    
    success = generate_tournament(game)
    if success:
        save_data()
        return jsonify({'success': True, 'message': f'Toernooi voor {game} succesvol gegenereerd'})
    else:
        return jsonify({'success': False, 'message': 'Fout bij genereren toernooi'}), 500

@app.route('/get_tournament/<game>')
def get_tournament(game):
    """Get tournament structure for a specific game"""
    load_data()
    if game not in ['petanque', 'kubb']:
        return jsonify({'success': False, 'message': 'Ongeldig spel'}), 400
    
    if game not in tournaments:
        return jsonify({'success': False, 'message': 'Geen toernooi gevonden'}), 404
    
    return jsonify(tournaments[game])

@app.route('/submit_tournament_match', methods=['POST'])
def submit_tournament_match():
    """Submit results for a tournament match"""
    load_data()
    data = request.get_json()
    
    game = data.get('game')
    match_id = data.get('match_id')
    winner_id = data.get('winner_id')
    loser_id = data.get('loser_id')
    doping1 = data.get('doping1', False)
    doping2 = data.get('doping2', False)
    
    if not all([game, match_id, winner_id, loser_id]):
        return jsonify({'success': False, 'message': 'Alle velden zijn verplicht'}), 400
    
    if game not in ['petanque', 'kubb']:
        return jsonify({'success': False, 'message': 'Ongeldig spel'}), 400
    
    # Check if match is already completed and allow overwrite
    if game in tournaments:
        tournament = tournaments[game]
        for round_matches in tournament['rounds']:
            for match in round_matches:
                if match['match_id'] == match_id and match['completed']:
                    # Reset doping usage for the previous players if they used it
                    if match['doping1'] and match['winner'] in doping_usage:
                        del doping_usage[match['winner']]
                    if match['doping2'] and match['loser'] in doping_usage:
                        del doping_usage[match['loser']]
                    break
    
    success = advance_tournament(game, match_id, int(winner_id), int(loser_id), doping1, doping2)
    
    if success:
        save_data()
        return jsonify({'success': True, 'message': 'Wedstrijd resultaat succesvol opgeslagen'})
    else:
        # Check if it failed due to doping validation
        if doping1 and int(winner_id) in doping_usage and doping_usage[int(winner_id)] != game:
            return jsonify({'success': False, 'doping_error': True, 'message': f'Speler heeft al doping gebruikt voor {doping_usage[int(winner_id)]}'}), 200
        if doping2 and int(loser_id) in doping_usage and doping_usage[int(loser_id)] != game:
            return jsonify({'success': False, 'doping_error': True, 'message': f'Speler heeft al doping gebruikt voor {doping_usage[int(loser_id)]}'}), 200
        # Check if it failed due to doping in wrong round
        if (doping1 or doping2) and game in tournaments and tournaments[game]['current_round'] > 0:
            return jsonify({'success': False, 'doping_error': True, 'message': 'Doping kan alleen in ronde 1 gebruikt worden'}), 200
        return jsonify({'success': False, 'message': 'Fout bij opslaan wedstrijd'}), 500

@app.route('/get_tournament_matches/<game>')
def get_tournament_matches(game):
    """Get all tournament matches for a specific game to display in tegenstanders view"""
    load_data()
    if game not in ['petanque', 'kubb']:
        return jsonify({'success': False, 'message': 'Ongeldig spel'}), 400
    
    if game not in tournaments:
        return jsonify({'success': False, 'message': 'Geen toernooi gevonden'}), 404
    
    tournament = tournaments[game]
    all_matches = []
    
    # Collect all matches from all rounds
    for round_idx, round_matches in enumerate(tournament['rounds']):
        for match in round_matches:
            match_info = {
                'round': round_idx + 1,
                'match_id': match['match_id'],
                'player1': match['player1'],
                'player2': match['player2'],
                'winner': match['winner'],
                'loser': match['loser'],
                'doping1': match['doping1'],
                'doping2': match['doping2'],
                'completed': match['completed']
            }
            all_matches.append(match_info)
    
    return jsonify({
        'success': True,
        'game': game,
        'matches': all_matches,
        'current_round': tournament['current_round'] + 1,
        'total_rounds': tournament['num_rounds']
    })

@app.route('/check_winners')
def check_winners():
    """Check for winners in all categories"""
    load_data()
    
    winners = {}
    
    # Check overall winner (Gele Trui)
    overall_winner = get_overall_winner()
    if overall_winner and 'gele_trui' not in dismissed_winners:
        winners['gele_trui'] = overall_winner
    
    # Check category winners
    for category in GAME_CATEGORIES.keys():
        category_winner = get_category_winner(category)
        if category_winner:
            if category == 'speed_games' and 'groene_trui' not in dismissed_winners:
                winners['groene_trui'] = category_winner
            elif category == 'ball_games' and 'bolletjes_trui' not in dismissed_winners:
                winners['bolletjes_trui'] = category_winner
            elif category == 'brain_games' and 'witte_trui' not in dismissed_winners:
                winners['witte_trui'] = category_winner
    
    return jsonify(winners)

@app.route('/dismiss_winner', methods=['POST'])
def dismiss_winner():
    """Mark a winner popup as dismissed so it won't show again"""
    data = request.get_json()
    category = data.get('category')
    
    if not category:
        return jsonify({'success': False, 'message': 'Category is required'}), 400
    
    # Store dismissed winners in a simple way (in a real app, you'd use a database)
    # For now, we'll use a global variable
    global dismissed_winners
    if 'dismissed_winners' not in globals():
        dismissed_winners = set()
    
    dismissed_winners.add(category)
    
    return jsonify({'success': True})

@app.route('/check_existing_score', methods=['POST'])
def check_existing_score():
    """Check if a score already exists for a player/game combination"""
    load_data()
    data = request.get_json()
    game = data.get('game')
    player_id = data.get('player_id')
    
    if not game or player_id is None:
        return jsonify({'success': False, 'message': 'Game and player_id are required'}), 400
    
    player_id = int(player_id)
    exists = False
    
    if game == 'touwspringen':
        exists = str(player_id) in results['touwspringen'] or player_id in results['touwspringen']
    elif game == 'stoelendans':
        # For stoelendans, check if any ordering exists (it's a single result for all players)
        exists = len(results['stoelendans']) > 0
    elif game in ['rebus', 'wiskunde']:
        exists = str(player_id) in results[game] or player_id in results[game]
    elif game in ['petanque', 'kubb']:
        # For tournament games, check if player has participated in any matches
        exists = False
        if game in tournaments:
            for round_matches in tournaments[game]['rounds']:
                for match in round_matches:
                    if match['player1'] == player_id or match['player2'] == player_id:
                        if match['completed']:
                            exists = True
                            break
                if exists:
                    break
    
    return jsonify({
        'success': True,
        'exists': exists,
        'game': game,
        'player_id': player_id
    })

@app.route('/check_tournament_results')
def check_tournament_results():
    """Check if there are any results for Kubb or Petanque tournaments"""
    load_data()
    
    kubb_has_results = False
    petanque_has_results = False
    
    # Check Kubb results
    if 'kubb' in tournaments:
        for round_matches in tournaments['kubb']['rounds']:
            for match in round_matches:
                # Only count as result if it's completed AND not a bye match
                if match['completed'] and match['player2'] is not None:
                    kubb_has_results = True
                    break
            if kubb_has_results:
                break
    
    # Check Petanque results
    if 'petanque' in tournaments:
        for round_matches in tournaments['petanque']['rounds']:
            for match in round_matches:
                # Only count as result if it's completed AND not a bye match
                if match['completed'] and match['player2'] is not None:
                    petanque_has_results = True
                    break
            if petanque_has_results:
                break
    
    return jsonify({
        'success': True,
        'kubb_has_results': kubb_has_results,
        'petanque_has_results': petanque_has_results
    })

if __name__ == '__main__':
    load_data()
    app.run(debug=True, host='0.0.0.0', port=5000) 