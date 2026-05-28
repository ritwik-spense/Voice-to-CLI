# Voice Input - VS Code / Kiro Extension

Press **Ctrl+Shift+Space** to dictate text into your editor or terminal. Recording stops automatically after 1.5 seconds of silence.

---

## Install

### 1. Install Sox

**Windows (PowerShell as Admin):**

```powershell
winget install sox
```

⚠️ **Important:** After installing sox on Windows, you must add it to your PATH manually:

```powershell
$soxPath = "C:\Users\$env:USERNAME\AppData\Local\Microsoft\WinGet\Packages\ChrisBagwell.SoX_Microsoft.Winget.Source_8wekyb3d8bbwe\sox-14.4.2"
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$soxPath", "User")
```

Then **restart your editor completely**.



**macOS:**

```bash
brew install sox
```

**Ubuntu:**

```bash
sudo apt install sox
```

### 2. Install extension

**Windows (PowerShell):**

```powershell
$env:VOICE_INPUT_KEY="API_KEY"; npm config set @ritwik-spense:registry https://npm.pkg.github.com; npm install -g @ritwik-spense/voice-input
```

**macOS / Ubuntu:**

```bash
VOICE_INPUT_KEY=YOUR_API_KEY npm config set @ritwik-spense:registry https://npm.pkg.github.com && npm install -g @ritwik-spense/voice-input
```

> Replace `YOUR_API_KEY` with the key provided by your team admin.

---

## Usage

> ⚠️ **Important:** The terminal must be focused (clicked on) before pressing the shortcut. If the terminal is not focused, voice input will not activate.

**Ctrl+Shift+Space** — start recording

Recording stops automatically after 1.5 seconds of silence, then transcribes and inserts text at your cursor (editor or terminal).

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
- English (`en`)
- Hindi (`hi`)
- Kannada (`kn`)
- Tamil (`ta`)
- Auto-detect (`auto`)

Non-English speech is translated to English by default. Set `voiceInput.translateToEnglish` to `false` to keep the original language.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Nothing happens on Ctrl+Shift+Space | Run command from palette: "Voice Input: Toggle Recording" |
| "Failed to start recording" | Ensure sox is installed and on PATH. Restart your editor after installing. |
| Recording works but no text appears | Check Output panel → "Voice Input" for errors |
| "STT server unreachable" | Check network connectivity to the STT server |
| "Recording too short" | Speak for at least 1 second before stopping |
This is the final package and let's publish it again.
---

## Uninstall

```bash
code --uninstall-extension spense.voice-input
```
