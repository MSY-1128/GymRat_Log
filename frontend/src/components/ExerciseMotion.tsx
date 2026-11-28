import { useEffect, useState, type ReactNode } from 'react';
import type { Equipment, Muscle } from '../api/types';
import { MUSCLE_LABELS } from '../api/types';
import { patternFor, type Item, type Pattern, type Prop, type Tone } from '../motion/patterns';
import { add, blend, dir, len, lerpV, mul, solve, sub, type Limb, type Pose, type Skeleton, type V } from '../motion/rig';
import styles from './ExerciseMotion.module.css';

type Level = 'primary' | 'secondary';

/** 위상(0~1) → 자세. 키프레임은 왕복(코사인 이징), at은 그대로 반복. */
export function poseAt(pattern: Pattern, phase: number): Pose {
  if (pattern.at) return pattern.at(phase);
  const frames = pattern.frames ?? [];
  if (frames.length === 1) return frames[0]!;
  const u = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const segs = frames.length - 1;
  const s = Math.min(u * segs, segs - 1e-6);
  const i = Math.floor(s);
  const k = s - i;
  const eased = k * k * (3 - 2 * k);
  return blend(frames[i]!, frames[i + 1]!, eased);
}

const propFor = (pattern: Pattern, equipment: Equipment | null): Prop => {
  if (pattern.prop) return pattern.prop;
  switch (equipment) {
    case 'BARBELL':
      return 'barbell';
    case 'DUMBBELL':
      return 'dumbbell';
    case 'KETTLEBELL':
      return 'kettlebell';
    case 'CABLE':
      return 'handle';
    default:
      return 'none';
  }
};

const toneClass: Record<Tone, string> = {
  frame: styles.frame!,
  pad: styles.pad!,
  plate: styles.plate!,
  cable: styles.cable!,
  mark: styles.mark!,
  water: styles.water!,
};

/** 장면 좌표(y 위)로 그리고 바깥 g에서 뒤집는다 */
const L = (a: V, b: V, w: number, cls: string, key?: string | number) => (
  <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={w} className={cls} />
);
const C = (c: V, r: number, cls: string, key?: string | number) => <circle key={key} cx={c[0]} cy={c[1]} r={r} className={cls} />;

const unit = (v: V): V => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l];
};
const leftN = (v: V): V => [-v[1], v[0]];
const at = (a: V, b: V, f: number): V => lerpV(a, b, f);
const cross = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];

