# Voice Input — VS Code Extension

Press **Ctrl+Space** to dictate text into your editor or terminal.

---

## Install

### 1. Install Sox

**Windows:** [Download Sox](https://sourceforge.net/projects/sox/files/sox/) and add to PATH  
**macOS:** `brew install sox`

### 2. Install extension

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
