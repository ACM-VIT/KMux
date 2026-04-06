export const buildPtyEnv = (inputEnv: NodeJS.ProcessEnv): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(inputEnv)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  env.TERM = env.TERM ?? 'xterm-256color';
  return env;
};
