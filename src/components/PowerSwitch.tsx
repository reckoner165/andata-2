import { Toggle } from 'radix-ui';

interface Props {
  on: boolean;
  busy: boolean;
  onToggle: () => void;
}

export function PowerSwitch({ on, busy, onToggle }: Props) {
  return (
    <Toggle.Root
      className="power"
      pressed={on}
      onPressedChange={onToggle}
      disabled={busy}
      aria-label="Power"
      title={on ? 'Power off' : 'Power on'}
    >
      <span className="power__track">
        <span className="power__thumb" />
      </span>
      <span className="power__label">
        <span className="power__caption">power</span>
        <span className="power__state">{busy ? '···' : on ? 'on' : 'off'}</span>
      </span>
    </Toggle.Root>
  );
}
