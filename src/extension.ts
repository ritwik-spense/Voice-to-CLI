import * as vscode from "vscode";
import * as http from "http";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";
import FormData from "form-data";

let recording = false;
let recProcess: ChildProcess | null = null;
let monProcess: ChildProcess | null = null;
let tempFile = "";
let statusBar: vscode.StatusBarItem;
const log = vscode.window.createOutputChannel("Voice Input");

export function activate(context: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "voiceInput.toggle";
  setIdle();
  statusBar.show();

  const cmd = vscode.commands.registerCommand("voiceInput.toggle", toggleRecording);
  context.subscriptions.push(cmd, statusBar);
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

  const config = vscode.workspace.getConfiguration("voiceInput");
  const silenceDuration = config.get<number>("silenceDuration", 1.5);

  tempFile = path.join(os.tmpdir(), `voice-input-${Date.now()}.wav`);
  const isWin = process.platform === "win32";
  const cmd = "sox";

  // Record to file AND pipe raw PCM to stdout for silence detection
  const args = isWin
    ? ["-t", "waveaudio", "default", "-t", "wav", tempFile]
    : ["-t", "alsa", "default", "-t", "wav", tempFile];

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
    const monArgs = isWin
      ? ["-t", "waveaudio", "default", "-t", "raw", "-r", "16000", "-c", "1", "-b", "16", "-e", "signed-integer", "-"]
      : ["-t", "alsa", "default", "-t", "raw", "-r", "16000", "-c", "1", "-b", "16", "-e", "signed-integer", "-"];

    monProcess = spawn(cmd, monArgs, { stdio: ["ignore", "pipe", "ignore"] });

    let speechDetected = false;
    let silentSince = Date.now();
    const THRESHOLD = 500; // amplitude threshold for "silence"
    const CHECK_BYTES = 3200; // 100ms of 16kHz 16-bit mono
    let buf = Buffer.alloc(0);

    monProcess.stdout?.on("data", (chunk: Buffer) => {
      if (!recording) {
        monProcess.kill();
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
          monProcess.kill();
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
  const sttUrl = config.get<string>("sttUrl", "http://65.0.42.25:9000/v1/audio/transcriptions");
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
  const terminal = vscode.window.activeTerminal;

  if (terminal) {
    terminal.sendText(text, false);
  } else {
    vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage(`Voice Input: Copied to clipboard — "${text}"`);
  }
}
