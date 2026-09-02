export type VoiceState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'ready'
  | 'correcting';

const STATUS: Record<VoiceState, string> = {
  idle: 'Listo',
  recording: '\u{1F3A4} Escuchando… pulsa otra vez para parar',
  transcribing: 'Transcribiendo…',
  ready: 'Revisa el texto y pulsa Enviar',
  correcting: 'Corrigiendo…',
};

/**
 * Owns the toolbar DOM and the dictation state machine.
 *
 * Nothing reaches the terminal from here: the buffer only holds text while
 * the speech service is still working, which is the point of keeping dictate,
 * correct and send as three separate steps.
 */
export class VoiceBuffer {
  readonly root: HTMLElement;

  private readonly textarea: HTMLTextAreaElement;

  private readonly status: HTMLElement;

  private readonly buttons: Record<string, HTMLElement | null>;

  private current: VoiceState = 'idle';

  constructor(root: HTMLElement) {
    this.root = root;
    this.textarea = root.querySelector('#voice-buffer') as HTMLTextAreaElement;
    this.status = root.querySelector('#voice-status') as HTMLElement;
    this.buttons = {
      dictate: root.querySelector('#voice-dictate'),
      correct: root.querySelector('#voice-correct'),
      send: root.querySelector('#voice-send'),
    };
    this.render();
  }

  get state(): VoiceState {
    return this.current;
  }

  get busy(): boolean {
    return this.current === 'transcribing' || this.current === 'correcting';
  }

  get text(): string {
    return this.textarea.value;
  }

  set text(value: string) {
    this.textarea.value = value;
  }

  get isOpen(): boolean {
    return this.root.classList.contains('active');
  }

  open(): void {
    this.root.classList.add('active');
  }

  toggle(): void {
    this.root.classList.toggle('active');
    if (this.isOpen) this.textarea.focus();
  }

  setState(state: VoiceState): void {
    this.current = state;
    this.render();
  }

  /**
   * Show a failure without losing whatever text is already in the buffer.
   *
   * @param message - message to show in the status line
   */
  fail(message: string): void {
    this.current = this.text.trim() === '' ? 'idle' : 'ready';
    this.render();
    this.status.textContent = `⚠ ${message}`;
    this.status.classList.add('error');
  }

  focusText(): void {
    this.textarea.focus();
  }

  private render(): void {
    this.status.textContent = STATUS[this.current];
    this.status.classList.remove('error');
    this.root.dataset.state = this.current;

    const { busy } = this;
    this.toggleButton('dictate', !busy);
    this.toggleButton('correct', !busy && this.current !== 'recording');
    this.toggleButton('send', !busy && this.current !== 'recording');
    this.buttons.dictate?.classList.toggle(
      'recording',
      this.current === 'recording',
    );
  }

  private toggleButton(name: string, enabled: boolean): void {
    this.buttons[name]?.classList.toggle('disabled', !enabled);
  }
}
