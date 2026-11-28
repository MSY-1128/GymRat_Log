/**
 * 운동 동작 그림용 2D 골격.
 *
 * 좌표는 바닥이 y = 0, 위가 +y인 장면 좌표(단위 ≈ cm의 절반)다. SVG로 그릴 때 뒤집는다.
 * 자세(Pose)는 엉덩이 위치·몸통 각도와 손·발이 닿을 목표점으로 정하고, 팔·다리는 두 마디 IK로 푼다.
 * 각도는 도(degree), 0 = 오른쪽(+x), 90 = 위.
 *
 * 보기(view)
 *  - 's' 옆모습(오른쪽을 본다). 가까운 팔·다리와 먼 팔·다리.
 *  - 'f' 앞모습, 'b' 뒷모습. 오른쪽 팔·다리 기준으로 쓰고 왼쪽은 몸 중심선으로 뒤집는다(따로 주면 그 값).
 */

export type V = readonly [number, number];
export type View = 's' | 'f' | 'b';

export const LEN = { torso: 50, neck: 6, headR: 9.5, upperArm: 28, foreArm: 25, thigh: 40, shin: 38, foot: 13 };
/** 앞·뒷모습의 어깨·엉덩이 너비(가운데에서) */
const SHOULDER_HALF = 16;
const HIP_HALF = 8.5;

export interface Pose {
  /** 엉덩이(골반 중심) */
  hip: V;
  /** 몸통 각도(엉덩이 → 목). 90 = 똑바로 섬 */
  t: number;
  /** 머리 기울기(몸통 기준) */
  head?: number;
  /** 어깨 들어 올림(슈러그) */
  lift?: number;

  /** 손 목표: 절대 좌표 / 어깨 기준(장면 축) / 어깨 기준(몸통 축: [몸통 방향, 앞쪽]) / 엉덩이 기준 */
  h?: V;
  hs?: V;
  hl?: V;
  hh?: V;
  /** 먼(왼) 쪽 손. 없으면 옆모습은 가까운 손과 같게, 앞·뒷모습은 좌우 대칭 */
  h2?: V;
  hs2?: V;
  hl2?: V;

  /** 발목 목표: 절대 좌표 / 엉덩이 기준 */
  f?: V;
  fh?: V;
  f2?: V;
  fh2?: V;

  /** 팔꿈치·무릎이 꺾이는 쪽(+1 / −1) */
  eb?: number;
  eb2?: number;
  kb?: number;
  kb2?: number;
  /** 발 각도(절대). 옆모습 기본 0(앞), 앞·뒷모습은 아래 */
  ft?: number;
  ft2?: number;

  /** 마디 길이 배율(카메라 쪽으로 향해 짧아 보이는 팔·다리) */
  ua?: number;
  fa?: number;
  th?: number;
  sh?: number;
  ua2?: number;
  fa2?: number;
  th2?: number;
}

export interface Limb {
  root: V;
  mid: V;
  end: V;
  tip?: V;
}

export interface Skeleton {
  view: View;
  hip: V;
  neck: V;
  headC: V;
  t: number;
  /** 옆모습: 0 = 가까운 쪽, 1 = 먼 쪽 / 앞·뒷모습: 0 = 오른쪽(화면 +x), 1 = 왼쪽 */
  arms: [Limb, Limb];
  legs: [Limb, Limb];
  /** 앞·뒷모습의 몸통 네 귀퉁이(오른어깨, 왼어깨, 왼엉덩이, 오른엉덩이) */
  torsoQuad?: [V, V, V, V];
}

export const dir = (deg: number): V => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
export const len = (a: V) => Math.hypot(a[0], a[1]);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const lerpV = (a: V, b: V, k: number): V => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const deg = (v: V) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;

/** 두 마디 IK. 닿지 않으면 목표 쪽으로 쭉 뻗는다. */
export function ik(root: V, target: V, a: number, b: number, side: number): { mid: V; end: V } {
  const d0 = len(sub(target, root));
  const d = Math.min(Math.max(d0, Math.abs(a - b) + 0.01), a + b - 0.01);
  const th = deg(sub(target, root));
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const al = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  const mid = add(root, mul(dir(th + side * al), a));
  const end = add(root, mul(dir(th), d));
  return { mid, end };
}

