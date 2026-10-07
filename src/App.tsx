import { useCallback, useEffect, useState } from 'react';
import { Tooltip } from 'radix-ui';
import { BankStrip } from './components/BankStrip';
import { MasterSection } from './components/MasterSection';
import { PowerSwitch } from './components/PowerSwitch';
import { SequencerPanel } from './components/SequencerPanel';
import { SourceBar } from './components/SourceBar';
import { Stage } from './components/Stage';
import { BANK_COUNT, emptyGrid, Engine } from './engine/Engine';
import { emptyBank, type BankUI } from './types';
import './App.css';

const RANDOM_DENSITY = 0.3;

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function App() {
  const [engine] = useState(() => new Engine());

  const [power, setPower] = useState(false);
  const [powerBusy, setPowerBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoId, setVideoId] = useState('');
  const [audioId, setAudioId] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [selectedBank, setSelectedBank] = useState(0);
  const [recBank, setRecBank] = useState<number | null>(null);
  const [recStart, setRecStart] = useState(0);
  const [recBusy, setRecBusy] = useState(false);
  const [banks, setBanks] = useState<BankUI[]>(() => Array.from({ length: BANK_COUNT }, emptyBank));

  const [grid, setGrid] = useState(emptyGrid);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [bg, setBg] = useState('#000000');
  const [masterVolume, setMasterVolume] = useState(1);

  const [bouncing, setBouncing] = useState(false);
  const [bounceStart, setBounceStart] = useState(0);
  const [bounceBusy, setBounceBusy] = useState(false);
  const [now, setNow] = useState(0);

  // ---- engine sync ----
  useEffect(() => {
    engine.onStep = setStep;
  }, [engine]);
  useEffect(() => {
    engine.grid = grid;
  }, [engine, grid]);
  useEffect(() => {
    engine.bpm = bpm;
  }, [engine, bpm]);
  useEffect(() => {
    engine.bg = bg;
  }, [engine, bg]);
  useEffect(() => {
    engine.setMasterVolume(masterVolume);
  }, [engine, masterVolume]);

  const canvasRef = useCallback((c: HTMLCanvasElement | null) => engine.attachCanvas(c), [engine]);

  // Elapsed-time readouts while recording.
  useEffect(() => {
    if (recBank === null && !bouncing) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [recBank, bouncing]);

  // ---- sources ----
  const syncDevices = useCallback(async (s: MediaStream | null) => {
    const list = await navigator.mediaDevices.enumerateDevices();
    setVideoDevices(list.filter((d) => d.kind === 'videoinput'));
    setAudioDevices(list.filter((d) => d.kind === 'audioinput'));
    const v = s?.getVideoTracks()[0]?.getSettings().deviceId;
    const a = s?.getAudioTracks()[0]?.getSettings().deviceId;
    if (v) setVideoId(v);
    if (a) setAudioId(a);
  }, []);

  useEffect(() => {
    if (!power) return;
    const onChange = () => syncDevices(engine.stream).catch(() => {});
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
  }, [power, engine, syncDevices]);

  const openSource = async (v: string, a: string) => {
    try {
      const s = await engine.openStream(v || undefined, a || undefined);
      setStream(s);
      await syncDevices(s);
      setError(null);
    } catch (e) {
      setStream(null);
      setError(`Could not open camera/mic: ${errorText(e)}`);
    }
  };

  // ---- power ----
  const togglePower = async () => {
    setPowerBusy(true);
    try {
      if (!power) {
        await engine.powerOn();
        setPower(true);
        await openSource(videoId, audioId);
      } else {
        await engine.powerOff();
        setPower(false);
        setStream(null);
        setPlaying(false);
        setStep(-1);
        if (recBank !== null) updateBankUI(recBank, { loading: false });
        setRecBank(null);
        setBouncing(false);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPowerBusy(false);
    }
  };

  // ---- banks ----
  const updateBankUI = (i: number, patch: Partial<BankUI>) =>
    setBanks((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const changeBank = (i: number, patch: Partial<BankUI>) => {
    updateBankUI(i, patch);
    const b = engine.banks[i];
    if (!b) return;
    if (patch.trimStart !== undefined) b.trimStart = patch.trimStart;
    if (patch.trimEnd !== undefined) b.trimEnd = patch.trimEnd;
    if (patch.choke !== undefined) b.choke = patch.choke;
    if (patch.gain !== undefined) b.setGain(patch.gain);
    if (patch.pan !== undefined) b.setPan(patch.pan);
  };

  const clearBank = (i: number) => {
    engine.clearBank(i);
    updateBankUI(i, { hasClip: false, duration: 0, thumbUrl: null, trimStart: 0, trimEnd: 0 });
  };

  const toggleRecord = async () => {
    if (recBank === null) {
      try {
        await engine.startClipRecording();
        setRecBank(selectedBank);
        setRecStart(performance.now());
        setNow(performance.now());
        setError(null);
      } catch (e) {
        setError(`Recording failed: ${errorText(e)}`);
      }
      return;
    }
    const i = recBank;
    setRecBusy(true);
    updateBankUI(i, { loading: true });
    try {
      const clip = await engine.finishClipRecording(i);
      updateBankUI(i, {
        hasClip: true,
        duration: clip.duration,
        thumbUrl: clip.thumbUrl,
        trimStart: 0,
        trimEnd: clip.duration,
      });
    } catch (e) {
      setError(`Recording failed: ${errorText(e)}`);
    } finally {
      updateBankUI(i, { loading: false });
      setRecBank(null);
      setRecBusy(false);
    }
  };

  // ---- sequencer ----
  const togglePlay = () => {
    if (playing) engine.stop();
    else engine.play();
    setPlaying(!playing);
  };

  const toggleCell = (b: number, s: number) =>
    setGrid((g) => g.map((row, i) => (i === b ? row.map((on, j) => (j === s ? !on : on)) : row)));

  const randomize = () => {
    const anyClip = banks.some((b) => b.hasClip);
    setGrid((g) =>
      g.map((row, i) => row.map(() => (!anyClip || banks[i].hasClip) && Math.random() < RANDOM_DENSITY)),
    );
  };

  const toggleBounce = async () => {
    setBounceBusy(true);
    try {
      if (!bouncing) {
        await engine.startBounce();
        setBounceStart(performance.now());
        setNow(performance.now());
        setBouncing(true);
      } else {
        setBouncing(false);
        await engine.stopBounce();
      }
      setError(null);
    } catch (e) {
      setError(`Output recording failed: ${errorText(e)}`);
    } finally {
      setBounceBusy(false);
    }
  };

  // Space toggles play when not typing in a field.
  useEffect(() => {
    if (!power) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code !== 'Space' || t.closest('input, select, textarea, button, [role="slider"]')) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="app">
        <header className="topbar">
          <PowerSwitch on={power} busy={powerBusy} onToggle={togglePower} />
          <div className="brand">
            <span className="brand__name">andata-2</span>
            <span className="brand__sub">4-track video live looper</span>
          </div>
          <fieldset className="rack rack--top" disabled={!power}>
            <SourceBar
              videoDevices={videoDevices}
              audioDevices={audioDevices}
              videoId={videoId}
              audioId={audioId}
              onVideoChange={(v) => openSource(v, audioId)}
              onAudioChange={(a) => openSource(videoId, a)}
              stream={stream}
              selectedBank={selectedBank}
              onSelectBank={setSelectedBank}
              recording={recBank !== null}
              recElapsed={(now - recStart) / 1000}
              recBusy={recBusy}
              onRecToggle={toggleRecord}
            />
          </fieldset>
        </header>

        {error && (
          <div className="error" role="alert">
            {error}
            <button className="btn btn--small" onClick={() => setError(null)}>
              dismiss
            </button>
          </div>
        )}

        <fieldset className="rack rack--main" disabled={!power}>
          <Stage canvasRef={canvasRef} powered={power} bg={bg} onBgChange={setBg} />
          <div className="banks">
            {banks.map((b, i) => (
              <BankStrip
                key={i}
                index={i}
                bank={b}
                recording={recBank === i}
                onChange={(patch) => changeBank(i, patch)}
                onAudition={() => engine.audition(i)}
                onClear={() => clearBank(i)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="rack" disabled={!power}>
          <SequencerPanel
            grid={grid}
            step={step}
            playing={playing}
            bpm={bpm}
            bouncing={bouncing}
            bounceElapsed={(now - bounceStart) / 1000}
            bounceBusy={bounceBusy}
            hasClip={banks.map((b) => b.hasClip)}
            onToggleCell={toggleCell}
            onPlayToggle={togglePlay}
            onBpm={setBpm}
            onRandomize={randomize}
            onClear={() => setGrid(emptyGrid())}
            onBounceToggle={toggleBounce}
            master={
              <MasterSection
                volume={masterVolume}
                onVolume={setMasterVolume}
                powered={power}
                readPeaks={() => engine.meterPeaks()}
              />
            }
          />
        </fieldset>
      </div>
    </Tooltip.Provider>
  );
}
