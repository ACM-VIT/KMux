import type { ITheme } from '@xterm/xterm';
import type { Theme } from '../../../types/canvas-types';

export const toXtermTheme = (theme: Theme): ITheme => {
  return {
    background: theme.panelBg,
    foreground: theme.text,
    cursor: theme.accent,
    cursorAccent: theme.bg,
    selectionBackground: `${theme.accent}55`,
    black: '#000000',
    red: '#ff5f56',
    green: '#27c93f',
    yellow: '#ffbd2e',
    blue: '#5c9dff',
    magenta: '#bd93f9',
    cyan: '#38bdf8',
    white: '#e8dcc8',
    brightBlack: '#666666',
    brightRed: '#ff7b72',
    brightGreen: '#3fb950',
    brightYellow: '#d29922',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#ffffff',
  };
};
