import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGitStatusOutput } from '../../src/terminal/main/git/git-status.ts';

test('parses branch and clean status from porcelain output', () => {
  const output = [
    '# branch.oid abc123',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +0 -0',
  ].join('\n');

  const status = parseGitStatusOutput(output, 't-1');
  assert.equal(status.terminalId, 't-1');
  assert.equal(status.branchName, 'main');
  assert.equal(status.isDirty, false);
});

test('marks dirty when porcelain reports file changes', () => {
  const output = [
    '# branch.oid abc123',
    '# branch.head feature/footer',
    '1 .M N... 100644 100644 100644 abc123 abc123 src/file.ts',
  ].join('\n');

  const status = parseGitStatusOutput(output, 't-2');
  assert.equal(status.branchName, 'feature/footer');
  assert.equal(status.isDirty, true);
});

test('handles detached head and unknown branch gracefully', () => {
  const output = '# branch.head (detached)\n';
  const status = parseGitStatusOutput(output, 't-3');

  assert.equal(status.branchName, 'detached');
  assert.equal(status.isDirty, false);
});
