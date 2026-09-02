import { isDev } from './env.js';
import type { SSH, Server, Voice, CorrectorMode, VoiceHotkey } from './interfaces';

export const sshDefault: SSH = {
  user: process.env.SSHUSER || '',
  host: process.env.SSHHOST || 'localhost',
  auth: process.env.SSHAUTH || 'password',
  pass: process.env.SSHPASS || undefined,
  key: process.env.SSHKEY || undefined,
  port: parseInt(process.env.SSHPORT || '22', 10),
  knownHosts: process.env.KNOWNHOSTS || '/dev/null',
  allowRemoteHosts: false,
  allowRemoteCommand: false,
  config: process.env.SSHCONFIG || undefined,
};

export const serverDefault: Server = {
  base: process.env.BASE || '/wetty/',
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  title: process.env.TITLE || 'WeTTY - The Web Terminal Emulator',
  allowIframe: process.env.ALLOWIFRAME === 'true' || false,
};

/**
 * Shortcuts shipped with the toolbar, free of environment variables so that
 * validation always has something to fall back to.
 *
 * All four were measured against a running xterm by watching `term.onData`:
 * `ctrl+shift+<key>` sends nothing to the shell, so even a shortcut that never
 * reaches its handler cannot type into the terminal. The mnemonic letters
 * (v, d, c, e) are unusable here because Chrome and Firefox reserve them.
 */
export const builtinHotkeys = {
  hotkeyToggle: 'ctrl+shift+l',
  hotkeyDictate: 'ctrl+shift+space',
  hotkeyCorrect: 'ctrl+shift+f',
  hotkeySend: 'ctrl+shift+x',
};

export const voiceDefault: Voice = {
  enabled: process.env.VOICE_ENABLED !== 'false',
  hotkeyToggle:
    (process.env.VOICE_HOTKEY_TOGGLE as VoiceHotkey) ||
    builtinHotkeys.hotkeyToggle,
  hotkeyDictate:
    (process.env.VOICE_HOTKEY_DICTATE as VoiceHotkey) ||
    builtinHotkeys.hotkeyDictate,
  hotkeyCorrect:
    (process.env.VOICE_HOTKEY_CORRECT as VoiceHotkey) ||
    builtinHotkeys.hotkeyCorrect,
  hotkeySend:
    (process.env.VOICE_HOTKEY_SEND as VoiceHotkey) || builtinHotkeys.hotkeySend,
  // Deprecated: empty means unset, `resolveVoiceHotkeys` maps it onto dictate.
  hotkey: (process.env.VOICE_HOTKEY as VoiceHotkey) || '',
  sttUrl: process.env.STT_URL || 'http://whisper:8080',
  sttTimeout: parseInt(process.env.STT_TIMEOUT || '120000', 10),
  correctorMode: (process.env.CORRECTOR_MODE as CorrectorMode) || 'both',
  llmUrl: process.env.LLM_URL || 'http://ollama:11434',
  llmModel: process.env.LLM_MODEL || 'qwen2.5-coder:3b',
  llmTimeout: parseInt(process.env.LLM_TIMEOUT || '30000', 10),
  dictionaryPath: process.env.VOICE_DICTIONARY || '',
};

export const forceSSHDefault = process.env.FORCESSH === 'true' || false;
export const defaultCommand = process.env.COMMAND || 'login';
export const defaultLogLevel = isDev ? 'debug' : 'http';
