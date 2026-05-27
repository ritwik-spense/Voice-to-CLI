#!/bin/bash
set -e

# ============================================================
# Package the VS Code extension for distribution
# ============================================================

cd "$(dirname "$0")/.."

echo "=== Installing dependencies ==="
npm install

echo "=== Compiling TypeScript ==="
npm run compile

echo "=== Packaging extension ==="
npx @vscode/vsce package --no-dependencies

echo ""
echo "✅ Extension packaged!"
echo "   File: $(ls *.vsix)"
echo ""
echo "Install with:"
echo "   code --install-extension $(ls *.vsix)"
