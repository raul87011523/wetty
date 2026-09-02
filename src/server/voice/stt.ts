import { logger } from '../../shared/logger.js';
import type { Voice } from '../../shared/interfaces.js';

export class SttError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SttError';
    this.status = status;
  }
}

interface InferenceResponse {
  text?: string;
  error?: string;
}

/**
 * Forward recorded audio to the whisper.cpp server and return its transcript.
 * The browser already encodes 16 kHz mono WAV, which is what whisper-server
 * expects, so no transcoding happens anywhere in the stack.
 *
 * @param audio - WAV bytes uploaded by the browser
 * @param filename - original upload name, only used to label the multipart part
 * @param voice - voice configuration holding the stt url and timeout
 * @returns the transcribed text
 */
export async function transcribe(
  audio: Buffer,
  filename: string,
  voice: Voice,
): Promise<string> {
  const url = `${voice.sttUrl.replace(/\/+$/, '')}/inference`;
  const body = new FormData();
  body.append('file', new Blob([audio], { type: 'audio/wav' }), filename);
  body.append('response_format', 'json');
  body.append('temperature', '0');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(voice.sttTimeout),
    });
  } catch (err) {
    logger().error('Speech to text service unreachable', {
      url,
      message: (err as Error)?.message,
    });
    throw new SttError('speech to text service unavailable', 503);
  }

  if (!response.ok) {
    logger().error('Speech to text service returned an error', {
      url,
      status: response.status,
    });
    throw new SttError('speech to text service failed', 502);
  }

  const parsed = (await response.json()) as InferenceResponse;
  if (parsed.error) throw new SttError(parsed.error, 502);
  // whisper-server pads short transcripts with surrounding whitespace.
  return (parsed.text ?? '').trim();
}
