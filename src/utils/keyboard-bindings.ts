export const KEY_TOKEN_BY_CODE: Record<string, string> = {
  Space: 'space',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

export const normalizeBindingKey = (event: Pick<KeyboardEvent, 'code' | 'key'>): string => {
  const { code, key } = event;

  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }

  if (/^Digit\d$/.test(code)) {
    return code.slice(5);
  }

  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) {
    return code.toLowerCase();
  }

  if (KEY_TOKEN_BY_CODE[code]) {
    return KEY_TOKEN_BY_CODE[code];
  }

  const fallbackKey = key.toLowerCase();
  if (fallbackKey === ' ') {
    return 'space';
  }
  if (fallbackKey === 'esc') {
    return 'escape';
  }
  return fallbackKey;
};

export const createBindingTokenFromEvent = (event: KeyboardEvent): string | null => {
  const baseKey = normalizeBindingKey(event);
  if (baseKey === 'shift' || baseKey === 'alt' || baseKey === 'meta' || baseKey === 'control') {
    return null;
  }

  const tokens: string[] = [];
  if (event.ctrlKey) {
    tokens.push('ctrl');
  }
  if (event.shiftKey) {
    tokens.push('shift');
  }
  tokens.push(baseKey);
  return tokens.join('+');
};

export const formatBindingDisplay = (value: string): string => {
  return value
    .split('+')
    .map((token) => (token.length === 1 ? token.toUpperCase() : token[0].toUpperCase() + token.slice(1)))
    .join(' + ');
};
