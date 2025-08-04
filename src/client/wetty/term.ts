import { FitAddon } from '@xterm/addon-fit';
import { ImageAddon } from '@xterm/addon-image';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import _ from 'lodash';

import { terminal as termElement } from './disconnect/elements';
import { configureTerm } from './term/confiruragtion';
import { loadOptions } from './term/load';
import type { Options } from './term/options';
import type { Socket } from 'socket.io-client';

export class Term extends Terminal {
  socket: Socket;
  fitAddon: FitAddon;
  loadOptions: () => Options;
  themes: Record<string, object>; 

  constructor(socket: Socket) {
    super({ allowProposedApi: true });
    this.socket = socket;
    this.fitAddon = new FitAddon();
    this.loadAddon(this.fitAddon);
    this.loadAddon(new WebLinksAddon());
    this.loadAddon(new ImageAddon());
    this.loadOptions = loadOptions;
    this.keepTerminalActive = false;
    this.themes = {};
    const foreground = this.loadOptions().xterm.theme.foreground;
    const keyboard = document.querySelector('#functions .toggler');
    const options = document.querySelector('#options .toggler');
    keyboard.style.color = foreground;
    options.style.color = foreground;
  }

  resizeTerm(): void {
    this.refresh(0, this.rows - 1);
    if (this.shouldFitTerm) this.fitAddon.fit();
    this.socket.emit('resize', { cols: this.cols, rows: this.rows });
  }

  get shouldFitTerm(): boolean {
    return this.loadOptions().wettyFitTerminal ?? true;
  }
}

const ctrlButton = document.getElementById('onscreen-ctrl');
let ctrlFlag = false; // This indicates whether the CTRL key is pressed or not

/**
 * Toggles the state of the `ctrlFlag` variable and updates the visual state
 * of the `ctrlButton` element accordingly. If `ctrlFlag` is set to `true`,
 * the `active` class is added to the `ctrlButton`; otherwise, it is removed.
 * After toggling, the terminal (`wetty_term`) is focused if it exists.
 */
const toggleCTRL = (): void => {
  ctrlFlag = !ctrlFlag;
  if (ctrlButton) {
    if (ctrlFlag) {
      ctrlButton.classList.add('active');
      if (altFlag) {
        toggleALT();
      }
    } else {
      ctrlButton.classList.remove('active');
    }
  }
  window.wetty_term?.focus();
}

/**
 * Simulates a backspace key press by sending the backspace character
 * (ASCII code 127) to the terminal. This function is intended to be used
 * in conjunction with the `simulateCTRLAndKey` function to handle
 * keyboard shortcuts.
 *
 */
const simulateBackspace = (): void => {
  window.wetty_term?.input('\x7F', true);
}

/**
 * Simulates a CTRL + key press by sending the corresponding character
 * (converted from the key's ASCII code) to the terminal. This function
 * is intended to be used in conjunction with the `toggleCTRL` function
 * to handle keyboard shortcuts.
 *
 * @param key - The key that was pressed, which will be converted to
 *              its corresponding character code.
 */
const simulateCTRLAndKey = (key: string): void => {
  window.wetty_term?.input(`${String.fromCharCode(key.toUpperCase().charCodeAt(0) - 64)}`, false);
}


const altButton = document.getElementById('onscreen-alt');
let altFlag = false; // This indicates whether the ALT key is pressed or not

/**
 * Toggles the state of the `altFlag` variable and updates the visual state
 * of the `altButton` element accordingly. If `altFlag` is set to `true`,
 * the `active` class is added to the `altButton`; otherwise, it is removed.
 * After toggling, the terminal (`wetty_term`) is focused if it exists.
 */
const toggleALT = (): void => {
  altFlag = !altFlag;
  if (altButton) {
    if (altFlag) {
      altButton.classList.add('active');
      if (ctrlFlag) {
        toggleCTRL();
      }
    } else {
      altButton.classList.remove('active');
    }
  }
  window.wetty_term?.focus();
}

/**
 * Simulates a ALT + key press by sending the corresponding character
 * (converted from the key's ASCII code) to the terminal. This function
 * is intended to be used in conjunction with the `toggleALT` function
 * to handle keyboard shortcuts.
 *
 * @param key - The key that was pressed, which will be converted to
 *              its corresponding character code.
 */
const simulateALTAndKey = (key: string): void => {
  window.wetty_term?.input(`\x1b${key}`, false);
}

/**
 * Handles the keydown event for the CTRL key. When the CTRL key is pressed,
 * it sets the `ctrlFlag` variable to true and updates the visual state of
 * the `ctrlButton` element. If the CTRL key is released, it sets `ctrlFlag`
 * to false and updates the visual state of the `ctrlButton` element.
 *
 * @param e - The keyboard event object.
 */
