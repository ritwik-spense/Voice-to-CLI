#!/usr/bin/env node
const { execSync } = require("child_process");

const editors = ["code", "kiro"];

for (const editor of editors) {
  try {
    execSync(`${editor} --uninstall-extension spense.voice-input --force`, { stdio: "ignore" });
  } catch {}
}
