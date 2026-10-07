import { useCallback, useEffect, useState } from 'react';
import { Tooltip } from 'radix-ui';
import { BankPanel } from './components/BankPanel';
import { BankStrip } from './components/BankStrip';
import { FxFilters } from './components/FxFilters';
import { MasterSection } from './components/MasterSection';
import { PowerSwitch } from './components/PowerSwitch';
import { SequencerPanel } from './components/SequencerPanel';
import { SourceBar } from './components/SourceBar';
import { Stage } from './components/Stage';
import { VideoFxPanel } from './components/VideoFxPanel';
import { BANK_COUNT, emptyGrid, Engine, type Orientation } from './engine/Engine';
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
  const [banks, setBanks] = useState<BankUI[]>(() => Array.from({ length: BANK_COUNT }, (_, i) => emptyBank(i)));

  const [grid, setGrid] = useState(emptyGrid);
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [bg, setBg] = useState('#000000');
  const [orientation, setOrientation] = useState<Orientation>('landscape');
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
    if (patch.envelope !== undefined) b.envelope = patch.envelope;
    if (patch.fx !== undefined) b.fx = patch.fx;
    if (patch.crush !== undefined) b.crush = patch.crush;
  };

  const copyFxToAll = (from: number) => {
    const { fx, crush } = banks[from];
    banks.forEach((_, i) => changeBank(i, { fx: { ...fx }, crush: { ...crush } }));
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

  // Number keys 1–4 pick the record bank (same as the top-bar bank buttons).
  useEffect(() => {
    if (!power || recBank !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      // Physical key (number row or numpad), so it works on any keyboard layout.
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      const n = m ? Number(m[1]) : NaN;
      if (!(n >= 1 && n <= BANK_COUNT)) return;
      // Let digits through to text/number fields (e.g. typing a BPM) and open lists.
      if ((e.target as HTMLElement).closest?.('input[type="number"], input[type="text"], textarea, [role="listbox"]')) return;
      e.preventDefault();
      setSelectedBank(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [power, recBank]);

  // Space is always play/pause, whatever has focus (a just-clicked pad, knob, button…).
  // Captured at the window so the focused control never sees it — a button would
  // otherwise "click" on space. The one exception is an open dropdown list, where
  // space picks an item.
  useEffect(() => {
    if (!power) return;
    const isSpace = (e: KeyboardEvent) =>
      e.code === 'Space' &&
      // the BPM field only takes digits, so space stays play/pause there too
      !(e.target as HTMLElement).closest?.('[role="listbox"], textarea, input[type="text"]:not(.lcd__num)');
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSpace(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) togglePlay();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isSpace(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
    };
  });

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className={`app app--${orientation}`}>
        <FxFilters effects={banks.map(({ fx, crush }) => ({ fx, crush }))} />
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
          {/* same file as the favicon, so the two always match */}
          <img className={`logo${power ? '' : ' logo--off'}`} src="/favicon.svg" alt="andata-2" />
        </header>

        {error && (
          <div className="error" role="alert">
            {error}
            <button className="btn btn--small" onClick={() => setError(null)}>
              dismiss
            </button>
          </div>
        )}

        {/* video row and sequencer share one panel, split by a divider */}
        <fieldset className="rack rack--body" disabled={!power}>
          <div className="mainrow">
            <Stage
              canvasRef={canvasRef}
              powered={power}
              bg={bg}
              onBgChange={setBg}
              orientation={orientation}
              onOrientationChange={setOrientation}
              orientationLocked={bouncing || bounceBusy}
            />
            <BankPanel
              control={banks.map((b, i) => (
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
              videoFx={
                <VideoFxPanel
                  banks={banks}
                  orientation={orientation}
                  onChange={(i, patch) => changeBank(i, patch)}
                  onCopyToAll={copyFxToAll}
                />
              }
            />
          </div>
          <hr className="divider" />
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
