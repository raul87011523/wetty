const DOUBLE_TAP_MS = 400;

/**
 * Is the onscreen keyboard's Ctrl button armed?
 *
 * Read from the DOM rather than from `term.ts` so the two Ctrl handlers stay
 * independent: while that button is armed it owns the next keystroke, and its
 * deferred backspace workaround must not race with dictation.
 *
 * @returns true when the onscreen Ctrl is waiting for a key
 */
const onscreenCtrlArmed = (): boolean =>
  document.getElementById('onscreen-ctrl')?.classList.contains('active') ??
  false;

/**
 * Toggle dictation on a double tap of Ctrl.
 *
 * Ctrl on its own sends nothing to the shell, so this needs no
 * `preventDefault()` and never interferes with normal typing. It is also not
 * reserved by the browser, unlike Ctrl+Tab, which Chrome and Firefox keep for
 * switching tabs and do not reliably deliver to the page.
 *
 * @param onTrigger - called when a clean double tap is detected
 * @returns a function that removes the listeners
 */
export function registerDoubleCtrl(onTrigger: () => void): () => void {
  let lastTap = 0;
  // True when another key went down while Ctrl was held, so a real shortcut
  // such as Ctrl+C never counts as a tap no matter how often it is repeated.
  let dirty = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Control') {
      // A fresh Ctrl press starts a clean tap, unless it is autorepeating
      // because the key is being held down.
      dirty = event.repeat;
      return;
    }
    dirty = true;
    lastTap = 0;
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== 'Control') return;

    if (dirty || onscreenCtrlArmed()) {
      lastTap = 0;
      return;
    }

    const now = Date.now();
    if (now - lastTap < DOUBLE_TAP_MS) {
      lastTap = 0;
      onTrigger();
    } else {
      lastTap = now;
    }
  };

  const onBlur = (): void => {
    // A keyup we never see would otherwise leave half a tap pending.
    lastTap = 0;
    dirty = false;
  };

  // On `document` so the shortcut works with the focus in the terminal or in
  // the review textarea alike.
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);

  return (): void => {
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
  };
}
