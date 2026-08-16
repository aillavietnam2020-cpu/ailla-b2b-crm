import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from './api';

export interface AsyncState<T> {
  data: T | null;
  meta?: Record<string, unknown>;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Tải dữ liệu từ API kèm trạng thái loading/lỗi - dùng cho mọi màn hình danh sách. */
export function useApi<T>(path: string | null, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | undefined>();
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const activePath = useRef(path);

  useEffect(() => {
    activePath.current = path;
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiFetch<T>(path, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result.data);
        setMeta(result.meta);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Không tải được dữ liệu');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, meta, loading, error, reload };
}

/** Debounce cho ô tìm kiếm để không gọi API mỗi lần gõ phím. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
