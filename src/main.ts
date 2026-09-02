#!/usr/bin/env node

/**
 * Create WeTTY server
 * @module WeTTy
 *
 * This is the cli Interface for wetty.
 */
import { createRequire } from 'module';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { start } from './server.js';
import { loadConfigFile, mergeCliConf } from './shared/config.js';
import { setLevel, logger } from './shared/logger.js';

/* eslint-disable @typescript-eslint/no-var-requires */
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const opts = yargs(hideBin(process.argv))
  .scriptName(packageJson.name)
  .version(packageJson.version)
  .options('conf', {
    type: 'string',
    description: 'config file to load config from',
  })
  .option('ssl-key', {
    type: 'string',
    description: 'path to SSL key',
  })
  .option('ssl-cert', {
    type: 'string',
    description: 'path to SSL certificate',
  })
  .option('ssh-host', {
    description: 'ssh server host',
    type: 'string',
  })
  .option('ssh-port', {
    description: 'ssh server port',
    type: 'number',
  })
  .option('ssh-user', {
    description: 'ssh user',
    type: 'string',
  })
  .option('title', {
    description: 'window title',
    type: 'string',
  })
  .option('ssh-auth', {
    description:
      'defaults to "password", you can use "publickey,password" instead',
    type: 'string',
  })
  .option('ssh-pass', {
    description: 'ssh password',
    type: 'string',
  })
  .option('ssh-key', {
    demand: false,
    description:
      'path to an optional client private key (connection will be password-less and insecure!)',
    type: 'string',
  })
  .option('ssh-config', {
    description:
      'Specifies an alternative ssh configuration file. For further details see "-F" option in ssh(1)',
    type: 'string',
  })
  .option('force-ssh', {
    description: 'Connecting through ssh even if running as root',
    type: 'boolean',
  })
  .option('known-hosts', {
    description: 'path to known hosts file',
    type: 'string',
  })
  .option('base', {
    alias: 'b',
    description: 'base path to wetty',
    type: 'string',
  })
  .option('port', {
    alias: 'p',
    description: 'wetty listen port',
    type: 'number',
  })
  .option('host', {
    description: 'wetty listen host',
    type: 'string',
  })
  .option('command', {
    alias: 'c',
    description: 'command to run in shell',
    type: 'string',
  })
  .option('allow-iframe', {
    description:
      'Allow WeTTY to be embedded in an iframe, defaults to allowing same origin',
    type: 'boolean',
  })
  .option('allow-remote-hosts', {
    description:
      'Allow WeTTY to use the `host` and `port` params in a url as ssh destination',
    type: 'boolean',
  })
  .option('allow-remote-command', {
    description:
      'Allow WeTTY to use the `command` and `path` params in a url as command and working directory on ssh host',
    type: 'boolean',
  })
  .option('log-level', {
    description: 'set log level of wetty server',
    type: 'string',
  })
  .option('voice', {
    description: 'enable the voice toolbar, use --no-voice to disable',
    type: 'boolean',
  })
  .option('voice-hotkey-toggle', {
    description:
      'shortcut that opens or closes the voice bar. A chord such as ctrl+shift+l, or double-ctrl, or none',
    type: 'string',
  })
  .option('voice-hotkey-dictate', {
    description: 'shortcut that starts or stops dictation',
    type: 'string',
  })
  .option('voice-hotkey-correct', {
    description: 'shortcut that corrects the text sitting in the buffer',
    type: 'string',
  })
  .option('voice-hotkey-send', {
    description: 'shortcut that types the buffer into the terminal',
    type: 'string',
  })
  .option('voice-hotkey', {
    description: 'deprecated alias of --voice-hotkey-dictate',
    type: 'string',
  })
  .option('stt-url', {
    description: 'base url of the speech to text service (whisper.cpp server)',
    type: 'string',
  })
  .option('corrector-mode', {
    description: 'text correction strategy: dictionary, llm or both',
    type: 'string',
  })
  .option('llm-url', {
    description: 'base url of the ollama server used to correct transcripts',
    type: 'string',
  })
  .option('llm-model', {
    description: 'ollama model used to correct transcripts',
    type: 'string',
  })
  .option('voice-dictionary', {
    description: 'path to a JSON5 file of technical term replacements',
    type: 'string',
  })
  .option('help', {
    alias: 'h',
    type: 'boolean',
    description: 'Print help message',
  })
  .boolean('allow_discovery')
  .parseSync();

if (!opts.help) {
  loadConfigFile(opts.conf)
    .then((config) => mergeCliConf(opts, config))
    .then((conf) => {
      setLevel(conf.logLevel);
      start(
        conf.ssh,
        conf.server,
        conf.command,
        conf.forceSSH,
        conf.ssl,
        conf.voice,
      );
    })
    .catch((err: Error) => {
      logger().error('error in server', {
        message: err?.message,
        stack: err?.stack,
        err
      });
      process.exitCode = 1;
    });
} else {
  yargs.showHelp();
  process.exitCode = 0;
}
