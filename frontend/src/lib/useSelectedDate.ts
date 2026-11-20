import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { isValidDateString, todayString } from './date';

/** 선택 날짜는 URL ?date=YYYY-MM-DD 로 유지(새로고침·탭 이동 시 보존). 없으면 오늘(로컬). */
export function useSelectedDate(): [string, (date: string) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('date');
  const date = isValidDateString(raw) ? raw : todayString();
  const setDate = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === todayString()) p.delete('date');
          else p.set('date', next);
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [date, setDate];
}
