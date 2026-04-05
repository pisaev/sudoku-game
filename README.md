# Sudoku Game

A clean, cross-platform Sudoku puzzle game built as a Progressive Web App (PWA).

## Platforms

- **Windows** — Open `index.html` in any browser, or serve locally
- **macOS** — Open `index.html` in any browser, or serve locally
- **Android** — Open in Chrome → "Add to Home Screen" to install as a native-like app

## How to Run

### Quick start (any platform)
```bash
# Option 1: Just open the file
open index.html        # macOS
start index.html       # Windows

# Option 2: Serve locally (needed for PWA/service worker)
npx serve .
# or
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

### Install on Android
1. Open the URL in Chrome on your Android device
2. Tap the browser menu → "Add to Home Screen"
3. The game installs as a standalone app with offline support

## Features

- **3 difficulty levels** — Easy, Medium, Hard
- **Pencil notes** — Toggle note mode to track candidates
- **Undo** — Full move history
- **Hints** — Reveals the correct number for selected cell
- **Error highlighting** — Conflicts shown in red with shake animation
- **Auto-complete detection** — Numbers greyed out when all 9 placed
- **Timer** — Tracks your solve time
- **Keyboard support** — Arrow keys, 1-9, Backspace, Ctrl+Z, N for notes
- **Touch-friendly** — Large tap targets, responsive layout
- **Offline support** — Service worker caches all assets
- **Dark theme** — Easy on the eyes

## Controls

| Action | Touch/Click | Keyboard |
|--------|------------|----------|
| Select cell | Tap cell | Arrow keys |
| Enter number | Tap numpad | 1-9 |
| Erase | Tap ⌫ | Backspace/Delete |
| Undo | Tap ↩ | Ctrl+Z |
| Toggle notes | Tap ✏ | N |
| Hint | Tap 💡 | — |
