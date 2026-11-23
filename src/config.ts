import * as vscode from "vscode";

export interface TermSnapTextWrapConfig {
  theme: string;
  fontSize: number;
  padding: number;
  wrapText: boolean;
  preserveTerminalColors: boolean;
  wrapWidth: number;
  exportScale: number;
  showWindowControls: boolean;
  showLineNumbers: boolean;
  backgroundColor: string;
  customBackground: string;
  customTextColor: string;
  customTitleBarColor: string;
}

// The registered setting IDs are termsnap.*. Early fork builds stored values
// under termsnap-textwrap.* instead. Honor those old values until the user
// explicitly sets a value in the registered namespace.
function readConfig<T>(key: string, fallback: T): T {
  const current = vscode.workspace.getConfiguration("termsnap");
  const inspected = current.inspect<T>(key);
  if (
    inspected?.workspaceFolderValue !== undefined ||
    inspected?.workspaceValue !== undefined ||
    inspected?.globalValue !== undefined
  ) {
    return current.get<T>(key, fallback);
  }
  return vscode.workspace
    .getConfiguration("termsnap-textwrap")
    .get<T>(key, current.get<T>(key, fallback));
}

export function getConfig(): TermSnapTextWrapConfig {
  return {
    theme: readConfig("theme", "andromeda"),
    fontSize: readConfig("fontSize", 14),
    padding: readConfig("padding", 16),
    wrapText: readConfig("wrapText", false),
    preserveTerminalColors: readConfig("preserveTerminalColors", true),
    wrapWidth: readConfig("wrapWidth", 800),
    exportScale: readConfig("exportScale", 2),
    showWindowControls: readConfig("showWindowControls", true),
    showLineNumbers: readConfig("showLineNumbers", false),
    backgroundColor: readConfig("backgroundColor", "#1e1e2e"),
    customBackground: readConfig("customBackground", "#1e1e2e"),
    customTextColor: readConfig("customTextColor", "#f8f8f2"),
    customTitleBarColor: readConfig("customTitleBarColor", "#161616"),
  };
}

export async function updateConfig(key: string, value: unknown): Promise<void> {
  await vscode.workspace
    .getConfiguration("termsnap")
    .update(key, value, vscode.ConfigurationTarget.Global);
}
