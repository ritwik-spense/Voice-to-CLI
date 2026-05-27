#!/usr/bin/env node
/**
 * Installs the Voice Input VS Code extension.
 * Run: npx @spense/voice-input
 * Or after npm install: voice-input-install
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const pkgDir = path.resolve(__dirname, "..");

// Build if out/ doesn't exist
if (!fs.existsSync(path.join(pkgDir, "out", "extension.js"))) {
  console.log("Building extension...");
  execSync("npm run compile", { cwd: pkgDir, stdio: "inherit" });
}

// Package .vsix if it doesn't exist
const vsixFiles = fs.readdirSync(pkgDir).filter((f) => f.endsWith(".vsix"));
let vsixPath;

if (vsixFiles.length === 0) {
  console.log("Packaging extension...");
  execSync("npx @vscode/vsce package --no-dependencies --allow-missing-repository", {
    cwd: pkgDir,
    stdio: "inherit",
  });
  const newVsix = fs.readdirSync(pkgDir).filter((f) => f.endsWith(".vsix"));
  vsixPath = path.join(pkgDir, newVsix[0]);
} else {
  vsixPath = path.join(pkgDir, vsixFiles[0]);
}

// Install into VS Code
console.log("\nInstalling extension into VS Code...");
try {
  execSync(`code --install-extension "${vsixPath}" --force`, { stdio: "inherit" });

  // Set API key if provided
  const apiKey = process.argv[2];
  if (apiKey) {
    const settingsPath = process.platform === "win32"
      ? path.join(process.env.APPDATA, "Code", "User", "settings.json")
      : process.platform === "darwin"
        ? path.join(process.env.HOME, "Library", "Application Support", "Code", "User", "settings.json")
        : path.join(process.env.HOME, ".config", "Code", "User", "settings.json");

    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } else {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    }
    settings["voiceInput.apiKey"] = apiKey;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log("\n✅ Voice Input extension installed with API key configured!");
  } else {
    console.log("\n✅ Voice Input extension installed!");
    console.log("\nSet your API key: Open VS Code Settings → search 'voiceInput' → set API Key");
  }

  console.log("\nUsage: Press Ctrl+Space to start/stop voice recording.");
} catch (e) {
  console.error("\n❌ Failed to install. Make sure 'code' is in your PATH.");
  console.error("   In VS Code: Cmd+Shift+P → 'Shell Command: Install code command in PATH'");
  process.exit(1);
}
