import * as vscode from "vscode";
import * as http from "http";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn, execSync, ChildProcess } from "child_process";
import FormData from "form-data";

let resolvedSoxPath: string | null = null;

function isWSL(): boolean {
  try {
    return fs.readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch { return false; }
}

function findSoxInDir(base: string): string | null {
  // Search for sox.exe recursively up to 3 levels deep in a directory
  try {
    if (!fs.existsSync(base)) { return null; }
    const search = (dir: string, depth: number): string | null => {
      if (depth > 3) { return null; }
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory() && entry.name.toLowerCase() === "sox.exe") {
            return path.join(dir, entry.name);
          }
          if (entry.isDirectory()) {
            const found = search(path.join(dir, entry.name), depth + 1);
            if (found) { return found; }
          }
        }
      } catch {}
      return null;
    };
    return search(base, 0);
  } catch {}
  return null;
}

function findSoxPath(): string {
  if (resolvedSoxPath) { return resolvedSoxPath; }

  const isWin = process.platform === "win32";

  if (isWin) {
    // 1. Check PATH
    try {
      const found = execSync("where.exe sox", { encoding: "utf8" }).trim().split(/\r?\n/)[0];
      if (found) { resolvedSoxPath = found; log.appendLine(`Sox found via PATH: ${found}`); return found; }
    } catch {}

    // 2. Search WinGet packages
    const userProfile = process.env.USERPROFILE || process.env.HOME || "";
    const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, "AppData", "Local");
    const winGetBase = path.join(localAppData, "Microsoft", "WinGet", "Packages");
    try {
      if (fs.existsSync(winGetBase)) {
        for (const d of fs.readdirSync(winGetBase)) {
          if (d.toLowerCase().includes("sox")) {
            const found = findSoxInDir(path.join(winGetBase, d));
            if (found) { resolvedSoxPath = found; log.appendLine(`Sox found (WinGet): ${found}`); return found; }
          }
        }
      }
    } catch {}

    // 3. Search Program Files
    const programDirs = [
      process.env.ProgramFiles || "C:\\Program Files",
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
    ];
    for (const pf of programDirs) {
      try {
        if (!fs.existsSync(pf)) { continue; }
        for (const d of fs.readdirSync(pf)) {
          if (d.toLowerCase().includes("sox")) {
            const found = findSoxInDir(path.join(pf, d));
            if (found) { resolvedSoxPath = found; log.appendLine(`Sox found (Program Files): ${found}`); return found; }
          }
        }
      } catch {}
    }

    resolvedSoxPath = "sox";
    return "sox";
  }

  // WSL: prefer Windows sox.exe (ALSA doesn't work in WSL2)
  if (isWSL()) {
    log.appendLine("WSL detected, searching for Windows sox.exe");

    // Resolve the actual Windows user's LOCALAPPDATA via cmd.exe
    let wslBase: string | null = null;
    try {
      const winLocalAppData = execSync("cmd.exe /c echo %LOCALAPPDATA%", { encoding: "utf8", timeout: 5000 }).trim().replace(/\r/g, "");
      wslBase = execSync(`wslpath -u "${winLocalAppData}"`, { encoding: "utf8", timeout: 3000 }).trim();
    } catch (e: any) { log.appendLine(`WSL cmd.exe lookup failed: ${e.message}`); }

    // Build list of candidate WinGet package dirs
    const candidates: string[] = [];
    if (wslBase) { candidates.push(path.join(wslBase, "Microsoft", "WinGet", "Packages")); }

    // Also try common /mnt/c/Users/*/AppData paths in case cmd.exe approach failed
    try {
      const usersDir = "/mnt/c/Users";
      if (fs.existsSync(usersDir)) {
        for (const u of fs.readdirSync(usersDir)) {
          if (u === "Public" || u === "Default" || u === "Default User" || u === "All Users") { continue; }
          const candidate = path.join(usersDir, u, "AppData", "Local", "Microsoft", "WinGet", "Packages");
          if (!candidates.includes(candidate)) { candidates.push(candidate); }
        }
      }
    } catch {}

    for (const base of candidates) {
      try {
        if (!fs.existsSync(base)) { continue; }
        for (const d of fs.readdirSync(base)) {
          if (d.toLowerCase().includes("sox")) {
            const found = findSoxInDir(path.join(base, d));
            if (found) { resolvedSoxPath = found; log.appendLine(`Sox found (WSL): ${found}`); return found; }
          }
        }
      } catch {}
    }

    // Also check Program Files via /mnt/c
    const pfDirs = ["/mnt/c/Program Files", "/mnt/c/Program Files (x86)"];
    for (const pf of pfDirs) {
      try {
        if (!fs.existsSync(pf)) { continue; }
        for (const d of fs.readdirSync(pf)) {
          if (d.toLowerCase().includes("sox")) {
            const found = findSoxInDir(path.join(pf, d));
            if (found) { resolvedSoxPath = found; log.appendLine(`Sox found (WSL Program Files): ${found}`); return found; }
          }
        }
      } catch {}
    }
  }

  // Linux / macOS — check if sox is available natively
  try {
    execSync("which sox", { encoding: "utf8" });
    resolvedSoxPath = "sox";
    return "sox";
  } catch {}

  log.appendLine("Sox NOT FOUND");
  resolvedSoxPath = "sox";
  return "sox";
}

