# Ronde van Brakel - De wielerklassieker van de spellen

Een web-applicatie voor het bijhouden van scores en klassementen voor verschillende spellen, geïnspireerd op de wielerklassieker.

## Nieuwe Features

### 🖼️ Speler Foto's
- Spelers kunnen nu een foto uploaden bij registratie
- Ondersteunde formaten: PNG, JPG, JPEG, GIF, WEBP
- Foto's worden naast de naam getoond in alle klassementen
- Standaard jersey afbeeldingen worden gebruikt als geen foto is geüpload

### 🏆 Winnaar Popups
- Automatische popups wanneer alle scores binnen zijn voor een categorie
- Verschillende modals voor elke trui categorie:
  - **Gele Trui**: Algemeen klassement
  - **Groene Trui**: Snelheid spellen (Touwspringen & Stoelendans)
  - **Bolletjestrui**: Bal spellen (Petanque & Kubb)
  - **Witte Trui**: Hersenspellen (Rebus & Wiskunde)
- Popups tonen winnaar foto, naam, startnummer en punten
- Auto-sluit na 10 seconden of bij klikken op sluitknop

## Installatie

1. Installeer de vereiste packages:
```bash
pip install -r requirements.txt
```

2. Start de applicatie:
```bash
python app.py
```

3. Open je browser en ga naar `http://localhost:5000`

## Gebruik

### Speler Registratie
1. Ga naar de "Registratie" sectie
2. Vul naam en startnummer in
3. Upload optioneel een foto
4. Klik op "Registreer"

### Scores Invoeren
1. Selecteer een spel uit de dropdown
2. Vul de vereiste gegevens in
3. Klik op "Score Invoeren"

### Klassementen Bekijken
- Alle klassementen worden automatisch bijgewerkt
- Winnaar popups verschijnen automatisch wanneer alle scores binnen zijn
- Speler foto's worden naast de namen getoond

## Bestandsstructuur

```
ronde-van-brakel/
├── app.py                 # Flask backend
├── static/
│   ├── player_pictures/  # Geüploade speler foto's
│   ├── script.js         # Frontend JavaScript
│   ├── styles.css        # Styling
│   └── *.png             # Jersey afbeeldingen
├── templates/
│   └── index.html        # Hoofdpagina template
└── data/                 # JSON data bestanden
```

## Technische Details

- **Backend**: Flask met file upload ondersteuning
- **Frontend**: Vanilla JavaScript met moderne CSS
- **Bestandsopslag**: Lokale opslag in `static/player_pictures/`
- **Database**: JSON bestanden voor eenvoudige data opslag
- **Responsive Design**: Werkt op desktop en mobiel

## Spelregels

### Touwspringen
- Spring zo veel mogelijk keer met het touw binnen 30 seconden
- De speler met de meeste sprongen wint
- **Punten:** 25-22-19-15-12-8-7-6-5-4-3-2-1-0-0-0

### Stoelendans
- Doe mee aan de stoelendans
- De laatste speler die overblijft wint
- **Punten:** 25-22-19-15-12-8-7-6-5-4-3-2-1-0-0-0

### Petanque
- Gooi de 3 ballen zo dicht mogelijk bij het kleine houten balletje (cochonnet)
- Degene die het dichtste is bij de cochonnet wint
- **Toernooi Systeem:** Knock-out toernooi met verliezersbracket
- **Punten:** Finale: 25-22, Halve finale: 19, Kwartfinale: 15, etc.
- **Doping:** Elke speler kan één keer doping gebruiken om punten te verdubbelen

### Kubb
- Gooi houten stokken om de 2 houten blokken (kubbs) van de tegenstander omver
- De speler die het meeste blokken omver gooit wint
- **Toernooi Systeem:** Knock-out toernooi met verliezersbracket
- **Punten:** Finale: 25-22, Halve finale: 19, Kwartfinale: 15, etc.
- **Doping:** Elke speler kan één keer doping gebruiken om punten te verdubbelen
- **Tie-breaker:** Bij gelijke punten voor bolletjestrui wordt de Petanque ranking gebruikt

### Rebus
- Los de rebus op door de afbeeldingen en woorden te combineren tot een antwoord
- **Punten:** 25-22-19-15-12-8-7-6-5-4-3-2-1-0-0-0

### Wiskunde
- Los wiskundige puzzels op
- Snelheid en nauwkeurigheid zijn belangrijk
- **Punten:** 25-22-19-15-12-8-7-6-5-4-3-2-1-0-0-0

## Nieuwe Functies

### 🏆 **Toernooi Systeem voor Kubb & Petanque**
- **Knock-out toernooi** met verliezersbracket
- **Automatische seeding** met willekeurige matchups
- **Ronde-voor-ronde voortgang** met automatische volgende ronde generatie
- **Eindklassement** gebaseerd op eliminatie ronde

### 💊 **Doping Systeem**
- Elke speler kan **één keer per spel** doping gebruiken
- **Verdubbelt de punten** voor die wedstrijd
- **Trackt gebruik** om dubbele doping te voorkomen
- **Checkbox in score invoer** voor eenvoudig gebruik

### 🎯 **Verbeterde Scoring**
- **Tournament-based scoring** voor Kubb & Petanque:
  - Finale: 25-22 punten
  - Halve finale: 19 punten
  - Kwartfinale: 15 punten
  - etc.
- **Tie-breaker systeem** voor bolletjestrui (Petanque ranking)
- **Doping multipliers** toegepast op basis scoring

### 🚫 **Verbeterde Popup Beheer**
- **Eenmalige weergave** van winner popups
- **Dismissed popups** worden niet meer getoond
- **Server-side tracking** van afgewezen popups
- **Betere gebruikerservaring** zonder herhaalde meldingen 