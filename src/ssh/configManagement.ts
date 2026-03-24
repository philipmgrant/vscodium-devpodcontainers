import * as vscode from "vscode";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { customSshConfigPath, defaultSshConfigPath, useNonDefaultSshConfig } from "./ssh";
import { getDevPodCommand, useConfiguredDevPodCommand } from "../devpod/bin";

export function validateDevpodAndSshSettings() {
  let errors = [];
  if (shouldOverrideProxyCommand()) {
    if (!useNonDefaultSshConfig()) {
      errors.push("'Use Devpod Command In Proxy Command' is set, but 'Remote.SSH Config File' is not set.");
    }
    if (!useConfiguredDevPodCommand()) {
      errors.push("'Use Devpod Command In Proxy Command' is set, but 'Devpod Command' is not set.");
    }
  }
  return errors;
}

function shouldOverrideProxyCommand() {
  return vscode.workspace
    .getConfiguration("remote.devpodcontainers")
    .get<Boolean>("useDevpodCommandInProxyCommand", false);
}

export function copyDevpodToCustomSshConfig(devpodAddr: string) {
  // Copies the stanza belonging to the devpod <devpodAddr> from the default SSH config to
  // the user-configured one (in the remote.SSH.configFile preference)
  if (!useNonDefaultSshConfig()) {
    return;  // Nowhere to copy to
  }
  const sourceConfigLines = readFileLines(defaultSshConfigPath());
  let targetConfigLines = readFileLines(customSshConfigPath());
  const sourceHostStanza = getHostStanza(sourceConfigLines, devpodAddr);
  if (shouldOverrideProxyCommand()) {
    overrideProxyCommandInLines(sourceHostStanza);
  }
  updateOrAppendHostStanza(targetConfigLines, devpodAddr, sourceHostStanza);
  writeFileLines(customSshConfigPath(), targetConfigLines);
}

function readFileLines(filePath: string) {
  if (!existsSync(filePath)) {
    return [];
  }
  return readFileSync(filePath, {"encoding": "utf8"}).split("\n");
}

function getHostStanza(configLines: string[], hostName: string) {
  // Search in <configLines> and return the lines of the stanza for host <hostName>
  const pos = findHostStanzaPosition(configLines, hostName);
  if (pos[0] == -1) {
    return [];
  }
  return configLines.slice(...pos);
}

function updateOrAppendHostStanza(configLines: string[], hostName: string, hostStanza: string[]) {
  // Add the lines <hostStanza> to <configLines>, replacing any existing stanze for host <hostName>
  const pos = findHostStanzaPosition(configLines, hostName);
  if (pos[0] == -1) {  // No existing stanza, so just append it
    configLines.push(...hostStanza);
  } else {  // Splice in the new stanza, replacing the existing one
    configLines.splice(pos[0], pos[1] - pos[0], ...hostStanza);
  }
}

function writeFileLines(filePath: string, lines: string[]) {
  writeFileSync(filePath, lines.join("\n"), {"encoding": "utf8"});
}

const HOST_REGEXP = new RegExp("^\\s*Host\\s*[\\s=]\\s*(\\S+)\\s*$", "i");
const DEVPOD_COMMENT_REGEXP = new RegExp("^#\\s*DevPod", "i");

function findHostStanzaPosition(configLines: string[], hostName: string) {
  // Looks in the SSH config lines <configLines> for a stanza for host <hostName>
  // Returns its position [stanzaStartLine, stanzaEndLine] using array slice notation, i.e.
  // stanzaEndLine is the first line of the next stanza.
  // Returns [-1, -1] if no stanza is found.
  let stanzaStartLine = -1;
  let stanzaEndLine = -1;
  let previousLineWasComment = false;
  for (let i=0; i < configLines.length; i++) {
    let match = configLines[i].match(HOST_REGEXP);
    if (match) { // this line is a host declaration
      if (match[1] == hostName) {
        // Found the start of our target stanza
        // If the previous line was a comment, assume it's part of this host stanza
        stanzaStartLine = previousLineWasComment ? i-1 : i;
      } else {
        // It's the start of a different host's stanza
        if (stanzaStartLine != -1) {
          // Found the end of our target stanza
          stanzaEndLine = previousLineWasComment ? i-1 : i;
          break;
        }
      }
    }
    previousLineWasComment = DEVPOD_COMMENT_REGEXP.test(configLines[i]);
  }
  if (stanzaStartLine != -1 && stanzaEndLine == -1) {
    // Target host was the last one in the file
    stanzaEndLine = configLines.length;
  }
  return [stanzaStartLine, stanzaEndLine];
}

// Pattern to identify the proxy command spec. It will look like:
// "ProxyCommand <devpod binary> ssh <more options>", where the devpod command might be multi-word.
// Regex has 3 capturing groups: (1) everything before the devpod binary, (2) the devpod binary,
// (3) everything after.
const PROXY_COMMAND_REGEXP = new RegExp("^(\\s*ProxyCommand\\s*[\\s=]\\s*)(.*)(\\sssh\\s.*)", "i");

function overrideProxyCommandInLines(configLines: string[]) {
  // Looks in the SSH config lines <configLines> for a ProxyCommand entry invoking '<devpod binary> ssh',
  // and modifies that line, replacing the devpod binary with the devpod command as configured by the user.
  for (let i=0; i < configLines.length; i++) {
    if (PROXY_COMMAND_REGEXP.test(configLines[i])) {
      configLines[i] = configLines[i].replace(PROXY_COMMAND_REGEXP, `$1${getDevPodCommand()}$3`);
      break;
    }
  }
}