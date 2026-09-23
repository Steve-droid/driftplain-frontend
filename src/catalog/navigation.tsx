import { useSyncExternalStore, type AnchorHTMLAttributes } from "react";
function subscribe(fn: () => void) {
  window.addEventListener("popstate", fn);
  window.addEventListener("catalog:navigate", fn);
  return () => {
    window.removeEventListener("popstate", fn);
    window.removeEventListener("catalog:navigate", fn);
  };
}
export function navigate(href: string, replace = false) {
  window.history[replace ? "replaceState" : "pushState"](null, "", href);
  window.dispatchEvent(new Event("catalog:navigate"));
}
export function useLocation() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
  );
}
export function withChoices(href: string) {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) return href;
  const compare = new URLSearchParams(window.location.search).get("compare");
  if (
    url.origin === window.location.origin &&
    /^\/(benchmarks|models|compare|evidence)(\/|$)/.test(url.pathname) &&
    compare &&
    !url.searchParams.has("compare")
  )
    url.searchParams.set("compare", compare);
  return url.pathname + url.search + url.hash;
}
export function Link({
  href = "",
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  href = withChoices(href);
  return (
    <a
      {...props}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (
          !e.defaultPrevented &&
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey &&
          !props.target &&
          new URL(href, window.location.origin).origin ===
            window.location.origin
        ) {
          e.preventDefault();
          navigate(href);
        }
      }}
    />
  );
}
export function updateParams(
  values: Record<string, string | null>,
  replace = false,
) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(values)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  navigate(url.pathname + url.search, replace);
}