document.addEventListener('keyup', (e) => {
  if (ctrlFlag) {
    // if key is a character
    if (e.key.length === 1 && e.key.match(/^[a-zA-Z0-9]$/)) {
      simulateCTRLAndKey(e.key);
      // delayed backspace is needed to remove the character added to the terminal
      // when CTRL + key is pressed.
      // this is a workaround because e.preventDefault() cannot be used.
      _.debounce(() => {
        simulateBackspace();
      }, 100)();
    }
    toggleCTRL();
  }
  if (altFlag) {
    if (e.key.length === 1 && e.key.match(/^[a-zA-Z0-9]$/)) {
      simulateALTAndKey(e.key);
      // delayed backspace is needed to remove the character added to the terminal
      // when ALT + key is pressed.
      // this is a workaround because e.preventDefault() cannot be used.
      _.debounce(() => {
        simulateBackspace();
      }, 100)();
    }
    simulateALTAndKey(e.key);
    toggleALT();
  }
});

/**
 * Simulates pressing the ESC key by sending the ESC character (ASCII code 27)
 * to the terminal. If the CTRL key is active, it toggles the CTRL state off.
 * After sending the ESC character, the terminal is focused.
 */
const pressESC = (): void => {
  if (ctrlFlag) {
    toggleCTRL();
  }
  if (altFlag) {
    toggleALT();
  }
  window.wetty_term?.input('\x1B', false);
  if (window.wetty_term.keepTerminalActive) {
    window.wetty_term?.focus();
  }
}

/**
 * Simulates pressing the UP arrow key by sending the UP character (ASCII code 65)
 * to the terminal. If the CTRL key is active, it toggles the CTRL state off.
 * After sending the UP character, the terminal is focused.
 */
const pressUP = (): void => {
  if (ctrlFlag) {
    toggleCTRL();
  }
  if (altFlag) {
    toggleALT();
  }
  window.wetty_term?.input('\x1B[A', false);
  if (window.wetty_term.keepTerminalActive) {
    window.wetty_term?.focus();
  }
}

/**
 * Simulates pressing the DOWN arrow key by sending the DOWN character (ASCII code 66)
 * to the terminal. If the CTRL key is active, it toggles the CTRL state off.
 * After sending the DOWN character, the terminal is focused.
 */
const pressDOWN = (): void => {
  if (ctrlFlag) {
    toggleCTRL();
  }
  if (altFlag) {
    toggleALT();
  }
  window.wetty_term?.input('\x1B[B', false);
  if (window.wetty_term.keepTerminalActive) {
    window.wetty_term?.focus();
  }
}

/**
 * Simulates pressing the TAB key by sending the TAB character (ASCII code 9)
 * to the terminal. If the CTRL key is active, it toggles the CTRL state off.
 * After sending the TAB character, the terminal is focused.
 */
const pressTAB = (): void => {
  if (ctrlFlag) {
    toggleCTRL();
  }
  if (altFlag) {
    toggleALT();
  }
  window.wetty_term?.input('\x09', false);
  if (window.wetty_term.keepTerminalActive) {
    window.wetty_term?.focus();
  }
}

/**
 * Simulates pressing the Enter key by sending the Enter character (ASCII code A)
 * to the terminal. If the CTRL key is active, it toggles the CTRL state off.
 * After sending the ENTER character, the terminal is focused.
 */
const pressENTER = (): void => {
  if (ctrlFlag) {
    toggleCTRL();
  }
  if (altFlag) {
    toggleALT();
  }
  window.wetty_term?.input('\x0A', false);
  if (window.wetty_term.keepTerminalActive) {
    window.wetty_term?.focus();
  }
}

/**
 * Simulates pressing the LEFT arrow key by sending the LEFT character (ASCII code 68)
 * to the terminal. If the CTRL key is active, it toggles the CTRL state off.
 * After sending the LEFT character, the terminal is focused.
 */
const pressLEFT = (): void => {
  if (ctrlFlag) {
    toggleCTRL();
  }
  if (altFlag) {
    toggleALT();
  }
  window.wetty_term?.input('\x1B[D', false);
  if (window.wetty_term.keepTerminalActive) {
    window.wetty_term?.focus();
  }
}

/**
 * Simulates pressing the RIGHT arrow key by sending the RIGHT character (ASCII code 67)
 * to the terminal. If the CTRL key is active, it toggles the CTRL state off.
 * After sending the RIGHT character, the terminal is focused.
 */
const pressRIGHT = (): void => {
  if (ctrlFlag) {
    toggleCTRL();
  }
  if (altFlag) {
    toggleALT();
  }
  window.wetty_term?.input('\x1B[C', false);
  if (window.wetty_term.keepTerminalActive) {
    window.wetty_term?.focus();
  }
}

/**
 * Toggles the visibility of the onscreen buttons by adding or removing
 * the 'active' class to the element with the ID 'onscreen-buttons'.
 */
const toggleFunctions = (): void => {
  const element = document.querySelector('div#functions > div.onscreen-buttons')
  if (element?.classList.contains('active')) {
    element?.classList.remove('active');
  } else {
    element?.classList.add('active');
  }
}

declare global {
  interface Window {
    wetty_term?: Term;
    wetty_get_themes?: () => Record<string, object>;
    wetty_close_config?: () => void;
    wetty_save_config?: (newConfig: Options) => void;
    clipboardData: DataTransfer;
    loadOptions: (conf: Options) => void;
    toggleFunctions?: () => void;
    toggleCTRL? : () => void;
    toggleALT? : () => void;
    pressESC?: () => void;
    pressUP?: () => void;
    pressDOWN?: () => void;
    pressTAB?: () => void;
    pressENTER?: () => void;
    pressLEFT?: () => void;
    pressRIGHT?: () => void;
  }
}

