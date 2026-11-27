import type { Muscle } from '../api/types';
import { MUSCLE_LABELS } from '../api/types';
import styles from './MuscleMap.module.css';

type Pt = readonly [number, number];

/** 왼쪽 절반 좌표를 가운데(x = 100) 기준으로 뒤집는다. */
const flip = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [200 - x, y] as const);

/** 점들을 지나는 닫힌 곡선(Catmull-Rom → 3차 베지어). 근육 윤곽을 부드럽게 만든다. */
function smooth(pts: readonly Pt[]): string {
  const n = pts.length;
  const p = (i: number): Pt => pts[(i + n) % n]!;
  let d = `M${p(0)[0]},${p(0)[1]}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p(i - 1);
    const [x1, y1] = p(i);
    const [x2, y2] = p(i + 1);
    const [x3, y3] = p(i + 2);
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2},${y2}`;
  }
  return d + 'Z';
}

/** 몸 윤곽 왼쪽 절반(목 → 팔 → 몸통 → 다리 → 사타구니). 오른쪽은 뒤집어 잇는다. */
const OUTLINE_LEFT: Pt[] = [
  [90, 50], [88, 58], [74, 62], [58, 68], [50, 78], [46, 96], [43, 118], [40, 140], [36, 165], [32, 190],
  [30, 205], [27, 220], [29, 234], [35, 236], [40, 224], [42, 208], [47, 186], [52, 164], [57, 142], [61, 122],
  [63, 140], [66, 168], [66, 190], [62, 210], [60, 240], [62, 268], [66, 290], [64, 318], [68, 350], [74, 380],
  [70, 394], [78, 402], [92, 400], [92, 384], [92, 350], [94, 318], [94, 292], [96, 262], [98, 232], [100, 220],
];
const OUTLINE = smooth([...OUTLINE_LEFT, ...flip(OUTLINE_LEFT).reverse().slice(1)]);

type Region = { muscle: Muscle | null; pts: Pt[] };

/** 앞모습 근육(왼쪽 절반). muscle이 null이면 강조하지 않는 바탕 근육이다. */
const FRONT: Region[] = [
  { muscle: 'TRAPS', pts: [[89, 55], [80, 59], [70, 63], [80, 66], [90, 62]] },
  { muscle: 'SIDE_DELT', pts: [[60, 67], [52, 74], [48, 86], [47, 100], [52, 98], [55, 84]] },
  { muscle: 'FRONT_DELT', pts: [[70, 65], [62, 69], [57, 82], [55, 100], [60, 104], [65, 90], [71, 74]] },
  { muscle: 'CHEST', pts: [[98, 69], [84, 67], [74, 70], [67, 82], [66, 98], [72, 110], [86, 113], [98, 108]] },
  { muscle: 'BICEPS', pts: [[55, 106], [49, 110], [46, 122], [48, 136], [54, 138], [58, 126], [60, 113]] },
  { muscle: 'FOREARMS', pts: [[46, 145], [40, 158], [36, 178], [35, 196], [41, 197], [47, 176], [53, 153], [52, 145]] },
  { muscle: 'ABS', pts: [[98, 117], [88, 118], [86, 140], [86, 170], [90, 196], [98, 207]] },
  { muscle: 'OBLIQUES', pts: [[83, 119], [71, 115], [66, 136], [68, 162], [74, 182], [85, 192], [84, 162], [83, 138]] },
  { muscle: 'QUADS', pts: [[86, 219], [74, 209], [65, 226], [63, 252], [68, 278], [78, 290], [89, 284], [91, 262], [88, 236]] },
  { muscle: 'ADDUCTORS', pts: [[97, 224], [92, 227], [91, 244], [94, 262], [98, 248]] },
  { muscle: 'CALVES', pts: [[70, 302], [66, 320], [68, 346], [74, 362], [78, 340], [77, 312]] },
  { muscle: null, pts: [[84, 302], [80, 320], [81, 350], [85, 372], [89, 348], [90, 318]] },
];

