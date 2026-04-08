import type { WidthFraction } from '../types/canvas-types';
import { TERMINAL_WIDTHS } from '../lib/constants';

export const getWidthVW = (fraction: WidthFraction | undefined): number => {
  if (!fraction) {
    return TERMINAL_WIDTHS['1'];
  }
  return TERMINAL_WIDTHS[fraction] ?? TERMINAL_WIDTHS['1'];
};

export const getWidthVWString = (widthFraction: WidthFraction | undefined): string => {
  return `${getWidthVW(widthFraction)}vw`;
};
