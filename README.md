# Voice Input — VS Code Extension

Press **Ctrl+Space** to dictate text into your editor or terminal.

---

## Install

### 1. Install Sox

**Windows:** [Download Sox](https://sourceforge.net/projects/sox/files/sox/) and add to PATH  
**macOS:** `brew install sox`

### 2. Configure npm for GitHub Packages

Add to `~/.npmrc`:
```
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
@ritwik-spense:registry=https://npm.pkg.github.com
```

### 3. Install extension

```bash
npx @ritwik-spense/voice-input
```

### 4. Set API key

VS Code Settings → search `voiceInput` → set **API Key**

---

## Usage

**Ctrl+Space** — start recording  
**Ctrl+Space** again — stop and insert transcribed text

---

## Uninstall

```bash
code --uninstall-extension spense.voice-input
```
