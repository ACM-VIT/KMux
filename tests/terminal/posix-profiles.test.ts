import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listDarwinTerminalProfiles,
  resolveDarwinShell,
  type DarwinRuntime,
} from '../../src/terminal/main/shell/darwin.ts';
import {
  listLinuxTerminalProfiles,
  resolveLinuxShell,
  type LinuxRuntime,
} from '../../src/terminal/main/shell/linux.ts';

const makeRuntime = (
  existingPaths: string[],
  files: Record<string, string>,
): DarwinRuntime & LinuxRuntime => {
  const existing = new Set(existingPaths);
  return {
    pathExists: (candidatePath) => existing.has(candidatePath),
    readFile: (candidatePath) => files[candidatePath] ?? '',
  };
};

test('darwin profiles are discovered dynamically from /etc/shells and env shell', () => {
  const runtime = makeRuntime(
    ['/bin/zsh', '/bin/bash', '/usr/local/bin/fish', '/etc/shells'],
    {
      '/etc/shells': '# comment\n/bin/bash\n/usr/local/bin/fish\n',
    },
  );

  const env: NodeJS.ProcessEnv = {
    SHELL: '/bin/zsh',
  };

  const profiles = listDarwinTerminalProfiles(env, runtime);
  const labels = profiles.map((profile) => profile.label);

  assert.deepEqual(labels, ['zsh', 'bash', 'fish']);
  assert.ok(!labels.includes('default'));
  assert.equal(resolveDarwinShell(env, 'default', runtime).command, '/bin/zsh');
  assert.equal(resolveDarwinShell(env, 'bash', runtime).command, '/bin/bash');
});

test('linux profiles are discovered dynamically from /etc/shells and env shell', () => {
  const runtime = makeRuntime(
    ['/bin/bash', '/bin/zsh', '/usr/bin/fish', '/etc/shells'],
    {
      '/etc/shells': '/bin/zsh\n/usr/bin/fish\n',
    },
  );

  const env: NodeJS.ProcessEnv = {
    SHELL: '/bin/bash',
  };

  const profiles = listLinuxTerminalProfiles(env, runtime);
  const labels = profiles.map((profile) => profile.label);

  assert.deepEqual(labels, ['bash', 'zsh', 'fish']);
  assert.ok(!labels.includes('default'));
  assert.equal(resolveLinuxShell(env, 'default', runtime).command, '/bin/bash');
  assert.equal(resolveLinuxShell(env, 'fish', runtime).command, '/usr/bin/fish');
});
