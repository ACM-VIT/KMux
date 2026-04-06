import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeTerminalInputData,
  extractTrackedCwdFromOutput,
  resolveNextCwdFromCommand,
} from '../../src/terminal/main/utils/cwd-tracking.ts';

test('extracts cwd from osc 7 output', () => {
  const output = '\u001b]7;file://localhost/C:/Users/tester/workspace\u0007';
  const cwd = extractTrackedCwdFromOutput(output, 'win32');
  assert.equal(cwd, 'C:\\Users\\tester\\workspace');
});

test('extracts cwd from osc 633 output', () => {
  const output = '\u001b]633;P;Cwd=/home/tester/repo\u0007';
  const cwd = extractTrackedCwdFromOutput(output, 'linux');
  assert.equal(cwd, '/home/tester/repo');
});

test('extracts cwd from powershell prompt output', () => {
  const output = '\u001b[32mPS E:\\ACM\\KMux>\u001b[0m ';
  const cwd = extractTrackedCwdFromOutput(output, 'win32');
  assert.equal(cwd, 'E:\\ACM\\KMux');
});

test('extracts cwd from command prompt output', () => {
  const output = '\r\nC:\\Users\\tester\\repo>';
  const cwd = extractTrackedCwdFromOutput(output, 'win32');
  assert.equal(cwd, 'C:\\Users\\tester\\repo');
});

test('resolves next cwd from cd command', () => {
  const cwd = resolveNextCwdFromCommand(
    'cd ../repo-2',
    '/home/tester/repo-1',
    '/home/tester',
    'linux',
  );
  assert.equal(cwd, '/home/tester/repo-2');
});

test('resolves next cwd from set-location command', () => {
  const cwd = resolveNextCwdFromCommand(
    'Set-Location -Path "D:\\source\\app"',
    'C:\\Users\\tester',
    'C:\\Users\\tester',
    'win32',
  );
  assert.equal(cwd, 'D:\\source\\app');
});

test('ignores non-directory commands', () => {
  const cwd = resolveNextCwdFromCommand(
    'git status',
    '/home/tester/repo-1',
    '/home/tester',
    'linux',
  );
  assert.equal(cwd, null);
});

test('tracks command line from terminal keystrokes', () => {
  const commands: string[] = [];
  let buffer = '';

  buffer = consumeTerminalInputData(buffer, 'cd rep', (commandLine) => commands.push(commandLine));
  buffer = consumeTerminalInputData(buffer, 'o\u001b[A\r', (commandLine) => commands.push(commandLine));

  assert.deepEqual(commands, ['cd repo']);
  assert.equal(buffer, '');
});
