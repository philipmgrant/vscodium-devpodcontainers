import * as vscode from "vscode";

export function getSshConfigPath() {
  return vscode.workspace
    .getConfiguration("remote.SSH")
    .get<string>("configFile", "");
}
