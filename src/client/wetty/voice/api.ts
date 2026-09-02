const trim = (str: string): string => str.replace(/\/*$/, '');

// Same base path resolution as `../socket.ts`, so the endpoints follow
// `--base` whether it is `/` or `/wetty/`.
const base = trim(trim(window.location.pathname).replace(/ssh\/[^/]+$/, ''));

interface TextResponse {
  text?: string;
  error?: string;
}

/**
 * Read a `{ text }` payload, turning a service error into a thrown Error.
 *
 * @param response - fetch response to unwrap
 * @returns the text field
 */
async function readText(response: Response): Promise<string> {
  const parsed = (await response.json().catch(() => ({}))) as TextResponse;
  if (!response.ok) {
    throw new Error(parsed.error ?? `request failed with ${response.status}`);
  }
  return parsed.text ?? '';
}

/**
 * Send recorded audio to the speech to text service.
 *
 * @param wav - 16 kHz mono WAV produced by the recorder
 * @returns the transcript
 */
export async function transcribe(wav: Blob): Promise<string> {
  return readText(
    await fetch(`${base}/api/stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wav,
    }),
  );
}

/**
 * Ask the server to correct a transcript.
 *
 * @param text - text to correct
 * @returns the corrected text
 */
export async function correct(text: string): Promise<string> {
  return readText(
    await fetch(`${base}/api/voice/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context: 'terminal' }),
    }),
  );
}
