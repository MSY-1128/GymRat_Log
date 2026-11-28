import type { Muscle } from '../api/types';
import { add, dir, mul, type Pose, type V, type View } from './rig';

/**
 * 동작 패턴. 운동마다 DB의 motion 키("bench", "bench:incline")로 고른다.
 * frames는 시작 → … → 끝 자세이고 왕복 재생한다. at이 있으면 0~1 위상의 반복 동작(달리기·자전거)이다.
 * 장면(scene)은 몸 뒤에 그리는 기구, 좌표는 rig와 같다(바닥 y = 0).
 */

export type Tone = 'frame' | 'pad' | 'plate' | 'cable' | 'mark' | 'water';
export type Item =
  | { k: 'line'; a: V; b: V; w?: number; tone?: Tone }
  | { k: 'circle'; c: V; r: number; tone?: Tone }
  | { k: 'rope' }
  | { k: 'wave'; y: number };

/** 손에 드는 도구. equipment로 정하고 패턴이 바꿀 수 있다 */
export type Prop = 'barbell' | 'dumbbell' | 'kettlebell' | 'none' | 'pad' | 'wheel' | 'glove' | 'racket' | 'club' | 'ball' | 'handle';

export interface Pattern {
  view: View;
  frames?: Pose[];
  at?: (p: number) => Pose;
  /** 한 번 왕복(또는 한 바퀴)에 걸리는 초 */
  period?: number;
  scene?: Item[];
  /** 장면 위(몸 앞)에 그리는 기구 */
  front?: Item[];
  /** 발에 붙어 움직이는 기구(레그 프레스 발판 등): 발목 기준 */
  footItems?: Item[];
  prop?: Prop;
  /** 케이블 고정점. 장비가 케이블이거나 always면 손 → 고정점 줄을 그린다(앞·뒷모습은 좌우 대칭) */
  cable?: V;
  cableAlways?: boolean;
  /** 데이터에 근육이 없는 운동(유산소 등)에 쓰는 기본 근육 */
  muscles?: { primary: Muscle[]; secondary: Muscle[] };
  noFloor?: boolean;
  /** viewBox [x, 바닥 아래 여백, 너비, 높이] */
  box?: [number, number, number, number];
}

// ---------- 장면 조각 ----------
const line = (a: V, b: V, w = 4, tone: Tone = 'frame'): Item => ({ k: 'line', a, b, w, tone });
const pad = (a: V, b: V, w = 9): Item => line(a, b, w, 'pad');
const circle = (c: V, r: number, tone: Tone = 'frame'): Item => ({ k: 'circle', c, r, tone });

/** 평벤치: x0~x1, 윗면 높이 top */
const flatBench = (x0: number, x1: number, top = 40): Item[] => [
  line([x0 + 8, 0], [x0 + 8, top - 4], 4),
  line([x1 - 8, 0], [x1 - 8, top - 4], 4),
  line([x0 + 2, 1], [x0 + 16, 1], 4),
  line([x1 - 16, 1], [x1 - 2, 1], 4),
  pad([x0, top - 4.5], [x1, top - 4.5]),
];
/** 각도 있는 등받이(엉덩이 근처 a에서 deg 방향으로 길이 l) + 의자 */
const angledBench = (a: V, degAngle: number, l: number, seatTo: number): Item[] => {
  const back = add(a, mul(dir(degAngle), l));
  return [line([a[0], 0], [a[0], a[1] - 4], 4), line([a[0] - 12, 1], [a[0] + 18, 1], 4), pad(a, back), pad(a, [seatTo, a[1]])];
};
const seat = (x: number, top = 40, w = 18): Item[] => [line([x, 0], [x, top - 4], 4), line([x - 14, 1], [x + 14, 1], 4), pad([x - w / 2, top - 4.5], [x + w / 2, top - 4.5])];
const uprightPad = (x: number, y0: number, y1: number): Item => pad([x, y0], [x, y1], 9);
const pullBar = (y: number, x0 = -60, x1 = 60): Item[] => [line([x0, 0], [x0, y + 2], 4), line([x1, 0], [x1, y + 2], 4), line([x0, y], [x1, y], 3.5)];
const tower = (x: number, top: number): Item[] => [line([x, 0], [x, top], 5), line([x - 10, 1], [x + 10, 1], 4), line([x, top], [x - 12, top], 3)];

const STAND: Pose = { hip: [0, 80], t: 90, f: [3, 3], hs: [2, -50] };
const SEAT_HIP: V = [0, 48];

// 바벨을 몸통에 얹는 자세(어깨 기준, 몸통 축)
const BAR_BACK: V = [-1, -9];
const BAR_FRONT: V = [2, 9];

const legsMuscles = { primary: ['QUADS', 'HAMSTRINGS', 'CALVES'] as Muscle[], secondary: ['GLUTES'] as Muscle[] };

