import { STAGE_H, STAGE_W } from '../engine/Engine';

interface Props {
  canvasRef: (c: HTMLCanvasElement | null) => void;
  powered: boolean;
  bg: string;
  onBgChange: (c: string) => void;
}

export function Stage({ canvasRef, powered, bg, onBgChange }: Props) {
  return (
    <div className="stage">
      <div className="stage__bezel">
        <div className="stage__frame">
          <canvas ref={canvasRef} width={STAGE_W} height={STAGE_H} className="stage__canvas" />
          {!powered && <div className="stage__off">power off</div>}
          <div className="stage__controls">
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
