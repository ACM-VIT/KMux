import type { BrowserWindowConstructorOptions } from 'electron';

const DEFAULT_WINDOW_WIDTH = 1000;
const DEFAULT_WINDOW_HEIGHT = 720;
const DEFAULT_WINDOW_BACKGROUND = '#111827';

export const mainWindowConfig: BrowserWindowConstructorOptions = {
  width: DEFAULT_WINDOW_WIDTH,
  height: DEFAULT_WINDOW_HEIGHT,
  backgroundColor: DEFAULT_WINDOW_BACKGROUND,
  autoHideMenuBar: true,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
  },
};

export const shouldOpenDevTools = (devServerUrl?: string): boolean => {
  return Boolean(devServerUrl) && process.env.KMUX_OPEN_DEVTOOLS === 'true';
};