/** 뒷모습 근육(왼쪽 절반) */
const BACK: Region[] = [
  { muscle: 'TRAPS', pts: [[100, 48], [92, 52], [82, 60], [68, 66], [80, 72], [90, 86], [96, 104], [100, 114]] },
  { muscle: 'REAR_DELT', pts: [[67, 69], [58, 71], [51, 80], [48, 96], [56, 96], [63, 84]] },
  { muscle: 'MID_BACK', pts: [[78, 76], [68, 79], [63, 92], [70, 102], [84, 104], [88, 92]] },
  { muscle: 'LATS', pts: [[66, 106], [62, 120], [66, 140], [76, 158], [88, 166], [90, 146], [90, 120], [84, 108]] },
  { muscle: 'LOWER_BACK', pts: [[98, 120], [93, 122], [91, 150], [91, 178], [95, 194], [99, 194]] },
  { muscle: 'OBLIQUES', pts: [[66, 152], [64, 172], [70, 188], [84, 192], [86, 176], [75, 166]] },
  { muscle: 'TRICEPS', pts: [[56, 100], [49, 104], [45, 118], [45, 134], [51, 140], [57, 128], [60, 110]] },
  { muscle: 'FOREARMS', pts: [[46, 145], [40, 158], [36, 178], [35, 196], [41, 197], [47, 176], [53, 153], [52, 145]] },
  { muscle: 'GLUTES', pts: [[98, 202], [84, 196], [70, 204], [66, 220], [72, 235], [86, 239], [98, 234]] },
  { muscle: 'HAMSTRINGS', pts: [[84, 244], [72, 240], [66, 258], [68, 280], [76, 292], [88, 290], [93, 266], [94, 248]] },
  { muscle: 'CALVES', pts: [[72, 302], [66, 320], [68, 342], [76, 358], [86, 352], [92, 332], [90, 310], [84, 302]] },
];

/** 복근 마디와 몸 가운데 선(장식) */
const ABS_LINES = 'M100,118V205 M87,140H113 M86,162H114 M88,184H112';

type Level = 'primary' | 'secondary' | 'none';

function Figure({ regions, level, label, absLines }: {
  regions: Region[];
  level: (m: Muscle | null) => Level;
  label: string;
  absLines?: boolean;
}) {
  const cls = { primary: styles.primary, secondary: styles.secondary, none: styles.muscle };
  return (
    <figure className={styles.view}>
      <svg viewBox="0 0 200 410" aria-hidden="true" className={styles.svg}>
        <ellipse cx={100} cy={30} rx={15} ry={19} className={styles.skin} />
        <path d={OUTLINE} className={styles.skin} />
        {regions.map(({ muscle, pts }, i) => (
          <g key={i} className={cls[level(muscle)]}>
            <path d={smooth(pts)} />
            <path d={smooth(flip(pts))} />
          </g>
        ))}
        {absLines && <path d={ABS_LINES} className={styles.line} />}
      </svg>
      <figcaption className={styles.caption}>{label}</figcaption>
    </figure>
  );
}

const names = (ms: Muscle[]) => ms.map((m) => MUSCLE_LABELS[m]).join(', ');

/** 헬스 종목의 근육 그림(앞·뒤). 주 근육은 진하게, 보조 근육은 연하게 칠한다. 직접 그린 단순화한 해부도다. */
export function MuscleMap({ name, primary, secondary }: { name: string; primary: Muscle[]; secondary: Muscle[] }) {
  const level = (m: Muscle | null): Level =>
    m == null ? 'none' : primary.includes(m) ? 'primary' : secondary.includes(m) ? 'secondary' : 'none';
  const absActive = level('ABS') !== 'none';
  const description =
    `${name} 근육 그림. 주 근육: ${names(primary) || '없음'}` + (secondary.length ? `, 보조 근육: ${names(secondary)}` : '');
  return (
    <div className={styles.wrap}>
      <div className={styles.map} role="img" aria-label={description}>
        <Figure regions={FRONT} level={level} label="앞" absLines={!absActive} />
        <Figure regions={BACK} level={level} label="뒤" />
      </div>
      <dl className={styles.legend}>
        <div>
          <dt>
            <span className={`${styles.swatch} ${styles.swatchPrimary}`} aria-hidden="true" />주 근육
          </dt>
          <dd>{names(primary) || '—'}</dd>
        </div>
        {secondary.length > 0 && (
          <div>
            <dt>
              <span className={`${styles.swatch} ${styles.swatchSecondary}`} aria-hidden="true" />보조
            </dt>
            <dd>{names(secondary)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
