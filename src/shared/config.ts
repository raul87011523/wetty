import path from 'path';
import fs from 'fs-extra';
import JSON5 from 'json5';
import isUndefined from 'lodash/isUndefined.js';
import {
  sshDefault,
  serverDefault,
  voiceDefault,
  builtinHotkeys,
  forceSSHDefault,
  defaultCommand,
  defaultLogLevel,
} from './defaults.js';
import {
  canonicalHotkey,
  duplicateBindings,
  parseBindings,
  parseHotkey,
} from './hotkey.js';
import { logger } from './logger.js';
import type { VoiceAction } from './hotkey.js';
import type {
  Config,
  SSH,
  Server,
  SSL,
  Voice,
  VoiceFields,
} from './interfaces';
import type winston from 'winston';
import type { Arguments } from 'yargs';

import { fileURLToPath } from 'url';

// Get the absolute path to the current file and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THEME_DIR = path.join(__dirname, 'themes');

type confValue =
  | boolean
  | string
  | number
  | undefined
  | unknown
  | SSH
  | Server
  | SSL;

/**
 * Cast given value to boolean
 *
 * @param value - variable to cast
 * @returns variable cast to boolean
 */
function ensureBoolean(value: confValue): boolean {
  switch (value) {
    case true:
    case 'true':
    case 1:
    case '1':
    case 'on':
    case 'yes':
      return true;
    default:
      return false;
  }
}

function parseLogLevel(
  confLevel: typeof winston.level,
  optsLevel: unknown,
): typeof winston.level {
  const logLevel = isUndefined(optsLevel) ? confLevel : `${optsLevel}`;
  return [
    'error',
    'warn',
    'info',
    'http',
    'verbose',
    'debug',
    'silly',
  ].includes(logLevel)
    ? (logLevel as typeof winston.level)
    : defaultLogLevel;
}

/**
 * [EN] Returns an array with the names of all JSON files in the 'theme' directory.
 * [ES] Devuelve un array con los nombres de todos los archivos JSON en el directorio 'theme'.
 */

async function getThemeNames() {
  try {
    const files = await fs.readdir(THEME_DIR);
    const names = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace(/\.json$/, ''));
    return names;
  } catch (err) {
    return [];
  }
}

/**
 * [EN] Given a filename, loads and parses its JSON content from the 'theme' directory.
 * [ES] Dado un nombre de archivo, carga y parsea su contenido JSON desde el directorio 'theme'.
 * @param {string} filename - The name of the JSON file (e.g., 'reader.json')
 */
async function loadTheme(filename) {
  try {
    const filePath = path.join(THEME_DIR, filename);
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

export async function loadThemes() {
  const themes = {};
  const themeNames = await getThemeNames();	
  for (const name of themeNames) {
    const theme = await loadTheme(`${name}.json`);
    if (Object.keys(theme).length > 0) {
      themes[name] = theme;
    }
  }
  return themes
}

/**
 * Load JSON5 config from file and merge with default args
 * If no path is provided the default config is returned
 *
 * @param filepath - path to config to load
 * @returns variable cast to boolean
 */
export async function loadConfigFile(filepath?: string): Promise<Config> {
  if (isUndefined(filepath)) {
    return {
      ssh: sshDefault,
      server: serverDefault,
      voice: voiceDefault,
      command: defaultCommand,
      forceSSH: forceSSHDefault,
      logLevel: defaultLogLevel,
    };
  }
  const content = await fs.readFile(path.resolve(filepath));
  const parsed = JSON5.parse(content.toString()) as Config;
  return {
    ssh: isUndefined(parsed.ssh)
      ? sshDefault
      : Object.assign(sshDefault, parsed.ssh),
    server: isUndefined(parsed.server)
      ? serverDefault
      : Object.assign(serverDefault, parsed.server),
    voice: isUndefined(parsed.voice)
      ? voiceDefault
      : Object.assign(voiceDefault, parsed.voice),
    command: isUndefined(parsed.command) ? defaultCommand : `${parsed.command}`,
    forceSSH: isUndefined(parsed.forceSSH)
      ? forceSSHDefault
      : ensureBoolean(parsed.forceSSH),
    ssl: parsed.ssl,
    logLevel: parseLogLevel(defaultLogLevel, parsed.logLevel),
  };
}

/**
 * Merge 2 objects removing undefined fields
 *
 * @param target - base object
 * @param source - object to get new values from
 * @returns merged object
 *
 */
const objectAssign = (
  target: SSH | Server | Voice,
  source: Record<string, confValue>,
): SSH | Server | Voice =>
  Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      isUndefined(source[key]) ? target[key] : value,
    ]),
  ) as SSH | Server | Voice;

/**
 * Merge cli arguemens with config object
 *
 * @param opts - Object containing cli args
 * @param config - Config object
 * @returns merged configuration
 *
 */