function sceneItem(it: Item, i: number, phase: number, sk: Skeleton, box: [number, number, number, number]): ReactNode {
  switch (it.k) {
    case 'line':
      return L(it.a, it.b, it.w ?? 4, toneClass[it.tone ?? 'frame'], i);
    case 'circle':
      return C(it.c, it.r, toneClass[it.tone ?? 'frame'], i);
    case 'wave': {
      let d = '';
      for (let x = box[0]; x <= box[0] + box[2]; x += 6) {
        const y = it.y + 2.6 * Math.sin(x / 14 + phase * Math.PI * 2);
        d += `${d ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }
      return <path key={i} d={d} className={styles.water} strokeWidth={2} />;
    }
    case 'rope': {
      const a = sk.arms[0].end;
      const b = sk.arms[1].end;
      const cy = 96 + 104 * Math.cos(phase * Math.PI * 2);
      return <path key={i} d={`M${a[0]},${a[1]} Q0,${cy} ${b[0]},${b[1]}`} className={styles.rope} strokeWidth={1.6} />;
    }
  }
}

interface Paint {
  level: (m: Muscle) => Level | null;
}

/** 근육 띠 하나(선) */
function band(a: V, b: V, w: number, lv: Level | null, key: string) {
  if (!lv) return null;
  return L(a, b, w, lv === 'primary' ? styles.mPrimary! : styles.mSecondary!, key);
}
function dot(c: V, r: number, lv: Level | null, key: string) {
  if (!lv) return null;
  return C(c, r, lv === 'primary' ? styles.mPrimary! : styles.mSecondary!, key);
}

/** 팔·다리 한 쪽(옆모습). 접히는 안쪽을 이두·햄스트링 쪽으로 본다. */
function sideArm(arm: Limb, eb: number, paint: Paint, key: string, far: boolean) {
  const ua = sub(arm.mid, arm.root);
  const fa = sub(arm.end, arm.mid);
  const c = cross(unit(ua), unit(fa));
  const inner = mul(leftN(unit(ua)), Math.abs(c) < 0.08 ? -eb : Math.sign(c));
  const cls = far ? styles.bodyFar! : styles.body!;
  return (
    <g key={key} className={far ? styles.farGroup : undefined}>
      {L(arm.root, arm.mid, 11.5, styles.outline!)}
      {L(arm.mid, arm.end, 9.5, styles.outline!)}
      {L(arm.root, arm.mid, 9, cls)}
      {L(arm.mid, arm.end, 7, cls)}
      {band(add(at(arm.root, arm.mid, 0.3), mul(inner, 2)), add(at(arm.root, arm.mid, 0.8), mul(inner, 2)), 4.5, paint.level('BICEPS'), 'bi')}
      {band(add(at(arm.root, arm.mid, 0.25), mul(inner, -2)), add(at(arm.root, arm.mid, 0.8), mul(inner, -2)), 4.5, paint.level('TRICEPS'), 'tri')}
      {band(at(arm.mid, arm.end, 0.12), at(arm.mid, arm.end, 0.7), 5, paint.level('FOREARMS'), 'fo')}
      {C(arm.end, 4, cls)}
    </g>
  );
}

function sideLeg(leg: Limb, kb: number, paint: Paint, key: string, far: boolean) {
  const th = sub(leg.mid, leg.root);
  const sh = sub(leg.end, leg.mid);
  const c = cross(unit(th), unit(sh));
  const back = mul(leftN(unit(th)), Math.abs(c) < 0.08 ? -kb : Math.sign(c));
  const shinBack = mul(leftN(unit(sh)), Math.abs(c) < 0.08 ? -kb : Math.sign(c));
  const cls = far ? styles.bodyFar! : styles.body!;
  return (
    <g key={key} className={far ? styles.farGroup : undefined}>
      {L(leg.root, leg.mid, 15.5, styles.outline!)}
      {L(leg.mid, leg.end, 11.5, styles.outline!)}
      {leg.tip && L(leg.end, leg.tip, 6.5, styles.outline!)}
      {L(leg.root, leg.mid, 13, cls)}
      {L(leg.mid, leg.end, 9, cls)}
      {leg.tip && L(leg.end, leg.tip, 4.5, cls)}
      {band(add(at(leg.root, leg.mid, 0.15), mul(back, -2.5)), add(at(leg.root, leg.mid, 0.82), mul(back, -2.5)), 7, paint.level('QUADS'), 'q')}
      {band(add(at(leg.root, leg.mid, 0.2), mul(back, 3)), add(at(leg.root, leg.mid, 0.85), mul(back, 3)), 5.5, paint.level('HAMSTRINGS'), 'h')}
      {band(at(leg.root, leg.mid, 0.25), at(leg.root, leg.mid, 0.6), 3.5, paint.level('ADDUCTORS'), 'ad')}
      {band(add(at(leg.mid, leg.end, 0.12), mul(shinBack, 1.6)), add(at(leg.mid, leg.end, 0.5), mul(shinBack, 1.6)), 5.5, paint.level('CALVES'), 'ca')}
    </g>
  );
}

function SideBody({ sk, pose, paint }: { sk: Skeleton; pose: Pose; paint: Paint }) {
  const up = dir(sk.t);
  const fwd = dir(sk.t - 90);
  const shoulder = sk.arms[0].root;
  const P = (f: number, o: number): V => add(add(sk.hip, mul(sub(shoulder, sk.hip), f)), mul(fwd, o));
  const torso = [P(0, 9.5), P(0.55, 9), P(1, 10.5), P(1.06, -2), P(1, -11), P(0.5, -10), P(0, -11), P(-0.08, 0)];
  const d = 'M' + torso.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
  return (
    <>
      {sideArm(sk.arms[1], pose.eb2 ?? pose.eb ?? -1, paint, 'a1', true)}
      {sideLeg(sk.legs[1], pose.kb2 ?? pose.kb ?? 1, paint, 'l1', true)}
      {L(shoulder, sk.headC, 7.5, styles.outline!)}
      {L(shoulder, sk.headC, 5.5, styles.body!)}
      <path d={d} className={styles.torso} strokeWidth={2.4} />
      {band(P(0.66, 6.5), P(0.9, 6.5), 7.5, paint.level('CHEST'), 'ch')}
      {band(P(0.16, 6.6), P(0.56, 6.6), 5, paint.level('ABS'), 'ab')}
      {band(P(0.2, 1.5), P(0.5, 1), 7, paint.level('OBLIQUES'), 'ob')}
      {band(P(0.42, -5), P(0.82, -5.5), 8, paint.level('LATS'), 'la')}
      {band(P(0.8, -7.5), P(0.96, -7), 5, paint.level('MID_BACK'), 'mb')}
      {band(P(0.06, -7.2), P(0.4, -7.2), 5, paint.level('LOWER_BACK'), 'lb')}
      {band(P(0.98, -5), add(sk.neck, add(mul(up, 2), mul(fwd, -3))), 5, paint.level('TRAPS'), 'tr')}
      {dot(add(add(sk.hip, mul(fwd, -6.5)), mul(up, -2)), 7, paint.level('GLUTES'), 'gl')}
      {sideLeg(sk.legs[0], pose.kb ?? 1, paint, 'l0', false)}
      {C(sk.headC, 10.6, styles.outline!)}
      {C(sk.headC, 9.4, styles.body!)}
      {dot(add(shoulder, mul(fwd, -3.5)), 5.5, paint.level('REAR_DELT'), 'rd')}
      {dot(shoulder, 5.5, paint.level('SIDE_DELT'), 'sd')}
      {dot(add(shoulder, mul(fwd, 3.5)), 5.5, paint.level('FRONT_DELT'), 'fd')}
      {sideArm(sk.arms[0], pose.eb ?? -1, paint, 'a0', false)}
    </>
  );
}

function FrontBody({ sk, paint, back }: { sk: Skeleton; paint: Paint; back: boolean }) {
  const up = dir(sk.t);
  const right = dir(sk.t - 90);
  const Cp = (f: number, x: number): V => add(add(sk.hip, mul(up, f * 45)), mul(right, x));
  const [shR, shL, hipL, hipR] = sk.torsoQuad!;
  const torso = [add(shR, mul(up, 2)), add(shL, mul(up, 2)), Cp(0.45, -12), add(hipL, mul(right, -3)), add(hipR, mul(right, 3)), Cp(0.45, 12)];
  const d = 'M' + torso.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
  const pair = (f: (s: number) => ReactNode) => (
    <>
      {f(1)}
      {f(-1)}
    </>
  );
  const limb = (lb: Limb, w1: number, w2: number, key: string, kind: 'arm' | 'leg') => {
    const s = lb.root[0] >= sk.hip[0] ? 1 : -1; // 바깥쪽
    const outward = mul(right, s);
    return (
      <g key={key}>
        {L(lb.root, lb.mid, w1 + 2.5, styles.outline!)}
        {L(lb.mid, lb.end, w2 + 2.5, styles.outline!)}
        {lb.tip && L(lb.end, lb.tip, 7, styles.outline!)}
        {L(lb.root, lb.mid, w1, styles.body!)}
        {L(lb.mid, lb.end, w2, styles.body!)}
        {lb.tip && L(lb.end, lb.tip, 4.6, styles.body!)}
        {kind === 'arm' ? (
          <>
            {!back && band(at(lb.root, lb.mid, 0.28), at(lb.root, lb.mid, 0.82), 5, paint.level('BICEPS'), 'bi')}
            {back && band(at(lb.root, lb.mid, 0.22), at(lb.root, lb.mid, 0.82), 5.5, paint.level('TRICEPS'), 'tri')}
            {band(at(lb.mid, lb.end, 0.12), at(lb.mid, lb.end, 0.7), 5, paint.level('FOREARMS'), 'fo')}
            {C(lb.end, 4, styles.body!)}
          </>
        ) : (
          <>
            {!back && band(at(lb.root, lb.mid, 0.15), at(lb.root, lb.mid, 0.85), 8, paint.level('QUADS'), 'q')}
            {back && band(at(lb.root, lb.mid, 0.25), at(lb.root, lb.mid, 0.88), 8, paint.level('HAMSTRINGS'), 'h')}
            {band(add(at(lb.root, lb.mid, 0.12), mul(outward, -4.5)), add(at(lb.root, lb.mid, 0.55), mul(outward, -3.5)), 3.5, paint.level('ADDUCTORS'), 'ad')}
            {band(add(at(lb.mid, lb.end, 0.12), mul(outward, back ? 0 : 1.5)), add(at(lb.mid, lb.end, 0.5), mul(outward, back ? 0 : 1.5)), back ? 7 : 4.5, paint.level('CALVES'), 'ca')}
          </>
        )}
      </g>
    );
  };
  return (
    <>
      {limb(sk.legs[0], 13, 9.5, 'l0', 'leg')}
      {limb(sk.legs[1], 13, 9.5, 'l1', 'leg')}
      {L(sk.neck, sk.headC, 9, styles.outline!)}
      {L(sk.neck, sk.headC, 7, styles.body!)}
      <path d={d} className={styles.torso} strokeWidth={2.4} strokeLinejoin="round" />
      {back ? (
        <>
          {band(Cp(1.04, 0), Cp(0.62, 0), 9, paint.level('TRAPS'), 'tr')}
          {pair((s) => band(Cp(0.97, 4 * s), Cp(0.95, 12 * s), 5, paint.level('TRAPS'), `tr${s}`))}
          {pair((s) => band(Cp(0.46, 7 * s), Cp(0.78, 12.5 * s), 7, paint.level('LATS'), `la${s}`))}
          {pair((s) => band(Cp(0.8, 4 * s), Cp(0.84, 10 * s), 5, paint.level('MID_BACK'), `mb${s}`))}
          {pair((s) => band(Cp(0.08, 3.5 * s), Cp(0.42, 3.5 * s), 4.5, paint.level('LOWER_BACK'), `lb${s}`))}
          {pair((s) => dot(Cp(-0.08, 6 * s), 7.5, paint.level('GLUTES'), `gl${s}`))}
        </>
      ) : (
        <>
          {pair((s) => band(Cp(0.78, 2.5 * s), Cp(0.76, 12 * s), 8.5, paint.level('CHEST'), `ch${s}`))}
          {band(Cp(0.16, 0), Cp(0.6, 0), 9, paint.level('ABS'), 'ab')}
          {pair((s) => band(Cp(0.22, 10 * s), Cp(0.52, 11 * s), 4.5, paint.level('OBLIQUES'), `ob${s}`))}
          {pair((s) => band(Cp(0.6, 12.5 * s), Cp(0.76, 13.5 * s), 3.5, paint.level('LATS'), `la${s}`))}
          {pair((s) => band(Cp(0.98, 4.5 * s), Cp(0.96, 11 * s), 3.5, paint.level('TRAPS'), `tr${s}`))}
        </>
      )}
      {C(sk.headC, 10.6, styles.outline!)}
      {C(sk.headC, 9.4, styles.body!)}
      {limb(sk.arms[0], 9, 7, 'a0', 'arm')}
      {limb(sk.arms[1], 9, 7, 'a1', 'arm')}
      {[shR, shL].map((s, i) => {
        const lv = back
          ? (paint.level('REAR_DELT') ?? paint.level('SIDE_DELT'))
          : (paint.level('FRONT_DELT') ?? paint.level('SIDE_DELT'));
        return dot(s, 6, lv, `d${i}`);
      })}
    </>
  );
}

function props(kind: Prop, sk: Skeleton, pattern: Pattern, equipment: Equipment | null): ReactNode {
  const side = sk.view === 's';
  const [a0, a1] = sk.arms;
  const out: ReactNode[] = [];
  if (pattern.cable && (equipment === 'CABLE' || pattern.cableAlways)) {
    const anchor = pattern.cable;
    if (side) {
      out.push(L(a0.end, anchor, 1.4, styles.cable!, 'c0'));
    } else {
      out.push(L(a0.end, [Math.abs(anchor[0]), anchor[1]], 1.4, styles.cable!, 'c0'));
      out.push(L(a1.end, [-Math.abs(anchor[0]), anchor[1]], 1.4, styles.cable!, 'c1'));
    }
  }
  const hands = side ? [a0] : [a0, a1];
  switch (kind) {
    case 'barbell':
      if (side) {
        out.push(C(a0.end, 12.5, styles.plate!, 'p'), C(a0.end, 3, styles.hub!, 'ph'));
      } else {
        const u = unit(sub(a0.end, a1.end));
        const e0 = add(a0.end, mul(u, 26));
        const e1 = add(a1.end, mul(u, -26));
        const n = leftN(u);
        out.push(L(e0, e1, 2.6, styles.bar!, 'b'));
        for (const [i, e] of [e0, e1].entries()) out.push(L(add(e, mul(n, 12)), add(e, mul(n, -12)), 6, styles.plate!, `pl${i}`));
      }
      break;
    case 'dumbbell':
      for (const [i, h] of (side ? [a1, a0] : hands).entries()) {
        if (side) {
          out.push(C(h.end, 5.5, i === 0 ? styles.plateFar! : styles.plate!, `d${i}`));
        } else {
          const u = unit(sub(h.end, h.mid));
          const n = leftN(u);
          out.push(L(add(h.end, mul(n, 7)), add(h.end, mul(n, -7)), 2.4, styles.bar!, `db${i}`));
          out.push(L(add(add(h.end, mul(n, 7)), mul(u, 3.5)), add(add(h.end, mul(n, 7)), mul(u, -3.5)), 4.5, styles.plate!, `dp${i}`));
          out.push(L(add(add(h.end, mul(n, -7)), mul(u, 3.5)), add(add(h.end, mul(n, -7)), mul(u, -3.5)), 4.5, styles.plate!, `dq${i}`));
        }
      }
      break;
    case 'kettlebell':
      out.push(C(add(a0.end, [0, -8]), 7, styles.plate!, 'k'));
      break;
    case 'handle':
      for (const [i, h] of hands.entries()) out.push(C(h.end, 3.2, styles.hub!, `h${i}`));
      break;
    case 'pad':
      for (const [i, h] of hands.entries()) {
        const u = unit(sub(h.end, h.mid));
        out.push(L(at(h.mid, h.end, 0.2), add(h.end, mul(u, 8)), 10, styles.pad!, `pd${i}`));
      }
      break;
    case 'wheel':
      out.push(C(a0.end, 8, styles.plate!, 'w'), C(a0.end, 2.4, styles.hub!, 'wh'));
      break;
    case 'glove':
      for (const [i, h] of [a1, a0].entries()) out.push(C(h.end, 6, i === 0 ? styles.gloveFar! : styles.glove!, `g${i}`));
      break;
    case 'ball':
      out.push(C(add(a0.end, [2, 8]), 8, styles.ball!, 'ball'));
      break;
    case 'racket': {
      const u = unit(sub(a0.end, a0.mid));
      const tip = add(a0.end, mul(u, 22));
      out.push(L(a0.end, tip, 2.4, styles.bar!, 'rk'));
      out.push(
        <ellipse
          key="rh"
          cx={add(tip, mul(u, 9))[0]}
          cy={add(tip, mul(u, 9))[1]}
          rx={9}
          ry={6.5}
          transform={`rotate(${(Math.atan2(u[1], u[0]) * 180) / Math.PI} ${add(tip, mul(u, 9))[0]} ${add(tip, mul(u, 9))[1]})`}
          className={styles.racket}
        />,
      );
      break;
    }
    case 'club': {
      const mid = lerpV(a0.end, a1.end, 0.5);
      const u = unit(sub(mid, sk.neck));
      const end = add(mid, mul(u, 62));
      out.push(L(mid, end, 2, styles.bar!, 'cl'), L(end, add(end, mul(leftN(u), 6)), 4, styles.plate!, 'ch'));
      break;
    }
    default:
      break;
  }
  return out;
}

const names = (ms: Muscle[]) => ms.map((m) => MUSCLE_LABELS[m]).join(', ');

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 동작 장면 한 장(정지 그림) */
export function MotionFrame({ pattern, phase, equipment, primary, secondary }: {
  pattern: Pattern;
  phase: number;
  equipment: Equipment | null;
  primary: Muscle[];
  secondary: Muscle[];
}) {
  const pose = poseAt(pattern, phase);
  const sk = solve(pattern.view, pose);
  const box = pattern.box ?? [-110, -4, 220, 196];
  const paint: Paint = {
    level: (m) => (primary.includes(m) ? 'primary' : secondary.includes(m) ? 'secondary' : null),
  };
  const footItems = pattern.footItems ?? [];
  return (
    <svg viewBox={`${box[0]} ${-(box[1] + box[3])} ${box[2]} ${box[3]}`} className={styles.svg} aria-hidden="true">
      <g transform="scale(1,-1)">
        {!pattern.noFloor && L([box[0], -1.5], [box[0] + box[2], -1.5], 3, styles.floor!)}
        {(pattern.scene ?? []).map((it, i) => sceneItem(it, i, phase, sk, box))}
        {sk.view === 's' ? <SideBody sk={sk} pose={pose} paint={paint} /> : <FrontBody sk={sk} paint={paint} back={sk.view === 'b'} />}
        {footItems.flatMap((it, i) =>
          sk.legs.map((lg, j) =>
            it.k === 'line'
              ? L(add(lg.end, it.a), add(lg.end, it.b), it.w ?? 4, toneClass[it.tone ?? 'pad'], `f${i}${j}`)
              : it.k === 'circle'
                ? C(add(lg.end, it.c), it.r, toneClass[it.tone ?? 'pad'], `f${i}${j}`)
                : null,
          ),
        )}
        {props(propFor(pattern, equipment), sk, pattern, equipment)}
        {(pattern.front ?? []).map((it, i) => sceneItem(it, 100 + i, phase, sk, box))}
      </g>
    </svg>
  );
}

/**
 * 운동 동작 애니메이션. 직접 그린 단순화 인체가 시작 ↔ 끝 자세를 반복하고 주 근육(진한 빨강)·보조 근육(연한 빨강)을 칠한다.
 * 움직임 줄이기 설정이면 시작·끝 두 장면을 나란히 보여 준다. 일시정지할 수 있다.
 */
export function ExerciseMotion({ name, motion, equipment, primary, secondary }: {
  name: string;
  motion: string;
  equipment: Equipment | null;
  primary: Muscle[];
  secondary: Muscle[];
}) {
  const pattern = patternFor(motion);
  const [reduced] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!pattern || reduced || !playing || typeof requestAnimationFrame !== 'function') return;
    const period = (pattern.period ?? 2.4) * 1000;
    let raf = 0;
    let start: number | null = null;
    let last = 0;
    const offset = phase * period;
    const tick = (now: number) => {
      if (start == null) start = now - offset;
      // 30fps 정도로만 다시 그린다
      if (now - last > 33) {
        last = now;
        setPhase((((now - start) % period) + period) % period / period);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // phase는 재생을 다시 시작할 때의 위치로만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, reduced, playing]);

  if (!pattern) return null;
  const pm = primary.length || secondary.length ? { primary, secondary } : (pattern.muscles ?? { primary: [], secondary: [] });
  const label =
    `${name} 동작 그림` +
    (pm.primary.length ? `. 주 근육: ${names(pm.primary)}` : '') +
    (pm.secondary.length ? `, 보조 근육: ${names(pm.secondary)}` : '');

  return (
    <div className={styles.wrap}>
      <div className={styles.stage} role="img" aria-label={label}>
        {reduced ? (
          <div className={styles.pair}>
            <figure className={styles.still}>
              <MotionFrame pattern={pattern} phase={0} equipment={equipment} primary={pm.primary} secondary={pm.secondary} />
              <figcaption>시작</figcaption>
            </figure>
            <figure className={styles.still}>
              <MotionFrame pattern={pattern} phase={0.5} equipment={equipment} primary={pm.primary} secondary={pm.secondary} />
              <figcaption>끝</figcaption>
            </figure>
          </div>
        ) : (
          <MotionFrame pattern={pattern} phase={phase} equipment={equipment} primary={pm.primary} secondary={pm.secondary} />
        )}
      </div>
      {!reduced && (
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? `${name} 동작 멈추기` : `${name} 동작 재생`}
        >
          {playing ? '❚❚' : '▶'}
        </button>
      )}
    </div>
  );
}
