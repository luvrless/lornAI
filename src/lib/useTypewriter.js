import { useEffect, useRef, useState } from "react";

// Smoothly reveals `target` character by character. Speeds up automatically when it falls behind
// the stream, so long answers never lag. When `animate` is false the full text is shown at once.
const RATES = { normal: { min: 1.5, div: 30, cap: 48 }, fast: { min: 4, div: 10, cap: 240 } };

export function useTypewriter(target, animate, speed = "normal") {
  const [shown, setShown] = useState(animate && speed !== "off" ? 0 : target.length);
  const pos = useRef(shown);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (!animate || speed === "off") {
      pos.current = target.length;
      setShown(target.length);
      return;
    }
    const rate = RATES[speed] || RATES.normal;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(64, now - last) / 16.67;
      last = now;
      const len = targetRef.current.length;
      if (pos.current < len) {
        const backlog = len - pos.current;
        // Huge backlogs (e.g. a non-streaming provider) lift the cap so it never takes more than a few seconds.
        const cap = Math.max(rate.cap, backlog / 90);
        pos.current = Math.min(len, pos.current + Math.min(cap, Math.max(rate.min, backlog / rate.div)) * dt);
        setShown(Math.floor(pos.current));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = Math.min(shown, target.length);
  return { text: target.slice(0, n), done: n >= target.length };
}
