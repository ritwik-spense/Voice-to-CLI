# Production Deployment Guide

## Architecture

```
Team's VS Code (Ctrl+Space)
    │
    │ HTTPS + Bearer token
    ▼
┌─────────────────────────┐
│  Nginx (TLS + 50r/min)  │  :443
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Auth Proxy (Flask)     │  :8080
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Faster-Whisper Server  │  :9000
└─────────────────────────┘
```

## Server Setup (one-time)

1. Point your domain DNS (e.g., `stt.yourcompany.com`) to your server IP
2. SSH into the server:

```bash
cd deploy/
# Edit setup-server.sh — change DOMAIN and EMAIL at the top
chmod +x setup-server.sh
./setup-server.sh
```

This installs nginx, gets a TLS cert, starts the auth proxy as a systemd service.

3. Make sure your Whisper server is running on port 9000.

## Package the Extension

```bash
chmod +x deploy/package-extension.sh
./deploy/package-extension.sh
```

This produces `voice-input-0.1.0.vsix`.

## Distribute to Team

Share the `.vsix` file + these instructions:

### For team members:

1. Install the extension:
   ```
   code --install-extension voice-input-0.1.0.vsix
   ```

2. Open VS Code Settings (`Ctrl+,`) and set:
   - `voiceInput.sttUrl` → `https://stt.yourcompany.com/v1/audio/transcriptions`
   - `voiceInput.apiKey` → (the key you share with them)

3. Press **Ctrl+Space** in the terminal to start/stop voice input.

## Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `voiceInput.sttUrl` | `http://65.0.42.25:9000/v1/audio/transcriptions` | STT endpoint |
| `voiceInput.sttModel` | `deepdml/faster-whisper-large-v3-turbo-ct2` | Whisper model |
| `voiceInput.language` | `en` | Language (`en`, `hi`, `kn`, `ta`, `auto`) |
| `voiceInput.translateToEnglish` | `true` | Translate Hindi/Kannada/Tamil → English |
| `voiceInput.apiKey` | (empty) | Required API key |

## Monitoring

Check auth proxy status:
```bash
sudo systemctl status voice-input-proxy
sudo journalctl -u voice-input-proxy -f
```

Check nginx:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Rotate API Key

1. Generate new key: `openssl rand -hex 32`
2. Update on server: edit `/etc/systemd/system/voice-input-proxy.service` → `Environment=VALID_API_KEY=...`
3. Restart: `sudo systemctl restart voice-input-proxy`
4. Tell team to update their VS Code setting
