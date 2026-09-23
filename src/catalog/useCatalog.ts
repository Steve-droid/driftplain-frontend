import { useEffect, useState } from "react";
import { allPages, catalog } from "./api";
import type { Page } from "./types";
function useRequest<T>(
  path: string | null,
  load: (path: string, signal: AbortSignal) => Promise<T>,
) {
  const [state, setState] = useState<{
    key: string | null;
    data?: T;
    error?: string;
  }>({ key: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let live = true;
    load(path, controller.signal)
      .then((data) => {
        if (live) setState({ key: path, data });
      })
      .catch((e: unknown) => {
        if (live)
          setState({
            key: path,
            error: e instanceof Error ? e.message : "Catalog unavailable.",
          });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [path, retry, load]);
  return {
    ...(state.key === path ? state : {}),
    loading: !!path && (state.key !== path || (!state.data && !state.error)),
    retry: () => {
      setState({ key: null });
      setRetry((n) => n + 1);
    },
  };
}

export function useCatalog<T>(path: string | null) {
  return useRequest<T>(path, catalog<T>);
}
async function completePage<T>(
  path: string,
  signal: AbortSignal,
): Promise<Page<T>> {
  const items = await allPages<T>(path, signal);
  return { items, pageInfo: { limit: 100, nextCursor: null, hasMore: false } };
}
export function useCatalogPages<T>(path: string) {
  return useRequest<Page<T>>(path, completePage<T>);
}
