import { config } from "../config";
import { ApiError } from "../api/client";
import type { Page } from "./types";
export function query(
  params: Record<string, string | number | null | undefined>,
) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
/** Anonymous reads never attach a saved JWT or browser credentials. */
export async function catalog<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}/catalog/v1/${path}`, {
    signal,
    credentials: "omit",
  });
  if (!res.ok)
    throw new ApiError(
      res.status,
      res.status === 404
        ? "Catalog entry not found."
        : "The catalog is unavailable. Please try again.",
    );
  return res.json() as Promise<T>;
}
export async function allPages<T>(
  path: string,
  signal: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page: Page<T> = await catalog(
      `${path}${path.includes("?") ? "&" : "?"}${query({ limit: 100, cursor })}`,
      signal,
    );
    items.push(...page.items);
    cursor = page.pageInfo.nextCursor;
    if (cursor && (seen.has(cursor) || seen.size >= 99))
      throw new Error(
        "This evidence set is too large. Narrow the benchmark filter.",
      );
    if (cursor) seen.add(cursor);
  } while (cursor);
  return items;
}
