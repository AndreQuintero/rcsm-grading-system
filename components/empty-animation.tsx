"use client";

import { useEffect, useRef } from "react";

// The "nothing found" Lottie animation shown above an empty table's message. Decorative (aria-hidden).
// The light player renders SVG without eval, which the production CSP forbids; it and the JSON load only
// when an empty state is on screen. Reduced motion: the first frame is shown, not played.
export function EmptyAnimation() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let anim: { destroy(): void } | undefined;
    let gone = false;
    Promise.all([import("lottie-web/build/player/lottie_light"), import("./lottie/data-not-found.json")]).then(([lottie, data]) => {
      if (gone || !box.current) return;
      anim = lottie.default.loadAnimation({
        container: box.current,
        renderer: "svg",
        loop: true,
        autoplay: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        animationData: data.default,
      });
    });
    return () => {
      gone = true;
      anim?.destroy();
    };
  }, []);
  // fixed aspect box (426 × 290) so the message below doesn't jump when the animation loads
  return <div ref={box} aria-hidden="true" className="mx-auto mb-2 aspect-[426/290] w-44" />;
}
