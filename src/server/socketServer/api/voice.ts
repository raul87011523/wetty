import express, { Router } from 'express';
import { logger } from '../../../shared/logger.js';
import { correct } from '../../voice/correct.js';
import { SttError, transcribe } from '../../voice/stt.js';
import type { Voice } from '../../../shared/interfaces.js';
import type { Request, Response } from 'express';

const MAX_AUDIO = '25mb';
const MAX_TEXT = 8 * 1024;

interface CorrectBody {
  text?: unknown;
  context?: unknown;
}

/**
 * Routes backing the voice toolbar.
 *
 * The audio arrives as a raw `audio/wav` body rather than multipart, which
 * keeps the server free of an upload parsing dependency.
 *
 * @param voice - voice configuration
 * @returns router to mount under the server base path
 */
export function voiceRoutes(voice: Voice): Router {
  const router = Router();

  router.post(
    '/api/stt',
    express.raw({ type: 'audio/wav', limit: MAX_AUDIO }),
    async (req: Request, res: Response): Promise<void> => {
      const audio = req.body as Buffer;
      if (!Buffer.isBuffer(audio) || audio.length === 0) {
        res.status(400).json({ error: 'expected an audio/wav body' });
        return;
      }
      try {
        const text = await transcribe(audio, 'dictation.wav', voice);
        res.json({ text });
      } catch (err) {
        const status = err instanceof SttError ? err.status : 500;
        res.status(status).json({ error: (err as Error).message });
      }
    },
  );

  router.post(
    '/api/voice/correct',
    express.json({ limit: MAX_TEXT }),
    async (req: Request, res: Response): Promise<void> => {
      const { text, context } = (req.body ?? {}) as CorrectBody;
      if (typeof text !== 'string') {
        res.status(400).json({ error: 'expected a text field' });
        return;
      }
      if (text.trim() === '') {
        res.json({ text });
        return;
      }
      try {
        const corrected = await correct(
          text,
          typeof context === 'string' ? context : 'terminal',
          voice,
        );
        res.json({ text: corrected });
      } catch (err) {
        logger().error('Text correction failed', {
          message: (err as Error)?.message,
        });
        // Never block dictation on the corrector, hand the text back untouched.
        res.json({ text });
      }
    },
  );

  return router;
}
