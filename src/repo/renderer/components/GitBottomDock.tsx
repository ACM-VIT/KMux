import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '../../../store/useCanvasStore';
import type { RepoAction } from '../../shared/repo-types';
import type { RepoDockState } from '../hooks/useRepoDockState';

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString();
};

const DockButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent: string;
  text: string;
}> = ({ label, onClick, disabled, accent, text }) => (
  <button
    type="button"
    className="rounded-sm px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] transition-colors"
    style={{
      color: disabled ? `${text}66` : text,
      background: disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'}`,
    }}
    onClick={onClick}
    disabled={disabled}
  >
    {label}
  </button>
);

interface GitBottomDockProps {
  isOpen: boolean;
  onToggle: () => void;
  state: RepoDockState;
}

export const GitBottomDock: React.FC<GitBottomDockProps> = ({ isOpen, onToggle, state }) => {
  const theme = useCanvasStore((store) => store.theme);
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const snapshot = state.snapshot;

  useEffect(() => {
    if (snapshot?.branch) {
      setSelectedBranch(snapshot.branch);
    }
  }, [snapshot?.branch]);

  const runAction = async (
    action: RepoAction,
    options?: { filePath?: string; message?: string; branch?: string },
  ): Promise<void> => {
    const result = await state.runAction(action, options);
    if (action === 'commit' && result?.ok) {
      setCommitMessage('');
    }
  };

  const totalChanges = snapshot
    ? snapshot.status.modified + snapshot.status.added + snapshot.status.deleted + snapshot.status.untracked + snapshot.status.conflicts
    : 0;

  return (
    <div
      className="h-full overflow-hidden border-t transition-[height] duration-300 ease-out"
      style={{
        height: '100%',
        background: theme.panelBg,
        borderColor: theme.border,
        backdropFilter: 'blur(18px)',
      }}
    >
      <div className="flex h-full flex-col">
        <div
          className="flex items-center justify-between gap-3 border-b px-3"
          style={{ minHeight: 34, borderColor: theme.border }}
        >
          <div className="flex min-w-0 items-center gap-3 text-[11px]">
            <button
              type="button"
              className="uppercase tracking-[0.22em]"
              style={{ color: theme.text, height: 34 }}
              onClick={onToggle}
            >
              source control
            </button>
            <div className="truncate" style={{ color: theme.textDim }}>
              {snapshot?.repoName ?? 'No repository'}
            </div>
            {snapshot?.branch ? (
              <div className="shrink-0" style={{ color: theme.textDim }}>
                {snapshot.branch}{snapshot.status.ahead > 0 ? `  ↑${snapshot.status.ahead}` : ''}{snapshot.status.behind > 0 ? ` ↓${snapshot.status.behind}` : ''}
              </div>
            ) : null}
            {totalChanges > 0 ? (
              <div className="shrink-0" style={{ color: theme.textDim }}>{totalChanges} changes</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: theme.textDim }}>
            {snapshot?.scannedAt ? <span className="hidden lg:inline">last scan {formatTimestamp(snapshot.scannedAt)}</span> : null}
            <button
              type="button"
              className="rounded-sm px-2 py-1"
              style={{
                color: theme.text,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${theme.border}`,
              }}
              onClick={onToggle}
            >
              {isOpen ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {isOpen ? (
          <div className="flex flex-1 flex-col gap-3 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <DockButton label="Fetch" onClick={() => { void runAction('fetch'); }} disabled={state.isRunningAction} accent={theme.accent} text={theme.text} />
              <DockButton label="Pull" onClick={() => { void runAction('pull'); }} disabled={state.isRunningAction} accent={theme.accent} text={theme.text} />
              <DockButton label="Push" onClick={() => { void runAction('push'); }} disabled={state.isRunningAction} accent={theme.accent} text={theme.text} />
              <DockButton label="Stage All" onClick={() => { void runAction('stage-all'); }} disabled={state.isRunningAction} accent={theme.accent} text={theme.text} />
              <DockButton label="Unstage" onClick={() => { void runAction('unstage-all'); }} disabled={state.isRunningAction} accent={theme.accent} text={theme.text} />
              <DockButton label="Refresh" onClick={() => { void state.refreshSnapshot(); }} disabled={state.isRunningAction} accent={theme.accent} text={theme.text} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="min-w-[140px] rounded-sm border bg-transparent px-2.5 py-1.5 text-[11px] outline-none"
                style={{ borderColor: theme.border, color: theme.text }}
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
              >
                {(snapshot?.branches ?? []).map((branch) => (
                  <option key={branch} value={branch} style={{ background: '#111827', color: '#e5e7eb' }}>
                    {branch}
                  </option>
                ))}
              </select>
              <DockButton
                label="Checkout"
                onClick={() => { void runAction('checkout-branch', { branch: selectedBranch }); }}
                disabled={state.isRunningAction || selectedBranch.trim().length === 0 || selectedBranch === snapshot?.branch}
                accent={theme.accent}
                text={theme.text}
              />
              <input
                className="min-w-[200px] flex-1 rounded-sm border bg-transparent px-2.5 py-1.5 text-[11px] outline-none"
                style={{ borderColor: theme.border, color: theme.text }}
                placeholder="Commit message"
                value={commitMessage}
                onChange={(event) => setCommitMessage(event.target.value)}
              />
              <DockButton
                label="Commit"
                onClick={() => { void runAction('commit', { message: commitMessage }); }}
                disabled={state.isRunningAction || commitMessage.trim().length === 0}
                accent={theme.accent}
                text={theme.text}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: theme.textDim }}>
              <span className="truncate">{state.activeCwd ?? snapshot?.repoRoot ?? 'Git metadata unavailable'}</span>
              <span>remotes: {snapshot?.remotes.length ? snapshot.remotes.join(', ') : 'none'}</span>
              {state.actionFeedback ? (
                <span style={{ color: state.actionFeedback.ok ? theme.text : '#fca5a5' }}>
                  {state.actionFeedback.message}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
