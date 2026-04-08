# KMux (Karousel Terminal Multiplexer)

## Requirements Specification (requirements.md)

---

## 1. Overview

KMux is a desktop application that reimagines terminal management as a spatial workspace. Instead of tabs or splits, terminals are arranged on an infinite horizontal canvas, enabling fluid navigation, spatial memory, and improved workflow organization.

---

## 2. Objectives

* Provide a unified workspace for managing multiple terminal sessions
* Replace tab-based navigation with spatial navigation
* Enable persistent and context-aware terminal sessions
* Deliver consistent cross-platform behavior

---

## 3. Scope

### In Scope

* Terminal session management
* Infinite horizontal workspace
* Navigation and focus handling
* Session persistence
* Basic search functionality

### Out of Scope (MVP)

* Advanced Git automation (PR creation, worktrees)
* Third-party AI integrations (Codex, Claude, etc.)
* Plugin ecosystem

---

## 4. Definitions

* **Terminal Session**: A PTY-backed shell instance
* **Workspace**: Infinite horizontal canvas containing terminals
* **Viewport**: Visible region of the workspace
* **Focus**: Currently active terminal receiving input

---

## 5. Functional Requirements

### 5.1 Terminal Management

* System shall allow users to spawn new terminal sessions
* Each session must be backed by a real PTY process
* Sessions must persist while navigating the workspace
* Users must be able to close terminals

### 5.2 Workspace Layout

* Terminals shall be arranged horizontally in a linear sequence
* Adding a new terminal shall place it to the right of the last terminal
* Existing terminals must not resize when new ones are added

### 5.3 Navigation

* Users shall navigate horizontally using keyboard and/or trackpad
* System shall support smooth scrolling across terminals
* System shall maintain current viewport position

### 5.4 Focus Management

* Only one terminal shall be active at a time
* Input must be directed exclusively to the focused terminal
* Visual indication of active terminal must be provided

### 5.5 Viewport & Virtualization

* System shall render only visible terminals
* Off-screen terminals must remain active but not rendered
* Rendering must be optimized to prevent performance degradation

### 5.6 Session Persistence

* Terminal sessions must retain:

  * Scrollback buffer
  * Process state
  * Working directory

### 5.7 Fuzzy Search (Phase 2)

* Users shall search terminals by name or path
* System shall allow instant navigation to selected terminal

### 5.8 Zoom-Out Overview (Phase 2)

* System shall provide a zoomed-out grid view of all terminals
* Users shall select any terminal from this view

---

## 6. Non-Functional Requirements

### 6.1 Performance

* Must support at least 20 concurrent terminal sessions
* Navigation latency must be < 100ms
* Rendering must remain smooth (60 FPS target)

### 6.2 Scalability

* System must handle increasing number of terminals without UI degradation

### 6.3 Reliability

* Terminal processes must not crash during navigation
* Session state must remain consistent

### 6.4 Cross-Platform Compatibility

* Must support Windows, macOS, and Linux

### 6.5 Usability

* Navigation must be intuitive and fluid
* Minimal learning curve for users familiar with terminals

---

## 7. System Architecture

### Components

* Renderer Layer (React UI)
* Terminal Rendering (xterm.js)
* Backend PTY Manager (node-pty)
* IPC Communication (Electron)

### Data Flow

User Input → React UI → xterm.js → IPC → node-pty → OS Shell

---

## 8. Constraints

* Electron-based desktop application
* Dependence on system shell environments (bash, zsh, PowerShell)
* Limited by system memory and CPU resources

---

## 9. Assumptions

* Users are familiar with terminal usage
* System has sufficient resources to run multiple PTY sessions

---

## 10. Future Enhancements

* Git integration with repository insights
* Sidebar for file and repo navigation
* Notifications system
* Collaborative terminal sessions
* Plugin architecture

---

## 11. Acceptance Criteria

* Users can create and navigate multiple terminals seamlessly
* No performance degradation with up to 20 terminals
* Navigation is smooth and responsive
* Terminal sessions retain state during navigation

---

## 12. Risks

* Performance bottlenecks with many terminals
* Complex state management for persistence
* UX challenges in navigation model

---

## 13. Milestones

### Phase 1 (MVP)

* Terminal spawning
* Horizontal layout
* Navigation
* Focus management

### Phase 2

* Search
* Zoom-out overview
* Session labeling

### Phase 3

* Git integration
* Notifications
* Advanced workflows

---

## 14. Success Metrics

* Reduced time switching between terminals
* Increased session organization efficiency
* Positive user feedback on navigation experience

---