let recording = false;
let recProcess: ChildProcess | null = null;
let monProcess: ChildProcess | null = null;
let tempFile = "";
let statusBar: vscode.StatusBarItem;
let terminalFocused = false;
let recordingTerminal: vscode.Terminal | undefined;
const log = vscode.window.createOutputChannel("Voice Input");

export function activate(context: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "voiceInput.toggle";
  setIdle();
  statusBar.show();

  vscode.window.onDidChangeActiveTerminal((t) => { if (t) terminalFocused = true; });
  vscode.window.onDidChangeActiveTextEditor((e) => { if (e) terminalFocused = false; });
  vscode.window.onDidChangeTextEditorSelection(() => { terminalFocused = false; });

  const cmd = vscode.commands.registerCommand("voiceInput.toggle", () => toggleRecording());
  const termCmd = vscode.commands.registerCommand("voiceInput.toggleTerminal", () => {
    terminalFocused = true;
    toggleRecording();
  });
  const checkCmd = vscode.commands.registerCommand("voiceInput.checkSetup", checkSetup);
  context.subscriptions.push(cmd, termCmd, checkCmd, statusBar);
}

async function checkSetup() {
  log.show(true);
  log.appendLine("=== Voice Input: Setup Check ===");

  // 1. Check sox
  let soxOk = false;
  try {
    const soxCmd = findSoxPath();
    log.appendLine(`✓ Sox path: ${soxCmd}`);
    try {
      const version = execSync(`"${soxCmd}" --version`, { encoding: "utf8", timeout: 5000 }).trim();
      log.appendLine(`✓ Sox version: ${version}`);
      soxOk = true;
    } catch {
      // sox --version may fail but sox might still work (some builds)
      soxOk = soxCmd !== "sox" || process.platform !== "win32";
      log.appendLine(soxOk ? `⚠ Sox found at ${soxCmd} but --version failed (may still work)` : "✗ Sox not found");
    }
  } catch (e: any) {
    log.appendLine(`✗ Sox error: ${e.message}`);
  }

  // 2. Check API key
  const config = vscode.workspace.getConfiguration("voiceInput");
  const apiKey = config.get<string>("apiKey", "") || "sk-c05446ce3a3efde3783b67f5725b73867763f7ad0c9f1737";
  if (config.get<string>("apiKey", "")) {
    log.appendLine("✓ API key configured in settings");
  } else {
    log.appendLine("⚠ No API key in settings (using built-in fallback)");
  }

  // 3. Check STT server
  const sttUrl = config.get<string>("sttUrl", "");
  try {
    const parsed = new URL(sttUrl);
    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    await new Promise<void>((resolve, reject) => {
      const req = http.get(baseUrl, { timeout: 5000 }, (res) => {
        log.appendLine(`✓ STT server reachable (${baseUrl} → HTTP ${res.statusCode})`);
        res.resume();
        resolve();
      });
      req.on("error", (e) => { reject(e); });
      req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    });
  } catch (e: any) {
    log.appendLine(`✗ STT server unreachable (${sttUrl}): ${e.message}`);
  }

  // Summary
  log.appendLine("=== Check Complete ===");
  if (soxOk) {
    vscode.window.showInformationMessage("Voice Input: Setup looks good! Check Output panel for details.");
  } else {
    vscode.window.showWarningMessage("Voice Input: Sox not found. Install sox and restart your editor.");
  }
}