export const PATTERNS: Record<string, Pattern> = {
  // ================= 가슴 =================
  bench: {
    view: 's',
    scene: flatBench(-58, 34),
    frames: [
      { hip: [12, 48], t: 180, f: [60, 3], hs: [2, 52], eb: -1 },
      { hip: [12, 48], t: 180, f: [60, 3], hs: [8, 20], eb: -1, ua: 0.6 },
    ],
  },
  'bench:incline': {
    view: 's',
    scene: angledBench([18, 40], 145, 70, 40),
    frames: [
      { hip: [20, 46], t: 145, f: [64, 3], hs: [4, 50], eb: -1 },
      { hip: [20, 46], t: 145, f: [64, 3], hs: [12, 18], eb: -1, ua: 0.6 },
    ],
  },
  'bench:decline': {
    view: 's',
    scene: [...angledBench([22, 50], 195, 76, 36), pad([46, 30], [46, 44], 10)],
    frames: [
      { hip: [16, 56], t: 195, f: [52, 30], hs: [-4, 52], eb: -1 },
      { hip: [16, 56], t: 195, f: [52, 30], hs: [4, 22], eb: -1, ua: 0.6 },
    ],
  },
  // 누운 플라이는 위에서 내려다본 모습(앞모습 골격 + 세로 벤치)
  fly: {
    view: 'f',
    noFloor: true,
    scene: [pad([0, 40], [0, 150], 30)],
    frames: [
      { hip: [0, 70], t: 90, fh: [3, -77], hs: [-8, -6], ua: 0.45, fa: 0.4 },
      { hip: [0, 70], t: 90, fh: [3, -77], hs: [50, -4], eb: -1 },
    ],
    box: [-110, 0, 220, 190],
  },
  'fly:incline': { view: 'f', noFloor: true, scene: [pad([0, 40], [0, 150], 30)], frames: [
    { hip: [0, 70], t: 90, fh: [3, -77], hs: [-8, -2], ua: 0.45, fa: 0.4 },
    { hip: [0, 70], t: 90, fh: [3, -77], hs: [50, 4], eb: -1 },
  ], box: [-110, 0, 220, 190] },
  pullover: {
    view: 's',
    scene: flatBench(-58, 34),
    frames: [
      { hip: [12, 48], t: 180, f: [60, 3], hs: [2, 50], eb: -1 },
      { hip: [12, 48], t: 180, f: [60, 3], hs: [-50, 6], eb: -1 },
    ],
  },
  chestPress: {
    view: 's',
    scene: [...seat(0), uprightPad(-10, 46, 112), line([72, 0], [72, 140], 5), line([72, 140], [40, 140], 4)],
    frames: [
      { hip: [0, 48], t: 95, f: [38, 3], hs: [18, -4], eb: -1, ua: 0.45 },
      { hip: [0, 48], t: 95, f: [38, 3], hs: [50, -2], eb: -1 },
    ],
    prop: 'handle',
  },
  'chestPress:incline': {
    view: 's',
    scene: [...seat(0), uprightPad(-10, 46, 112), line([72, 0], [72, 150], 5)],
    frames: [
      { hip: [0, 48], t: 95, f: [38, 3], hs: [18, 4], eb: -1, ua: 0.45 },
      { hip: [0, 48], t: 95, f: [38, 3], hs: [44, 26], eb: -1 },
    ],
    prop: 'handle',
  },
  // 사진처럼 앞에서 본 펙덱: 팔꿈치를 어깨 높이로 벌렸다가 가운데로 모은다
  pecDeck: {
    view: 'f',
    scene: [...seat(0, 40, 34), uprightPad(0, 44, 128), line([-70, 0], [-70, 160], 5), line([70, 0], [70, 160], 5), line([-70, 160], [70, 160], 5), circle([-40, 158], 7), circle([40, 158], 7)],
    frames: [
      { hip: SEAT_HIP, t: 90, fh: [6, -45], th: 0.35, hs: [30, 26], eb: -1 },
      { hip: SEAT_HIP, t: 90, fh: [6, -45], th: 0.35, hs: [-10, 24], eb: -1, ua: 0.55 },
    ],
    prop: 'pad',
  },
  cableFly: {
    view: 'f',
    scene: [...tower(-96, 176), ...tower(96, 176)],
    cable: [-92, 168],
    cableAlways: true,
    frames: [
      { ...STAND, f: undefined, fh: [12, -77], hs: [46, 20], eb: -1 },
      { ...STAND, f: undefined, fh: [12, -77], hs: [-10, -30], eb: -1 },
    ],
    prop: 'handle',
  },
  'cableFly:low': {
    view: 'f',
    scene: [...tower(-96, 176), ...tower(96, 176)],
    cable: [-92, 14],
    cableAlways: true,
    frames: [
      { ...STAND, f: undefined, fh: [12, -77], hs: [46, -28], eb: -1 },
      { ...STAND, f: undefined, fh: [12, -77], hs: [-10, 14], eb: -1 },
    ],
    prop: 'handle',
  },
  'cableFly:high': {
    view: 'f',
    scene: [...tower(-96, 176), ...tower(96, 176)],
    cable: [-92, 168],
    cableAlways: true,
    frames: [
      { ...STAND, f: undefined, fh: [12, -77], hs: [48, 8], eb: -1 },
      { ...STAND, f: undefined, fh: [12, -77], hs: [-10, -14], eb: -1 },
    ],
    prop: 'handle',
  },
  dip: {
    view: 's',
    scene: [line([-6, 110], [38, 110], 4), line([30, 0], [30, 110], 4), line([22, 1], [40, 1], 4)],
    frames: [
      { hip: [-2, 118], t: 88, h: [8, 112], fh: [-14, -66], kb: -1, eb: 1 },
      { hip: [-8, 86], t: 76, h: [8, 112], fh: [-16, -64], kb: -1, eb: 1 },
    ],
    box: [-110, 0, 220, 205],
  },
  pushup: {
    view: 's',
    frames: [
      { hip: [-4, 40], t: 14, f: [-74, 11], ft: -78, h: [42, 3], eb: 1 },
      { hip: [-4, 22], t: 6, f: [-74, 11], ft: -82, h: [42, 3], eb: 1 },
    ],
  },
  'pushup:incline': {
    view: 's',
    scene: flatBench(30, 80, 38),
    frames: [
      { hip: [-12, 54], t: 30, f: [-70, 7], ft: -70, h: [50, 38], eb: 1 },
      { hip: [-8, 46], t: 24, f: [-70, 7], ft: -70, h: [50, 38], eb: 1 },
    ],
  },
  'pushup:decline': {
    view: 's',
    scene: flatBench(-98, -48, 38),
    frames: [
      { hip: [-18, 50], t: -4, f: [-74, 42], ft: -60, h: [46, 3], eb: 1 },
      { hip: [-14, 36], t: -12, f: [-74, 42], ft: -60, h: [46, 3], eb: 1 },
    ],
  },

  // ================= 등 =================
  deadlift: {
    view: 's',
    frames: [
      { hip: [-16, 46], t: 32, f: [4, 3], h: [12, 14], eb: -1 },
      { hip: [0, 80], t: 93, f: [4, 3], hs: [3, -50], eb: -1 },
    ],
  },
  'deadlift:rack': {
    view: 's',
    scene: [line([34, 0], [34, 58], 4), line([26, 50], [44, 50], 4)],
    frames: [
      { hip: [-8, 66], t: 55, f: [4, 3], h: [10, 56], eb: -1 },
      { hip: [0, 80], t: 93, f: [4, 3], hs: [3, -50], eb: -1 },
    ],
  },
  'deadlift:sumo': {
    view: 'f',
    frames: [
      { hip: [0, 44], t: 90, fh: [30, -41], kb: 1, hs: [-2, -48], eb: 1 },
      { hip: [0, 70], t: 90, fh: [24, -67], kb: 1, hs: [-2, -50], eb: 1 },
    ],
  },
  rdl: {
    view: 's',
    frames: [
      { hip: [0, 80], t: 92, f: [3, 3], hs: [3, -50] },
      { hip: [-18, 76], t: 16, f: [3, 3], hs: [-2, -50] },
    ],
  },
  goodMorning: {
    view: 's',
    frames: [
      { hip: [0, 80], t: 90, f: [3, 3], hl: BAR_BACK, eb: -1 },
      { hip: [-20, 76], t: 12, f: [3, 3], hl: BAR_BACK, eb: -1 },
    ],
  },
  row: {
    view: 's',
    frames: [
      { hip: [-16, 72], t: 26, f: [4, 3], hs: [0, -48], eb: -1 },
      { hip: [-16, 72], t: 26, f: [4, 3], hl: [-24, 6], eb: 1 },
    ],
  },
  'row:pendlay': {
    view: 's',
    frames: [
      { hip: [-20, 66], t: 8, f: [4, 3], h: [26, 14], eb: -1 },
      { hip: [-20, 66], t: 8, f: [4, 3], hl: [-24, 12], eb: 1 },
    ],
  },
  oneArmRow: {
    view: 's',
    scene: flatBench(30, 96, 40),
    frames: [
      { hip: [-16, 70], t: 6, f: [-10, 3], f2: [-30, 3], h2: [60, 42], hs: [0, -46], eb: -1, eb2: 1 },
      { hip: [-16, 70], t: 6, f: [-10, 3], f2: [-30, 3], h2: [60, 42], hl: [-26, 10], eb: 1, eb2: 1 },
    ],
  },
  supportedRow: {
    view: 's',
    scene: angledBench([-6, 40], 35, 74, -30),
    frames: [
      { hip: [-4, 52], t: 35, f: [-50, 3], kb: 1, hs: [2, -46], eb: -1 },
      { hip: [-4, 52], t: 35, f: [-50, 3], kb: 1, hl: [-22, 14], eb: 1 },
    ],
  },
  shrug: {
    view: 'f',
    frames: [
      { ...STAND, f: undefined, fh: [4, -77], hs: [2, -51] },
      { ...STAND, f: undefined, fh: [4, -77], hs: [2, -51], lift: 7 },
    ],
  },
  pulldown: {
    view: 'b',
    scene: [line([0, 0], [0, 40], 5), pad([-17, 36], [17, 36]), pad([-20, 66], [20, 66], 7), line([0, 66], [0, 40], 3), line([0, 182], [0, 120], 2, 'cable'), circle([0, 182], 6)],
    frames: [
      { hip: [0, 48], t: 90, fh: [2, -45], th: 0.35, hs: [26, 48], eb: -1 },
      { hip: [0, 48], t: 90, fh: [2, -45], th: 0.35, hs: [22, 8], eb: -1 },
    ],
    prop: 'barbell',
    box: [-110, 0, 220, 200],
  },
  'pulldown:close': {
    view: 'b',
    scene: [line([0, 0], [0, 40], 5), pad([-17, 36], [17, 36]), pad([-20, 66], [20, 66], 7), line([0, 182], [0, 120], 2, 'cable'), circle([0, 182], 6)],
    frames: [
      { hip: [0, 48], t: 90, fh: [2, -45], th: 0.35, hs: [-6, 50], eb: -1 },
      { hip: [0, 48], t: 90, fh: [2, -45], th: 0.35, hs: [-6, 10], eb: -1 },
    ],
    prop: 'handle',
    box: [-110, 0, 220, 200],
  },
  seatedRow: {
    view: 's',
    scene: [pad([-28, 26], [18, 26]), line([-6, 0], [-6, 22], 4), line([78, 0], [78, 32], 5), circle([110, 20], 5)],
    cable: [110, 20],
    cableAlways: true,
    frames: [
      { hip: [0, 30], t: 72, f: [74, 18], ft: 80, kb: 1, hs: [52, -8], eb: -1 },
      { hip: [0, 30], t: 96, f: [74, 18], ft: 80, kb: 1, hl: [-26, 12], eb: 1 },
    ],
    prop: 'handle',
  },
  'seatedRow:high': {
    view: 's',
    scene: [...seat(0), pad([30, 30], [30, 60], 8), line([80, 0], [80, 170], 5), circle([80, 168], 6)],
    cable: [80, 168],
    cableAlways: true,
    frames: [
      { hip: [0, 48], t: 88, f: [36, 3], hs: [40, 36], eb: -1 },
      { hip: [0, 48], t: 96, f: [36, 3], hs: [8, -4], eb: 1 },
    ],
    prop: 'handle',
  },
  straightArmPulldown: {
    view: 's',
    scene: tower(90, 176),
    cable: [86, 170],
    cableAlways: true,
    frames: [
      { hip: [-6, 79], t: 80, f: [3, 3], hs: [38, 34], eb: 1 },
      { hip: [-6, 79], t: 80, f: [3, 3], hs: [8, -50], eb: 1 },
    ],
    prop: 'handle',
  },
  pullup: {
    view: 'b',
    scene: pullBar(184, -70, 70),
    frames: [
      { hip: [0, 88], t: 90, h: [30, 184], fh: [3, -74], eb: -1 },
      { hip: [0, 122], t: 90, h: [30, 184], fh: [3, -70], eb: -1 },
    ],
    box: [-110, 0, 220, 212],
  },
  'pullup:close': {
    view: 'b',
    scene: pullBar(184, -70, 70),
    frames: [
      { hip: [0, 88], t: 90, h: [12, 184], fh: [3, -74], eb: -1 },
      { hip: [0, 122], t: 90, h: [12, 184], fh: [3, -70], eb: -1 },
    ],
    box: [-110, 0, 220, 212],
  },
  invertedRow: {
    view: 's',
    scene: [line([60, 0], [60, 82], 4), line([36, 80], [70, 80], 3.5)],
    frames: [
      { hip: [5, 19], t: 12, f: [-70, 3], ft: 80, h: [44, 80], eb: 1 },
      { hip: [-2, 39], t: 28, f: [-70, 3], ft: 70, h: [44, 80], eb: 1 },
    ],
  },
  backExtension: {
    view: 's',
    scene: [pad([-8, 54], [14, 76], 10), line([2, 0], [2, 60], 4), pad([-56, 10], [-44, 10], 8), line([-50, 0], [-50, 8], 4)],
    frames: [
      { hip: [0, 64], t: -62, f: [-50, 14], ft: -45, kb: -1, hl: [-14, 8], eb: 1 },
      { hip: [0, 64], t: 44, f: [-50, 14], ft: -45, kb: -1, hl: [-14, 8], eb: 1 },
    ],
  },

  // ================= 어깨 =================
  ohp: {
    view: 'f',
    frames: [
      { ...STAND, f: undefined, fh: [4, -77], hs: [10, 4], eb: -1 },
      { ...STAND, f: undefined, fh: [4, -77], hs: [6, 51], eb: -1 },
    ],
  },
  'ohp:push': {
    view: 'f',
    frames: [
      { hip: [0, 72], t: 90, fh: [5, -69], kb: 1, hs: [10, 4], eb: -1 },
      { hip: [0, 80], t: 90, fh: [4, -77], hs: [6, 51], eb: -1 },
    ],
  },
  'ohp:seated': {
    view: 'f',
    scene: [...seat(0, 40, 34), uprightPad(0, 44, 120)],
    frames: [
      { hip: SEAT_HIP, t: 90, fh: [6, -45], th: 0.35, hs: [14, 6], eb: -1 },
      { hip: SEAT_HIP, t: 90, fh: [6, -45], th: 0.35, hs: [6, 51], eb: -1 },
    ],
  },
  uprightRow: {
    view: 'f',
    frames: [
      { ...STAND, f: undefined, fh: [4, -77], hs: [-8, -50], eb: 1 },
      { ...STAND, f: undefined, fh: [4, -77], hs: [-8, 4], eb: -1 },
    ],
  },
  landminePress: {
    view: 's',
    frames: [
      { hip: [0, 80], t: 88, f: [12, 3], f2: [-16, 3], hs: [14, -6], eb: -1 },
      { hip: [0, 80], t: 84, f: [12, 3], f2: [-16, 3], hs: [42, 30], eb: -1 },
    ],
    prop: 'barbell',
  },
  lateralRaise: {
    view: 'f',
    frames: [
      { ...STAND, f: undefined, fh: [4, -77], hs: [6, -50], eb: 1 },
      { ...STAND, f: undefined, fh: [4, -77], hs: [50, 0], eb: 1 },
    ],
    cable: [-30, 8],
  },
  'lateralRaise:seated': {
    view: 'f',
    scene: [...seat(0, 40, 34), uprightPad(0, 44, 110)],
    frames: [
      { hip: SEAT_HIP, t: 90, fh: [6, -45], th: 0.35, hs: [10, -42], ua: 1, fa: 0.7, eb: 1 },
      { hip: SEAT_HIP, t: 90, fh: [6, -45], th: 0.35, hs: [42, 0], fa: 0.7, eb: 1 },
    ],
    prop: 'pad',
  },
  frontRaise: {
    view: 's',
    frames: [
      { ...STAND, hs: [4, -51], eb: 1 },
      { ...STAND, hs: [51, 4], eb: 1 },
    ],
    cable: [-10, 6],
  },
  rearFly: {
    view: 'b',
    frames: [
      { ...STAND, f: undefined, fh: [4, -77], t: 90, hs: [-12, -42], eb: 1 },
      { ...STAND, f: undefined, fh: [4, -77], t: 90, hs: [48, -6], eb: -1 },
    ],
  },
  reversePecDeck: {
    view: 'b',
    scene: [...seat(0, 40, 34), line([-70, 0], [-70, 160], 5), line([70, 0], [70, 160], 5), line([-70, 160], [70, 160], 5)],
    frames: [
      { hip: SEAT_HIP, t: 90, fh: [6, -45], th: 0.35, hs: [-12, 2], eb: 1, ua: 0.6 },
      { hip: SEAT_HIP, t: 90, fh: [6, -45], th: 0.35, hs: [50, 2], eb: -1 },
    ],
    prop: 'handle',
  },
  'reversePecDeck:standing': {
    view: 'b',
    scene: [...tower(-96, 150), ...tower(96, 150)],
    cable: [-92, 120],
    cableAlways: true,
    frames: [
      { ...STAND, f: undefined, fh: [10, -77], hs: [-12, 0], eb: 1, ua: 0.6 },
      { ...STAND, f: undefined, fh: [10, -77], hs: [50, 2], eb: -1 },
    ],
    prop: 'handle',
  },
  facePull: {
    view: 's',
    scene: tower(98, 150),
    cable: [94, 140],
    cableAlways: true,
    frames: [
      { ...STAND, f: [8, 3], f2: [-10, 3], hs: [48, 16], eb: -1 },
      { ...STAND, f: [8, 3], f2: [-10, 3], hs: [8, 18], eb: 1, ua: 0.7 },
    ],
    prop: 'handle',
  },
  pikePushup: {
    view: 's',
    frames: [
      { hip: [-12, 78], t: -48, f: [-40, 3], ft: -30, h: [40, 3], eb: 1, head: 20 },
      { hip: [-6, 70], t: -64, f: [-40, 3], ft: -30, h: [40, 3], eb: 1, head: 20 },
    ],
  },
  handstandPushup: {
    view: 's',
    scene: [line([-34, 0], [-34, 200], 6)],
    frames: [
      { hip: [-4, 100], t: -90, fh: [-6, 77], ft: 100, h: [6, 3], eb: 1 },
      { hip: [-4, 78], t: -90, fh: [-6, 77], ft: 100, h: [6, 3], eb: 1 },
    ],
    box: [-110, 0, 220, 190],
  },

  // ================= 하체 =================
  squat: {
    view: 's',
    frames: [
      { hip: [0, 80], t: 90, f: [4, 3], hl: BAR_BACK, eb: -1 },
      { hip: [-26, 42], t: 54, f: [4, 3], hl: BAR_BACK, eb: -1 },
    ],
  },
  'squat:front': {
    view: 's',
    frames: [
      { hip: [0, 80], t: 90, f: [4, 3], hl: BAR_FRONT, eb: 1 },
      { hip: [-22, 40], t: 72, f: [4, 3], hl: BAR_FRONT, eb: 1 },
    ],
  },
  'squat:goblet': {
    view: 's',
    frames: [
      { hip: [0, 80], t: 90, f: [4, 3], hl: [-12, 12], eb: -1 },
      { hip: [-22, 40], t: 68, f: [4, 3], hl: [-12, 12], eb: -1 },
    ],
  },
  'squat:air': {
    view: 's',
    frames: [
      { hip: [0, 80], t: 90, f: [4, 3], hs: [3, -50] },
      { hip: [-24, 42], t: 58, f: [4, 3], hs: [50, -4] },
    ],
  },
  'squat:jump': {
    view: 's',
    period: 1.6,
    frames: [
      { hip: [-22, 46], t: 58, f: [4, 3], hs: [-34, -36] },
      { hip: [0, 96], t: 92, f: [3, 18], ft: -30, hs: [12, 50] },
    ],
  },
  splitSquat: {
    view: 's',
    scene: flatBench(-90, -40, 38),
    frames: [
      { hip: [-4, 80], t: 88, f: [24, 3], f2: [-56, 42], ft2: -60, kb2: 1, hs: [2, -48] },
      { hip: [-10, 48], t: 80, f: [24, 3], f2: [-56, 42], ft2: -60, kb2: 1, hs: [2, -48] },
    ],
  },
  lunge: {
    view: 's',
    frames: [
      { hip: [0, 80], t: 90, f: [4, 3], f2: [-2, 3], hs: [2, -48] },
      { hip: [-4, 44], t: 90, f: [34, 3], f2: [-38, 6], ft2: -70, kb2: 1, hs: [2, -48] },
    ],
  },
  stepUp: {
    view: 's',
    scene: [line([14, 18], [58, 18], 36, 'frame')],
    frames: [
      { hip: [0, 80], t: 88, f: [30, 39], f2: [-6, 3], hs: [2, -48] },
      { hip: [26, 114], t: 92, f: [30, 39], f2: [20, 56], ft2: -30, hs: [2, -48] },
    ],
    box: [-110, 0, 220, 200],
  },
  hipThrust: {
    view: 's',
    scene: flatBench(-78, -22, 40),
    frames: [
      { hip: [14, 20], t: 152, f: [52, 3], hh: [2, 10], eb: 1 },
      { hip: [10, 44], t: 183, f: [52, 3], hh: [2, 10], eb: 1 },
    ],
  },
  glutBridge: {
    view: 's',
    frames: [
      { hip: [14, 10], t: 172, f: [46, 3], h: [-10, 6] },
      { hip: [12, 34], t: 207, f: [46, 3], h: [-10, 6] },
    ],
  },
  kbSwing: {
    view: 's',
    period: 1.8,
    frames: [
      { hip: [-16, 70], t: 30, f: [4, 3], hs: [-16, -46], eb: 1 },
      { hip: [0, 80], t: 94, f: [4, 3], hs: [50, 2], eb: 1 },
    ],
  },
  legPress: {
    view: 's',
    scene: [pad([-6, 26], [-48, 64], 10), pad([-6, 26], [22, 26], 10), line([-20, 0], [-20, 20], 4), line([0, 20], [110, 128], 4)],
    footItems: [{ k: 'line', a: [-12, 14], b: [12, -10], w: 7, tone: 'pad' }],
    frames: [
      { hip: [0, 32], t: 135, f: [34, 58], ft: 45, kb: 1, h: [8, 30] },
      { hip: [0, 32], t: 135, f: [58, 82], ft: 45, kb: 1, h: [8, 30] },
    ],
  },
  hackSquat: {
    view: 's',
    scene: [line([-50, 0], [10, 170], 4), line([-10, 1], [40, 1], 8, 'pad')],
    frames: [
      { hip: [-12, 80], t: 72, f: [16, 6], hl: [2, -6], eb: -1 },
      { hip: [-30, 44], t: 72, f: [16, 6], hl: [2, -6], eb: -1 },
    ],
  },
  legExtension: {
    view: 's',
    scene: [...seat(0, 40, 40), uprightPad(-14, 46, 108)],
    footItems: [{ k: 'circle', c: [4, 0], r: 5, tone: 'pad' }],
    frames: [
      { hip: [0, 48], t: 96, f: [42, 12], h: [-4, 40] },
      { hip: [0, 48], t: 96, f: [78, 46], h: [-4, 40] },
    ],
  },
  legCurl: {
    view: 's',
    scene: flatBench(-60, 96, 40),
    footItems: [{ k: 'circle', c: [0, 6], r: 5, tone: 'pad' }],
    frames: [
      { hip: [6, 48], t: 180, f: [84, 46], h: [-56, 40], eb: 1, kb: -1, ft: -80 },
      { hip: [6, 48], t: 180, f: [50, 88], h: [-56, 40], eb: 1, kb: -1, ft: -80 },
    ],
  },
  seatedLegCurl: {
    view: 's',
    scene: [...seat(0, 40, 40), uprightPad(-14, 46, 108)],
    footItems: [{ k: 'circle', c: [0, 6], r: 5, tone: 'pad' }],
    frames: [
      { hip: [0, 48], t: 100, f: [78, 46], h: [-4, 40] },
      { hip: [0, 48], t: 100, f: [36, 10], h: [-4, 40] },
    ],
  },
  hipAbduction: {
    view: 'f',
    scene: [...seat(0, 40, 34), uprightPad(0, 44, 118)],
    frames: [
      { hip: SEAT_HIP, t: 90, fh: [-4, -44], th: 0.35, hs: [6, -26], eb: 1 },
      { hip: SEAT_HIP, t: 90, fh: [16, -42], th: 0.35, hs: [6, -26], eb: 1 },
    ],
  },
  hipAdduction: {
    view: 'f',
    scene: [...seat(0, 40, 34), uprightPad(0, 44, 118)],
    frames: [
      { hip: SEAT_HIP, t: 90, fh: [18, -42], th: 0.35, hs: [6, -26], eb: 1 },
      { hip: SEAT_HIP, t: 90, fh: [-4, -44], th: 0.35, hs: [6, -26], eb: 1 },
    ],
  },
  calfRaise: {
    view: 's',
    scene: [line([-2, 5], [30, 5], 10, 'pad')],
    frames: [
      { hip: [0, 90], t: 90, f: [3, 13], ft: 0, hs: [2, -48] },
      { hip: [0, 97], t: 90, f: [3, 20], ft: -42, hs: [2, -48] },
    ],
  },
  seatedCalfRaise: {
    view: 's',
    scene: [...seat(-6, 40, 30), line([-2, 5], [36, 5], 10, 'pad')],
    front: [pad([20, 50], [44, 50], 8)],
    frames: [
      { hip: [0, 48], t: 92, f: [30, 13], ft: 0, h: [34, 52] },
      { hip: [0, 48], t: 92, f: [30, 20], ft: -42, h: [34, 52] },
    ],
  },
  glutKickback: {
    view: 's',
    scene: [line([60, 0], [60, 130], 5), circle([60, 8], 5)],
    cable: [60, 8],
    cableAlways: true,
    frames: [
      { hip: [0, 80], t: 76, f: [-4, 8], f2: [5, 3], h: [56, 110], eb: -1 },
      { hip: [0, 80], t: 76, f: [-56, 46], f2: [5, 3], h: [56, 110], eb: -1 },
    ],
    prop: 'none',
  },
  nordic: {
    view: 's',
    scene: [pad([-50, 6], [-30, 6], 8)],
    frames: [
      { hip: [0, 42], t: 90, f: [-40, 6], kb: 1, hl: [-14, 8], eb: 1 },
      { hip: [22, 34], t: 20, f: [-40, 6], kb: 1, hs: [12, -26], eb: 1 },
    ],
  },

  // ================= 팔 =================
  curl: {
    view: 's',
    cable: [30, 6],
    frames: [
      { ...STAND, hs: [3, -50], eb: -1 },
      { ...STAND, hs: [14, -4], eb: -1 },
    ],
  },
  preacherCurl: {
    view: 's',
    scene: [...seat(-6, 40, 26), pad([12, 76], [36, 60], 10), line([28, 0], [28, 62], 4)],
    frames: [
      { hip: [-6, 48], t: 92, f: [30, 3], hs: [46, -26], eb: -1 },
      { hip: [-6, 48], t: 92, f: [30, 3], hs: [26, 8], eb: -1 },
    ],
  },
  inclineCurl: {
    view: 's',
    scene: angledBench([4, 40], 118, 76, 34),
    frames: [
      { hip: [6, 46], t: 118, f: [52, 3], hs: [-4, -50], eb: -1 },
      { hip: [6, 46], t: 118, f: [52, 3], hs: [12, -16], eb: -1 },
    ],
  },
  concentrationCurl: {
    view: 's',
    scene: flatBench(-34, 14, 40),
    frames: [
      { hip: [-8, 48], t: 56, f: [32, 3], hs: [6, -46], eb: 1 },
      { hip: [-8, 48], t: 56, f: [32, 3], hs: [2, -12], eb: 1 },
    ],
  },
  wristCurl: {
    view: 's',
    scene: flatBench(-34, 14, 40),
    period: 1.6,
    frames: [
      { hip: [-8, 48], t: 70, f: [32, 3], h: [46, 40], eb: -1 },
      { hip: [-8, 48], t: 70, f: [32, 3], h: [46, 48], eb: -1 },
    ],
  },
  skullCrusher: {
    view: 's',
    scene: flatBench(-58, 34),
    frames: [
      { hip: [12, 48], t: 180, f: [60, 3], hs: [0, 52], eb: -1 },
      { hip: [12, 48], t: 180, f: [60, 3], hs: [-22, 32], eb: -1 },
    ],
  },
  overheadExtension: {
    view: 's',
    frames: [
      { ...STAND, hs: [-18, 20], eb: 1 },
      { ...STAND, hs: [2, 52], eb: 1 },
    ],
  },
  'overheadExtension:cable': {
    view: 's',
    scene: tower(-98, 150),
    cable: [-94, 30],
    cableAlways: true,
    frames: [
      { hip: [0, 80], t: 76, f: [14, 3], f2: [-16, 3], hs: [-18, 20], eb: 1 },
      { hip: [0, 80], t: 76, f: [14, 3], f2: [-16, 3], hs: [24, 46], eb: 1 },
    ],
    prop: 'handle',
  },
  tricepsKickback: {
    view: 's',
    frames: [
      { hip: [-14, 74], t: 20, f: [4, 3], hs: [-24, -32], eb: 1 },
      { hip: [-14, 74], t: 20, f: [4, 3], hs: [-52, -12], eb: 1 },
    ],
  },
  pushdown: {
    view: 's',
    scene: tower(62, 186),
    cable: [58, 180],
    cableAlways: true,
    frames: [
      { ...STAND, t: 84, hs: [18, -14], eb: -1 },
      { ...STAND, t: 84, hs: [10, -50], eb: -1 },
    ],
    prop: 'handle',
  },
  benchDip: {
    view: 's',
    scene: flatBench(-62, -14, 38),
    frames: [
      { hip: [-8, 42], t: 92, f: [58, 3], kb: 1, h: [-24, 38], eb: 1 },
      { hip: [-8, 20], t: 92, f: [58, 3], kb: 1, h: [-24, 38], eb: 1 },
    ],
  },
  farmerWalk: {
    view: 's',
    period: 1.4,
    frames: [
      { hip: [0, 79], t: 90, f: [18, 3], f2: [-16, 6], hs: [3, -50] },
      { hip: [0, 79], t: 90, f: [-16, 6], f2: [18, 3], hs: [3, -50] },
    ],
  },

  // ================= 복근 =================
  crunch: {
    view: 's',
    frames: [
      { hip: [10, 9], t: 178, f: [52, 3], kb: 1, hl: [8, -4], eb: 1 },
      { hip: [10, 9], t: 150, f: [52, 3], kb: 1, hl: [8, -4], eb: 1, head: -15 },
    ],
  },
  'crunch:machine': {
    view: 's',
    scene: [...seat(0, 40, 26), line([-20, 0], [-20, 150], 5)],
    frames: [
      { hip: [0, 48], t: 96, f: [34, 3], hl: [-6, 10], eb: 1 },
      { hip: [0, 48], t: 56, f: [34, 3], hl: [-6, 10], eb: 1, head: -15 },
    ],
    prop: 'handle',
  },
  cableCrunch: {
    view: 's',
    scene: tower(70, 186),
    cable: [66, 180],
    cableAlways: true,
    frames: [
      { hip: [0, 44], t: 96, f: [-40, 5], ft: 180, kb: 1, hl: [2, 8], eb: 1 },
      { hip: [0, 44], t: 30, f: [-40, 5], ft: 180, kb: 1, hl: [2, 8], eb: 1, head: -15 },
    ],
    prop: 'handle',
  },
  situp: {
    view: 's',
    frames: [
      { hip: [10, 9], t: 178, f: [52, 3], kb: 1, hl: [-14, 8], eb: 1 },
      { hip: [10, 9], t: 84, f: [52, 3], kb: 1, hl: [-14, 8], eb: 1 },
    ],
  },
  'situp:decline': {
    view: 's',
    scene: [pad([-50, 30], [24, 48], 10), line([-30, 0], [-30, 30], 4), line([10, 0], [10, 42], 4), pad([50, 56], [50, 66], 10)],
    frames: [
      { hip: [16, 50], t: 194, f: [54, 64], kb: 1, hl: [-14, 8], eb: 1 },
      { hip: [16, 50], t: 92, f: [54, 64], kb: 1, hl: [-14, 8], eb: 1 },
    ],
  },
  reverseCrunch: {
    view: 's',
    frames: [
      { hip: [10, 9], t: 178, f: [42, 30], kb: 1, h: [-46, 4] },
      { hip: [6, 16], t: 172, f: [6, 54], kb: 1, h: [-46, 4] },
    ],
  },
  bicycleCrunch: {
    view: 's',
    frames: [
      { hip: [10, 9], t: 152, f: [36, 34], f2: [70, 22], kb: 1, hl: [8, -4], eb: 1 },
      { hip: [10, 9], t: 152, f: [70, 22], f2: [36, 34], kb: 1, hl: [8, -4], eb: 1 },
    ],
  },
  legRaise: {
    view: 's',
    frames: [
      { hip: [10, 9], t: 178, f: [86, 7], ft: 80, h: [-36, 4] },
      { hip: [10, 9], t: 178, f: [16, 86], ft: 170, h: [-36, 4] },
    ],
  },
  hangingLegRaise: {
    view: 's',
    scene: pullBar(184, -70, 70),
    frames: [
      { hip: [0, 88], t: 90, h: [2, 184], fh: [3, -77], eb: 1 },
      { hip: [-2, 90], t: 92, h: [2, 184], fh: [76, -2], ft: 80, eb: 1 },
    ],
    box: [-110, 0, 220, 205],
  },
  'hangingLegRaise:knee': {
    view: 's',
    scene: pullBar(184, -70, 70),
    frames: [
      { hip: [0, 88], t: 90, h: [2, 184], fh: [3, -77], eb: 1 },
      { hip: [-2, 90], t: 92, h: [2, 184], fh: [28, -24], kb: 1, eb: 1 },
    ],
    box: [-110, 0, 220, 205],
  },
  'hangingLegRaise:toes': {
    view: 's',
    scene: pullBar(184, -70, 70),
    frames: [
      { hip: [0, 88], t: 90, h: [2, 184], fh: [3, -77], eb: 1 },
      { hip: [-4, 100], t: 96, h: [2, 184], fh: [18, 72], ft: 150, eb: 1 },
    ],
    box: [-110, 0, 220, 205],
  },
  vUp: {
    view: 's',
    frames: [
      { hip: [10, 9], t: 178, f: [86, 7], ft: 80, hs: [-50, 2] },
      { hip: [6, 10], t: 58, f: [46, 64], ft: 30, hs: [42, 10] },
    ],
  },
  russianTwist: {
    view: 'f',
    period: 1.6,
    frames: [
      { hip: [0, 22], t: 90, fh: [6, -6], th: 0.4, sh: 0.5, h: [-24, 58], h2: [-32, 60], eb: -1 },
      { hip: [0, 22], t: 90, fh: [6, -6], th: 0.4, sh: 0.5, h: [32, 60], h2: [24, 58], eb: -1 },
    ],
  },
  plank: {
    view: 's',
    period: 3,
    frames: [
      { hip: [6, 21], t: 9.4, f: [-70, 8], ft: -80, h: [74, 4], eb: 1 },
      { hip: [6, 23], t: 8, f: [-70, 8], ft: -80, h: [74, 4], eb: 1 },
    ],
  },
  sidePlank: {
    view: 'f',
    period: 3,
    frames: [
      { hip: [3, 30], t: 18, f: [-70, 6], f2: [-72, 13], h: [52, 4], h2: [40, 120], eb: 1 },
      { hip: [3, 24], t: 14, f: [-70, 6], f2: [-72, 13], h: [52, 4], h2: [40, 120], eb: 1 },
    ],
  },
  abRollout: {
    view: 's',
    frames: [
      { hip: [-22, 44], t: 62, f: [-60, 4], ft: 180, kb: -1, h: [8, 8], eb: 1 },
      { hip: [-10, 26], t: 12, f: [-60, 4], ft: 180, kb: -1, h: [70, 8], eb: 1 },
    ],
    prop: 'wheel',
  },
  mountainClimber: {
    view: 's',
    period: 1,
    frames: [
      { hip: [-10, 40], t: 15, h: [40, 3], f: [-78, 6], f2: [6, 16], ft: -70, ft2: -40, eb: 1 },
      { hip: [-10, 40], t: 15, h: [40, 3], f: [6, 16], f2: [-78, 6], ft: -40, ft2: -70, eb: 1 },
    ],
  },
  deadBug: {
    view: 's',
    frames: [
      { hip: [10, 9], t: 178, hs: [0, 50], hs2: [-50, 4], f: [38, 44], f2: [86, 8], kb: 1, ft2: 80 },
      { hip: [10, 9], t: 178, hs: [-50, 4], hs2: [0, 50], f: [86, 8], f2: [38, 44], kb: 1, ft: 80 },
    ],
  },
  sideBend: {
    view: 'f',
    frames: [
      { ...STAND, f: undefined, fh: [6, -77], hs: [4, -50] },
      { ...STAND, f: undefined, fh: [6, -77], t: 104, hs: [4, -50] },
    ],
  },
  woodchop: {
    view: 'f',
    scene: tower(-96, 176),
    cable: [-92, 166],
    cableAlways: true,
    frames: [
      { hip: [0, 80], t: 96, fh: [12, -77], h: [-44, 140], h2: [-38, 136], eb: -1 },
      { hip: [0, 76], t: 86, fh: [12, -73], h: [40, 66], h2: [34, 70], eb: -1 },
    ],
    prop: 'handle',
  },

  // ================= 유산소·종목 =================
  walk: {
    view: 's',
    period: 1.4,
    muscles: legsMuscles,
    frames: [
      { hip: [0, 78], t: 90, f: [22, 3], f2: [-20, 6], ft2: -30, hs: [-12, -48], hs2: [14, -48] },
      { hip: [0, 78], t: 90, f: [-20, 6], f2: [22, 3], ft: -30, hs: [14, -48], hs2: [-12, -48] },
    ],
  },
  hike: {
    view: 's',
    period: 1.6,
    muscles: legsMuscles,
    scene: [line([-110, -6], [110, 18], 3, 'mark')],
    frames: [
      { hip: [0, 82], t: 82, f: [22, 12], f2: [-20, 4], ft2: -30, hs: [-12, -46], hs2: [16, -40] },
      { hip: [0, 82], t: 82, f: [-20, 4], f2: [22, 12], ft: -30, hs: [16, -40], hs2: [-12, -46] },
    ],
  },
  run: {
    view: 's',
    period: 0.8,
    muscles: legsMuscles,
    frames: [
      { hip: [0, 76], t: 80, f: [26, 10], f2: [-30, 30], ft2: -20, kb2: 1, hs: [-8, -24], hs2: [18, -16], eb: -1 },
      { hip: [0, 76], t: 80, f: [-30, 30], f2: [26, 10], ft: -20, hs: [18, -16], hs2: [-8, -24], eb: -1 },
    ],
  },
  skate: {
    view: 's',
    period: 1.2,
    muscles: legsMuscles,
    frames: [
      { hip: [0, 64], t: 55, f: [12, 9], f2: [-50, 14], hs: [-30, -30], hs2: [30, -30] },
      { hip: [0, 64], t: 55, f: [-50, 14], f2: [12, 9], hs: [30, -30], hs2: [-30, -30] },
    ],
    footItems: [{ k: 'line', a: [-4, -6], b: [16, -6], w: 4, tone: 'pad' }],
  },
  cycle: {
    view: 's',
    period: 1,
    muscles: legsMuscles,
    scene: [circle([-46, 18], 18), circle([64, 18], 18), line([-46, 18], [8, 22], 3), line([8, 22], [64, 18], 3), line([8, 22], [-8, 64], 3), line([-8, 64], [44, 92], 3), line([44, 92], [64, 18], 3), pad([-18, 66], [2, 66], 6)],
    at: (p) => {
      const crank: V = [8, 22];
      const a = -360 * p;
      return { hip: [-8, 72], t: 58, h: [44, 94], eb: -1, f: add(crank, mul(dir(a), 12)), f2: add(crank, mul(dir(a + 180), 12)), kb: 1 };
    },
  },
  airbike: {
    view: 's',
    period: 1,
    muscles: { primary: ['QUADS', 'GLUTES'], secondary: ['CHEST', 'LATS', 'HAMSTRINGS'] },
    scene: [circle([62, 30], 26), line([8, 22], [-8, 64], 4), line([8, 22], [62, 30], 4), line([-30, 1], [70, 1], 5), pad([-18, 66], [2, 66], 6)],
    at: (p) => {
      const crank: V = [8, 22];
      const a = -360 * p;
      const c = Math.cos((a * Math.PI) / 180);
      return { hip: [-8, 72], t: 66, h: [40 + 10 * c, 96], h2: [40 - 10 * c, 96], eb: -1, f: add(crank, mul(dir(a), 12)), f2: add(crank, mul(dir(a + 180), 12)), kb: 1 };
    },
  },
  elliptical: {
    view: 's',
    period: 1.4,
    muscles: legsMuscles,
    scene: [line([-50, 4], [70, 4], 6), line([70, 4], [70, 130], 4), line([-30, 1], [80, 1], 4)],
    at: (p) => {
      const a = 360 * p;
      const c = Math.cos((a * Math.PI) / 180);
      const s = Math.sin((a * Math.PI) / 180);
      return { hip: [0, 92], t: 86, h: [36 + 8 * c, 108], h2: [36 - 8 * c, 108], eb: -1, f: [6 + 20 * c, 18 + 6 * s], f2: [6 - 20 * c, 18 - 6 * s], kb: 1 };
    },
    footItems: [{ k: 'line', a: [-6, -4], b: [16, -4], w: 4, tone: 'pad' }],
  },
  stairs: {
    view: 's',
    period: 1.2,
    muscles: legsMuscles,
    scene: [line([-20, 6], [70, 6], 10, 'pad'), line([10, 30], [70, 30], 6), line([70, 0], [70, 140], 4), line([40, 104], [70, 104], 4)],
    frames: [
      { hip: [0, 90], t: 84, f: [22, 34], f2: [-4, 12], h: [42, 106], eb: -1 },
      { hip: [0, 90], t: 84, f: [-4, 12], f2: [22, 34], h: [42, 106], eb: -1 },
    ],
  },
  rower: {
    view: 's',
    period: 2,
    muscles: { primary: ['LATS', 'MID_BACK', 'QUADS'], secondary: ['BICEPS', 'GLUTES', 'HAMSTRINGS', 'REAR_DELT'] },
    scene: [line([-90, 12], [70, 12], 4), line([-90, 1], [-90, 12], 4), circle([82, 26], 16), pad([60, 8], [60, 26], 6)],
    frames: [
      { hip: [-8, 22], t: 62, f: [54, 14], ft: 70, kb: 1, h: [62, 32], eb: -1 },
      { hip: [-52, 22], t: 104, f: [54, 14], ft: 70, kb: 1, h: [-26, 46], eb: 1 },
    ],
    prop: 'handle',
  },
  jumpRope: {
    view: 'f',
    period: 0.7,
    muscles: { primary: ['CALVES', 'QUADS'], secondary: ['FRONT_DELT', 'FOREARMS'] },
    frames: [
      { hip: [0, 79], t: 90, fh: [4, -76], hs: [14, -44], eb: 1 },
      { hip: [0, 88], t: 90, fh: [4, -74], ft: -100, hs: [16, -42], eb: 1 },
    ],
    front: [{ k: 'rope' }],
  },
  aerobics: {
    view: 'f',
    period: 1,
    muscles: { primary: ['QUADS', 'CALVES'], secondary: ['SIDE_DELT', 'GLUTES'] },
    frames: [
      { hip: [0, 80], t: 90, fh: [2, -77], hs: [6, -50], eb: 1 },
      { hip: [0, 84], t: 90, fh: [26, -74], hs: [26, 46], eb: 1 },
    ],
  },
  golf: {
    view: 'f',
    period: 2.4,
    muscles: { primary: ['OBLIQUES'], secondary: ['LATS', 'FRONT_DELT', 'FOREARMS'] },
    frames: [
      { hip: [0, 76], t: 98, fh: [14, -73], h: [34, 134], h2: [28, 128], eb: -1 },
      { hip: [0, 76], t: 90, fh: [14, -73], h: [4, 60], h2: [-2, 62], eb: -1 },
      { hip: [0, 76], t: 82, fh: [14, -73], h: [-34, 130], h2: [-28, 136], eb: -1 },
    ],
    prop: 'club',
  },
  racket: {
    view: 'f',
    period: 1.6,
    muscles: { primary: ['FRONT_DELT', 'CHEST', 'OBLIQUES'], secondary: ['QUADS', 'FOREARMS'] },
    frames: [
      { hip: [0, 70], t: 94, fh: [24, -66], h: [62, 92], h2: [-40, 100], eb: -1 },
      { hip: [0, 70], t: 90, fh: [24, -66], h: [36, 96], h2: [-36, 96], eb: -1 },
      { hip: [0, 70], t: 86, fh: [24, -66], h: [-26, 128], h2: [-30, 90], eb: -1 },
    ],
    prop: 'racket',
  },
  racketOverhead: {
    view: 'f',
    period: 1.4,
    muscles: { primary: ['FRONT_DELT', 'TRICEPS', 'CHEST'], secondary: ['CALVES', 'OBLIQUES'] },
    frames: [
      { hip: [0, 78], t: 92, fh: [16, -74], hs: [8, 20], h2: [-30, 140], eb: 1 },
      { hip: [0, 82], t: 90, fh: [16, -76], hs: [8, 52], h2: [-30, 120], eb: 1 },
      { hip: [0, 80], t: 86, fh: [16, -76], hs: [-30, -20], h2: [-28, 80], eb: 1 },
    ],
    prop: 'racket',
  },
  kick: {
    view: 's',
    period: 1.4,
    muscles: { primary: ['QUADS', 'ADDUCTORS'], secondary: ['GLUTES', 'ABS'] },
    scene: [circle([40, 10], 9, 'plate')],
    frames: [
      { hip: [0, 78], t: 96, f: [-40, 34], f2: [2, 3], ft: -40, hs: [-20, -40], hs2: [24, -36] },
      { hip: [0, 78], t: 104, f: [56, 26], f2: [2, 3], ft: 10, hs: [20, -36], hs2: [-24, -36] },
    ],
  },
  shoot: {
    view: 's',
    period: 1.6,
    muscles: { primary: ['QUADS', 'CALVES', 'FRONT_DELT'], secondary: ['TRICEPS', 'GLUTES'] },
    frames: [
      { hip: [-8, 66], t: 82, f: [4, 3], hs: [16, -8], eb: -1 },
      { hip: [0, 90], t: 92, f: [3, 14], ft: -40, hs: [12, 50], eb: -1 },
    ],
    prop: 'ball',
  },
  climb: {
    view: 'b',
    period: 2,
    muscles: { primary: ['LATS', 'FOREARMS', 'BICEPS'], secondary: ['QUADS', 'CALVES', 'MID_BACK'] },
    scene: [line([0, 0], [0, 200], 150, 'mark'), circle([30, 182], 4, 'plate'), circle([-26, 144], 4, 'plate'), circle([22, 44], 4, 'plate'), circle([-20, 66], 4, 'plate'), circle([-28, 186], 4, 'plate'), circle([24, 148], 4, 'plate')],
    frames: [
      { hip: [0, 92], t: 90, h: [30, 182], h2: [-26, 144], f: [22, 44], f2: [-20, 66], eb: -1, kb: 1 },
      { hip: [0, 100], t: 90, h: [24, 148], h2: [-28, 186], f: [22, 60], f2: [-20, 50], eb: -1, kb: 1 },
    ],
    noFloor: false,
    box: [-110, 0, 220, 205],
  },
  punch: {
    view: 's',
    period: 1.6,
    muscles: { primary: ['FRONT_DELT', 'CHEST', 'TRICEPS'], secondary: ['OBLIQUES', 'CALVES'] },
    frames: [
      { hip: [0, 74], t: 86, f: [18, 3], f2: [-20, 3], hs: [16, -4], hs2: [20, 4], eb: -1 },
      { hip: [0, 74], t: 82, f: [18, 3], f2: [-20, 3], hs: [52, 4], hs2: [20, 4], eb: -1 },
      { hip: [0, 74], t: 86, f: [18, 3], f2: [-20, 3], hs: [16, -4], hs2: [20, 4], eb: -1 },
      { hip: [0, 74], t: 80, f: [18, 3], f2: [-20, 3], hs: [16, -4], hs2: [54, 6], eb: -1 },
    ],
    prop: 'glove',
  },
  kickStrike: {
    view: 's',
    period: 1.6,
    muscles: { primary: ['QUADS', 'GLUTES', 'ADDUCTORS'], secondary: ['ABS', 'OBLIQUES'] },
    frames: [
      { hip: [0, 76], t: 88, f: [16, 3], f2: [-18, 3], hs: [16, -4], hs2: [20, 4], eb: -1 },
      { hip: [-6, 78], t: 112, f: [64, 94], f2: [-10, 3], ft: 10, hs: [10, -4], hs2: [16, 6], eb: -1 },
    ],
    prop: 'glove',
  },
  burpee: {
    view: 's',
    period: 2.6,
    muscles: { primary: ['QUADS', 'CHEST', 'FRONT_DELT'], secondary: ['ABS', 'TRICEPS', 'CALVES'] },
    frames: [
      { hip: [0, 82], t: 92, f: [3, 5], hs: [8, 50] },
      { hip: [-12, 40], t: 50, f: [3, 3], h: [40, 3], eb: 1 },
      { hip: [-4, 22], t: 10, f: [-74, 10], ft: -78, h: [42, 3], eb: 1 },
    ],
  },
  yoga: {
    view: 'f',
    period: 4,
    muscles: { primary: ['QUADS', 'ABS'], secondary: ['GLUTES', 'SIDE_DELT', 'ADDUCTORS'] },
    frames: [
      { hip: [0, 80], t: 90, fh: [2, -77], hs: [6, 51], eb: 1 },
      { hip: [0, 62], t: 90, f: [50, 3], f2: [-48, 3], kb: 1, hs: [50, 2], eb: 1 },
    ],
  },
  pilates: {
    view: 's',
    period: 3.4,
    muscles: { primary: ['ABS'], secondary: ['OBLIQUES', 'QUADS'] },
    frames: [
      { hip: [10, 9], t: 178, f: [86, 7], ft: 80, hs: [-50, 2] },
      { hip: [6, 10], t: 58, f: [46, 64], ft: 30, hs: [42, 10] },
    ],
  },
  swim: {
    view: 's',
    period: 1.6,
    muscles: { primary: ['LATS', 'FRONT_DELT', 'TRICEPS'], secondary: ['CHEST', 'QUADS', 'CALVES', 'ABS'] },
    noFloor: true,
    scene: [{ k: 'wave', y: 96 }],
    at: (p) => {
      const hip: V = [-34, 80];
      const sh: V = add(hip, mul(dir(2), 45));
      const a = -360 * p + 180;
      const kick = Math.sin(p * Math.PI * 8) * 8;
      return {
        hip,
        t: 2,
        head: -10,
        h: add(sh, mul(dir(a), 48)),
        h2: add(sh, mul(dir(a + 180), 48)),
        eb: 1,
        f: [-110, 80 + kick],
        f2: [-110, 80 - kick],
        ft: 180,
        ft2: 180,
      };
    },
    box: [-130, 40, 230, 120],
  },
};

/** motion 키로 패턴을 찾는다. 변형이 없으면 기본 패턴. */
export function patternFor(motion: string | null | undefined): Pattern | null {
  if (!motion) return null;
  return PATTERNS[motion] ?? PATTERNS[motion.split(':')[0]!] ?? null;
}
