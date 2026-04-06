import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '../../../store/useCanvasStore';
import { useTerminalRuntime } from '../../../terminal/renderer/context/useTerminalRuntime';
import type {
  RepoAction,
  RepoActionResult,
  RepoChangedFile,
  RepoSnapshot,
  RepoTreeNode,
} from '../../shared/repo-types';

const REFRESH_INTERVAL_MS = 10000;

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString();
};

const StatusPill: React.FC<{ label: string; value: number; accent: string }> = ({
  label,
  value,
  accent,
}) => {
  if (value <= 0) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] uppercase tracking-wider"
      style={{
        background: `${accent}22`,
        color: accent,
        border: `1px solid ${accent}33`,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </span>
  );
};

const ActionButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent: string;
  text: string;
}> = ({ label, onClick, disabled, accent, text }) => (
  <button
    type="button"
    className="rounded-md px-2 py-2 text-[10px] uppercase tracking-wider transition-colors"
    style={{
      color: disabled ? `${text}66` : text,
      background: disabled ? 'rgba(255,255,255,0.03)' : `${accent}18`,
      border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : `${accent}2c`}`,
    }}
    onClick={onClick}
    disabled={disabled}
  >
    {label}
  </button>
);

interface TreeNodeRowProps {
  node: RepoTreeNode;
  depth: number;
  accent: string;
  text: string;
  textDim: string;
  copiedPath: string | null;
  onCopyPath: (path: string) => void;
}

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  depth,
  accent,
  text,
  textDim,
  copiedPath,
  onCopyPath,
}) => {
  const isDirectory = node.kind === 'directory';
  const [isExpanded, setIsExpanded] = useState(depth < 1);

  return (
    <div>
      <button
        type="button"
        className="w-full text-left rounded-md px-2 py-1.5 transition-colors hover:bg-white/5"
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => {
          if (isDirectory) {
            setIsExpanded((current) => !current);
            return;
          }
          onCopyPath(node.path);
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="truncate text-[11px]"
            style={{ color: isDirectory ? text : textDim }}
          >
            {isDirectory ? (isExpanded ? '[-] ' : '[+] ') : '[F] '}
            {node.name}
          </span>
          {!isDirectory && copiedPath === node.path ? (
            <span className="text-[9px] uppercase tracking-wider" style={{ color: accent }}>
              copied
            </span>
          ) : null}
        </div>
      </button>
      {isDirectory && isExpanded && node.children?.length ? (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              accent={accent}
              text={text}
              textDim={textDim}
              copiedPath={copiedPath}
              onCopyPath={onCopyPath}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

interface RepoSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const createFallbackSnapshot = (message: string): RepoSnapshot => ({
  isRepo: false,
  repoRoot: null,
  repoName: null,
  branch: null,
  branches: [],
  headSha: null,
  remotes: [],
  status: {
    modified: 0,
    added: 0,
    deleted: 0,
    untracked: 0,
    conflicts: 0,
    ahead: 0,
    behind: 0,
  },
  changedFiles: [],
  tree: [],
  scannedAt: new Date().toISOString(),
  errorMessage: message,
});

const inferFileActionState = (file: RepoChangedFile): {
  canStage: boolean;
  canUnstage: boolean;
  canDiscard: boolean;
} => {
  const code = file.status.padEnd(2, ' ');
  const indexCode = code[0];
  const workTreeCode = code[1];

  return {
    canStage: indexCode === '?' || workTreeCode === 'M' || workTreeCode === 'D' || workTreeCode === '?',
    canUnstage: indexCode === 'A' || indexCode === 'M' || indexCode === 'D',
    canDiscard: workTreeCode === 'M' || workTreeCode === 'D',
  };
};

export const RepoSidebar: React.FC<RepoSidebarProps> = ({ isOpen, onToggle }) => {
  const theme = useCanvasStore((state) => state.theme);
  const workspaces = useCanvasStore((state) => state.workspaces);
  const activeWorkspaceIndex = useCanvasStore((state) => state.activeWorkspaceIndex);
  const { sessions } = useTerminalRuntime();
  const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<RepoActionResult | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');

  const activeWorkspace = workspaces[activeWorkspaceIndex];
  const activeTerminal = activeWorkspace?.terminals[activeWorkspace.activeTerminalIndex];
  const activeCwd = activeTerminal ? sessions[activeTerminal.id]?.cwd : undefined;

  useEffect(() => {
    let isMounted = true;

    const loadSnapshot = async (): Promise<void> => {
      try {
        const nextSnapshot = await window.repoApi.getRepoSnapshot({ cwd: activeCwd });
        if (isMounted) {
          setSnapshot(nextSnapshot);
        }
      } catch (error) {
        if (isMounted) {
          setSnapshot(createFallbackSnapshot(error instanceof Error ? error.message : String(error)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSnapshot();
    const intervalId = window.setInterval(() => {
      void loadSnapshot();
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [activeCwd]);

  useEffect(() => {
    if (snapshot?.branch) {
      setSelectedBranch(snapshot.branch);
    }
  }, [snapshot?.branch]);

  const copyPath = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPath(value);
      window.setTimeout(() => {
        setCopiedPath((current) => (current === value ? null : current));
      }, 1500);
    } catch (error) {
      console.error('Failed to copy repo path.', error);
    }
  };

  const runAction = async (
    action: RepoAction,
    options?: { filePath?: string; message?: string; branch?: string },
  ): Promise<void> => {
    if (!activeCwd || isRunningAction) {
      return;
    }

    setIsRunningAction(true);
    try {
      const result = await window.repoApi.runAction({
        cwd: activeCwd,
        action,
        ...options,
      });
      setActionFeedback(result);
      setSnapshot(result.snapshot);
      if (action === 'commit' && result.ok) {
        setCommitMessage('');
      }
    } catch (error) {
      setActionFeedback({
        ok: false,
        action,
        message: error instanceof Error ? error.message : String(error),
        output: '',
        snapshot: snapshot ?? createFallbackSnapshot('Action failed'),
      });
    } finally {
      setIsRunningAction(false);
    }
  };

  const status = snapshot?.status;

  return (
    <aside
      className={`h-full flex-shrink-0 border-l transition-[width] duration-300 ${
        isOpen ? 'w-[340px]' : 'w-[68px]'
      }`}
      style={{
        background: theme.panelBg,
        borderColor: theme.border,
        backdropFilter: 'blur(26px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.28), inset 1px 0 0 rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex h-full flex-col">
        <div className="border-b px-3 py-3" style={{ borderColor: theme.border }}>
          <div className={`flex items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
            {isOpen ? (
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em]" style={{ color: theme.accent }}>
                  repo dock
                </div>
                <div className="mt-1 text-[11px]" style={{ color: theme.textDim }}>
                  follows active terminal cwd
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.25em]"
              style={{
                color: theme.text,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${theme.border}`,
              }}
              onClick={onToggle}
              title={isOpen ? 'Collapse repo dock' : 'Expand repo dock'}
            >
              {isOpen ? 'Close' : 'Repo'}
            </button>
          </div>
        </div>

        {isOpen ? (
          <>
            <div className="border-b px-4 py-4" style={{ borderColor: theme.border }}>
              <div className="text-[10px] uppercase tracking-[0.35em]" style={{ color: theme.accent }}>
                repository
              </div>
              <div className="mt-2 text-sm font-semibold" style={{ color: theme.text }}>
                {isLoading ? 'Loading repo...' : snapshot?.repoName ?? 'No repository'}
              </div>
              <div className="mt-1 text-[11px] break-all" style={{ color: theme.textDim }}>
                {activeCwd ?? snapshot?.repoRoot ?? snapshot?.errorMessage ?? 'Git metadata unavailable'}
              </div>
              {snapshot?.isRepo ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className="rounded-full px-2 py-1 text-[10px] uppercase tracking-wider"
                    style={{
                      background: `${theme.accent}22`,
                      color: theme.accent,
                      border: `1px solid ${theme.accent}33`,
                    }}
                  >
                    {snapshot.branch} {snapshot.headSha ? `@ ${snapshot.headSha}` : ''}
                  </span>
                  <StatusPill label="ahead" value={status?.ahead ?? 0} accent={theme.accent} />
                  <StatusPill label="behind" value={status?.behind ?? 0} accent={theme.text} />
                </div>
              ) : null}
              {snapshot?.remotes.length ? (
                <div className="mt-3 text-[10px] uppercase tracking-wider" style={{ color: theme.textDim }}>
                  remotes: {snapshot.remotes.join(', ')}
                </div>
              ) : null}
            </div>

            <div className="repo-sidebar-scroll flex-1 overflow-y-auto px-4 py-4">
              {snapshot?.isRepo ? (
                <>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.accent }}>
                      actions
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <ActionButton label="Fetch" onClick={() => { void runAction('fetch'); }} disabled={isRunningAction} accent={theme.accent} text={theme.text} />
                      <ActionButton label="Pull" onClick={() => { void runAction('pull'); }} disabled={isRunningAction} accent={theme.accent} text={theme.text} />
                      <ActionButton label="Push" onClick={() => { void runAction('push'); }} disabled={isRunningAction} accent={theme.accent} text={theme.text} />
                      <ActionButton label="Stage All" onClick={() => { void runAction('stage-all'); }} disabled={isRunningAction} accent={theme.accent} text={theme.text} />
                      <ActionButton label="Unstage" onClick={() => { void runAction('unstage-all'); }} disabled={isRunningAction} accent={theme.accent} text={theme.text} />
                      <ActionButton label="Refresh" onClick={() => { void runAction('fetch'); }} disabled={isRunningAction} accent={theme.accent} text={theme.text} />
                    </div>

                    <div className="mt-4">
                      <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: theme.textDim }}>
                        commit
                      </div>
                      <textarea
                        className="mt-2 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-[11px] outline-none"
                        style={{ borderColor: theme.border, color: theme.text }}
                        rows={3}
                        placeholder="Write commit message"
                        value={commitMessage}
                        onChange={(event) => setCommitMessage(event.target.value)}
                      />
                      <div className="mt-2">
                        <ActionButton
                          label="Commit"
                          onClick={() => { void runAction('commit', { message: commitMessage }); }}
                          disabled={commitMessage.trim().length === 0 || isRunningAction}
                          accent={theme.accent}
                          text={theme.text}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-[10px] uppercase tracking-[0.25em]" style={{ color: theme.textDim }}>
                        branches
                      </div>
                      <div className="mt-2 flex gap-2">
                        <select
                          className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-[11px] outline-none"
                          style={{ borderColor: theme.border, color: theme.text }}
                          value={selectedBranch}
                          onChange={(event) => setSelectedBranch(event.target.value)}
                        >
                          {snapshot.branches.map((branch) => (
                            <option key={branch} value={branch} style={{ background: '#111827', color: '#e5e7eb' }}>
                              {branch}
                            </option>
                          ))}
                        </select>
                        <ActionButton
                          label="Checkout"
                          onClick={() => { void runAction('checkout-branch', { branch: selectedBranch }); }}
                          disabled={isRunningAction || selectedBranch.trim().length === 0 || selectedBranch === snapshot.branch}
                          accent={theme.accent}
                          text={theme.text}
                        />
                      </div>
                    </div>

                    {actionFeedback ? (
                      <div
                        className="mt-4 rounded-md border px-3 py-2 text-[11px]"
                        style={{
                          borderColor: actionFeedback.ok ? `${theme.accent}44` : '#ef444466',
                          color: actionFeedback.ok ? theme.text : '#fca5a5',
                          background: actionFeedback.ok ? `${theme.accent}12` : 'rgba(127,29,29,0.18)',
                        }}
                      >
                        {actionFeedback.message}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.accent }}>
                      insights
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill label="modified" value={status?.modified ?? 0} accent="#f59e0b" />
                      <StatusPill label="added" value={status?.added ?? 0} accent="#22c55e" />
                      <StatusPill label="deleted" value={status?.deleted ?? 0} accent="#ef4444" />
                      <StatusPill label="untracked" value={status?.untracked ?? 0} accent="#38bdf8" />
                      <StatusPill label="conflicts" value={status?.conflicts ?? 0} accent="#f97316" />
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.accent }}>
                        changed files
                      </div>
                      <div className="text-[10px]" style={{ color: theme.textDim }}>
                        {snapshot.changedFiles.length}
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {snapshot.changedFiles.length > 0 ? (
                        snapshot.changedFiles.slice(0, 12).map((file) => {
                          const fileState = inferFileActionState(file);
                          return (
                            <div
                              key={`${file.status}:${file.path}`}
                              className="rounded-md px-2 py-2 transition-colors hover:bg-white/5"
                            >
                              <button
                                type="button"
                                className="w-full text-left"
                                onClick={() => {
                                  void copyPath(file.path);
                                }}
                              >
                                <span className="mr-2 inline-block w-8 text-[10px]" style={{ color: theme.accent }}>
                                  {file.status}
                                </span>
                                <span className="truncate text-[11px]" style={{ color: theme.textDim }}>
                                  {file.path}
                                </span>
                              </button>
                              <div className="mt-2 flex gap-2">
                                <ActionButton
                                  label="Stage"
                                  onClick={() => { void runAction('stage-file', { filePath: file.path }); }}
                                  disabled={isRunningAction || !fileState.canStage}
                                  accent={theme.accent}
                                  text={theme.text}
                                />
                                <ActionButton
                                  label="Unstage"
                                  onClick={() => { void runAction('unstage-file', { filePath: file.path }); }}
                                  disabled={isRunningAction || !fileState.canUnstage}
                                  accent={theme.accent}
                                  text={theme.text}
                                />
                                <ActionButton
                                  label="Discard"
                                  onClick={() => { void runAction('discard-file', { filePath: file.path }); }}
                                  disabled={isRunningAction || !fileState.canDiscard}
                                  accent="#ef4444"
                                  text={theme.text}
                                />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-md px-2 py-2 text-[11px]" style={{ color: theme.textDim }}>
                          working tree is clean
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.accent }}>
                        files
                      </div>
                      <div className="text-[10px]" style={{ color: theme.textDim }}>
                        click a file to copy its path
                      </div>
                    </div>
                    <div className="mt-3 space-y-0.5">
                      {snapshot.tree.length > 0 ? (
                        snapshot.tree.map((node) => (
                          <TreeNodeRow
                            key={node.path}
                            node={node}
                            depth={0}
                            accent={theme.accent}
                            text={theme.text}
                            textDim={theme.textDim}
                            copiedPath={copiedPath}
                            onCopyPath={(value) => {
                              void copyPath(value);
                            }}
                          />
                        ))
                      ) : (
                        <div className="rounded-md px-2 py-2 text-[11px]" style={{ color: theme.textDim }}>
                          file tree unavailable
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 text-[10px] uppercase tracking-wider" style={{ color: theme.textDim }}>
                    last scan {formatTimestamp(snapshot.scannedAt)}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border px-3 py-3 text-[11px]" style={{ borderColor: theme.border, color: theme.textDim }}>
                  {isLoading
                    ? 'Scanning repository...'
                    : snapshot?.errorMessage ?? 'No repository metadata is available.'}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-2">
            <div className="text-center [writing-mode:vertical-rl] text-[10px] uppercase tracking-[0.35em]" style={{ color: theme.textDim }}>
              repo dock
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
