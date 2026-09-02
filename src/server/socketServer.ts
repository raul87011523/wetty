import compression from 'compression';
import winston from 'express-winston';
import { resolveVoiceHotkeys } from '../shared/config.js';
import { voiceDefault } from '../shared/defaults.js';
import { logger } from '../shared/logger.js';
import { voiceRoutes } from './socketServer/api/voice.js';
import { serveStatic, trim } from './socketServer/assets.js';
import { html } from './socketServer/html.js';
import { metricMiddleware, metricRoute } from './socketServer/metrics.js';
import { favicon, redirect } from './socketServer/middleware.js';
import { policies } from './socketServer/security.js';
import { listen } from './socketServer/socket.js';
import { loadSSL } from './socketServer/ssl.js';
import { loadDictionary } from './voice/dictionary.js';
import type { SSL, SSLBuffer, Server, Voice } from '../shared/interfaces.js';
import type { Express } from 'express';
import type SocketIO from 'socket.io';

export async function server(
  app: Express,
  { base, port, host, title, allowIframe }: Server,
  ssl?: SSL,
  voice: Voice = voiceDefault,
): Promise<SocketIO.Server> {
  const basePath = trim(base);
  logger().info('Starting server', {
    ssl,
    port,
    base,
    title,
  });

  // Validate here rather than in `mergeCliConf`: `start()` is exported, so an
  // embedder can hand us a Voice that never went through the cli merge.
  const voiceConf = voice.enabled ? resolveVoiceHotkeys(voice) : voice;

  if (voiceConf.enabled) await loadDictionary(voiceConf.dictionaryPath);

  const client = html(basePath, title, voiceConf);
  app
    .disable('x-powered-by')
    .use(metricMiddleware(basePath))
    .use(`${basePath}/metrics`, metricRoute)
    .use(`${basePath}/client`, serveStatic('client'))
    .use(
      winston.logger({
        winstonInstance: logger(),
        expressFormat: true,
        level: 'http',
      }),
    )
    .use(compression())
    .use(await favicon(basePath))
    .use(redirect)
    .use(policies(allowIframe));

  // `--base /` trims to an empty string, which `use` does not accept as a mount path.
  if (voiceConf.enabled) app.use(basePath || '/', voiceRoutes(voiceConf));

  app
    .get(basePath, client)
    .get(`${basePath}/ssh/:user`, client);

  const sslBuffer: SSLBuffer = await loadSSL(ssl);

  return listen(app, host, port, basePath, sslBuffer);
}