/** 자세 → 관절 위치 */
export function solve(view: View, p: Pose): Skeleton {
  const up = dir(p.t);
  const neck = add(p.hip, mul(up, LEN.torso));
  const headC = add(neck, mul(dir(p.t + (p.head ?? 0)), LEN.neck + LEN.headR));
  const lift = p.lift ?? 0;

  if (view === 's') {
    const shoulder = add(add(p.hip, mul(up, LEN.torso - 5)), mul(up, lift));
    const front = dir(p.t - 90);
    const handOf = (h?: V, hs?: V, hl?: V, hh?: V): V =>
      h ??
      (hs ? add(shoulder, hs) : hl ? add(shoulder, add(mul(up, hl[0]), mul(front, hl[1]))) : hh ? add(p.hip, hh) : add(shoulder, [2, -50]));
    const footOf = (f?: V, fh?: V): V => f ?? (fh ? add(p.hip, fh) : add(p.hip, [3, -77]));
    const hand1 = handOf(p.h, p.hs, p.hl, p.hh);
    const hand2 = p.h2 || p.hs2 || p.hl2 ? handOf(p.h2, p.hs2, p.hl2) : hand1;
    const foot1 = footOf(p.f, p.fh);
    const foot2 = p.f2 || p.fh2 ? footOf(p.f2, p.fh2) : foot1;
    const arm = (target: V, side: number, ua: number, fa: number): Limb => {
      const r = ik(shoulder, target, LEN.upperArm * ua, LEN.foreArm * fa, side);
      return { root: shoulder, mid: r.mid, end: r.end };
    };
    const leg = (target: V, side: number, th: number, sh: number, ft: number): Limb => {
      const r = ik(p.hip, target, LEN.thigh * th, LEN.shin * sh, side);
      return { root: p.hip, mid: r.mid, end: r.end, tip: add(r.end, mul(dir(ft), LEN.foot)) };
    };
    return {
      view,
      hip: p.hip,
      neck,
      headC,
      t: p.t,
      arms: [
        arm(hand1, p.eb ?? -1, p.ua ?? 1, p.fa ?? 1),
        arm(hand2, p.eb2 ?? p.eb ?? -1, p.ua2 ?? p.ua ?? 1, p.fa2 ?? p.fa ?? 1),
      ],
      legs: [
        leg(foot1, p.kb ?? 1, p.th ?? 1, p.sh ?? 1, p.ft ?? 0),
        leg(foot2, p.kb2 ?? p.kb ?? 1, p.th2 ?? p.th ?? 1, p.sh ?? 1, p.ft2 ?? p.ft ?? 0),
      ],
    };
  }

  // 앞·뒷모습: 오른쪽(+x) 팔·다리를 기준으로 쓰고 왼쪽은 몸 중심선에 대해 뒤집는다
  const right = dir(p.t - 90);
  const shoulderBase = add(add(p.hip, mul(up, LEN.torso - 5)), mul(up, lift));
  const shR = add(shoulderBase, mul(right, SHOULDER_HALF));
  const shL = add(shoulderBase, mul(right, -SHOULDER_HALF));
  const hipR = add(p.hip, mul(right, HIP_HALF));
  const hipL = add(p.hip, mul(right, -HIP_HALF));
  // 중심선(엉덩이를 지나는 몸통 방향 직선)에 대한 대칭
  const mirror = (v: V): V => {
    const rel = sub(v, p.hip);
    const along = rel[0] * up[0] + rel[1] * up[1];
    const across = rel[0] * right[0] + rel[1] * right[1];
    return add(p.hip, add(mul(up, along), mul(right, -across)));
  };
  const handR = p.h ?? (p.hs ? add(shR, p.hs) : p.hh ? add(p.hip, p.hh) : add(shR, [4, -50]));
  const handL = p.h2 ?? (p.hs2 ? add(shL, [-p.hs2[0], p.hs2[1]]) : mirror(handR));
  const footR = p.f ?? (p.fh ? add(hipR, p.fh) : add(hipR, [3, -77]));
  const footL = p.f2 ?? (p.fh2 ? add(hipL, [-p.fh2[0], p.fh2[1]]) : mirror(footR));
  const eb = p.eb ?? -1;
  const kb = p.kb ?? 1;
  const armR = ik(shR, handR, LEN.upperArm * (p.ua ?? 1), LEN.foreArm * (p.fa ?? 1), eb);
  const armL = ik(shL, handL, LEN.upperArm * (p.ua2 ?? p.ua ?? 1), LEN.foreArm * (p.fa2 ?? p.fa ?? 1), -(p.eb2 ?? eb));
  const legR = ik(hipR, footR, LEN.thigh * (p.th ?? 1), LEN.shin * (p.sh ?? 1), kb);
  const legL = ik(hipL, footL, LEN.thigh * (p.th2 ?? p.th ?? 1), LEN.shin * (p.sh ?? 1), -(p.kb2 ?? kb));
  const footTip = (end: V, sign: number, ft?: number): V => add(end, mul(dir(ft ?? (sign > 0 ? -70 : -110)), 8));
  return {
    view,
    hip: p.hip,
    neck,
    headC,
    t: p.t,
    arms: [
      { root: shR, mid: armR.mid, end: armR.end },
      { root: shL, mid: armL.mid, end: armL.end },
    ],
    legs: [
      { root: hipR, mid: legR.mid, end: legR.end, tip: footTip(legR.end, 1, p.ft) },
      { root: hipL, mid: legL.mid, end: legL.end, tip: footTip(legL.end, -1, p.ft2) },
    ],
    torsoQuad: [shR, shL, hipL, hipR],
  };
}

const NUM_KEYS = ['t', 'head', 'lift', 'eb', 'eb2', 'kb', 'kb2', 'ft', 'ft2', 'ua', 'fa', 'th', 'sh', 'ua2', 'fa2', 'th2'] as const;
const VEC_KEYS = ['hip', 'h', 'hs', 'hl', 'hh', 'h2', 'hs2', 'hl2', 'f', 'fh', 'f2', 'fh2'] as const;

/** 두 자세 사이. 한쪽에만 있는 값은 그 값을 그대로 쓴다. */
export function blend(a: Pose, b: Pose, k: number): Pose {
  const out: Record<string, unknown> = {};
  for (const key of NUM_KEYS) {
    const x = a[key];
    const y = b[key];
    if (x != null || y != null) out[key] = x != null && y != null ? lerp(x, y, k) : (x ?? y);
  }
  for (const key of VEC_KEYS) {
    const x = a[key];
    const y = b[key];
    if (x != null || y != null) out[key] = x != null && y != null ? lerpV(x, y, k) : (x ?? y);
  }
  return out as unknown as Pose;
}
