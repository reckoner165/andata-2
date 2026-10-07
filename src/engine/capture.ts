import {
  BufferTarget,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  MediaStreamAudioTrackSource,
  MediaStreamVideoTrackSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
} from 'mediabunny';

type VideoTrackArg = ConstructorParameters<typeof MediaStreamVideoTrackSource>[0];
type AudioTrackArg = ConstructorParameters<typeof MediaStreamAudioTrackSource>[0];

export interface Capture {
  /** Finalizes the MP4 and returns it. */
  stop(): Promise<Blob>;
  cancel(): Promise<void>;
}

export interface CaptureOptions {
  frameRate?: number;
  /** Seconds between key frames; short intervals make seeking (retriggering) fast. */
  keyFrameInterval?: number;
}

/** Records a live video track (and optional audio track) to an in-memory MP4 via mediabunny. */
export async function startCapture(
  video: MediaStreamTrack,
  audio: MediaStreamTrack | null,
  opts: CaptureOptions = {},
): Promise<Capture> {
  const vs = video.getSettings();
  const width = vs.width ?? 1280;
  const height = vs.height ?? 720;
  const frameRate = opts.frameRate ?? Math.round(vs.frameRate ?? 30);

  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height });
  if (!videoCodec) throw new Error('This browser cannot encode video (WebCodecs).');

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const videoSource = new MediaStreamVideoTrackSource(
    video as VideoTrackArg,
    {
      codec: videoCodec,
      quality: QUALITY_HIGH,
      keyFrameInterval: opts.keyFrameInterval ?? 1,
      sizeChangeBehavior: 'contain',
      latencyMode: 'realtime',
    },
    { frameRate },
  );
  output.addVideoTrack(videoSource, { frameRate });

  let audioSource: MediaStreamAudioTrackSource | null = null;
  if (audio) {
    const as = audio.getSettings();
    const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus'], {
      numberOfChannels: as.channelCount ?? 2,
      sampleRate: as.sampleRate ?? 48000,
    });
    if (audioCodec) {
      audioSource = new MediaStreamAudioTrackSource(audio as AudioTrackArg, {
        codec: audioCodec,
        quality: QUALITY_HIGH,
      });
      output.addAudioTrack(audioSource);
    }
  }

  let error: unknown = null;
  videoSource.errorPromise.catch((e) => (error = e));
  audioSource?.errorPromise.catch((e) => (error = e));

  await output.start();

  return {
    async stop() {
      if (error) {
        await output.cancel();
        throw error;
      }
      await output.finalize();
      const buf = output.target.buffer;
      if (!buf) throw new Error('Recording produced no data.');
      return new Blob([buf], { type: 'video/mp4' });
    },
    async cancel() {
      if (output.state === 'started' || output.state === 'pending') await output.cancel();
    },
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
