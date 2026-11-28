import { MINUTES_PER_SET, bodyPartLabel, intensityLabel, type SpeedPoint, type WorkoutEntry } from '../api/types';
import { formatAmount, formatKcal } from './format';

/** 기록 한 줄 요약. 예: "가슴 · 4세트 × 10회 × 60kg", "5km · 30분 · 시속 10km", "60분 · 힘들게" */
export function workoutDetail(w: WorkoutEntry): string {
  switch (w.mode) {
    case 'SETS':
      return [
        w.bodyPart ? bodyPartLabel(w.bodyPart) : null,
        `${w.sets}세트 × ${w.reps}회 × ${formatAmount(w.liftedKg ?? 0)}kg`,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'DISTANCE':
      return [`${formatAmount(w.distanceKm ?? 0)}km`, w.minutes ? `${w.minutes}분` : null].filter(Boolean).join(' · ');
    default:
      if (w.intensityBasis === 'DISTANCE' || w.intensityBasis === 'SPEED')
        return `${formatAmount(w.distanceKm ?? 0)}km · ${w.minutes}분 · 시속 ${formatAmount(w.speedKmh ?? 0)}km`;
      if (w.intensityBasis === 'LEVEL' && w.intensity) return `${w.minutes}분 · ${intensityLabel(w.intensity)}`;
      return `${w.minutes}분`;
  }
}

/** 계산 근거 한 줄. 예: "볼륨 2,400kg · 약 10분 · MET 5" */
export function workoutBasis(w: WorkoutEntry): string {
  switch (w.mode) {
    case 'SETS':
      return `볼륨 ${formatKcal(w.volumeKg)}kg · 약 ${formatAmount(w.durationMinutes)}분 추정 · MET ${formatAmount(w.metSnapshot)}`;
    case 'DISTANCE':
      return `km당 ${formatAmount(w.kcalPerKgKmSnapshot ?? 0)}kcal/kg (이전 거리 기록)`;
    default:
      return w.intensityBasis === 'DISTANCE' || w.intensityBasis === 'SPEED'
        ? `속도 기준 MET ${formatAmount(w.metSnapshot)}`
        : `MET ${formatAmount(w.metSnapshot)}`;
  }
}

/** 속도(km/h)에 맞는 MET. 서버 Calculator.metForSpeed와 같은 식(점 사이 직선, 양 끝 밖은 끝점). */
export function metForSpeed(curve: SpeedPoint[], speedKmh: number): number | null {
  if (curve.length === 0 || !(speedKmh > 0)) return null;
  const first = curve[0]!;
  const last = curve[curve.length - 1]!;
  if (speedKmh <= first.speedKmh) return first.met;
  if (speedKmh >= last.speedKmh) return last.met;
  const i = curve.findIndex((p) => p.speedKmh >= speedKmh);
  const a = curve[i - 1]!;
  const b = curve[i]!;
  const met = a.met + ((b.met - a.met) * (speedKmh - a.speedKmh)) / (b.speedKmh - a.speedKmh);
  return Math.round(met * 100) / 100;
}

/** 서버와 같은 식으로 미리 보는 칼로리. 값이 부족하면 null. */
export function estimateKcal(
  input: { mode: 'TIME'; met: number; minutes: number } | { mode: 'SETS'; met: number; sets: number },
  weightKg: number | null,
): number | null {
  if (weightKg == null) return null;
  switch (input.mode) {
    case 'TIME':
      return input.minutes > 0 ? ((input.met * 3.5 * weightKg) / 200) * input.minutes : null;
    case 'SETS':
      return input.sets > 0 ? ((input.met * 3.5 * weightKg) / 200) * input.sets * MINUTES_PER_SET : null;
  }
}
