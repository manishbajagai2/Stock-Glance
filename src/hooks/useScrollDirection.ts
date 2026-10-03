import { useEffect, useState } from "react";

type UseScrollDirectionOptions = {
  /** Pixels of scroll before toggling visibility. */
  threshold?: number;
  /** Always show when within this distance from the top. */
  topReveal?: number;
};

/**
 * Returns whether chrome that auto-hides on scroll should be visible.
 * Shows near the top, hides on scroll down, reveals on scroll up.
 */
export function useScrollChromeVisible({
  threshold = 8,
  topReveal = 56,
}: UseScrollDirectionOptions = {}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y <= topReveal) {
          setVisible(true);
        } else if (delta > threshold) {
          setVisible(false);
        } else if (delta < -threshold) {
          setVisible(true);
        }
        lastY = y;
        frame = 0;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold, topReveal]);

  return visible;
}
