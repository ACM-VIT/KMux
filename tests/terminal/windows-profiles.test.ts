import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  listWindowsTerminalProfiles,
  resolveWindowsShell,
  type WindowsProfileRuntime,
} from '../../src/terminal/main/shell/windows.ts';

const createWindowsEnv = (): NodeJS.ProcessEnv => {
  return {
    ProgramW6432: 'C:\\Program Files',
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    SystemRoot: 'C:\\Windows',
    ComSpec: 'C:\\Windows\\System32\\cmd.exe',
    PATH: 'C:\\Tools\\AzureCLI;C:\\Tools\\Other',
  };
};

const makeRuntime = (
  existingPaths: string[],
  wslOutput = 'Ubuntu\r\n',
): WindowsProfileRuntime => {
  const knownPaths = new Set(existingPaths);
  return {
    pathExists: (candidatePath) => knownPaths.has(candidatePath),
    runCommand: (command, args) => {
      if (command.endsWith('wsl.exe') && args.join(' ') === '-l -q') {
        return { status: 0, stdout: wslOutput };
      }
      return { status: 0, stdout: '' };
    },
  };
};

test('windows profile detection returns the expected default profile set', () => {
  const env = createWindowsEnv();
  const runtime = makeRuntime([
    path.win32.join('C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.win32.join('C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
    path.win32.join('C:\\Windows', 'System32', 'wsl.exe'),
    path.win32.join('C:\\Program Files', 'Microsoft Visual Studio', '2022', 'Community', 'Common7', 'Tools', 'VsDevCmd.bat'),
    path.win32.join('C:\\Program Files', 'Microsoft Visual Studio', '2022', 'Community', 'Common7', 'Tools', 'Launch-VsDevShell.ps1'),
    path.win32.join('C:\\Tools\\AzureCLI', 'azshell.exe'),
  ]);

  const profiles = listWindowsTerminalProfiles(env, runtime);
  const labels = profiles.map((profile) => profile.label);

  assert.deepEqual(labels, [
    'Windows PowerShell',
    'Command Prompt',
    'Azure Cloud Shell',
    'Ubuntu',
    'Developer Command Prompt for Visual Studio',
    'Developer PowerShell for Visual Studio',
    'PowerShell',
  ]);
  assert.ok(!profiles.some((profile) => profile.label.toLowerCase() === 'default'));
});

test('windows profile detection includes dynamic wsl distributions', () => {
  const env = createWindowsEnv();
  const runtime = makeRuntime(
    [
      path.win32.join('C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      path.win32.join('C:\\Windows', 'System32', 'wsl.exe'),
    ],
    'Ubuntu\r\nDebian\r\n',
  );

  const profiles = listWindowsTerminalProfiles(env, runtime);
  const labels = profiles.map((profile) => profile.label);

  assert.ok(labels.includes('Ubuntu'));
  assert.ok(labels.includes('Debian'));
});

test('windows profile detection cleans utf16-style wsl output', () => {
  const env = createWindowsEnv();
  const runtime = makeRuntime(
    [
      path.win32.join('C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      path.win32.join('C:\\Windows', 'System32', 'wsl.exe'),
    ],
    'U\u0000b\u0000u\u0000n\u0000t\u0000u\u0000\r\n',
  );

  const profiles = listWindowsTerminalProfiles(env, runtime);
  const ubuntuProfile = profiles.find((profile) => profile.label === 'Ubuntu');

  assert.ok(ubuntuProfile);
  assert.equal(ubuntuProfile?.id, 'ubuntu');
});

test('windows shell resolver supports aliases and defaults', () => {
  const env = createWindowsEnv();
  const runtime = makeRuntime([
    path.win32.join('C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.win32.join('C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
    path.win32.join('C:\\Windows', 'System32', 'wsl.exe'),
    path.win32.join('C:\\Program Files', 'Microsoft Visual Studio', '2022', 'Community', 'Common7', 'Tools', 'VsDevCmd.bat'),
    path.win32.join('C:\\Program Files', 'Microsoft Visual Studio', '2022', 'Community', 'Common7', 'Tools', 'Launch-VsDevShell.ps1'),
    path.win32.join('C:\\Tools\\AzureCLI', 'azshell.exe'),
  ]);

  assert.equal(resolveWindowsShell(env, 'default', runtime).label, 'Windows PowerShell');
  assert.equal(resolveWindowsShell(env, 'windows-powershell', runtime).label, 'Windows PowerShell');
  assert.equal(resolveWindowsShell(env, 'command-prompt', runtime).label, 'Command Prompt');
  assert.equal(resolveWindowsShell(env, 'powershell', runtime).label, 'PowerShell');
  assert.equal(resolveWindowsShell(env, 'ubuntu', runtime).label, 'Ubuntu');
});

test('windows shell resolver gracefully falls back to command prompt', () => {
  const env = createWindowsEnv();
  const runtime = makeRuntime([path.win32.join('C:\\Windows', 'System32', 'cmd.exe')]);

  const profiles = listWindowsTerminalProfiles(env, runtime);
  assert.equal(profiles[0].label, 'Command Prompt');
  assert.equal(resolveWindowsShell(env, 'powershell', runtime).label, 'Command Prompt');
});
