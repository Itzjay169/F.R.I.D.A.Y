# F.R.I.D.A.Y. – Portable Laptop Migration Guide

This guide explains how to take the **FRIDAY** folder to **any new Windows laptop** with **NO software installed** (no Node.js, no Python, no git) and have it run immediately.

---

## 🚀 How to Move FRIDAY to a New Laptop

1. **Copy the `FRIDAY` folder** onto a USB flash drive, external drive, or zip it and upload to Google Drive / OneDrive.
2. **Paste the `FRIDAY` folder** onto the new laptop (e.g. on Desktop or Documents).
3. **Double-click** one of the two launchers:

---

### Option 1: `START_STANDALONE.bat` (⚡ Instant 1-Second Launch)
- **Requirements**: Zero. Absolutely nothing to download or install.
- **How it works**: Uses Windows 10/11's built-in native PowerShell to host the pre-compiled `dist/` production bundle on port 5173.
- **Features**:
  - Automatically opens the default browser (Chrome / Edge / Firefox).
  - Fetches real-time market data from Finnhub directly.
  - Queries Google Gemini Flash directly for multi-agent synthesis.
  - Speaks replies using the browser's built-in Web Speech API.

---

### Option 2: `START_FRIDAY.bat` (🚀 Full Dev & Electron Launcher)
- **Requirements**: Only an active Internet connection.
- **How it works**:
  - Automatically checks if Node.js is installed on the machine.
  - **If Node.js is NOT installed**: It automatically downloads a self-contained portable Node.js release from official `nodejs.org` into `.runtime/node/` (no admin rights needed, no installers).
  - Automatically installs dependencies if `node_modules` was not copied.
  - Automatically copies `.env.example` to `.env`.
  - Starts the Vite server and launches F.R.I.D.A.Y. HUD.

---

## 🔒 Security & Privacy Notes
- Your free API keys (`FINNHUB_API_KEY`, `GEMINI_API_KEY`, `POLYGON_API_KEY`) are stored in `.env` and `.env.example`.
- Everything runs locally on `localhost`.
- No personal data or live broker credentials exist in this desk.
- Safety rule: `LIVE_TRADING=false` is enforced at all times.
