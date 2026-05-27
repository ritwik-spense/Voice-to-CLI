# @spense/voice-input

VS Code extension for voice-to-text input. Press **Ctrl+Space** to dictate.

## Publishing to GitHub Packages

### One-time setup (you, the publisher):

1. Create a GitHub Personal Access Token with `write:packages` scope
2. Login to npm with GitHub registry:
   ```bash
   npm login --registry=https://npm.pkg.github.com
   # Username: your-github-username
   # Password: your-personal-access-token
   ```

3. Publish:
   ```bash
   cd vscode-extension
   npm publish
   ```

### For your team (installing):

1. Create a `.npmrc` in their home directory (`~/.npmrc`):
   ```
   //npm.pkg.github.com/:_authToken=THEIR_GITHUB_TOKEN
   @spense:registry=https://npm.pkg.github.com
   ```
   (Token needs `read:packages` scope)

2. Install:
   ```bash
   npx @spense/voice-input
   ```

   This builds, packages, and installs the extension into VS Code automatically.

3. Configure in VS Code Settings (`Ctrl+,`):
   - `voiceInput.apiKey` → the shared API key

4. Use: **Ctrl+Space** to start/stop recording.

## Prerequisites

- `sox` installed: `brew install sox` (Mac) / `sudo apt install sox` (Linux)
- Node.js 18+

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `voiceInput.sttUrl` | `http://65.0.42.25:9000/v1/audio/transcriptions` | STT endpoint |
| `voiceInput.sttModel` | `deepdml/faster-whisper-large-v3-turbo-ct2` | Whisper model |
| `voiceInput.language` | `en` | Language (`en`, `hi`, `kn`, `ta`, `auto`) |
| `voiceInput.translateToEnglish` | `true` | Translate to English |
| `voiceInput.apiKey` | (empty) | Required API key |
