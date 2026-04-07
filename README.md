# KMux

KMux is an Electron desktop app for managing multiple terminal workspaces with keyboard-first navigation, profile-aware shell launching, and a cinematic workspace canvas.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Start the app:

```bash
pnpm start
```

## Useful Commands

```bash
pnpm lint
pnpm typecheck
pnpm test:terminal
pnpm package
pnpm make
```

## Features

- Multiple workspaces with independent terminal stacks
- Keyboard-driven terminal and workspace navigation
- Searchable terminal switcher
- Dynamic shell profile discovery across Windows, macOS, and Linux
- Embedded xterm.js terminal sessions backed by `node-pty`

## `node-pty` Prerequisites

`node-pty` is a native Node module. Installing it, rebuilding it for Electron, and packaging the app all depend on having the native build toolchain available on the host OS.
It also expects a compatible runtime version; upstream currently documents Node.js 16+ or Electron 19+ as the minimum supported baseline.

### Linux

Install a Python 3 runtime, `make`, and a C/C++ toolchain.

Example for Debian/Ubuntu:

```bash
sudo apt install -y python3 make build-essential
```

### macOS

Install Xcode Command Line Tools so `clang`, `clang++`, and `make` are available:

```bash
xcode-select --install
```

Full Xcode also works, but the command line tools are the minimum prerequisite.

### Windows

You need all of the following before `node-pty` will build reliably:

- Python 3.
- Visual Studio 2022 Build Tools or Visual Studio Community with the `Desktop development with C++` workload.
- Windows SDK, specifically the desktop C++ app components.
- Spectre-mitigated MSVC libraries. If you hit `MSB8040: Spectre-mitigated libraries are required for this project`, open Visual Studio Installer, go to `Individual components`, search for `Spectre`, and install the matching component for your toolset and architecture, such as `MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libs`.

If you are setting up a fresh Windows machine for this project, the practical minimum is:

- `Desktop development with C++`
- A current Windows 10/11 SDK
- The matching Spectre-mitigated libraries for the installed MSVC toolset

## Notes

- This repo is standardized on `pnpm`.
- Terminal sessions are OS-shell aware and profile-aware.
- Terminal process state persists while the app is open; sessions do not auto-restore after app restart in v1.
- If `node-pty` fails to build or run, verify the OS-specific native build prerequisites above first.
