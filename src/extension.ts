import * as vscode from "vscode";
import * as http from "http";
import { spawn, ChildProcess } from "child_process";
import FormData from "form-data";

let recording = false;
let recProcess: ChildProcess | null = null;
let audioChunks: Buffer[] = [];
let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "voiceInput.toggle";
  setIdle();
  statusBar.show();

  const cmd = vscode.commands.registerCommand("voiceInput.toggle", toggleRecording);
  context.subscriptions.push(cmd, statusBar);
}

export function deactivate() {
  stopRecording();
}

function setIdle() {
  statusBar.text = "$(unmute) Voice";
  statusBar.tooltip = "Click or Ctrl+Space to start recording";
  statusBar.backgroundColor = undefined;
}

function setRecording() {
  statusBar.text = "$(pulse) Recording...";
  statusBar.tooltip = "Click or Ctrl+Space to stop";
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
  audioChunks = [];
  recording = true;
  setRecording();

  const isWin = process.platform === "win32";
  const cmd = isWin ? "sox" : "rec";
  const args = isWin
    ? ["-d", "-t", "wav", "-r", "16000", "-c", "1", "-b", "16", "-"]
    : ["-t", "wav", "-r", "16000", "-c", "1", "-b", "16", "-", "trim", "0"];

  try {
    recProcess = spawn(cmd, args, { stdio: ["ignore", "pipe", "ignore"] });

    recProcess.stdout?.on("data", (chunk: Buffer) => {
      audioChunks.push(chunk);
    });

    recProcess.on("error", (err) => {
      vscode.window.showErrorMessage(
        `Voice Input: Failed to start recording. Ensure 'sox' is installed. ${err.message}`
      );
      recording = false;
      setIdle();
    });

    recProcess.on("close", () => {
      recProcess = null;
    });
  } catch (e: any) {
    vscode.window.showErrorMessage(`Voice Input: ${e.message}`);
    recording = false;
    setIdle();
  }
}

function stopRecording(): Buffer {
  recording = false;
  setIdle();

  if (recProcess) {
    recProcess.kill("SIGTERM");
    recProcess = null;
  }

  return Buffer.concat(audioChunks);
}

async function stopAndTranscribe() {
  const wavBuffer = stopRecording();

  if (wavBuffer.length < 1000) {
    vscode.window.showWarningMessage("Voice Input: Recording too short");
    return;
  }

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
    if (text) {
      insertText(text);
    } else {
      vscode.window.showWarningMessage("Voice Input: No speech detected");
    }
  } catch (e: any) {
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
          reject(new Error(`STT server returned ${res.statusCode}`));
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
  const editor = vscode.window.activeTextEditor;

  if (terminal && !editor?.document.uri.scheme) {
    terminal.sendText(text, false);
  } else if (editor) {
    editor.edit((editBuilder) => {
      if (editor.selection.isEmpty) {
        editBuilder.insert(editor.selection.active, text);
      } else {
        editBuilder.replace(editor.selection, text);
      }
    });
  } else if (terminal) {
    terminal.sendText(text, false);
  } else {
    vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage(`Voice Input: Copied to clipboard — "${text}"`);
  }
}
