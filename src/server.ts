/**
 * Create WeTTY server
 * @module WeTTy
 */
import fs from 'fs';
import path from 'path';
import express from 'express';
import gc from 'gc-stats';
import { Gauge, collectDefaultMetrics } from 'prom-client';
import { getCommand } from './server/command.js';
import { gcMetrics } from './server/metrics.js';
import { server } from './server/socketServer.js';
import { spawn } from './server/spawn.js';
import {
  sshDefault,
  serverDefault,
  forceSSHDefault,
  defaultCommand,
} from './shared/defaults.js';
import { logger as getLogger } from './shared/logger.js';
import type { SSH, SSL, Server } from './shared/interfaces.js';
import type { Express } from 'express';
import type SocketIO from 'socket.io';

export * from './shared/interfaces.js';
export { logger as getLogger } from './shared/logger.js';

const wettyConnections = new Gauge({
  name: 'wetty_connections',
  help: 'number of active socket connections to wetty',
});

/**
 * Starts WeTTy Server
 * @name startServer
 * @returns Promise that resolves SocketIO server
 */
export const start = (
  ssh: SSH = sshDefault,
  serverConf: Server = serverDefault,
  command: string = defaultCommand,
  forcessh: boolean = forceSSHDefault,
  ssl: SSL | undefined = undefined,
): Promise<SocketIO.Server> =>
  decorateServerWithSsh(express(), ssh, serverConf, command, forcessh, ssl);

export async function decorateServerWithSsh(
  app: Express,
  ssh: SSH = sshDefault,
  serverConf: Server = serverDefault,
  command: string = defaultCommand,
  forcessh: boolean = forceSSHDefault,
  ssl: SSL | undefined = undefined,
): Promise<SocketIO.Server> {
  const logger = getLogger();
  if (ssh.key) {
    logger.warn(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
! Password-less auth enabled using private key from ${ssh.key}.
! This is dangerous, anything that reaches the wetty server
! will be able to run remote operations without authentication.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
  }

  collectDefaultMetrics();
  gc().on('stats', gcMetrics);

  const io = await server(app, serverConf, ssl);
  /**
   * Wetty server connected too
   * @fires WeTTy#connnection
   */
  io.on('connection', async (socket: SocketIO.Socket) => {
    /**
     * @event wetty#connection
     * @name connection
     */
    logger.info('Connection accepted.');
    wettyConnections.inc();

    try {
      const args = await getCommand(socket, ssh, command, forcessh);
      logger.debug('Command Generated', { cmd: args.join(' ') });
      await spawn(socket, args);
    } catch (error) {
      logger.info('Disconnect signal sent', { err: error });
      wettyConnections.dec();
    }
  });
  return io;
}

const app = express();

// Endpoint to list themes
app.get('/api/themes', (req, res) => {
  const themesDir = path.join(__dirname, 'client/xterm_config/themes');
  fs.readdir(themesDir, (err, files) => {
    if (err) {
      return [];
    }
    const jsonFiles = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace(/\.json$/, ''));
    res.json(jsonFiles);
  });
});

app.get('/api/themes/:filename', (req, res) => {
  try {
    // Retrieve the filename from the request parameters
    const filename = req.params.filename;
    // Validate that the file is a JSON file (security)
    if (!filename.endsWith('.json')) {
      return {};
    }
    // Load the theme and send it as JSON response
    const theme = loadTheme(filename);
    res.json(theme);
  } catch (error) {
    return {};
  }
});

