import { APP_ENV } from "../lib/firebase";

export function EnvBanner() {
  if (APP_ENV !== "staging") {
    return null;
  }

  return (
    <aside
      aria-label="Environment indicator"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-3 py-1 text-center text-xs font-medium text-amber-900 backdrop-blur-sm dark:text-amber-200"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
      <span>STAGING: test data only</span>
    </aside>
  );
}
