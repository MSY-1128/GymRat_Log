import type { BodyPart } from '../api/types';
import { bodyPartLabel } from '../api/types';
import styles from './BodyMap.module.css';

type Shape = { x: number; y: number; w: number; h: number };

/** 왼쪽 도형을 좌우 대칭으로 하나 더 만든다(가운데 x = 50). */
const pair = (s: Shape): Shape[] => [s, { ...s, x: 100 - s.x - s.w }];

const SHOULDERS = pair({ x: 20, y: 30, w: 17, h: 15 });
const ARMS = [...pair({ x: 17, y: 46, w: 10, h: 29 }), ...pair({ x: 14, y: 77, w: 9, h: 27 })];
const THIGHS = pair({ x: 38, y: 99, w: 11.5, h: 43 });
const CALVES = pair({ x: 39.5, y: 145, w: 9, h: 37 });
const PECS = pair({ x: 37, y: 31, w: 12.5, h: 21 });
const ABS: Shape[] = [{ x: 40, y: 55, w: 20, h: 29 }];
const HIPS: Shape[] = [{ x: 37, y: 86, w: 26, h: 12 }];
const BACK: Shape[] = [{ x: 36, y: 30, w: 28, h: 44 }];
const LOWER_BACK: Shape[] = [{ x: 39, y: 76, w: 22, h: 9 }];

/** 보기별 부위 도형. 강조할 부위가 아닌 도형은 회색으로 그린다. */
const FRONT: { part: BodyPart | null; shapes: Shape[] }[] = [
  { part: 'SHOULDER', shapes: SHOULDERS },
  { part: 'CHEST', shapes: PECS },
  { part: 'CORE', shapes: ABS },
  { part: 'ARMS', shapes: ARMS },
  { part: null, shapes: HIPS },
  { part: 'LEGS', shapes: [...THIGHS, ...CALVES] },
];
const REAR: { part: BodyPart | null; shapes: Shape[] }[] = [
  { part: 'BACK', shapes: BACK },
  { part: 'SHOULDER', shapes: SHOULDERS },
  { part: null, shapes: LOWER_BACK },
  { part: 'ARMS', shapes: ARMS },
  { part: 'LEGS', shapes: [...HIPS, ...THIGHS, ...CALVES] },
];

function Figure({ regions, active, label }: { regions: typeof FRONT; active: BodyPart; label: string }) {
  return (
    <figure className={styles.view}>
      <svg viewBox="0 0 100 190" aria-hidden="true" className={styles.svg}>
        <circle cx={50} cy={14} r={10} className={styles.base} />
        <rect x={45} y={23} width={10} height={7} rx={3} className={styles.base} />
        {regions.map(({ part, shapes }, i) =>
          shapes.map((s, j) => (
            <rect
              key={`${i}-${j}`}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              rx={Math.min(s.w, s.h) / 2.4}
              className={part === active ? styles.on : styles.base}
            />
          )),
        )}
      </svg>
      <figcaption className={styles.caption}>{label}</figcaption>
    </figure>
  );
}

/** 헬스 부위 그림(앞·뒤). 선택한 부위를 강조한다. 근육 해부도가 아니라 위치를 알려 주는 단순화한 그림이다. */
export function BodyMap({ part }: { part: BodyPart }) {
  return (
    <div className={styles.map} role="img" aria-label={`${bodyPartLabel(part)} 부위를 표시한 앞·뒤 몸 그림`}>
      <Figure regions={FRONT} active={part} label="앞" />
      <Figure regions={REAR} active={part} label="뒤" />
    </div>
  );
}
