export type TerminalProfileId = string;

export interface TerminalProfile {
  id: TerminalProfileId;
  label: string;
  description: string;
}

export const normalizeTerminalProfileId = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const isTerminalProfileId = (value: unknown): value is TerminalProfileId => {
  return typeof value === 'string' && value.trim().length > 0;
};
