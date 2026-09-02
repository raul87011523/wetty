import type winston from 'winston';

export interface SSH {
  [s: string]: string | number | boolean | undefined;
  user: string;
  host: string;
  auth: string;
  port: number;
  knownHosts: string;
  allowRemoteHosts: boolean;
  allowRemoteCommand: boolean;
  pass?: string;
  key?: string;
  config?: string;
}

export interface SSL {
  key: string;
  cert: string;
}

export interface SSLBuffer {
  key?: Buffer;
  cert?: Buffer;
}

export interface Server {
  [s: string]: string | number | boolean;
  port: number;
  host: string;
  title: string;
  base: string;
  allowIframe: boolean;
}

export type CorrectorMode = 'dictionary' | 'llm' | 'both';

/**
 * A shortcut as configured: 'none', 'double-ctrl', or a chord such as
 * 'ctrl+shift+f'. Parsed and canonicalised by `shared/hotkey.ts`; a literal
 * union cannot express a chord, so this is validated at run time instead.
 */
export type VoiceHotkey = string;

/**
 * The declared voice options, kept apart from the index signature below so
 * that `keyof VoiceFields` lists them. `mergeCliConf` relies on that to turn a
 * forgotten field into a compile error rather than a silently dropped option.
 */
export interface VoiceFields {
  enabled: boolean;
  hotkeyToggle: VoiceHotkey;
  hotkeyDictate: VoiceHotkey;
  hotkeyCorrect: VoiceHotkey;
  hotkeySend: VoiceHotkey;
  /** Deprecated alias of `hotkeyDictate`, kept so existing configs still work. */
  hotkey: VoiceHotkey;
  sttUrl: string;
  sttTimeout: number;
  correctorMode: CorrectorMode;
  llmUrl: string;
  llmModel: string;
  llmTimeout: number;
  dictionaryPath: string;
}

export interface Voice extends VoiceFields {
  [s: string]: string | number | boolean;
}

export interface Config {
  ssh: SSH;
  server: Server;
  voice: Voice;
  forceSSH: boolean;
  command: string;
  logLevel: typeof winston.level;
  ssl?: SSL;
}
