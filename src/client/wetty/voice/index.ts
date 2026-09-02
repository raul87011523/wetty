import type { VoiceAction } from '../../../shared/hotkey.js';
import { correct, transcribe } from './api.js';
import { VoiceBuffer } from './buffer.js';
import { canonicalHotkey, describeBinding, parseHotkey } from '../../../shared/hotkey.js';
import { loadOptions } from '../term/load.js';
import { registerHotkeys } from './hotkey.js';
import { Recorder } from './recorder.js';

/**
 * A dictated line must never arrive at the shell with a newline in it: that
 * would run the command instead of leaving it at the prompt for review.
 *
 * @param text - text as reviewed in the buffer
 * @returns single line text
 */
const singleLine = (text: string): string =>
  text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Keep the toolbar above the on screen keyboard on mobile, where the visual
 * viewport shrinks instead of the window.
 *
 * @param root - toolbar element
 */
function followViewport(root: HTMLElement): void {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const reposition = (): void => {
    const gap = window.innerHeight - (viewport.height + viewport.offsetTop);
    root.style.bottom = `${Math.max(gap, 0)}px`;
  };
  viewport.addEventListener('resize', reposition);
  viewport.addEventListener('scroll', reposition);
  reposition();
}

/**
 * Wire the voice toolbar.
 *
 * The three stages stay deliberately separate, and none of them presses
 * Enter: send only types the text into the terminal.
 */
let disposeHotkeys: (() => void) | undefined;

/**
 * The shortcut to use for one action: what the user configured, when it is
 * usable, otherwise what the server sent.
 *
 * @param configured - value from the configuration menu
 * @param fromServer - value rendered into the toolbar markup
 * @returns the shortcut to bind
 */
function pick(configured: string | undefined, fromServer = ''): string {
  const trimmed = (configured ?? '').trim();
  if (trimmed === '') return fromServer;
  const parsed = parseHotkey(trimmed);
  if (parsed.kind === 'none' && parsed.reason !== undefined) {
    // eslint-disable-next-line no-console
    console.warn(`voice: ignoring "${trimmed}", ${parsed.reason}`);
    return fromServer;
  }
  return canonicalHotkey(parsed);
}

export function voiceToolbar(): void {
  const root = document.getElementById('voice');
  // `wetty.ts` runs this on every socket connect, including reconnects.
  if (!root || root.dataset.mounted === 'true') return;
  root.dataset.mounted = 'true';

  const buffer = new VoiceBuffer(root);
  const recorder = new Recorder();

  /**
   * Start dictation, or stop it and transcribe what was captured.
   * The same action does both, so recording never ends on its own.
   */
  async function dictate(): Promise<void> {
    if (buffer.busy) return;
    buffer.open();

    if (recorder.recording) {
      buffer.setState('transcribing');
      try {
        const wav = await recorder.stop();
        if (!wav) {
          buffer.setState('idle');
          return;
        }
        const text = await transcribe(wav);
        buffer.text = [buffer.text.trim(), text].filter(Boolean).join(' ');
        buffer.setState('ready');
        buffer.focusText();
      } catch (err) {
        buffer.fail((err as Error).message);
      }
      return;
    }

    try {
      await recorder.start();
      buffer.setState('recording');
    } catch (err) {
      buffer.fail((err as Error).message);
    }
  }

  /**
   * Improve the transcript in place, leaving it in the buffer for review.
   */
  async function improve(): Promise<void> {
    const text = buffer.text.trim();
    if (buffer.busy || recorder.recording || text === '') return;

    buffer.setState('correcting');
    try {
      buffer.text = await correct(text);
      buffer.setState('ready');
      buffer.focusText();
    } catch (err) {
      buffer.fail((err as Error).message);
    }
  }

  /**
   * Type the reviewed text into the terminal without executing it.
   */
  function send(): void {
    const text = singleLine(buffer.text);
    if (buffer.busy || recorder.recording || text === '') return;

    const term = window.wetty_term;
    if (!term) return;

    // `paste` brackets the text only when the remote app asked for bracketed
    // paste, so it degrades cleanly. No `\x0A` anywhere: the user presses
    // Enter themselves after reading what landed at the prompt.
    if (typeof term.paste === 'function') term.paste(text);
    else term.input(text, false);

    buffer.text = '';
    buffer.setState('idle');
    term.focus();
  }

  /**
   * Open or close the bar. Closing hands the focus back to the terminal:
   * otherwise it stays on `body` and whatever is typed next is lost.
   */
  function toggle(): void {
    buffer.toggle();
    if (!buffer.isOpen) window.wetty_term?.focus();
  }

  window.voiceToggle = toggle;
  window.voiceDictate = (): void => {
    dictate();
  };
  window.voiceCorrect = (): void => {
    improve();
  };
  window.voiceSend = send;

  /**
   * Bind the shortcuts and show them on the buttons.
   *
   * The configuration menu wins over what the server sent, but only when its
   * value parses: a shortcut typed wrong falls back to the server one instead
   * of leaving the action unreachable.
   */
  function applyHotkeys(bar: HTMLElement): void {
    const stored = loadOptions().voice;
    const specs: Record<VoiceAction, string> = {
      toggle: pick(stored?.hotkeyToggle, bar.dataset.hotkeyToggle),
      dictate: pick(stored?.hotkeyDictate, bar.dataset.hotkeyDictate),
      correct: pick(stored?.hotkeyCorrect, bar.dataset.hotkeyCorrect),
      send: pick(stored?.hotkeySend, bar.dataset.hotkeySend),
    };

    disposeHotkeys?.();
    disposeHotkeys = registerHotkeys(specs, {
      toggle: () => toggle(),
      dictate: () => {
        dictate();
      },
      correct: () => {
        improve();
      },
      send,
    });

    bar.querySelectorAll('.voice-shortcut').forEach((label) => {
      const action = (label as HTMLElement).dataset.action as VoiceAction;
      const shortcut = describeBinding(parseHotkey(specs[action]));
      // eslint-disable-next-line no-param-reassign
      (label as HTMLElement).innerText = shortcut === '' ? '' : ` (${shortcut})`;
    });
  }

  window.voiceApplyHotkeys = (): void => applyHotkeys(root);
  applyHotkeys(root);

  followViewport(root);
}
