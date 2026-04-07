import React, { useState } from 'react';
import { useCanvasStore } from '../../../store/useCanvasStore';
import type { RepoChangedFile } from '../../shared/repo-types';
import { inferFileActionState, type RepoDockState } from '../hooks/useRepoDockState';

interface ChangesSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  state: RepoDockState;
}

const SectionHeader: React.FC<{
  label: string;
  count: number;
  accent: string;
  textDim: string;
}> = ({ label, count, accent, textDim }) => (
  <div className="flex items-center justify-between">
    <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>
      {label}
    </div>
    <div className="text-[10px]" style={{ color: textDim }}>
      {count}
    </div>
  </div>
);

const FileActionButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent: string;
  text: string;
}> = ({ label, onClick, disabled, accent, text }) => (
  <button
    type="button"
    className="rounded-md px-2 py-1.5 text-[10px] uppercase tracking-[0.22em]"
    style={{
      color: disabled ? `${text}66` : text,
      background: disabled ? 'rgba(255,255,255,0.03)' : `${accent}16`,
      border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : `${accent}30`}`,
    }}
    onClick={onClick}
    disabled={disabled}
  >
    {label}
  </button>
);

const FileListSection: React.FC<{
  title: string;
  files: RepoChangedFile[];
  emptyLabel: string;
  accent: string;
  text: string;
  textDim: string;
  isRunningAction: boolean;
  copiedPath: string | null;
  onCopyPath: (path: string) => void;
  onAction: (
    action: 'stage-file' | 'unstage-file' | 'discard-file',
    filePath: string,
  ) => void;
}> = ({
  title,
  files,
  emptyLabel,
  accent,
  text,
  textDim,
  isRunningAction,
  copiedPath,
  onCopyPath,
  onAction,
}) => (
  <section className="space-y-3">
    <SectionHeader label={title} count={files.length} accent={accent} textDim={textDim} />
    {files.length > 0 ? (
      <div className="space-y-2">
        {files.map((file) => {
          const fileState = inferFileActionState(file);
          return (
            <div key={`${file.status}:${file.path}`} className="rounded-md border px-3 py-2" style={{ borderColor: `${accent}20` }}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => {
                  onCopyPath(file.path);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-block min-w-[32px] text-[10px] uppercase tracking-[0.2em]" style={{ color: accent }}>
                    {file.status}
                  </span>
                  <span className="flex-1 break-all text-[11px]" style={{ color: textDim }}>
                    {file.path}
                  </span>
                  {copiedPath === file.path ? (
                    <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: accent }}>
                      copied
                    </span>
                  ) : null}
                </div>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <FileActionButton
                  label="Stage"
                  onClick={() => onAction('stage-file', file.path)}
                  disabled={isRunningAction || !fileState.canStage}
                  accent={accent}
                  text={text}
                />
                <FileActionButton
                  label="Unstage"
                  onClick={() => onAction('unstage-file', file.path)}
                  disabled={isRunningAction || !fileState.canUnstage}
                  accent={accent}
                  text={text}
                />
                <FileActionButton
                  label="Discard"
                  onClick={() => onAction('discard-file', file.path)}
                  disabled={isRunningAction || !fileState.canDiscard}
                  accent="#ef4444"
                  text={text}
                />
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="rounded-md border px-3 py-2 text-[11px]" style={{ borderColor: 'rgba(255,255,255,0.06)', color: textDim }}>
        {emptyLabel}
      </div>
    )}
  </section>
);

export const ChangesSidebar: React.FC<ChangesSidebarProps> = ({ isOpen, onToggle, state }) => {
  const theme = useCanvasStore((store) => store.theme);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const snapshot = state.snapshot;

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

  return (
    <aside
      className={`h-full overflow-hidden border-l transition-[width] duration-300 ${isOpen ? 'w-[320px]' : 'w-[58px]'}`}
      style={{
        background: theme.panelBg,
        borderColor: `${theme.border}`,
        backdropFilter: 'blur(26px)',
        boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex h-full flex-col">
        <div className="border-b px-3 py-3" style={{ borderColor: theme.border }}>
          <div className={`flex items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
            {isOpen ? (
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em]" style={{ color: theme.accent }}>
                  changes
                </div>
                <div className="mt-1 text-[11px]" style={{ color: theme.textDim }}>
                  tracked, untracked, conflicts
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
              title={isOpen ? 'Collapse changes panel' : 'Expand changes panel'}
            >
              {isOpen ? 'Close' : 'Git'}
            </button>
          </div>
        </div>

        {isOpen ? (
          <div className="repo-sidebar-scroll flex-1 overflow-y-auto px-4 py-4">
            {snapshot?.isRepo ? (
              <div className="space-y-6">
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: theme.border }}>
                  <div className="text-[10px] uppercase tracking-[0.28em]" style={{ color: theme.accent }}>
                    repository
                  </div>
                  <div className="mt-2 text-sm font-semibold" style={{ color: theme.text }}>
                    {snapshot.repoName}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: theme.textDim }}>
                    {snapshot.branch ?? 'detached'}{snapshot.headSha ? ` @ ${snapshot.headSha}` : ''}
                  </div>
                </div>

                <FileListSection
                  title="tracked"
                  files={state.fileGroups.tracked}
                  emptyLabel="no tracked file changes"
                  accent={theme.accent}
                  text={theme.text}
                  textDim={theme.textDim}
                  isRunningAction={state.isRunningAction}
                  copiedPath={copiedPath}
                  onCopyPath={(value) => {
                    void copyPath(value);
                  }}
                  onAction={(action, filePath) => {
                    void state.runAction(action, { filePath });
                  }}
                />

                <FileListSection
                  title="untracked"
                  files={state.fileGroups.untracked}
                  emptyLabel="no untracked files"
                  accent="#38bdf8"
                  text={theme.text}
                  textDim={theme.textDim}
                  isRunningAction={state.isRunningAction}
                  copiedPath={copiedPath}
                  onCopyPath={(value) => {
                    void copyPath(value);
                  }}
                  onAction={(action, filePath) => {
                    void state.runAction(action, { filePath });
                  }}
                />

                <FileListSection
                  title="conflicts"
                  files={state.fileGroups.conflicts}
                  emptyLabel="no merge conflicts"
                  accent="#f97316"
                  text={theme.text}
                  textDim={theme.textDim}
                  isRunningAction={state.isRunningAction}
                  copiedPath={copiedPath}
                  onCopyPath={(value) => {
                    void copyPath(value);
                  }}
                  onAction={(action, filePath) => {
                    void state.runAction(action, { filePath });
                  }}
                />
              </div>
            ) : (
              <div className="rounded-xl border px-3 py-3 text-[11px]" style={{ borderColor: theme.border, color: theme.textDim }}>
                {state.isLoading
                  ? 'Scanning repository...'
                  : snapshot?.errorMessage ?? 'No repository metadata is available.'}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-2">
            <div className="text-center [writing-mode:vertical-rl] text-[10px] uppercase tracking-[0.35em]" style={{ color: theme.textDim }}>
              changes
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
