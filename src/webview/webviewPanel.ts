import * as vscode from "vscode";
import { getWebviewContent } from "./getWebviewContent";
import { handleMessage } from "./messageHandler";
import { getConfig } from "../config";
import { CapturedTerminal } from "../captureTerminal";

let currentPanel: vscode.WebviewPanel | undefined;

export function createOrShowPanel(
  extensionUri: vscode.Uri,
  capture: CapturedTerminal,
): vscode.WebviewPanel {
  const config = getConfig();

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    currentPanel.webview.html = getWebviewContent(
      currentPanel.webview,
      extensionUri,
      capture,
      config,
    );
    return currentPanel;
  }

  const panel = vscode.window.createWebviewPanel(
    "termsnap.preview",
    "TermSnap Preview",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "media", "webview"),
      ],
      retainContextWhenHidden: true,
    },
  );

  currentPanel = panel;

  panel.webview.html = getWebviewContent(
    panel.webview,
    extensionUri,
    capture,
    config,
  );

  panel.webview.onDidReceiveMessage((message) => handleMessage(message));

  panel.onDidDispose(() => {
    currentPanel = undefined;
  });

  return panel;
}
