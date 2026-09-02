import _ from 'lodash';
import type { XTerm, Options, VoiceOptions } from './options';

export const defaultOptions: Options = {
  xterm: { fontSize: 14 },
  wettyVoid: 0,
  wettyFitTerminal: true,
};

/**
 * Shortcuts as the server configured them, read from the toolbar markup.
 *
 * They are the baseline the configuration menu starts from, so the fields are
 * never blank and clearing one falls back to what the operator configured
 * rather than to nothing.
 *
 * @returns the server side shortcuts, or undefined when voice is disabled
 */
export function serverVoiceOptions(): VoiceOptions | undefined {
  const root = document.getElementById('voice');
  if (root == null) return undefined;
  return {
    hotkeyToggle: root.dataset.hotkeyToggle ?? '',
    hotkeyDictate: root.dataset.hotkeyDictate ?? '',
    hotkeyCorrect: root.dataset.hotkeyCorrect ?? '',
    hotkeySend: root.dataset.hotkeySend ?? '',
  };
}

export function loadOptions(): Options {
  try {
    let options = _.isUndefined(localStorage.options)
      ? defaultOptions
      : JSON.parse(localStorage.options);
    // Convert old options to new options
    if (!('xterm' in options)) {
      const xterm = options;
      options = defaultOptions;
      options.xterm = xterm as unknown as XTerm;
    }
    const server = serverVoiceOptions();
    if (server !== undefined) {
      options.voice = { ...server, ...(options.voice ?? {}) };
    }
    return options;
  } catch {
    return defaultOptions;
  }
}
