/**
 * Voice toolbar shortcuts, shared by server and client.
 *
 * The server parses and canonicalises the configured strings before writing
 * them into the page, so the client only ever sees a normalised value and the
 * markup can never carry anything but `[a-z0-9+-]`. Nothing here touches the
 * DOM or node, so both bundles can import it.
 */

export type VoiceAction = 'toggle' | 'dictate' | 'correct' | 'send';

/** Fixed order: the first match wins when two actions share a shortcut. */
export const VOICE_ACTIONS: readonly VoiceAction[] = [
  'toggle',
  'dictate',
  'correct',
  'send',
];

export const HOTKEY_NONE = 'none';
export const HOTKEY_DOUBLE_CTRL = 'double-ctrl';

export interface Chord {
  kind: 'chord';
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  /** `KeyboardEvent.code`, e.g. `KeyD`, `Digit2`, `Space`, `F5`. */
  code: string;
}

export interface DoubleTap {
  kind: 'double-tap';
}

export interface NoBinding {
  kind: 'none';
  reason?: string;
}

export type Binding = Chord | DoubleTap | NoBinding;

/**
 * The part of `KeyboardEvent` the matcher needs. Declaring it structurally
 * keeps this module free of the DOM lib, so it type checks on the server and
 * can be unit tested with plain objects.
 */
export interface KeyLike {
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  code: string;
}

const MODIFIERS: Record<string, 'ctrl' | 'alt' | 'shift' | 'meta'> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
  win: 'meta',
};

const NAMED_KEYS: Record<string, string> = {
  space: 'Space',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  esc: 'Escape',
  escape: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  insert: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pgup: 'PageUp',
  pagedown: 'PageDown',
  pgdn: 'PageDown',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

const PUNCTUATION: Record<string, string> = {
  '-': 'Minus',
  '=': 'Equal',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  '`': 'Backquote',
};

/**
 * Shortcuts that must never be bound, with the reason.
 *
 * The terminal ones were measured against a running xterm 5.5.0 by watching
 * `term.onData`, not deduced: `ctrl+shift+enter` really does send a carriage
 * return, which would execute the command line, and that is the one thing the
 * voice path exists to prevent.
 */
const RESERVED: Record<string, string> = {
  'ctrl+shift+c': 'the copy shortcut uses it',
  'ctrl+shift+enter': 'the terminal reads it as Enter (0x0d)',
  'ctrl+shift+-': 'the terminal reads it as 0x1f',
  'ctrl+shift+2': 'the terminal reads it as NUL',
};

const none = (reason?: string): NoBinding => ({ kind: 'none', reason });

/**
 * Translate a key token into a `KeyboardEvent.code`.
 *
 * Letters and digits name **physical positions on a US layout**, which is what
 * `code` reports. That is deliberate: `key` changes with the layout and with
 * the modifiers held (spanish `Shift+2` is `"`, US is `@`), so it cannot
 * express a stable shortcut.
 *
 * @param token - a single lowercase token
 * @returns the matching code, or undefined when the token is not a key
 */
export function tokenToCode(token: string): string | undefined {
  if (/^[a-z]$/.test(token)) return `Key${token.toUpperCase()}`;
  if (/^[0-9]$/.test(token)) return `Digit${token}`;
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(token)) return token.toUpperCase();
  return NAMED_KEYS[token] ?? PUNCTUATION[token];
}

/**
 * Parse a configured shortcut.
 *
 * Accepts `none`, `double-ctrl`, or a chord such as `ctrl+shift+f`. A chord
 * needs at least one modifier: a bare key would steal a real key from the
 * terminal, so it is rejected rather than offered as an option.
 *
 * @param spec - the configured string
 * @returns the parsed binding, never throws
 */
export function parseHotkey(spec: string | undefined | null): Binding {
  const raw = (spec ?? '').trim().toLowerCase();
  if (raw === '' || raw === HOTKEY_NONE) return none();
  if (raw === HOTKEY_DOUBLE_CTRL) return { kind: 'double-tap' };

  const tokens = raw.split('+').map((token) => token.trim());
  // A trailing `+` means the key is missing; `ctrl++` is not bindable either.
  if (tokens.some((token) => token === '')) {
    return none(`"${raw}" is not a valid shortcut`);
  }

  const chord: Chord = {
    kind: 'chord',
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    code: '',
  };

  const keyToken = tokens[tokens.length - 1];
  for (const token of tokens.slice(0, -1)) {
    const modifier = MODIFIERS[token];
    if (modifier === undefined) return none(`unknown modifier "${token}"`);
    chord[modifier] = true;
  }

  // The last token may still be a modifier, as in `ctrl+shift`, which has no key.
  if (MODIFIERS[keyToken] !== undefined) {
    return none(`"${raw}" has no key, only modifiers`);
  }

  const code = tokenToCode(keyToken);
  if (code === undefined) return none(`unknown key "${keyToken}"`);
  chord.code = code;

  if (!chord.ctrl && !chord.alt && !chord.meta && !chord.shift) {
    return none(`"${raw}" needs a modifier, a bare key belongs to the terminal`);
  }

  const canonical = canonicalHotkey(chord);
  const reserved = RESERVED[canonical];
  if (reserved !== undefined) return none(`${canonical} is reserved: ${reserved}`);

  return chord;
}

