"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

const START = "rcsm:navigation-start";

// For navigations started from code (router.push/replace), which no click or submit listener can see.
export function startNavigationProgress() {
  window.dispatchEvent(new Event(START));
}

// A click that Next turns into a page change: same site, plain left click, another path or query.
// Listened to in the capture phase: <Link> and React's form actions call preventDefault() before a bubbling listener.
function isNavigationClick(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || a.target || a.hasAttribute("download")) return false;
  const to = new URL(a.href, location.href);
  return to.origin === location.origin && (to.pathname !== location.pathname || to.search !== location.search);
}

// A form that leaves the page: GET filters (full load) and actions marked data-navigates (they redirect).
// The attribute, not f.method: server-action forms have no method and would read as "get".
const isNavigationSubmit = (e: SubmitEvent) => {
  const f = e.target as HTMLFormElement;
  return (f.getAttribute("method")?.toLowerCase() === "get" || f.hasAttribute("data-navigates"));
};

// Slim flame-blue bar at the top of the window while a page change is in flight.
export function NavigationProgress() {
  return (
    <Suspense>
      <Bar />
    </Suspense>
  );
}

function Bar() {
  const route = usePathname() + "?" + useSearchParams().toString();
  const [progress, setProgress] = useState(0);
  const [shown, setShown] = useState(false);
  const finish = useRef<() => void>(undefined);

  useEffect(() => {
    let active = false, visible = false;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let trickle: ReturnType<typeof setInterval> | undefined;
    let watcher: MutationObserver | undefined;
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(trickle);
      watcher?.disconnect();
    };
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    const done = () => {
      if (!active) return;
      active = false;
      clear();
      if (!visible) return; // finished before it was worth showing
      setProgress(100);
      later(() => {
        visible = false;
        setShown(false);
      }, 250);
      later(() => setProgress(0), 650); // after the fade, so the reset isn't seen
    };
    const start = () => {
      if (active) return;
      active = true;
      clear();
      // instant (cached) pages never flash the bar
      later(() => {
        visible = true;
        setShown(true);
        setProgress(25);
        // each step covers a tenth of what is left, so it slows down and never reaches 90%
        trickle = setInterval(() => setProgress((p) => p + (90 - p) * 0.1), 300);
      }, 120);
      later(done, 10_000); // a redirect back to the same page, or an error: don't hang
    };
    // With partial prerendering the address changes almost at once and the page streams in behind loading
    // skeletons, so the page has really arrived only once no skeleton is left.
    const loading = () => document.querySelector('[data-slot="skeleton"]') !== null;
    finish.current = () => {
      if (!active) return;
      if (!loading()) return done();
      watcher?.disconnect();
      watcher = new MutationObserver(() => !loading() && done());
      watcher.observe(document.body, { childList: true, subtree: true });
    };

    const onClick = (e: MouseEvent) => isNavigationClick(e) && start();
    const onSubmit = (e: SubmitEvent) => isNavigationSubmit(e) && start();
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(START, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(START, start);
      clear();
    };
  }, []);

  // the address changed: finish once the new page has loaded
  useEffect(() => finish.current?.(), [route]);

  return (
    <div
      role={shown ? "progressbar" : undefined}
      aria-label={shown ? "Loading page" : undefined}
      aria-hidden={!shown}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] transition-opacity duration-300 print:hidden"
      style={{ opacity: shown ? 1 : 0 }}
    >
      <div
        className="nav-progress relative h-full rounded-r-full bg-[linear-gradient(90deg,#2e63cf,#5b8cf0_70%,#8fb4ff)] shadow-[0_0_10px_rgba(46,99,207,0.55)]"
        style={{ width: `${progress}%`, transition: progress === 0 ? "none" : "width 400ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {/* glowing tip at the leading edge */}
        <span className="absolute top-1/2 right-0 h-[3px] w-24 -translate-y-1/2 rounded-full bg-white/50 blur-[2px]" />
        <span className="absolute -top-1 right-0 size-[11px] rounded-full bg-[#8fb4ff] opacity-70 blur-[5px]" />
      </div>
    </div>
  );
}
