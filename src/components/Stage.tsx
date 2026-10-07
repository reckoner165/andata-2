import { ToggleGroup } from 'radix-ui';
import { STAGE_SIZE, type Orientation } from '../engine/Engine';
import { LandscapeIcon, PortraitIcon } from './IconButton';

interface Props {
  canvasRef: (c: HTMLCanvasElement | null) => void;
  powered: boolean;
  bg: string;
  onBgChange: (c: string) => void;
  orientation: Orientation;
  onOrientationChange: (o: Orientation) => void;
  /** Locked while the output is being recorded, so the file keeps one shape. */
  orientationLocked: boolean;
}

export function Stage({ canvasRef, powered, bg, onBgChange, orientation, onOrientationChange, orientationLocked }: Props) {
  const [w, h] = STAGE_SIZE[orientation];
  return (
    <div className={`stage stage--${orientation}`}>
      <div className="stage__bezel">
        <div className="stage__frame">
          <canvas ref={canvasRef} width={w} height={h} className="stage__canvas" />
          {!powered && <div className="stage__off">power off</div>}
          <div className="stage__controls">
            <ToggleGroup.Root
              type="single"
              className="orient"
              value={orientation}
              onValueChange={(v) => v && onOrientationChange(v as Orientation)}
              disabled={orientationLocked}
              aria-label="Stage orientation"
              title={orientationLocked ? 'Orientation is locked while recording output' : undefined}
            >
              <ToggleGroup.Item value="landscape" className="orient__item" aria-label="Horizontal (16:9)" title="Horizontal (16:9)">
                <LandscapeIcon />
              </ToggleGroup.Item>
              <ToggleGroup.Item value="portrait" className="orient__item" aria-label="Vertical (9:16)" title="Vertical (9:16)">
                <PortraitIcon />
              </ToggleGroup.Item>
            </ToggleGroup.Root>
            <span className="stage__sep" />
            <label className="swatch" title="Background colour">
              <input type="color" value={bg} onChange={(e) => onBgChange(e.target.value)} />
              <span className="swatch__chip" style={{ background: bg }} />
              <span>bg</span>
            </label>
            {bg !== '#000000' && (
              <button className="stage__reset" onClick={() => onBgChange('#000000')}>
                reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
