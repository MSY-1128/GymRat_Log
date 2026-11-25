import { MINUTES_PER_SET, bodyPartLabel, type WorkoutEntry } from '../api/types';
import { formatAmount, formatKcal } from './format';

/** 기록 한 줄 요약. 예: "가슴 · 4세트 × 10회 × 60kg", "5km · 30분", "60분" */
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
      return `${w.minutes}분`;
  }
}

/** 계산 근거 한 줄. 예: "볼륨 2,400kg · 약 10분 · MET 5" */
export function workoutBasis(w: WorkoutEntry): string {
  switch (w.mode) {
    case 'SETS':
      return `볼륨 ${formatKcal(w.volumeKg)}kg · 약 ${formatAmount(w.durationMinutes)}분 추정 · MET ${formatAmount(w.metSnapshot)}`;
    case 'DISTANCE':
      return `km당 ${formatAmount(w.kcalPerKgKmSnapshot ?? 0)}kcal/kg`;
    default:
      return `MET ${formatAmount(w.metSnapshot)}`;
  }
}

/** 서버와 같은 식으로 미리 보는 칼로리. 값이 부족하면 null. */
export function estimateKcal(
  input:
    | { mode: 'TIME'; met: number; minutes: number }
    | { mode: 'DISTANCE'; perKgKm: number; km: number }
    | { mode: 'SETS'; met: number; sets: number },
  weightKg: number | null,
): number | null {
  if (weightKg == null) return null;
  switch (input.mode) {
    case 'TIME':
      return input.minutes > 0 ? ((input.met * 3.5 * weightKg) / 200) * input.minutes : null;
    case 'DISTANCE':
      return input.km > 0 ? input.perKgKm * weightKg * input.km : null;
    case 'SETS':
      return input.sets > 0 ? ((input.met * 3.5 * weightKg) / 200) * input.sets * MINUTES_PER_SET : null;
  }
}
