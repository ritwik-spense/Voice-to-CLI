# Voice Input - VS Code Extension

Press **Ctrl+Space** to dictate text into your editor or terminal.

---

## Install

### 1. Install Sox

**Windows (PowerShell as Admin):** [Download Sox](https://sourceforge.net/projects/sox/files/sox/14.4.2/sox-14.4.2-win32.exe), install, then run:

```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files (x86)\sox-14-4-2", "Machine")
```

**macOS:** `brew install sox`

**Ubuntu:** `sudo apt install sox`

### 2. Install extension

**Windows (PowerShell):**

```powershell
$env:VOICE_INPUT_KEY="YOUR_API_KEY"; npm config set @ritwik-spense:registry https://npm.pkg.github.com; npm install -g @ritwik-spense/voice-input
```

**macOS / Ubuntu:**

```bash
VOICE_INPUT_KEY=YOUR_API_KEY npm config set @ritwik-spense:registry https://npm.pkg.github.com && npm install -g @ritwik-spense/voice-input
```

---

## Usage

**Ctrl+Space** - start recording

**Ctrl+Space** again - stop and insert transcribed text

---

## Uninstall

```bash
code --uninstall-extension spense.voice-input
```