/**
* Check is keyboard active
*/
function isKeyboardActive(): true {
  const element = document.querySelector('div#functions > div.onscreen-buttons');
  if (element?.classList.contains('active')) {
    return true;
  }
  return false;
}

export function terminal(socket: Socket): Term | undefined {
  const term = new Term(socket);
  if (_.isNull(termElement)) return undefined;
  termElement.innerHTML = '';
  term.open(termElement);
  configureTerm(term);
  term._core._onFocus.event(() => {
    if (isKeyboardActive()) {
      term.keepTerminalActive = true;
    } else {
      term.keepTerminalActive = false;
    }
  });
  socket.on('themes', (themes) => {
    term.themes = themes;
  });
  window.onresize = function onResize() {
    term.resizeTerm();
  };
  window.wetty_term = term;
  window.toggleFunctions = toggleFunctions;
  window.toggleCTRL = toggleCTRL;
  window.toggleALT = toggleALT;
  window.pressESC = pressESC;
  window.pressUP = pressUP;
  window.pressDOWN = pressDOWN;
  window.pressTAB = pressTAB;
  window.pressENTER = pressENTER;
  window.pressLEFT = pressLEFT;
  window.pressRIGHT = pressRIGHT;
  return term;
}

/**
*Vertical Drag & Drop for Onscreen Keyboard
*[EN] Vertical drag and drop for the virtual keyboard using pointer events (desktop and mobile).
*[ES] Arrastrar solo verticalmente el teclado virtual usando eventos de puntero (desktop y móvil).
*/
const keyboard = document.getElementById('functions'); // [EN] Reference to the keyboard. [ES] Referencia al teclado.
const handle = document.querySelector('#functions .toggler'); // [EN] Reference to the drag handle. [ES] Referencia al "handle" para arrastrar.

let isDragging = false; // [EN] Is the keyboard being dragged? [ES] ¿Se está arrastrando el teclado?
let startY = 0;         // [EN] Initial Y position. [ES] Posición Y inicial.
let startTop = 0;       // [EN] Initial top position. [ES] Top inicial del teclado.

// [EN] Handler for the start of drag (mousedown/touchstart/pointerdown)
// [ES] Manejador para inicio de arrastre (mousedown/touchstart/pointerdown)
function onPointerDown(e) {
  isDragging = true;
  keyboard.style.transition = 'none'; // [EN] Remove animation while dragging. [ES] Quita la animación mientras se arrastra.
  startY = e.type.startsWith('touch') ? e.touches[0].clientY : (e.clientY ?? e.pageY);
  startTop = keyboard.getBoundingClientRect().top;
  document.body.style.userSelect = 'none'; // [EN] Prevent text selection. [ES] Evita seleccionar texto al arrastrar.
}

/**
* [EN] Handler for dragging movement (mousemove/touchmove/pointermove)
* [ES] Manejador para el movimiento (mousemove/touchmove/pointermove)
*/
function onPointerMove(e) {
  if (!isDragging) return;
  // [EN] Prevent scrolling the page while dragging
  // [ES] Evita el scroll de la página mientras arrastrás
  if (e.type.startsWith('touch')) {
    e.preventDefault();
  }
  let currentY = e.type.startsWith('touch') ? e.touches[0].clientY : (e.clientY ?? e.pageY);
  let delta = currentY - startY;
  let newTop = startTop + delta;

  // [EN] Clamp position: can't go above the top or below the bottom of the window.
  // [ES] Limita la posición: no puede salir de la ventana ni por arriba ni por abajo.
  newTop = Math.max(0, Math.min(window.innerHeight - keyboard.offsetHeight, newTop));

  keyboard.style.top = newTop + 'px';
  keyboard.style.bottom = 'auto'; // [EN] Override bottom so 'top' works. [ES] Override a bottom para usar 'top'.
}

// [EN] Handler for end of drag (mouseup/touchend/pointerup)
// [ES] Manejador para fin de arrastre (mouseup/touchend/pointerup)
function onPointerUp(e) {
  isDragging = false;
  document.body.style.userSelect = '';
  keyboard.style.transition = '';
}

// [EN] Register listeners for mouse and touch events.
// [ES] Registra los listeners para mouse y touch.
handle.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);

handle.addEventListener('touchstart', onPointerDown, {passive: false});
window.addEventListener('touchmove', onPointerMove, {passive: false});
window.addEventListener('touchend', onPointerUp);

// [EN] Optionally, reset keyboard position when window is resized (optional).
// [ES] Opcional: restablecer la posición si se redimensiona la ventana.
window.addEventListener('resize', () => {
  if (parseInt(keyboard.style.top || '0') > window.innerHeight - keyboard.offsetHeight) {
    keyboard.style.top = (window.innerHeight - keyboard.offsetHeight) + 'px';
  }
});


