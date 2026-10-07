import { ALL_FORMATS, AudioBufferSink, BlobSource, CanvasSink, Input, type InputVideoTrack } from 'mediabunny';

const MAX_RENDER_WIDTH = 960;

/** A recorded clip: demuxed with mediabunny, audio fully decoded, video decoded on demand per voice. */
export class Clip {
  readonly input: Input;
  readonly videoTrack: InputVideoTrack;
  readonly audio: AudioBuffer | null;
  /** First video timestamp in the file; clip time 0 maps to this media time. */
  readonly t0: number;
  readonly duration: number;
  readonly renderWidth: number;
  readonly thumbUrl: string | null;

  private constructor(
    input: Input,
    videoTrack: InputVideoTrack,
    audio: AudioBuffer | null,
    t0: number,
    duration: number,
    thumbUrl: string | null,
  ) {
    this.input = input;
    this.videoTrack = videoTrack;
    this.audio = audio;
    this.t0 = t0;
    this.duration = duration;
    this.renderWidth = Math.min(MAX_RENDER_WIDTH, videoTrack.displayWidth);
    this.thumbUrl = thumbUrl;
  }

  static async load(blob: Blob, actx: BaseAudioContext): Promise<Clip> {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack) throw new Error('Clip has no video track.');
      if (!(await videoTrack.canDecode())) throw new Error('This browser cannot decode the clip video.');

      const t0 = await videoTrack.getFirstTimestamp();
      const duration = Math.max(0, (await input.computeDuration()) - t0);

      const audio = await decodeAudio(input, actx, t0, duration);
      const thumbUrl = await makeThumbnail(videoTrack, t0);
      return new Clip(input, videoTrack, audio, t0, duration, thumbUrl);
    } catch (e) {
      input.dispose();
      throw e;
    }
  }

  dispose() {
    this.input.dispose();
    if (this.thumbUrl) URL.revokeObjectURL(this.thumbUrl);
  }
}

async function decodeAudio(
  input: Input,
  actx: BaseAudioContext,
  t0: number,
  duration: number,
): Promise<AudioBuffer | null> {
  const track = await input.getPrimaryAudioTrack();
  if (!track || !(await track.canDecode())) return null;

  const sampleRate = track.sampleRate;
  const channels = track.numberOfChannels;
  const total = Math.max(1, Math.ceil(duration * sampleRate));
  const out = actx.createBuffer(channels, total, sampleRate);

  for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
    const offset = Math.round((timestamp - t0) * sampleRate);
    for (let c = 0; c < channels; c++) {
      let src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      let dst = offset;
      if (dst < 0) {
        src = src.subarray(-dst);
        dst = 0;
      }
      if (dst >= total || src.length === 0) continue;
      out.copyToChannel(src.subarray(0, total - dst), c, dst);
    }
  }
  return out;
}

async function makeThumbnail(track: InputVideoTrack, t0: number): Promise<string | null> {
  try {
    // Large enough that the centre crop shown in portrait mode stays sharp.
    const sink = new CanvasSink(track, { width: 320, height: 180, fit: 'cover', poolSize: 0 });
    const wrapped = await sink.getCanvas(t0);
    if (!wrapped) return null;
    const { canvas } = wrapped;
    const blob =
      canvas instanceof HTMLCanvasElement
        ? await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8))
        : await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}
