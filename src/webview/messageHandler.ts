import * as vscode from "vscode";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, unlinkSync } from "fs";
import { updateConfig } from "../config";

const execFileAsync = promisify(execFile);

interface SaveRequestMessage {
  type: "requestSave";
  requestId: string;
}
interface SaveMessage {
  type: "save";
  requestId: string;
  dataUrl: string;
}
interface CancelSaveMessage {
  type: "cancelSave";
  requestId: string;
}
interface CopyMessage {
  type: "copy";
  dataUrl: string;
}
interface ExportErrorMessage {
  type: "exportError";
  detail: string;
}
interface CopyTextMessage {
  type: "copyText";
  text: string;
}
interface SettingsChangedMessage {
  type: "settingsChanged";
  key: string;
  value: unknown;
}

type WebviewMessage =
  | SaveRequestMessage
  | SaveMessage
  | CancelSaveMessage
  | CopyMessage
  | CopyTextMessage
  | ExportErrorMessage
  | SettingsChangedMessage;

// The webview only receives an opaque request ID, never a filesystem URI.
const pendingSavePaths = new Map<string, vscode.Uri>();
const canceledSaveIds = new Set<string>();
let saveGeneration = 0;
export function clearPendingSaves(): void {
  pendingSavePaths.clear();
  canceledSaveIds.clear();
  saveGeneration++;
}

export async function handleMessage(
  message: WebviewMessage,
  panel: vscode.WebviewPanel,
): Promise<void> {
  switch (message.type) {
    case "requestSave":
      await requestSave(message.requestId, panel);
      break;
    case "save":
      await handleSave(message.requestId, message.dataUrl);
      break;
    case "cancelSave":
      pendingSavePaths.delete(message.requestId);
      canceledSaveIds.add(message.requestId);
      break;
    case "copy":
      await handleCopy(message.dataUrl);
      break;
    case "exportError":
      vscode.window.showErrorMessage(`TermSnap TextWrap: ${message.detail}`);
      break;
    case "copyText":
      await vscode.env.clipboard.writeText(message.text);
      vscode.window.showInformationMessage(
        "TermSnap TextWrap: Text copied to clipboard!",
      );
      break;
    case "settingsChanged":
      await updateConfig(message.key, message.value);
      break;
  }
}

async function requestSave(
  requestId: string,
  panel: vscode.WebviewPanel,
): Promise<void> {
  // The browser begins rendering before the dialog returns. A cancel discards
  // the rendered image; no disk write occurs unless the user chooses a path.
  const generation = saveGeneration;
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file("termsnap-textwrap.png"),
    filters: { "PNG Image": ["png"] },
  });
  // The panel could have been disposed/reloaded while the dialog was open.
  if (generation !== saveGeneration || canceledSaveIds.delete(requestId)) return;
  if (uri) pendingSavePaths.set(requestId, uri);
  await panel.webview.postMessage({
    type: "saveDestination",
    requestId,
    accepted: Boolean(uri),
  });
}

async function handleSave(requestId: string, dataUrl: string): Promise<void> {
  const uri = pendingSavePaths.get(requestId);
  pendingSavePaths.delete(requestId);
  if (!uri) return;
  const buffer = decodePngDataUrl(dataUrl);
  await vscode.workspace.fs.writeFile(uri, buffer);
  vscode.window.showInformationMessage(
    `TermSnap TextWrap: Screenshot saved to ${uri.fsPath}`,
  );
}

function decodePngDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid PNG data URL");
  return Buffer.from(match[1], "base64");
}

// Stream PNG bytes to the local graphical desktop rather than requiring a
// clipboard program inside the user's Dev Container.
function pipeToClipboard(command: string, args: string[], png: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (data: string) => { stderr += data.slice(0, 1000); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}: ${stderr}`));
    });
    child.stdin.on("error", () => { /* Process errors are handled above. */ });
    child.stdin.end(png);
  });
}

async function handleCopy(dataUrl: string): Promise<void> {
  const buffer = decodePngDataUrl(dataUrl);
  const tmpFile = join(tmpdir(), `termsnap-textwrap-${Date.now()}.png`);
  try {
    if (process.platform === "linux") {
      try {
        await pipeToClipboard("wl-copy", ["--type", "image/png"], buffer);
      } catch {
        await pipeToClipboard("xclip", ["-selection", "clipboard", "-t", "image/png", "-i"], buffer);
      }
    } else {
      writeFileSync(tmpFile, buffer);
      if (process.platform === "darwin") {
        await execFileAsync("osascript", [
          "-e",
          `set the clipboard to (read (POSIX file ${JSON.stringify(tmpFile)}) as «class PNGf»)`,
        ]);
      } else {
        // Windows PowerShell reads the PNG from disk into the clipboard.
        const escaped = tmpFile.replace(/'/g, "''");
        await execFileAsync("powershell", [
          "-NoProfile", "-Command",
          `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('${escaped}'))`,
        ]);
      }
    }
    vscode.window.showInformationMessage(
      "TermSnap TextWrap: Screenshot copied to clipboard!",
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `TermSnap TextWrap: Failed to copy image to clipboard. ${error}`,
    );
  } finally {
    if (process.platform !== "linux") {
      try {
        unlinkSync(tmpFile);
      } catch (error) {
        console.warn("TermSnap TextWrap: Failed to remove temporary PNG:", error);
      }
    }
  }
}
