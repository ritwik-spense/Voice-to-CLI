# Voice Input - VS Code / Kiro Extension

Press **Ctrl+Shift+Space** to dictate text into your terminal. Recording stops automatically after 1.5 seconds of silence.

---
## Install

### 1. Install Sox

**Windows (PowerShell as Admin):**

```powershell
winget install sox
```

> No need to add sox to PATH — the extension auto-discovers it from WinGet and Program Files locations.

**macOS:**

```bash
brew install sox
```

**Ubuntu:**

```bash
sudo apt install sox
```

### 2. Ensure `code` or `kiro` is in your PATH

The installer needs the `code` (or `kiro`) CLI command available.

- **VS Code:** Open Command Palette (Ctrl+Shift+P) → "Shell Command: Install 'code' command in PATH"
- **Kiro:** Same process, or ensure the Kiro binary is in your PATH

Verify by running in a terminal:
```bash
code --version
```

### 3. Install extension

**Windows (PowerShell):**

```powershell
npm config set @ritwik-spense:registry https://npm.pkg.github.com --location=user; npm config set //npm.pkg.github.com/:_authToken=YOUR_TOKEN_HERE --location=user; npm install -g @ritwik-spense/voice-input
```

**macOS / Ubuntu:**

```bash
echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN_HERE" >> ~/.npmrc
npm config set @ritwik-spense:registry https://npm.pkg.github.com
sudo bash -c 'echo "//npm.pkg.github.com/:_authToken=YOUR_TOKEN_HERE" >> ~/.npmrc && npm config set @ritwik-spense:registry https://npm.pkg.github.com && npm install -g @ritwik-spense/voice-input'
```

### 4. Restart your editor

After installation, **fully close and reopen** VS Code or Kiro. The extension activates on startup — you should see a microphone icon (🎙️) in the bottom-right status bar.

### 5. Verify setup

Open Command Palette (Ctrl+Shift+P) → **"Voice Input: Check Setup"**

This checks sox installation, API key, and STT server connectivity all at once.

---

## Usage

**Ctrl+Shift+Space** — start recording (works in both editor and terminal)

Recording stops automatically after 1.5 seconds of silence, then transcribes and inserts text at your cursor.

- **In the terminal:** text is sent to the active terminal
- **No terminal open:** text is copied to clipboard

You can also press **Ctrl+Shift+Space** again to stop manually.

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `voiceInput.sttUrl` | — | STT server endpoint |
| `voiceInput.sttModel` | `deepdml/faster-whisper-large-v3-turbo-ct2` | STT model name |
| `voiceInput.language` | `en` | Language code (en, hi, kn, ta, or auto) |
| `voiceInput.translateToEnglish` | `true` | Translate non-English speech to English |
| `voiceInput.apiKey` | — | API key for authentication |
| `voiceInput.silenceDuration` | `1.5` | Seconds of silence before auto-stop |

Supported languages:
- English (`en`)
- Hindi (`hi`)
- Kannada (`kn`)
- Tamil (`ta`)
- Auto-detect (`auto`)

Non-English speech is translated to English by default. Set `voiceInput.translateToEnglish` to `false` to keep the original language.

## Troubleshooting

Run **"Voice Input: Check Setup"** from the Command Palette first — it diagnoses most issues automatically.

| Issue | Fix |
|-------|-----|
| Nothing happens on Ctrl+Shift+Space | Open Command Palette → "Voice Input: Toggle Recording". Check Output → "Voice Input" for errors. |
| No 🎙️ in status bar | Extension not activated. Restart editor. If still missing, reinstall with `npm install -g @ritwik-spense/voice-input` |
| "Failed to start recording" | Run "Voice Input: Check Setup" to verify sox is found. |
| Recording works but no text appears | Check Output panel → "Voice Input" for errors |
| "STT server unreachable" | Check network connectivity. Run "Voice Input: Check Setup" to test. |
| "Recording too short" | Speak for at least 1 second before stopping |
| Install says "code not found" | See step 2 above — add VS Code/Kiro to PATH |

---

## Uninstall

```bash
code --uninstall-extension spense.voice-input
```
