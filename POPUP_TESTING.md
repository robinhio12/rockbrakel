# Winner Popup Testing Guide

## Overview
The winner popup functionality has been enhanced to show beautiful popups when a player wins a jersey ranking. The popup includes:
- Jersey picture
- Jersey name
- Winner's name
- Winner's picture
- Winner's score

## Features
- **Automatic Detection**: Popups appear automatically when rankings are updated
- **Session Management**: Each popup is only shown once per session to avoid spam
- **Multiple Close Options**: Click the X button, the "Gefeliciteerd!" button, or click outside the popup
- **Auto-close**: Popups automatically close after 8 seconds
- **Responsive Design**: Works on both desktop and mobile devices
- **Dark Mode Support**: Adapts to the current theme

## Testing the Popup Functionality

### Method 1: Using the Test HTML File
1. Open `test_popup.html` in your browser
2. Click any of the test buttons to see different jersey popups
3. Test the close functionality and responsive design

### Method 2: Using Browser Console (on main page)
1. Open the main application page
2. Open browser developer tools (F12)
3. Run these commands in the console:

```javascript
// Test individual popups
testWinnerPopup();  // Tests a single popup
testAllPopups();    // Tests all jersey types with delays

// Force check for new winners (useful after submitting scores)
forceCheckWinners();

// Clear popup session storage (to show popups again)
clearPopupSession();
```

### Method 3: Real Testing
1. Submit some game scores to create rankings
2. The popups should appear automatically when:
   - A jersey gets its first winner
   - A different player takes the lead in a jersey ranking
3. Each popup will only show once per session

## Popup Behavior
- **First Winner**: Shows when a jersey gets its first winner
- **New Leader**: Shows when a different player takes the lead
- **Session Persistence**: Once shown, won't show again until session storage is cleared
- **Auto-refresh**: Popups will appear when the page is refreshed and new winners are detected

## Troubleshooting
- If popups don't appear, check the browser console for errors
- Use `clearPopupSession()` to reset the popup state
- Ensure the jersey images are accessible in the `/static/` folder
- Check that player pictures are properly loaded

## Customization
The popup styling can be modified in `static/styles.css` under the "Enhanced Winner Popup Styles" section.
