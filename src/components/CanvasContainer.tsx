import React, { useEffect, useMemo, useState } from 'react';
import { ChangesSidebar } from '../repo/renderer/components/ChangesSidebar';
import { useRepoDockState } from '../repo/renderer/hooks/useRepoDockState';
import { useCanvasStore } from '../store/useCanvasStore';
import { useTerminalRuntime } from '../terminal/renderer/context/useTerminalRuntime';
import { WorkspaceRow } from './WorkspaceRow';
import { FuzzyFinder } from './FuzzyFinder';
import {
  OVERVIEW_SCALE,
  SCREEN_HEIGHT_VH,
  TRANSITION_CANVAS,
  TRANSITION_UI,
} from '../lib/constants';

const ACTIVITY_BAR_WIDTH_PX = 48;
const SIDEBAR_PANEL_WIDTH_PX = 240;
const STATUS_BAR_HEIGHT_PX = 24;

export const CanvasContainer: React.FC = () => {
  const { workspaces, activeWorkspaceIndex, isOverview, theme } = useCanvasStore();
  const { sessions } = useTerminalRuntime();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const repoDockState = useRepoDockState();
  const hasGitRepo = repoDockState.snapshot?.isRepo === true;
  const leftDockWidth = ACTIVITY_BAR_WIDTH_PX + (hasGitRepo && isSidebarOpen ? SIDEBAR_PANEL_WIDTH_PX : 0);
  const translateY = -(activeWorkspaceIndex * SCREEN_HEIGHT_VH);

  useEffect(() => {
    if (!hasGitRepo && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [hasGitRepo, isSidebarOpen]);

  const activeWorkspace = workspaces[activeWorkspaceIndex];
  const activeTerminal = activeWorkspace
    ? activeWorkspace.terminals[activeWorkspace.activeTerminalIndex]
    : undefined;
  const activeSession = activeTerminal ? sessions[activeTerminal.id] : undefined;
  const profileLabel = activeSession?.shell ?? activeTerminal?.profileId ?? 'local';
  const isRemoteProfile = /ssh|remote|wsl|container/i.test(profileLabel);

  const totalChanges = useMemo(() => {
    if (!repoDockState.snapshot?.isRepo) {
      return 0;
    }
    const status = repoDockState.snapshot.status;
    return status.modified + status.added + status.deleted + status.untracked + status.conflicts;
  }, [repoDockState.snapshot]);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none cursor-default"
      style={{
        background: theme.bg,
        transition: `background ${TRANSITION_UI}`,
      }}
    >
      <div
        className="absolute top-0 right-0 overflow-hidden transition-[width,height,transform] duration-150 ease-out"
        style={{
          width: `calc(100% - ${leftDockWidth}px)`,
          height: `calc(100% - ${STATUS_BAR_HEIGHT_PX}px)`,
        }}
      >
        <div
          className="w-full h-full"
          style={{
            transition: `transform ${TRANSITION_CANVAS}`,
            transform: isOverview ? `scale(${OVERVIEW_SCALE})` : 'scale(1)',
            transformOrigin: 'center center',
          }}
        >
          <div
            className="w-full h-full transition-transform"
            style={{
              transition: `transform ${TRANSITION_CANVAS}`,
              transform: `translateY(${translateY}vh)`,
            }}
          >
            {workspaces.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                workspace={ws}
                isActiveWorkspace={ws.id === workspaces[activeWorkspaceIndex]?.id}
              />
            ))}
          </div>
        </div>
      </div>

      <FuzzyFinder />

      <div
        className="absolute left-0 top-0 h-full transition-[width] duration-150 ease-out"
        style={{
          width: `${leftDockWidth}px`,
          height: `calc(100% - ${STATUS_BAR_HEIGHT_PX}px)`,
          borderRight: `1px solid ${theme.border}`,
        }}
      >
        <ChangesSidebar
          isOpen={hasGitRepo && isSidebarOpen}
          onToggle={() => {
            if (!hasGitRepo) {
              return;
            }
            setIsSidebarOpen((current) => !current);
          }}
          state={repoDockState}
        />
      </div>

      <div
        className="absolute left-0 bottom-0 flex h-6 w-full items-center justify-between border-t px-3"
        style={{
          background: theme.panelBg,
          borderColor: theme.border,
          color: theme.textDim,
        }}
      >
        <div
          className="flex min-w-0 items-center gap-3 text-[11px]"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          <span style={{ color: theme.accent, fontFamily: 'JetBrains Mono, monospace' }}>
            {repoDockState.snapshot?.branch ?? 'no-repo'}
          </span>
          <span className="truncate">
            {repoDockState.activeCwd ?? 'No active directory'}
          </span>
          {totalChanges > 0 ? (
            <span style={{ color: theme.accent }}>{totalChanges} changed</span>
          ) : null}
        </div>
        <div
          className="flex items-center gap-3 text-[11px]"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          <span>WS {activeWorkspaceIndex + 1}</span>
          <button
            type="button"
            className="border px-2 leading-5"
            style={{
              borderColor: theme.border,
              color: isRemoteProfile ? theme.accent : theme.text,
              borderRadius: '2px',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            title="Active terminal profile"
          >
            {profileLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
