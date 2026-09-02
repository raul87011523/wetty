window.inflateOptions([
  {
    type: 'text',
    name: 'Toggle Voice Bar',
    description:
      'Shortcut that opens or closes the voice bar. A chord such as ctrl+shift+l, or double-ctrl, or none.',
    path: ['voice', 'hotkeyToggle'],
  },
  {
    type: 'text',
    name: 'Dictate',
    description:
      'Shortcut that starts recording, and stops it and transcribes when pressed again.',
    path: ['voice', 'hotkeyDictate'],
  },
  {
    type: 'text',
    name: 'Correct',
    description:
      'Shortcut that runs the text sitting in the buffer through the dictionary and the model.',
    path: ['voice', 'hotkeyCorrect'],
  },
  {
    type: 'text',
    name: 'Send To Terminal',
    description:
      'Shortcut that types the buffer into the terminal. It never presses Enter for you.',
    path: ['voice', 'hotkeySend'],
  },
]);

/*
 * Live feedback for the four fields above.
 *
 * The grammar lives in the parent, in `shared/hotkey.ts`, and is reached
 * through `wetty_validate_hotkey`, the same way the theme list is reached
 * through `wetty_get_themes`. Reimplementing the grammar here would let the
 * two drift apart.
 */
(() => {
  const isVoiceField = option =>
    Array.isArray(option.path) && option.path[0] === 'voice';

  function report(option) {
    const validate = window.wetty_validate_hotkey;
    if (typeof validate !== 'function') return;
    // `copyOver` moves the template children into the body one by one, so the
    // error slot ends up as the control's next sibling, not its parent's child.
    const box = option.el.nextElementSibling;
    if (box == null || !box.classList.contains('error_reporting')) return;

    const result = validate(option.get());
    box.innerText = result.ok ? '' : result.reason;
    box.classList.toggle('invalid', !result.ok);
  }

  window.addEventListener('input', event => {
    const option = (window.wetty_all_options || []).find(
      candidate => isVoiceField(candidate) && candidate.el.contains(event.target),
    );
    if (option !== undefined) report(option);
  });
})();
