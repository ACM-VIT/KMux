import type { Terminal } from '../types/canvas-types';

const TERMINAL_WIDTHS_VW: Record<NonNullable<Terminal['widthFraction']>, number> = {
  '1': 97,
  '2/3': 64,
  '1/2': 47,
  '1/3': 30,
};

export const GAPS_VW = 3;

export const getWidthVW = (widthFraction: Terminal['widthFraction']): number => {
  if (!widthFraction) {
    return TERMINAL_WIDTHS_VW['1'];
  }
  return TERMINAL_WIDTHS_VW[widthFraction];
};

export const getWidthVWString = (widthFraction: Terminal['widthFraction']): string => {
  return `${getWidthVW(widthFraction)}vw`;
};
