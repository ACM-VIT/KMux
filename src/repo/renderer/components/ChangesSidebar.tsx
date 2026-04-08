import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCanvasStore } from '../../../store/useCanvasStore';
import type { RepoChangedFile, RepoTreeNode } from '../../shared/repo-types';
import { inferFileActionState, type RepoDockState } from '../hooks/useRepoDockState';

interface ChangesSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  state: RepoDockState;
}

type SidebarView = 'files' | 'git' | 'history';
type ActivityIconName = 'files' | 'search' | 'git' | 'history' | 'controls' | 'profiles';

const isConflictStatus = (status: string): boolean => {
  return status.padEnd(2, ' ').includes('U');
};

const getStatusColor = (status: string): string => {
  const normalized = status.padEnd(2, ' ');
  if (normalized.includes('A') || normalized.includes('?')) {
    return 'var(--color-git-add)';
  }
  if (normalized.includes('D')) {
    return 'var(--color-git-del)';
  }
  if (normalized.includes('U')) {
    return 'var(--color-git-mod)';
  }
  return 'var(--color-git-mod)';
};

const ActivityIcon: React.FC<{ name: ActivityIconName }> = ({ name }) => {
  const stroke = {
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  if (name === 'files') {
    return (
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <path d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" {...stroke} />
      </svg>
    );
  }

  if (name === 'search') {
    return (
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <circle cx="11" cy="11" r="6" {...stroke} />
        <path d="m20 20-4-4" {...stroke} />
      </svg>
    );
  }

  if (name === 'git') {
    return (
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <circle cx="6" cy="6" r="2.3" {...stroke} />
        <circle cx="18" cy="6" r="2.3" {...stroke} />
        <circle cx="12" cy="18" r="2.3" {...stroke} />
        <path d="M8.2 7.3 10.8 15m4-7.7L13.3 15" {...stroke} />
      </svg>
    );
  }

  if (name === 'history') {
    return (
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <path d="M4 12a8 8 0 1 0 2.3-5.7" {...stroke} />
        <path d="M4 4v4h4" {...stroke} />
        <path d="M12 8v4l3 2" {...stroke} />
      </svg>
    );
  }

  if (name === 'controls') {
    return (
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <line x1="4" y1="6" x2="20" y2="6" {...stroke} />
        <circle cx="9" cy="6" r="2" {...stroke} />
        <line x1="4" y1="12" x2="20" y2="12" {...stroke} />
        <circle cx="15" cy="12" r="2" {...stroke} />
        <line x1="4" y1="18" x2="20" y2="18" {...stroke} />
        <circle cx="11" cy="18" r="2" {...stroke} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <circle cx="12" cy="8" r="3" {...stroke} />
      <path d="M5 20c0-3.2 3-5 7-5s7 1.8 7 5" {...stroke} />
    </svg>
  );
};

const ActivityButton: React.FC<{
  icon: ActivityIconName;
  title: string;
  isActive: boolean;
  onClick: () => void;
  badgeCount?: number;
  disabled?: boolean;
}> = ({ icon, title, isActive, onClick, badgeCount, disabled = false }) => (
  <button
    type="button"
    className="relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200"
    style={{
      borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
      background: isActive ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'rgba(255,255,255,0.015)',
      color: disabled
        ? 'var(--color-text-dim)'
        : isActive
          ? 'var(--color-text)'
          : 'var(--color-text-muted)',
      opacity: disabled ? 0.45 : 1,
      boxShadow: isActive ? '0 4px 14px color-mix(in srgb, var(--color-primary) 28%, transparent)' : 'none',
      transform: isActive ? 'translateX(1px)' : 'translateX(0)',
    }}
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
  >
    <ActivityIcon name={icon} />
    {badgeCount && badgeCount > 0 ? (
      <span
        className="absolute right-1 top-1 min-w-[14px] rounded px-1 text-center text-[9px] leading-[14px]"
        style={{
          background: 'var(--color-primary)',
          color: 'var(--color-badge-text)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {badgeCount > 99 ? '99+' : badgeCount}
      </span>
    ) : null}
  </button>
);

const AccordionHeader: React.FC<{
  title: string;
  count?: number;
  isOpen: boolean;
  onClick: () => void;
}> = ({ title, count, isOpen, onClick }) => (
  <button
    type="button"
    className="flex h-8 w-full items-center justify-between border-b px-2 text-[11px]"
    style={{
      borderColor: 'var(--color-border)',
      color: 'var(--color-text)',
      fontFamily: 'var(--font-ui)',
    }}
    onClick={onClick}
  >
    <span className="uppercase tracking-[0.02em]">{title}</span>
    <span className="flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
      {typeof count === 'number' ? <span>{count}</span> : null}
      <span className="inline-block w-4 text-center" style={{ fontFamily: 'var(--font-mono)' }}>
        {isOpen ? '-' : '+'}
      </span>
    </span>
  </button>
);

const FileRow: React.FC<{
  file: RepoChangedFile;
  actionLabel: '+' | '-';
  actionTitle: string;
  onCopyPath: (path: string) => void;
  onAction: (path: string) => void;
  actionDisabled: boolean;
  copiedPath: string | null;
}> = ({ file, actionLabel, actionTitle, onCopyPath, onAction, actionDisabled, copiedPath }) => (
  <div
    className="group flex h-6 items-center gap-2 border-b px-2"
    style={{ borderColor: 'rgba(255,255,255,0.03)' }}
  >
    <span
      className="w-6 shrink-0 text-[10px] uppercase"
      style={{
        color: getStatusColor(file.status),
        fontFamily: 'var(--font-mono)',
      }}
    >
      {file.status.trim() || '--'}
    </span>

    <button
      type="button"
      className="min-w-0 flex-1 truncate text-left text-[11px]"
      style={{ color: copiedPath === file.path ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
      title={`Copy path: ${file.path}`}
      onClick={() => onCopyPath(file.path)}
    >
      {file.path}
    </button>

    <button
      type="button"
      className="h-5 w-5 rounded border text-[12px] leading-[18px] opacity-0 transition-opacity group-hover:opacity-100"
      style={{
        borderColor: 'var(--color-border)',
        color: actionDisabled ? 'var(--color-text-dim)' : 'var(--color-text)',
      }}
      onClick={() => onAction(file.path)}
      disabled={actionDisabled}
      title={actionTitle}
    >
      {actionLabel}
    </button>
  </div>
);

const EmptyRow: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-2 py-3 text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
    {label}
  </div>
);

const FilesTreeRow: React.FC<{
  node: RepoTreeNode;
  depth: number;
  copiedPath: string | null;
  onCopyPath: (path: string) => void;
}> = ({ node, depth, copiedPath, onCopyPath }) => {
  const isDirectory = node.kind === 'directory';
  const [isExpanded, setIsExpanded] = useState(depth < 1);

  return (
    <div>
      <button
        type="button"
        className="w-full border-b px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-white/5"
        style={{
          borderColor: 'rgba(255,255,255,0.03)',
          paddingLeft: `${8 + depth * 14}px`,
          color: isDirectory ? 'var(--color-text)' : 'var(--color-text-muted)',
          fontFamily: 'var(--font-ui)',
        }}
        onClick={() => {
          if (isDirectory) {
            setIsExpanded((current) => !current);
            return;
          }
          onCopyPath(node.path);
        }}
        title={isDirectory ? node.path : `Copy path: ${node.path}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">
            <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
              {isDirectory ? (isExpanded ? '[-] ' : '[+] ') : '[F] '}
            </span>
            {node.name}
          </span>
          {!isDirectory && copiedPath === node.path ? (
            <span className="text-[9px] uppercase" style={{ color: 'var(--color-primary)' }}>
              copied
            </span>
          ) : null}
        </div>
      </button>

      {isDirectory && isExpanded && node.children?.length ? (
        <div>
          {node.children.map((child) => (
            <FilesTreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              copiedPath={copiedPath}
              onCopyPath={onCopyPath}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const ChangesSidebar: React.FC<ChangesSidebarProps> = ({ isOpen, onToggle, state }) => {
  const theme = useCanvasStore((store) => store.theme);
  const toggleSearch = useCanvasStore((store) => store.toggleSearch);
  const isControlsOpen = useCanvasStore((store) => store.isControlsOpen);
  const toggleControls = useCanvasStore((store) => store.toggleControls);
  const [activeView, setActiveView] = useState<SidebarView>('git');
  const [commitMessage, setCommitMessage] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isStagedOpen, setIsStagedOpen] = useState(true);
  const [isChangesOpen, setIsChangesOpen] = useState(true);
  const [isCommitOpen, setIsCommitOpen] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState('Local Terminal');
  const [profileShell, setProfileShell] = useState('/bin/bash');
  const [profileDirectory, setProfileDirectory] = useState('~/workspace');
  const clearCopiedPathTimeoutRef = useRef<number | null>(null);
  const snapshot = state.snapshot;
  const hasRepo = snapshot?.isRepo === true;

  const totalChanges = snapshot
    ? snapshot.status.modified + snapshot.status.added + snapshot.status.deleted + snapshot.status.untracked + snapshot.status.conflicts
    : 0;

  const stagedFiles = useMemo(() => {
    const changedFiles = snapshot?.changedFiles ?? [];
    return changedFiles.filter((file) => inferFileActionState(file).canUnstage);
  }, [snapshot?.changedFiles]);

  const unstagedFiles = useMemo(() => {
    const changedFiles = snapshot?.changedFiles ?? [];
    return changedFiles.filter((file) => {
      const actionState = inferFileActionState(file);
      return actionState.canStage || isConflictStatus(file.status);
    });
  }, [snapshot?.changedFiles]);

  useEffect(() => {
    if (!hasRepo) {
      setActiveView('git');
    }
  }, [hasRepo]);

  useEffect(() => {
    return () => {
      if (clearCopiedPathTimeoutRef.current !== null) {
        window.clearTimeout(clearCopiedPathTimeoutRef.current);
      }
    };
  }, []);

  const copyPath = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPath(value);
      if (clearCopiedPathTimeoutRef.current !== null) {
        window.clearTimeout(clearCopiedPathTimeoutRef.current);
      }
      clearCopiedPathTimeoutRef.current = window.setTimeout(() => {
        setCopiedPath((current) => (current === value ? null : current));
        clearCopiedPathTimeoutRef.current = null;
      }, 1400);
    } catch (error) {
      console.error('Failed to copy path.', error);
    }
  };

  const runCommit = async (): Promise<void> => {
    const trimmed = commitMessage.trim();
    if (!trimmed || state.isRunningAction) {
      return;
    }
    const result = await state.runAction('commit', { message: trimmed });
    if (result?.ok) {
      setCommitMessage('');
    }
  };

  const panelWidth = isOpen && hasRepo ? 240 : 0;
  const colorVars = {
    '--color-bg-base': theme.bg,
    '--color-bg-surface': theme.panelBg,
    '--color-border': theme.border,
    '--color-text': theme.text,
    '--color-text-muted': theme.textDim,
    '--color-text-dim': theme.textDim,
    '--color-primary': theme.accent,
    '--color-git-add': '#22c55e',
    '--color-git-mod': theme.accent,
    '--color-git-del': '#ef4444',
    '--color-badge-text': theme.bg,
  } as React.CSSProperties;

  return (
    <aside
      className="h-full overflow-hidden transition-[width] duration-150 ease-out"
      style={{
        ...colorVars,
        width: `${48 + panelWidth}px`,
        background: 'transparent',
      }}
    >
      <div className="flex h-full px-1 py-2">
        <div
          className="flex h-full w-12 flex-col items-center gap-2 rounded-2xl border py-3"
          style={{
            borderColor: 'var(--color-border)',
            background: 'linear-gradient(180deg, var(--color-bg-base), color-mix(in srgb, var(--color-bg-base) 78%, black 22%))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <ActivityButton
            icon="files"
            title="Files"
            isActive={isOpen && activeView === 'files' && hasRepo}
            onClick={() => {
              setActiveView('files');
              if (!hasRepo) {
                return;
              }
              if (isOpen && activeView === 'files') {
                onToggle();
                return;
              }
              if (!isOpen) {
                onToggle();
              }
            }}
            disabled={!hasRepo}
          />
          <ActivityButton
            icon="search"
            title="Search"
            isActive={false}
            onClick={toggleSearch}
          />
          <ActivityButton
            icon="git"
            title="Git Changes"
            isActive={isOpen && activeView === 'git' && hasRepo}
            badgeCount={!isOpen && totalChanges > 0 ? totalChanges : undefined}
            onClick={() => {
              setActiveView('git');
              if (!hasRepo) {
                return;
              }
              if (isOpen && activeView === 'git') {
                onToggle();
                return;
              }
              if (!isOpen) {
                onToggle();
              }
            }}
            disabled={!hasRepo}
          />
          <ActivityButton
            icon="history"
            title="History"
            isActive={isOpen && activeView === 'history' && hasRepo}
            onClick={() => {
              setActiveView('history');
              if (!hasRepo) {
                return;
              }
              if (isOpen && activeView === 'history') {
                onToggle();
                return;
              }
              if (!isOpen) {
                onToggle();
              }
            }}
            disabled={!hasRepo}
          />
          <ActivityButton
            icon="controls"
            title="Controls"
            isActive={isControlsOpen}
            onClick={toggleControls}
          />

          <div className="mt-auto mb-2">
            <ActivityButton
              icon="profiles"
              title="Profiles"
              isActive={isProfileModalOpen}
              onClick={() => setIsProfileModalOpen(true)}
            />
          </div>
        </div>

        {panelWidth > 0 ? (
          <div
            className="flex h-full w-[240px] flex-col rounded-r-2xl border border-l-0"
            style={{
              borderColor: 'var(--color-border)',
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-bg-surface) 90%, black 10%), var(--color-bg-surface))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {activeView === 'git' ? (
              <>
                <div className="border-b px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="truncate text-[12px] font-semibold" style={{ color: 'var(--color-text)' }}>
                    {snapshot?.repoName ?? 'Repository'}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {snapshot?.branch ?? 'detached'}{snapshot?.headSha ? ` @ ${snapshot.headSha}` : ''}
                  </div>
                </div>

                <div className="repo-sidebar-scroll flex-1 overflow-y-auto">
                  <AccordionHeader
                    title="Staged Changes"
                    count={stagedFiles.length}
                    isOpen={isStagedOpen}
                    onClick={() => setIsStagedOpen((open) => !open)}
                  />
                  {isStagedOpen ? (
                    stagedFiles.length > 0 ? (
                      <div>
                        {stagedFiles.map((file) => (
                          <FileRow
                            key={`staged:${file.status}:${file.path}`}
                            file={file}
                            actionLabel="-"
                            actionTitle="Unstage file"
                            copiedPath={copiedPath}
                            onCopyPath={(value) => {
                              void copyPath(value);
                            }}
                            onAction={(filePath) => {
                              void state.runAction('unstage-file', { filePath });
                            }}
                            actionDisabled={state.isRunningAction || !inferFileActionState(file).canUnstage}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyRow label="No staged files" />
                    )
                  ) : null}

                  <AccordionHeader
                    title="Changes"
                    count={unstagedFiles.length}
                    isOpen={isChangesOpen}
                    onClick={() => setIsChangesOpen((open) => !open)}
                  />
                  {isChangesOpen ? (
                    unstagedFiles.length > 0 ? (
                      <div>
                        {unstagedFiles.map((file) => (
                          <FileRow
                            key={`unstaged:${file.status}:${file.path}`}
                            file={file}
                            actionLabel="+"
                            actionTitle="Stage file"
                            copiedPath={copiedPath}
                            onCopyPath={(value) => {
                              void copyPath(value);
                            }}
                            onAction={(filePath) => {
                              const fileActionState = inferFileActionState(file);
                              if (fileActionState.canStage) {
                                void state.runAction('stage-file', { filePath });
                                return;
                              }
                              if (fileActionState.canDiscard) {
                                void state.runAction('discard-file', { filePath });
                              }
                            }}
                            actionDisabled={state.isRunningAction || !inferFileActionState(file).canStage}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyRow label="No working tree changes" />
                    )
                  ) : null}

                  <AccordionHeader
                    title="Commit"
                    isOpen={isCommitOpen}
                    onClick={() => setIsCommitOpen((open) => !open)}
                  />
                  {isCommitOpen ? (
                    <div className="space-y-2 border-b px-2 py-2" style={{ borderColor: 'var(--color-border)' }}>
                      <textarea
                        value={commitMessage}
                        onChange={(event) => setCommitMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                            event.preventDefault();
                            void runCommit();
                          }
                        }}
                        className="h-20 w-full resize-none border p-2 text-[11px] outline-none"
                        style={{
                          borderColor: 'var(--color-border)',
                          background: 'var(--color-bg-base)',
                          color: 'var(--color-text)',
                        }}
                        placeholder="Write a commit message"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="h-6 border px-2 text-[10px] uppercase"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                          onClick={() => {
                            void state.runAction('stage-all');
                          }}
                          disabled={state.isRunningAction}
                        >
                          Stage All
                        </button>
                        <button
                          type="button"
                          className="h-6 border px-2 text-[10px] uppercase"
                          style={{
                            borderColor: 'var(--color-border)',
                            color: commitMessage.trim().length > 0 ? 'var(--color-text)' : 'var(--color-text-dim)',
                          }}
                          onClick={() => {
                            void runCommit();
                          }}
                          disabled={state.isRunningAction || commitMessage.trim().length === 0}
                        >
                          Commit
                        </button>
                      </div>

                      <div className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>
                        {state.actionFeedback ? state.actionFeedback.message : 'Cmd/Ctrl+Enter to commit'}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : activeView === 'files' ? (
              <div className="flex h-full flex-col">
                <div className="border-b px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--color-text)' }}>
                    Files
                  </div>
                  <div className="truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {snapshot?.repoRoot ?? 'repository tree'}
                  </div>
                </div>

                <div className="repo-sidebar-scroll flex-1 overflow-y-auto">
                  {snapshot?.tree.length ? (
                    <div>
                      {snapshot.tree.map((node) => (
                        <FilesTreeRow
                          key={node.path}
                          node={node}
                          depth={0}
                          copiedPath={copiedPath}
                          onCopyPath={(value) => {
                            void copyPath(value);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-3 text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
                      File tree unavailable for this repository.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="border-b px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--color-text)' }}>
                    Commit History
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    recent repository activity
                  </div>
                </div>
                <div className="repo-sidebar-scroll flex-1 overflow-y-auto px-2 py-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {snapshot?.headSha ? (
                    <div className="mb-3 border-l-2 pl-2" style={{ borderColor: 'var(--color-primary)' }}>
                      <div className="truncate" style={{ color: 'var(--color-text)' }}>
                        HEAD {snapshot.headSha}
                      </div>
                      <div>{snapshot.branch ?? 'detached head'}</div>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    {(snapshot?.branches ?? []).slice(0, 8).map((branch) => (
                      <div key={branch} className="rounded border px-2 py-1" style={{ borderColor: 'var(--color-border)' }}>
                        <div style={{ color: 'var(--color-text)' }}>{branch}</div>
                        <div style={{ color: 'var(--color-text-dim)' }}>branch reference</div>
                      </div>
                    ))}
                  </div>
                  {(snapshot?.branches.length ?? 0) === 0 ? (
                    <div className="mt-3 rounded border px-2 py-2" style={{ borderColor: 'var(--color-border)' }}>
                      History entries are not available from the current repo API.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {isProfileModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(0,0,0,0.56)] px-4">
          <div
            className="flex h-[420px] w-[600px] overflow-hidden border"
            style={{
              borderColor: 'var(--color-border)',
              background: 'var(--color-bg-surface)',
            }}
          >
            <div className="w-[180px] border-r p-3" style={{ borderColor: 'var(--color-border)' }}>
              <div className="mb-2 text-[11px] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                Profiles
              </div>
              <button
                type="button"
                className="mb-1 w-full border px-2 py-1 text-left text-[11px]"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-text)' }}
              >
                Local Terminal
              </button>
              <button
                type="button"
                className="w-full border px-2 py-1 text-left text-[11px]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Remote Profile
              </button>
            </div>

            <div className="flex flex-1 flex-col p-3">
              <div className="mb-2 text-[12px] font-semibold" style={{ color: 'var(--color-text)' }}>
                Terminal Profile
              </div>
              <label className="mb-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Name
              </label>
              <input
                className="mb-2 h-8 border px-2 text-[11px] outline-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-base)', color: 'var(--color-text)' }}
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
              />

              <label className="mb-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Shell
              </label>
              <input
                className="mb-2 h-8 border px-2 text-[11px] outline-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-base)', color: 'var(--color-text)' }}
                value={profileShell}
                onChange={(event) => setProfileShell(event.target.value)}
              />

              <label className="mb-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Working Directory
              </label>
              <input
                className="mb-3 h-8 border px-2 text-[11px] outline-none"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-base)', color: 'var(--color-text)' }}
                value={profileDirectory}
                onChange={(event) => setProfileDirectory(event.target.value)}
              />

              <div className="mt-auto flex justify-end gap-2">
                <button
                  type="button"
                  className="h-8 border px-3 text-[11px]"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  onClick={() => setIsProfileModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-8 border px-3 text-[11px]"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                  onClick={() => setIsProfileModalOpen(false)}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
};
