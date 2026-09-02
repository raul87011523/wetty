const TARGET_RATE = 16000;

/**
 * Write an ASCII string into a DataView, one byte per character.
 *
 * @param view - target view
 * @param offset - byte offset to write at
 * @param value - ascii string
 */
function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

/**
 * Encode mono float samples as a 16 bit PCM WAV file.
 * whisper-server expects 16 bit WAV, so doing it here keeps ffmpeg out of
 * the whole stack.
 *
 * @param samples - mono samples in the -1..1 range
 * @param sampleRate - sample rate of those samples
 * @returns a WAV blob
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      44 + i * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Decode whatever the browser recorded and resample it to 16 kHz mono WAV.
 *
 * @param recorded - blob produced by MediaRecorder
 * @returns a 16 kHz mono WAV blob
 */
async function toWav(recorded: Blob): Promise<Blob> {
  const bytes = await recorded.arrayBuffer();
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(bytes);
  } finally {
    await context.close();
  }

  const frames = Math.ceil(decoded.duration * TARGET_RATE);
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return encodeWav(rendered.getChannelData(0), TARGET_RATE);
}

export class Recorder {
  private recorder?: MediaRecorder;

  private stream?: MediaStream;

  private chunks: Blob[] = [];

  get recording(): boolean {
    return this.recorder?.state === 'recording';
  }

  /**
   * Ask for the microphone and start recording.
   * Requires a secure context, the browser blocks getUserMedia over http.
   */
  async start(): Promise<void> {
    if (this.recording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'El micrófono necesita HTTPS. Abre Wetty por https:// e inténtalo otra vez.',
      );
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (event: BlobEvent): void => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start();
  }

  /**
   * Stop recording and hand back the audio ready for the stt service.
   * Nothing is transcribed until this is called, dictation never stops itself.
   *
   * @returns a 16 kHz mono WAV blob, or undefined when nothing was captured
   */
  async stop(): Promise<Blob | undefined> {
    const { recorder } = this;
    if (!recorder || recorder.state === 'inactive') return undefined;

    const recorded = await new Promise<Blob>((done) => {
      recorder.onstop = (): void => {
        done(new Blob(this.chunks, { type: recorder.mimeType }));
      };
      recorder.stop();
    });

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.recorder = undefined;

    return recorded.size > 0 ? toWav(recorded) : undefined;
  }
}