/**
 * Voice options coming from the cli.
 *
 * `objectAssign` only keeps the keys listed in the source object, so every
 * field of `Voice` must appear here or the option vanishes without a word.
 * Typing the literal as `Record<keyof VoiceFields, confValue>` turns a
 * forgotten field into a compile error instead of a run time surprise. The
 * timeouts have no flag and are carried over as they are.
 *
 * @param opts - parsed cli arguments
 * @param config - configuration loaded from the file
 * @returns the voice options to merge
 */
function voiceCliConf(
  opts: Arguments,
  config: Config,
): Record<keyof VoiceFields, confValue> {
  return {
    enabled: isUndefined(opts.voice) ? undefined : ensureBoolean(opts.voice),
    hotkeyToggle: opts['voice-hotkey-toggle'],
    hotkeyDictate: opts['voice-hotkey-dictate'],
    hotkeyCorrect: opts['voice-hotkey-correct'],
    hotkeySend: opts['voice-hotkey-send'],
    hotkey: opts['voice-hotkey'],
    sttUrl: opts['stt-url'],
    sttTimeout: config.voice.sttTimeout,
    correctorMode: opts['corrector-mode'],
    llmUrl: opts['llm-url'],
    llmModel: opts['llm-model'],
    llmTimeout: config.voice.llmTimeout,
    dictionaryPath: opts['voice-dictionary'],
  };
}

/**
 * Validate and canonicalise the four shortcuts.
 *
 * A bad value falls back to the built in default with a warning rather than
 * taking the server down, matching how `parseLogLevel` treats an unknown
 * level. Silence is the thing to avoid here: an unparsed shortcut simply never
 * fires, which is impossible to diagnose from the browser.
 *
 * @param voice - voice configuration
 * @returns a copy with every shortcut canonical
 */
export function resolveVoiceHotkeys(voice: Voice): Voice {
  const log = logger();
  const resolved: Voice = { ...voice };

  const legacy = `${voice.hotkey ?? ''}`.trim();
  if (legacy !== '') {
    log.warn(
      'voice.hotkey is deprecated, use voice.hotkeyDictate instead',
      { value: legacy },
    );
    resolved.hotkeyDictate = legacy;
  }
  resolved.hotkey = '';

  const fields: [VoiceAction, keyof typeof builtinHotkeys][] = [
    ['toggle', 'hotkeyToggle'],
    ['dictate', 'hotkeyDictate'],
    ['correct', 'hotkeyCorrect'],
    ['send', 'hotkeySend'],
  ];

  fields.forEach(([, field]) => {
    const parsed = parseHotkey(`${resolved[field]}`);
    if (parsed.kind === 'none' && `${resolved[field]}`.trim() !== '') {
      log.warn(`voice.${field} is not a usable shortcut, using the default`, {
        value: resolved[field],
        reason: parsed.reason,
        fallback: builtinHotkeys[field],
      });
      resolved[field] = canonicalHotkey(parseHotkey(builtinHotkeys[field]));
      return;
    }
    resolved[field] = canonicalHotkey(parsed);
  });

  duplicateBindings(
    parseBindings({
      toggle: `${resolved.hotkeyToggle}`,
      dictate: `${resolved.hotkeyDictate}`,
      correct: `${resolved.hotkeyCorrect}`,
      send: `${resolved.hotkeySend}`,
    }),
  ).forEach((group) =>
    log.warn('the same voice shortcut is bound to several actions', {
      actions: group,
      note: `only ${group[0]} will fire`,
    }),
  );

  return resolved;
}

export function mergeCliConf(opts: Arguments, config: Config): Config {
  const ssl = {
    key: opts['ssl-key'],
    cert: opts['ssl-cert'],
    ...config.ssl,
  } as SSL;
  return {
    ssh: objectAssign(config.ssh, {
      user: opts['ssh-user'],
      host: opts['ssh-host'],
      auth: opts['ssh-auth'],
      port: opts['ssh-port'],
      pass: opts['ssh-pass'],
      key: opts['ssh-key'],
      allowRemoteHosts: opts['allow-remote-hosts'],
      allowRemoteCommand: opts['allow-remote-command'],
      config: opts['ssh-config'],
      knownHosts: opts['known-hosts'],
    }) as SSH,
    server: objectAssign(config.server, {
      base: opts.base,
      host: opts.host,
      port: opts.port,
      title: opts.title,
      allowIframe: opts['allow-iframe'],
    }) as Server,
    voice: objectAssign(config.voice, voiceCliConf(opts, config)) as Voice,
    command: isUndefined(opts.command) ? config.command : `${opts.command}`,
    forceSSH: isUndefined(opts['force-ssh'])
      ? config.forceSSH
      : ensureBoolean(opts['force-ssh']),
    ssl: isUndefined(ssl.key) || isUndefined(ssl.cert) ? undefined : ssl,
    logLevel: parseLogLevel(config.logLevel, opts['log-level']),
  };
}
