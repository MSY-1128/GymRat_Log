import { addDays, formatKoreanDate, isValidDateString, todayString } from '../lib/date';
import styles from './DateNav.module.css';

interface Props {
  date: string;
  onChange: (date: string) => void;
}

export function DateNav({ date, onChange }: Props) {
  const isToday = date === todayString();
  return (
    <div className={styles.nav} role="group" aria-label="날짜 이동">
      <button type="button" className={styles.arrow} onClick={() => onChange(addDays(date, -1))} aria-label="이전 날짜">
        ‹
      </button>
      <label className={styles.label}>
        <span className="visually-hidden">날짜 선택</span>
        <input
          type="date"
          className={styles.input}
          value={date}
          onChange={(e) => {
            if (isValidDateString(e.target.value)) onChange(e.target.value);
          }}
        />
      </label>
      <span className={styles.text} aria-live="polite">
        {formatKoreanDate(date)}
      </span>
      <button type="button" className={styles.arrow} onClick={() => onChange(addDays(date, 1))} aria-label="다음 날짜">
        ›
      </button>
      {!isToday && (
        <button type="button" className={styles.today} onClick={() => onChange(todayString())}>
          오늘
        </button>
      )}
    </div>
  );
}
