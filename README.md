# Voice Input — VS Code Extension

Press **Ctrl+Space** to dictate text into your editor or terminal.

---

## Install

### 1. Install Sox

**Windows (PowerShell):** [Download Sox](https://sourceforge.net/projects/sox/files/sox/) and add to PATH  
**macOS:** `brew install sox`  
**Ubuntu:** `sudo apt install sox`

### 2. Install extension

**Windows (PowerShell):**
```powershell
npm config set @ritwik-spense:registry https://npm.pkg.github.com
npx @ritwik-spense/voice-input YOUR_API_KEY
```

**macOS / Ubuntu:**
```bash
npm config set @ritwik-spense:registry https://npm.pkg.github.com && npx @ritwik-spense/voice-input YOUR_API_KEY
```

---

## Usage

**Ctrl+Space** — start recording  
**Ctrl+Space** again — stop and insert transcribed text

---

## Uninstall

```bash
code --uninstall-extension spense.voice-input
```
