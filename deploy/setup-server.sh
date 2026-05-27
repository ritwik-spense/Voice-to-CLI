#!/bin/bash
set -e

# ============================================================
# Voice Input STT Server — Production Setup Script
# Run this on your server (65.0.42.25 or wherever you host)
# ============================================================

DOMAIN="stt.yourcompany.com"  # ← Change this to your actual domain
EMAIL="admin@yourcompany.com" # ← Change this for Let's Encrypt

echo "=== Installing dependencies ==="
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx python3-pip

echo "=== Installing Python deps for auth proxy ==="
pip3 install flask requests gunicorn

echo "=== Setting up auth proxy ==="
sudo mkdir -p /opt/voice-input
sudo cp auth-proxy.py /opt/voice-input/
sudo cp voice-input-proxy.service /etc/systemd/system/

echo "=== Starting auth proxy service ==="
sudo systemctl daemon-reload
sudo systemctl enable voice-input-proxy
sudo systemctl start voice-input-proxy

echo "=== Setting up nginx ==="
sudo cp nginx-stt.conf /etc/nginx/sites-available/stt
sudo ln -sf /etc/nginx/sites-available/stt /etc/nginx/sites-enabled/stt
sudo rm -f /etc/nginx/sites-enabled/default

# Replace domain placeholder
sudo sed -i "s/stt.yourcompany.com/$DOMAIN/g" /etc/nginx/sites-available/stt

echo "=== Getting TLS certificate ==="
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"

echo "=== Restarting nginx ==="
sudo nginx -t
sudo systemctl restart nginx

echo ""
echo "✅ Done! Your STT endpoint is live at:"
echo "   https://$DOMAIN/v1/audio/transcriptions"
echo ""
echo "Tell your team to set in VS Code settings:"
echo "   voiceInput.sttUrl = https://$DOMAIN/v1/audio/transcriptions"
echo "   voiceInput.apiKey = sk-spense-93b10b0892fc4c1043aae0f74b1fe8a99b47585fda34e9b627ae43a4ca32a08c"
