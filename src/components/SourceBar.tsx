import { useEffect, useRef } from 'react';
import { Select, Toggle, ToggleGroup } from 'radix-ui';
import { BANK_COLORS, bankStyle } from '../types';

interface Props {
  videoDevices: MediaDeviceInfo[];
  audioDevices: MediaDeviceInfo[];
  videoId: string;
  audioId: string;
  onVideoChange: (id: string) => void;
  onAudioChange: (id: string) => void;
  stream: MediaStream | null;
  selectedBank: number;
  onSelectBank: (i: number) => void;
  recording: boolean;
  recElapsed: number;
  recBusy: boolean;
  onRecToggle: () => void;
}

interface DeviceSelectProps {
  label: string;
  fallback: string;
  devices: MediaDeviceInfo[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}

function DeviceSelect({ label, fallback, devices, value, onChange, disabled }: DeviceSelectProps) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <Select.Root value={value} onValueChange={onChange} disabled={disabled || devices.length === 0}>
        <Select.Trigger className="select" aria-label={label}>
          <Select.Value placeholder="—" />
          <Select.Icon className="select__icon">▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="select__content" position="popper" sideOffset={4}>
            <Select.Viewport>
              {devices.map((d, i) => (
                <Select.Item key={d.deviceId} value={d.deviceId} className="select__item">
                  <Select.ItemText>{d.label || `${fallback} ${i + 1}`}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

export function SourceBar(p: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = p.stream;
  }, [p.stream]);

  return (
    <div className="sourcebar">
      <DeviceSelect
        label="camera"
        fallback="camera"
        devices={p.videoDevices}
        value={p.videoId}
        onChange={p.onVideoChange}
        disabled={p.recording}
      />
      <DeviceSelect
        label="mic"
        fallback="mic"
        devices={p.audioDevices}
        value={p.audioId}
        onChange={p.onAudioChange}
        disabled={p.recording}
      />

      <video ref={videoRef} className="sourcebar__preview" autoPlay muted playsInline />

      <div className="field">
        <span className="field__label">bank</span>
        <div className="bankrow">
          <ToggleGroup.Root
            type="single"
            className="bankgroup"
            value={String(p.selectedBank)}
            onValueChange={(v) => v && p.onSelectBank(Number(v))}
            disabled={p.recording}
            aria-label="Record into bank (keys 1–4)"
          >
            {BANK_COLORS.map((_, i) => (
              <ToggleGroup.Item
                key={i}
                value={String(i)}
                className="bankbtn"
                style={bankStyle(i)}
                title={`Bank ${i + 1} (key ${i + 1})`}
              >
                {i + 1}
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>

          <Toggle.Root
            className="recbtn"
            pressed={p.recording}
            onPressedChange={p.onRecToggle}
            disabled={p.recBusy || !p.stream}
            aria-label="Record clip"
          >
            <span className="recbtn__dot" />
            <span className="recbtn__text">
              {p.recBusy ? 'saving' : p.recording ? `stop ${p.recElapsed.toFixed(1)}s` : `rec → ${p.selectedBank + 1}`}
            </span>
          </Toggle.Root>
        </div>
      </div>
    </div>
  );
}
