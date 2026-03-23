import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export function customSshConfigPath() {
  let p = vscode.workspace
    .getConfiguration("remote.SSH")
    .get<string>("configFile", "");
  if (p.startsWith("~")) {
    p = path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export function defaultSshConfigPath() {
  return path.resolve(os.homedir(), ".ssh/config");
}

export function useNonDefaultSshConfig() {
  let p = customSshConfigPath();
  return Boolean(p && (p != defaultSshConfigPath()));
}

export function buildSshCommand(args: string[] = []) {
  let argArray = [...args];
  if (useNonDefaultSshConfig()) {
    argArray.unshift("-F", customSshConfigPath());
  }
  return {
    command: "ssh",
    args: argArray
  }
}