export function deactivate() {
  if (recProcess) { recProcess.kill("SIGTERM"); recProcess = null; }
  if (monProcess) { monProcess.kill("SIGTERM"); monProcess = null; }
}

function setIdle() {
  statusBar.text = "$(unmute) Voice";
  statusBar.tooltip = "Click or Ctrl+Shift+Space to toggle recording";
  statusBar.backgroundColor = undefined;
}

function setRecording() {
  statusBar.text = "$(pulse) Recording...";
  statusBar.tooltip = "Click or Ctrl+Shift+Space to stop";
  statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
}

async function toggleRecording() {
  if (recording) {
    await stopAndTranscribe();
  } else {
    startRecording();
  }
}

function startRecording() {
  recording = true;
  setRecording();
  recordingTerminal = vscode.window.activeTerminal;

  const config = vscode.workspace.getConfiguration("voiceInput");
  const silenceDuration = config.get<number>("silenceDuration", 1.5);

  tempFile = path.join(os.tmpdir(), `voice-input-${Date.now()}.wav`);
  const cmd = findSoxPath();
  const useWinSox = process.platform !== "win32" && cmd.endsWith("sox.exe");
  const useWaveaudio = process.platform === "win32" || useWinSox;

  // Windows sox.exe needs a Windows-style path for the output file
  let soxTempFile = tempFile;
  if (useWinSox) {
    try {
      const winTmp = execSync("cmd.exe /c echo %TEMP%", { encoding: "utf8", timeout: 3000 }).trim().replace(/\r/g, "");
      soxTempFile = winTmp + "\\voice-input-" + Date.now() + ".wav";
      // Update tempFile to the WSL-accessible path for reading later
      const wslTmp = execSync(`wslpath -u "${winTmp}"`, { encoding: "utf8", timeout: 3000 }).trim();
      tempFile = path.join(wslTmp, path.basename(soxTempFile));
    } catch (e: any) {
      log.appendLine(`Failed to resolve Windows temp path: ${e.message}`);
    }
  }
  log.appendLine(`Sox resolved: ${cmd}, useWaveaudio: ${useWaveaudio}, tempFile: ${tempFile}, soxTempFile: ${soxTempFile}`);

  // Record to file AND pipe raw PCM to stdout for silence detection
  const inputArgs = useWaveaudio
    ? ["-t", "waveaudio", "default"]
    : process.platform === "darwin"
      ? ["-t", "coreaudio", "default"]
      : ["-t", "alsa", "default"];
  const args = [...inputArgs, "-t", "wav", useWaveaudio ? soxTempFile : tempFile];

  try {
    recProcess = spawn(cmd, args, { stdio: ["ignore", "ignore", "ignore"] });

    recProcess.on("error", (err) => {
      vscode.window.showErrorMessage(
        `Voice Input: Failed to start recording. Ensure 'sox' is installed. ${err.message}`
      );
      recording = false;
      setIdle();
    });

    recProcess.on("close", () => {
      recProcess = null;
      // Sox exited on its own — trigger transcription if still in recording state
      if (recording) {
        recording = false;
        stopAndTranscribe();
      }
    });

    // Silence detection: spawn a second sox process that reads from the same
    // input and outputs raw PCM to stdout for level analysis
    const monArgs = useWaveaudio
      ? ["-t", "waveaudio", "default", "-t", "raw", "-r", "16000", "-c", "1", "-b", "16", "-e", "signed-integer", "-"]
      : process.platform === "darwin"
        ? ["-t", "coreaudio", "default", "-t", "raw", "-r", "16000", "-c", "1", "-b", "16", "-e", "signed-integer", "-"]
        : ["-t", "alsa", "default", "-t", "raw", "-r", "16000", "-c", "1", "-b", "16", "-e", "signed-integer", "-"];

    monProcess = spawn(cmd, monArgs, { stdio: ["ignore", "pipe", "ignore"] });

    let speechDetected = false;
    let silentSince = Date.now();
    const THRESHOLD = 500; // amplitude threshold for "silence"
    const CHECK_BYTES = 3200; // 100ms of 16kHz 16-bit mono
    let buf = Buffer.alloc(0);

    monProcess.stdout?.on("data", (chunk: Buffer) => {
      if (!recording) {
        monProcess?.kill();
        return;
      }

      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= CHECK_BYTES) {
        const block = buf.subarray(0, CHECK_BYTES);
        buf = buf.subarray(CHECK_BYTES);

        // Calculate RMS amplitude
        let sum = 0;
        for (let i = 0; i < block.length; i += 2) {
          const sample = block.readInt16LE(i);
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / (block.length / 2));

        if (rms > THRESHOLD) {
          speechDetected = true;
          silentSince = Date.now();
        } else if (speechDetected && Date.now() - silentSince >= silenceDuration * 1000) {
          // Silence detected after speech — stop recording
          log.appendLine(`Auto-stop: ${silenceDuration}s silence detected`);
          monProcess?.kill();
          stopAndTranscribe();
          return;
        }
      }
    });

    monProcess.on("error", () => {}); // ignore monitor errors

  } catch (e: any) {
    vscode.window.showErrorMessage(`Voice Input: ${e.message}`);
    recording = false;
    setIdle();
  }
}

