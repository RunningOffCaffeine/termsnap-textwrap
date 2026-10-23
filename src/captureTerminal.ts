import * as vscode from "vscode";
import { execFile } from "child_process";
import { promisify } from "util";
import { getConfig } from "./config";

const execFileAsync = promisify(execFile);
const MAX_HTML_BYTES = 5 * 1024 * 1024;

export interface CapturedTerminal {
  text: string;
  /** Original xterm.js HTML. It is never inserted directly into the webview DOM. */
  html?: string;
}

/**
 * VS Code's API exposes text/plain only. On a local Linux desktop, use the
 * system clipboard to read text/html after the terminal's native HTML copy.
 * All commands use execFile (no shell expansion) and have limits/timeouts.
 * Remote extension hosts without access to the desktop clipboard gracefully
 * fall back to plain text.
 */
async function readClipboardHtml(): Promise<string | undefined> {
  if (process.platform !== "linux") {
    return undefined;
  }

  const readers: [string, string[]][] = [];
  if (
    process.env.WAYLAND_DISPLAY ||
    process.env.XDG_SESSION_TYPE === "wayland"
  ) {
    readers.push(["wl-paste", ["--no-newline", "--type", "text/html"]]);
  }
  // XWayland clipboard bridge is often available even on Wayland.
  if (process.env.DISPLAY) {
    readers.push([
      "xclip",
      ["-selection", "clipboard", "-out", "-t", "text/html"],
    ]);
  }
  if (!readers.length) {
    // e.g. a local environment with an unusual session configuration
    readers.push(["wl-paste", ["--no-newline", "--type", "text/html"]]);
    readers.push([
      "xclip",
      ["-selection", "clipboard", "-out", "-t", "text/html"],
    ]);
  }

  for (const [command, args] of readers) {
    try {
      const { stdout } = await execFileAsync(command, args, {
        encoding: "utf8",
        timeout: 2000,
        maxBuffer: MAX_HTML_BYTES,
        windowsHide: true,
      });
      // Reject stale/incompatible clipboard content. The HTML produced by
      // VS Code's xterm.js serialize addon contains a <pre> element.
      if (/<pre(?:\s|>)/i.test(stdout) && /<\/pre\s*>/i.test(stdout)) {
        return stdout;
      }
    } catch {
      // Missing utility, no HTML MIME type, or no clipboard access.
    }
  }
  return undefined;
}

export async function captureTerminalSelection(): Promise<
  CapturedTerminal | undefined
> {
  const preserveColors = getConfig().preserveTerminalColors;
  let html: string | undefined;

  if (preserveColors) {
    try {
      await vscode.commands.executeCommand(
        "workbench.action.terminal.copySelectionAsHtml",
      );
      // Let the desktop clipboard owner advertise the HTML MIME type.
      html = await readClipboardHtml();
      if (!html) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        html = await readClipboardHtml();
      }
    } catch {
      // Some terminal implementations don't implement HTML copying.
    }
  }

  // VS Code's HTML copy may provide an empty text/plain flavor. Copy plain
  // text separately AFTER reading HTML, so Copy Text always works as before.
  try {
    await vscode.commands.executeCommand(
      "workbench.action.terminal.copySelection",
    );
  } catch {
    vscode.window.showErrorMessage(
      "TermSnap: Could not copy the terminal selection.",
    );
    return undefined;
  }
  // Clipboard propagation can lag slightly behind VS Code's command.
  await new Promise((resolve) => setTimeout(resolve, 100));
  const text = await vscode.env.clipboard.readText();

  if (!text || text.trim().length === 0) {
    vscode.window.showErrorMessage(
      "TermSnap: No terminal text selected. Select text in the terminal first.",
    );
    return undefined;
  }

  if (preserveColors && !html) {
    vscode.window.showWarningMessage(
      "TermSnap: Terminal colors unavailable. Install wl-clipboard (Wayland) or xclip (X11) and run VS Code locally; capturing plain text instead.",
    );
  }
  return { text, html };
}
