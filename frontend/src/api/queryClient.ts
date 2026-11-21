import { QueryClient } from '@tanstack/react-query';
import { ApiError, setUnauthorizedHandler } from './client';
import { keys, resetSession } from './hooks';

/**
 * 앱 공용 QueryClient. API가 401을 돌려주면(세션 만료·다른 탭에서 로그아웃) 로그인 상태를 비워
 * 화면이 로그인 페이지로 이동하게 한다.
 */
export function createQueryClient(test = false): QueryClient {
  const client = new QueryClient({
    defaultOptions: test
      ? { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } }
      : {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // 4xx는 재시도해도 같은 결과이므로 재시도하지 않는다.
            retry: (count, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          },
        },
  });
  setUnauthorizedHandler(() => {
    if (client.getQueryData(keys.me)) resetSession(client, null);
  });
  return client;
}
