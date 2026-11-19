"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Each animation is its own chunk, fetched only when a player for it renders. (A server component can't pass a
// loader function to a client one, so callers pick by name.)
const ANIMATIONS = {
  "data-not-found": () => import("./lottie/data-not-found.json"),
  "business-plan": () => import("./lottie/business-plan.json"),
  "employee-content": () => import("./lottie/employee-content.json"),
  "calendar-booking": () => import("./lottie/calendar-booking.json"),
  "get-things-done": () => import("./lottie/get-things-done.json"),
};
export type AnimationName = keyof typeof ANIMATIONS;

// Decorative Lottie animation (aria-hidden). The light player renders SVG without eval, which the production CSP
// forbids; it ignores the rare After Effects expression (that part then plays once). Reduced motion: first frame only.
export function LottiePlayer({ name, className }: { name: AnimationName; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let anim: { destroy(): void } | undefined;
    let gone = false;
    Promise.all([import("lottie-web/build/player/lottie_light"), ANIMATIONS[name]()]).then(([lottie, data]) => {
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
  }, [name]);
  return <div ref={box} aria-hidden="true" className={cn("pointer-events-none", className)} />;
}
