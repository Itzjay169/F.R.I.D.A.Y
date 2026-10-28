# F.R.I.D.A.Y. – Portable Laptop Migration & Zero-Software Guide

This guide explains how to transfer the **FRIDAY** folder to **any new Windows laptop** with **NO software installed** (no Node.js, no Python, no Git, no VS Code) and have it run immediately and smoothly for non-technical users.

---

## 🚀 How to Move FRIDAY to a New Laptop

### Method 1: Using a USB Flash Drive / External SSD (Fastest & Recommended)
1. Copy the entire `FRIDAY` folder from your current laptop to your USB flash drive.
2. Plug the USB flash drive into the new laptop.
3. Copy the `FRIDAY` folder to the Desktop or Documents folder on the new laptop.
4. Open the folder and double-click:
   ```cmd
   START_FRIDAY.bat
   ```
5. F.R.I.D.A.Y. will automatically configure everything and open your web browser to `http://localhost:5173/`.

---

### Method 2: Downloading from GitHub (Direct ZIP Download)
1. On the new laptop, open your web browser and go to:
   [https://github.com/Itzjay169/F.R.I.D.A.Y](https://github.com/Itzjay169/F.R.I.D.A.Y)
2. Click the green **Code** button and select **Download ZIP**.
3. Right-click the downloaded zip file and select **Extract All...** to extract the folder.
4. Open the extracted folder and double-click:
   ```cmd
   START_FRIDAY.bat
   ```
5. The automated bootstrapper will:
   - Detect that Node.js is not present on the new laptop.
   - Automatically download a self-contained portable Node.js LTS runtime into `.runtime/node/` (no admin rights or installer needed).
   - Set up your `.env` configuration file from `.env.example`.
   - Install required packages in the background (~30–60 seconds, first run only).
   - Automatically open `http://localhost:5173/` in your browser.

---

## ⚡ The Two Launchers Explained

| Launcher | When to Use | Requirements | What It Does |
| :--- | :--- | :--- | :--- |
| **`START_FRIDAY.bat`** *(Recommended)* | Normal operation with internet | Wi-Fi / Internet connection | Auto-downloads portable Node runtime if needed, installs dependencies, starts Vite dev server, and opens browser |
| **`START_STANDALONE.bat`** | Offline or instant 1-second preview | Zero software, zero internet | Uses Windows built-in PowerShell web server to host pre-compiled `dist/` bundle |

---

## 💡 Troubleshooting & FAQ for Non-Technical Users

1. **"Windows protected your PC" (SmartScreen blue banner):**
   - Click **More info**.
   - Click **Run anyway**.
   - *Why?* Windows displays this safety prompt for any newly copied `.bat` file that wasn't signed with a commercial Microsoft developer certificate.

2. **Does this install anything permanently on Windows?**
   - No. All runtime files are isolated inside the `FRIDAY\.runtime` folder. It makes no registry modifications and requires no administrator privileges.

3. **How do I stop F.R.I.D.A.Y.?**
   - Close your browser tab and close the black terminal window.

4. **Can I keep my data and notes?**
   - Yes! All paper portfolios, trade reviews, and journal entries are stored inside `FRIDAY\data\` and your browser's local storage.
