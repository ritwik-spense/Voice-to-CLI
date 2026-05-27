#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const pkgDir = path.resolve(__dirname, "..");
const vsixPath = path.join(pkgDir, "voice-input.vsix");

if (!fs.existsSync(vsixPath)) {
  console.error("❌ voice-input.vsix not found in package.");
  process.exit(1);
}

// Install into VS Code
console.log("Installing Voice Input extension...");
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
    console.log("\n✅ Voice Input installed with API key configured!");
  } else {
    console.log("\n✅ Voice Input installed!");
  }

  console.log("\nUsage: Press Ctrl+Space to start/stop voice recording.");
} catch (e) {
  console.error("\n❌ Failed to install. Make sure 'code' is in your PATH.");
  process.exit(1);
}