/**
 * Canonical string for a binding, so that `shift+ctrl+f` and `ctrl+shift+f`
 * compare equal and duplicates can be detected.
 *
 * The output alphabet is `[a-z0-9+-]` plus the punctuation tokens, which is
 * what makes it safe to interpolate into an html attribute.
 *
 * @param binding - parsed binding
 * @returns canonical form
 */
export function canonicalHotkey(binding: Binding): string {
  if (binding.kind === 'none') return HOTKEY_NONE;
  if (binding.kind === 'double-tap') return HOTKEY_DOUBLE_CTRL;

  const parts: string[] = [];
  if (binding.ctrl) parts.push('ctrl');
  if (binding.alt) parts.push('alt');
  if (binding.shift) parts.push('shift');
  if (binding.meta) parts.push('meta');
  parts.push(codeToToken(binding.code));
  return parts.join('+');
}

/**
 * Human readable form, for the tooltips on the toolbar buttons.
 *
 * @param binding - parsed binding
 * @returns a label such as `Ctrl+Shift+F`, or an empty string when unbound
 */
export function describeBinding(binding: Binding): string {
  if (binding.kind === 'none') return '';
  if (binding.kind === 'double-tap') return 'Ctrl Ctrl';
  return canonicalHotkey(binding)
    .split('+')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('+');
}

/**
 * Inverse of `tokenToCode`, used to build the canonical form.
 *
 * @param code - a `KeyboardEvent.code`
 * @returns the token that produces it
 */
function codeToToken(code: string): string {
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code.toLowerCase();
  const named = Object.entries(NAMED_KEYS).find(([, value]) => value === code);
  if (named !== undefined) return named[0];
  const punctuation = Object.entries(PUNCTUATION).find(
    ([, value]) => value === code,
  );
  return punctuation === undefined ? code.toLowerCase() : punctuation[0];
}

/**
 * Does this event fire this chord?
 *
 * Modifiers compare **exactly**, not "at least". That is what keeps AltGr,
 * which reports ctrl and alt together on windows, from ever firing an
 * `alt+...` binding, and keeps `ctrl+alt+shift+f` from firing `ctrl+shift+f`.
 *
 * @param chord - the chord to match
 * @param event - the keyboard event
 * @returns true on an exact match
 */
export const matchesChord = (chord: Chord, event: KeyLike): boolean =>
  event.code !== '' &&
  event.code === chord.code &&
  event.ctrlKey === chord.ctrl &&
  event.altKey === chord.alt &&
  event.shiftKey === chord.shift &&
  event.metaKey === chord.meta;

export interface ActionBinding {
  action: VoiceAction;
  binding: Binding;
}

/**
 * Parse one shortcut per action, in the fixed action order.
 *
 * @param specs - raw strings, keyed by action
 * @returns the parsed bindings
 */
export const parseBindings = (
  specs: Partial<Record<VoiceAction, string>>,
): ActionBinding[] =>
  VOICE_ACTIONS.map((action) => ({
    action,
    binding: parseHotkey(specs[action]),
  }));

/**
 * The action bound to this event, if any. The first match in action order
 * wins, so a shortcut configured twice never fires two actions at once.
 *
 * @param bindings - parsed bindings
 * @param event - the keyboard event
 * @returns the action to run, or undefined
 */
export function findAction(
  bindings: readonly ActionBinding[],
  event: KeyLike,
): VoiceAction | undefined {
  const hit = bindings.find(
    ({ binding }) => binding.kind === 'chord' && matchesChord(binding, event),
  );
  return hit?.action;
}

/**
 * Groups of actions that share the same shortcut, so the caller can warn.
 * `none` is not a conflict, several actions may be unbound.
 *
 * @param bindings - parsed bindings
 * @returns one array per clashing group, in action order
 */
export function duplicateBindings(
  bindings: readonly ActionBinding[],
): VoiceAction[][] {
  const byKey = new Map<string, VoiceAction[]>();
  bindings.forEach(({ action, binding }) => {
    if (binding.kind === 'none') return;
    const key = canonicalHotkey(binding);
    byKey.set(key, [...(byKey.get(key) ?? []), action]);
  });
  return [...byKey.values()].filter((group) => group.length > 1);
}
