#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const pkgDir = path.resolve(__dirname, "..");
const vsixPath = path.join(pkgDir, "voice-input.vsix");

if (!fs.existsSync(vsixPath)) {
  console.log("⚠️  voice-input.vsix not found. Skipping extension install.");
  process.exit(0);
}

console.log("Installing Voice Input extension...");

// In WSL, VS Code CLI can't read from the Linux filesystem (UNC paths fail).
// Copy the VSIX to a Windows-accessible temp dir first.
let installPath = vsixPath;
if (isWSL()) {
  try {
    const winTemp = execSync("cmd.exe /c echo %TEMP%", { encoding: "utf8", timeout: 5000 }).trim().replace(/\r/g, "");
    const wslTemp = execSync(`wslpath -u "${winTemp}"`, { encoding: "utf8", timeout: 3000 }).trim();
    const destFile = path.join(wslTemp, "voice-input.vsix");
    fs.copyFileSync(vsixPath, destFile);
    installPath = winTemp + "\\voice-input.vsix";
  } catch (e) {
    // Fallback: try wslpath -w directly (works if vsix is on /mnt/c)
    try {
      installPath = execSync(`wslpath -w "${vsixPath}"`, { encoding: "utf8", timeout: 3000 }).trim();
    } catch {}
  }
}

const editors = ["code", "kiro"];
let installed = false;
let installedEditors = [];

for (const editor of editors) {
  try {
    execSync(`${editor} --install-extension "${installPath}" --force`, { stdio: "inherit" });
    installed = true;
    installedEditors.push(editor);
  } catch {}
}

if (!installed) {
  console.error("");
  console.error("❌ Could not install extension automatically.");
  console.error("   Neither 'code' nor 'kiro' was found in your PATH.");
  console.error("");
  console.error("   Fix: Open VS Code → Extensions → ⋯ → Install from VSIX");
  console.error(`   VSIX location: ${vsixPath}`);
  console.error("");
  process.exit(1);
}

// Set API key in settings for all installed editors
const apiKey = process.env.VOICE_INPUT_KEY;
if (apiKey) {
  for (const settingsPath of getSettingsPaths(installedEditors)) {
    try {
      let settings = {};
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      } else {
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      }
      settings["voiceInput.apiKey"] = apiKey;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch {}
  }
  console.log("\n✅ Voice Input installed with API key configured!");
} else {
  console.log("\n✅ Voice Input installed!");
  console.log("   Set your API key: Settings → voiceInput.apiKey");
}
console.log("   Restart your editor, then press Ctrl+Shift+Space to record.");

function isWSL() {
  try { return fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft"); }
  catch { return false; }
}

function getSettingsPaths(editors) {
  const paths = [];
  const dirNames = { code: "Code", kiro: "Kiro" };
  for (const editor of editors) {
    const dir = dirNames[editor] || "Code";
    if (process.platform === "win32") {
      paths.push(path.join(process.env.APPDATA, dir, "User", "settings.json"));
    } else if (process.platform === "darwin") {
      paths.push(path.join(process.env.HOME, "Library", "Application Support", dir, "User", "settings.json"));
    } else if (isWSL()) {
      try {
        const winAppData = execSync("cmd.exe /c echo %APPDATA%", { encoding: "utf8", timeout: 5000 }).trim().replace(/\r/g, "");
        const wslAppData = execSync(`wslpath -u "${winAppData}"`, { encoding: "utf8", timeout: 3000 }).trim();
        paths.push(path.join(wslAppData, dir, "User", "settings.json"));
      } catch {}
    } else {
      paths.push(path.join(process.env.HOME, ".config", dir, "User", "settings.json"));
    }
  }
  return paths;
}
