import type { ReactNode } from 'react';
import { Tooltip } from 'radix-ui';

interface Props {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Extra classes, e.g. `btn--small`. */
  className?: string;
  /** Which side the tooltip opens on (default: top). */
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}

/** Square icon-only button with a Radix tooltip; `label` doubles as the accessible name. */
export function IconButton({ label, onClick, active, disabled, className, tooltipSide = 'top', children }: Props) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          className={`btn btn--icon${active ? ' btn--active' : ''}${className ? ` ${className}` : ''}`}
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" side={tooltipSide} sideOffset={6}>
          {label}
          <Tooltip.Arrow className="tooltip__arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

const svg = { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true } as const;

export const PlayIcon = () => (
  <svg {...svg}>
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
);

export const StopIcon = () => (
  <svg {...svg}>
    <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" />
  </svg>
);

/** Trash can: clear (delete) a bank's clip. */
export const TrashIcon = () => (
  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M1.5 3h9" />
    <path d="M4.5 3V1.75h3V3" />
    <path d="M2.75 3l.6 7.25h5.3l.6-7.25" />
    <path d="M5 5v3.5M7 5v3.5" />
  </svg>
);

export const LandscapeIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
    <rect x="1" y="3.5" width="12" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

export const PortraitIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
    <rect x="3.5" y="1" width="7" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

/** Die face: randomize. */
export const RandomIcon = () => (
  <svg {...svg}>
    <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="5" cy="5" r="1.2" fill="currentColor" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <circle cx="11" cy="11" r="1.2" fill="currentColor" />
  </svg>
);

/** Empty grid with a slash: clear pattern. */
export const ClearIcon = () => (
  <svg {...svg} fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1.75" y="1.75" width="5" height="5" rx="1" />
    <rect x="9.25" y="1.75" width="5" height="5" rx="1" />
    <rect x="1.75" y="9.25" width="5" height="5" rx="1" />
    <rect x="9.25" y="9.25" width="5" height="5" rx="1" />
    <path d="M1 15L15 1" strokeLinecap="round" />
  </svg>
);
