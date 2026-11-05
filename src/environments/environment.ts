// The server addresses are read at runtime from env.js (written by the Docker container when it starts),
// so the same build works for dev and live. The values below are only used by `ng serve`.
const defaults = {
  apiBase: 'https://dev-api.twth.lamarpro.com/api',
  chatApiBase: 'https://dev-chat.twth.lamarpro.com/api',
  hubUrl: 'https://dev-chat.twth.lamarpro.com/api/chat/chatHub',
  chatMediaBase: 'https://dev-chat.twth.lamarpro.com',
  uploadsBase: 'https://dev-api.twth.lamarpro.com',
};

const runtimeEnv = (globalThis as { __env?: Partial<typeof defaults> }).__env ?? {};

export const environment = {
  production: true,
  ...defaults,
  ...runtimeEnv,
};
