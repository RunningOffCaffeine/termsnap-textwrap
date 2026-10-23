import * as vscode from "vscode";
import { captureTerminalSelection } from "./captureTerminal";
import { createOrShowPanel } from "./webview/webviewPanel";

export function activate(context: vscode.ExtensionContext) {
  const captureCommand = vscode.commands.registerCommand(
    "termsnap.capture",
    async () => {
      const capture = await captureTerminalSelection();
      if (!capture) {
        return;
      }
      createOrShowPanel(context.extensionUri, capture);
    },
  );

  context.subscriptions.push(captureCommand);
}