function stopRecording(): Promise<Buffer> {
  recording = false;
  setIdle();

  if (monProcess) {
    monProcess.kill("SIGTERM");
    monProcess = null;
  }

  return new Promise((resolve) => {
    if (!recProcess) {
      setTimeout(() => resolve(readTempFile()), 200);
      return;
    }
    const proc = recProcess;
    recProcess = null;
    proc.on("close", () => {
      setTimeout(() => resolve(readTempFile()), 200);
    });
    proc.kill("SIGTERM");
  });
}

function readTempFile(): Buffer {
  try {
    if (tempFile && fs.existsSync(tempFile)) {
      const buf = fs.readFileSync(tempFile);
      fs.unlinkSync(tempFile);
      return buf;
    }
  } catch {}
  return Buffer.alloc(0);
}

async function stopAndTranscribe() {
  const wavBuffer = await stopRecording();

  if (wavBuffer.length < 1000) {
    vscode.window.showWarningMessage("Voice Input: Recording too short");
    return;
  }

  log.appendLine(`Recording stopped. Buffer size: ${wavBuffer.length} bytes`);
  statusBar.text = "$(sync~spin) Transcribing...";

  const config = vscode.workspace.getConfiguration("voiceInput");
  const sttUrl = config.get<string>("sttUrl", "");
  const sttModel = config.get<string>("sttModel", "deepdml/faster-whisper-large-v3-turbo-ct2");
  const language = config.get<string>("language", "en");
  const translateToEnglish = config.get<boolean>("translateToEnglish", true);
  const apiKey = config.get<string>("apiKey", "") || "sk-c05446ce3a3efde3783b67f5725b73867763f7ad0c9f1737";

  if (!apiKey) {
    vscode.window.showErrorMessage(
      "Voice Input: API key required. Set it in Settings → voiceInput.apiKey"
    );
    setIdle();
    return;
  }

  try {
    const text = await transcribe(wavBuffer, sttUrl, sttModel, language, apiKey, translateToEnglish);
    log.appendLine(`Transcription result: "${text}"`);
    if (text) {
      insertText(text);
    } else {
      vscode.window.showWarningMessage("Voice Input: No speech detected");
    }
  } catch (e: any) {
    log.appendLine(`Transcription error: ${e.message}`);
    vscode.window.showErrorMessage(`Voice Input: ${e.message}`);
  } finally {
    setIdle();
  }
}

function transcribe(
  wav: Buffer,
  url: string,
  model: string,
  language: string,
  apiKey: string,
  translate: boolean
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", wav, { filename: "audio.wav", contentType: "audio/wav" });
    form.append("model", model);
    form.append("language", language);
    if (translate) {
      form.append("task", "translate");
    }

    const parsed = new URL(url);
    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: "POST",
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 15000,
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new Error("Invalid API key. Check voiceInput.apiKey in settings."));
        } else if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(body).text?.trim() || "");
          } catch {
            reject(new Error("Invalid response from STT server"));
          }
        } else {
          reject(new Error(`STT server returned ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", (e) => reject(new Error(`STT server unreachable: ${e.message}`)));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("STT request timed out"));
    });

    form.pipe(req);
  });
}

function insertText(text: string) {
  const terminal = recordingTerminal || vscode.window.activeTerminal;

  if (terminal) {
    terminal.sendText(text, false);
  } else {
    vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage(`Voice Input: Copied to clipboard — "${text}"`);
  }
}
