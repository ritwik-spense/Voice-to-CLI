# Voice Input — VS Code Extension

Press **Ctrl+Space** to dictate text directly into your editor.

## Prerequisites

- **sox** must be installed on your system:
  - **macOS**: `brew install sox`
  - **Ubuntu/Debian**: `sudo apt install sox`
  - **Windows**: Download from https://sox.sourceforge.net/ and add to PATH

- An OpenAI-compatible STT server must be running (configure the URL in settings)

## Setup

```bash
cd vscode-extension
npm install
npm run compile
```

## Configuration

In VS Code settings (`Ctrl+,`):

| Setting | Default | Description |
|---------|---------|-------------|
| `voiceInput.sttUrl` | `Customer Endpoint` | STT server endpoint |
| `voiceInput.sttModel` | `deepdml/faster-whisper-large-v3-turbo-ct2` | Model name |
| `voiceInput.language` | `en` | Language code |
| `voiceInput.apiKey` | *(empty)* | API key for authentication |

## Usage

1. Place cursor where you want text inserted
2. Press **Ctrl+Space** — status bar shows "Recording..."
3. Speak
4. Press **Ctrl+Space** again — transcribed text is inserted at cursor

If no editor is open, the text is copied to clipboard.

## License

MIT
