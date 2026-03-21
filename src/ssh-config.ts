import * as vscode from "vscode";

export function getSshConfigPath() {
  return vscode.workspace
    .getConfiguration("remote.SSH")
    .get<string>("configFile", "");
}

export function buildSshCommand(args: string[] = []) {
  const configPath = getSshConfigPath();
  let argArray = [...args];
  if (configPath) {
    argArray.unshift("-F", configPath);
  }
  return {
    command: "ssh",
    args: argArray
  }
}