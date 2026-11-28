import type { Muscle } from '../api/types';
import { MotionFrame } from '../components/ExerciseMotion';
import { PATTERNS } from '../motion/patterns';

/** 개발 서버에서만 여는 동작 패턴 확인용 화면(/dev/motions). 모든 패턴의 시작·중간·끝 자세를 한 번에 본다. */
export function MotionGallery() {
  const sample: Muscle[] = ['CHEST', 'QUADS', 'LATS', 'BICEPS', 'FRONT_DELT', 'GLUTES', 'ABS'];
  const sample2: Muscle[] = ['TRICEPS', 'HAMSTRINGS', 'TRAPS', 'CALVES', 'REAR_DELT', 'OBLIQUES', 'LOWER_BACK'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: 8, background: 'var(--bg)' }}>
      {Object.entries(PATTERNS).map(([key, p]) => (
        <div key={key} data-motion={key} style={{ border: '1px solid var(--border)', background: 'var(--motion-bg)' }}>
          <div style={{ font: '600 12px sans-serif', padding: 4 }}>{key}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            {[0, 0.25, 0.5].map((ph) => (
              <MotionFrame key={ph} pattern={p} phase={ph} equipment={key.includes('Row') || key === 'curl' ? 'CABLE' : 'BARBELL'} primary={sample} secondary={sample2} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
