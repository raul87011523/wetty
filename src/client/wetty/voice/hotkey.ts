import {
  duplicateBindings,
  findAction,
  parseBindings,
} from '../../../shared/hotkey.js';
import type { VoiceAction } from '../../../shared/hotkey.js';

const DOUBLE_TAP_MS = 400;
// A keydown we consumed owes its keyup a swallow. If that keyup never arrives
// (window switch, os shortcut) the entry would linger, so it also expires.
const CONSUMED_TTL_MS = 2000;

export type ActionHandlers = Record<VoiceAction, () => void>;

/**
 * Is one of the onscreen keyboard's modifier buttons armed?
 *
 * Read from the DOM rather than from `term.ts` so the two systems stay
 * independent: while one of those buttons is armed it owns the next
 * keystroke, and its deferred backspace workaround must not race with us.
 *
 * @returns true when Ctrl or Alt on screen is waiting for a key
 */
const onscreenModifierArmed = (): boolean =>
  ['onscreen-ctrl', 'onscreen-alt'].some(
    (id) => document.getElementById(id)?.classList.contains('active') ?? false,
  );

/**
 * Bind every configured voice shortcut.
 *
 * One pair of listeners drives all four actions. Chords are consumed with
 * `preventDefault` and `stopPropagation`: the second is the one that matters,
 * because xterm listens on its own textarea and never checks
 * `defaultPrevented`, so stopping the event in the capture phase on `document`
 * is what keeps the keystroke away from the shell.
 *
 * `double-ctrl` keeps its own path, unchanged: Ctrl on its own sends nothing,
 * so it needs no `preventDefault` and never interferes with typing.
 *
 * @param specs - canonical shortcut strings, one per action
 * @param handlers - what to run for each action
 * @returns a function that removes every listener
 */
export function registerHotkeys(
  specs: Partial<Record<VoiceAction, string>>,
  handlers: ActionHandlers,
): () => void {
  const bindings = parseBindings(specs);
  const chords = bindings.filter(({ binding }) => binding.kind === 'chord');
  const taps = bindings.filter(({ binding }) => binding.kind === 'double-tap');

  duplicateBindings(bindings).forEach((group) => {
    // eslint-disable-next-line no-console
    console.warn(
      `voice: the same shortcut is bound to ${group.join(' and ')}, only ${
        group[0]
      } will fire`,
    );
  });

  if (chords.length === 0 && taps.length === 0) return (): void => {};

  let lastTap = 0;
  // True when another key went down while Ctrl was held, so a real shortcut
  // such as Ctrl+C never counts as a tap no matter how often it is repeated.
  let dirty = false;
  const consumed = new Map<string, number>();

  const onKeyDown = (event: KeyboardEvent): void => {
    // Book keeping first: the double tap must see every key, matched or not.
    if (event.key === 'Control') {
      // A fresh Ctrl press starts a clean tap, unless it is autorepeating
      // because the key is being held down.
      dirty = event.repeat;
    } else {
      dirty = true;
      lastTap = 0;
    }

    // Holding a chord down must not fire the action thirty times a second.
    if (event.repeat || event.isComposing) return;
    if (onscreenModifierArmed()) return;

    const action = findAction(chords, event);
    if (action === undefined) return;

    event.preventDefault();
    event.stopPropagation();
    consumed.set(event.code, Date.now());
    // The match decides whether the key is consumed; the handler decides
    // whether anything happens. Making the consumption depend on the state
    // would let the same key reach the shell only sometimes.
    handlers[action]();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    const taken = consumed.get(event.code);
    if (taken !== undefined) {
      consumed.delete(event.code);
      if (Date.now() - taken < CONSUMED_TTL_MS) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    if (taps.length === 0 || event.key !== 'Control') return;
    if (dirty || onscreenModifierArmed()) {
      lastTap = 0;
      return;
    }

    const now = Date.now();
    if (now - lastTap < DOUBLE_TAP_MS) {
      lastTap = 0;
      handlers[taps[0].action]();
    } else {
      lastTap = now;
    }
  };

  const onBlur = (): void => {
    // A keyup we never see would otherwise leave half a tap pending.
    lastTap = 0;
    dirty = false;
    consumed.clear();
  };

  // On `document` in the capture phase so the shortcut works with the focus in
  // the terminal and in the review textarea alike, and so it runs before xterm.
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);

  return (): void => {
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
  };
}
