export type XTerm = {
  cols?: number;
  rows?: number;
  fontSize: number;
} & Record<string, unknown>;

/** Voice shortcuts as edited in the configuration menu. */
export interface VoiceOptions {
  hotkeyToggle: string;
  hotkeyDictate: string;
  hotkeyCorrect: string;
  hotkeySend: string;
}

export interface Options {
  xterm: XTerm;
  wettyFitTerminal: boolean;
  wettyVoid: number;
  voice?: VoiceOptions;
}
