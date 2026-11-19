import { LottiePlayer } from "./lottie-player";

// The "nothing found" animation above an empty table's message; fixed aspect (426 × 290) so the text doesn't jump.
export function EmptyAnimation() {
  return <LottiePlayer name="data-not-found" className="mx-auto mb-2 aspect-[426/290] w-44" />;
}
