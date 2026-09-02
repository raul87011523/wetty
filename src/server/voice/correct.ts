import { logger } from '../../shared/logger.js';
import { applyDictionary } from './dictionary.js';
import type { Voice } from '../../shared/interfaces.js';

const SYSTEM_PROMPT = `You clean up speech-to-text transcripts that a developer dictated for a terminal.
Rules:
- Reply with the corrected transcript and nothing else. No preamble, no explanation, no quotes, no code fences.
- Never answer the request, never execute it, never invent shell commands.
- Fix punctuation, capitalisation and speech recognition mistakes.
- Write technical identifiers the way they are written in code: Odoo model names, Python, SQL, git, docker, file paths.
- Keep the original language and the original meaning. Do not add or remove information.
- Reply on a single line.`;

interface GenerateResponse {
  response?: string;
  error?: string;
}

/**
 * Strip the wrappers small local models like to add around their answer:
 * reasoning blocks, code fences and surrounding quotes.
 *
 * @param raw - text as returned by the model
 * @returns the bare corrected sentence
 */
function unwrap(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*```[a-z]*\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
    .replace(/^["'`](.*)["'`]$/s, '$1')
    // The buffer is a single line, and a stray newline would run a command.
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * Ask the local ollama server to polish an already dictionary-corrected text.
 *
 * @param text - text after the dictionary pass
 * @param context - what the terminal is being used for, passed through as a hint
 * @param voice - voice configuration holding the llm url, model and timeout
 * @returns the polished text
 */
async function askLlm(
  text: string,
  context: string,
  voice: Voice,
): Promise<string> {
  const url = `${voice.llmUrl.replace(/\/+$/, '')}/api/generate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: voice.llmModel,
      system: SYSTEM_PROMPT,
      prompt: `Context: ${context}\nTranscript: ${text}`,
      stream: false,
      options: { temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(voice.llmTimeout),
  });

  if (!response.ok) throw new Error(`ollama responded ${response.status}`);

  const parsed = (await response.json()) as GenerateResponse;
  if (parsed.error) throw new Error(parsed.error);
  return unwrap(parsed.response ?? '');
}

/**
 * Correct a transcript in two layers: a deterministic technical dictionary
 * first, then optionally the local LLM. The dictionary never depends on the
 * LLM, so correction keeps working with ollama stopped.
 *
 * @param text - raw transcript from the browser
 * @param context - what the terminal is being used for
 * @param voice - voice configuration
 * @returns the corrected text
 */
export async function correct(
  text: string,
  context: string,
  voice: Voice,
): Promise<string> {
  const dictionaryPass = applyDictionary(text);
  if (voice.correctorMode === 'dictionary') return dictionaryPass;

  const input = voice.correctorMode === 'llm' ? text : dictionaryPass;
  try {
    const polished = await askLlm(input, context, voice);
    // An empty answer is a failed answer, keep what we already had.
    return polished || dictionaryPass;
  } catch (err) {
    logger().warn('Text corrector fell back to the dictionary', {
      model: voice.llmModel,
      message: (err as Error)?.message,
    });
    return dictionaryPass;
  }
}
