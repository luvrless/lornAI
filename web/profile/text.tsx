/** @jsxRuntime automatic @jsxImportSource react */
/**
 * Text effects. Server render outputs the plain text; effects start on the
 * client. Screen readers always get the full text via aria-label.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { reducedMotion } from "./effects.ts";

export type TextEffect = "none" | "typewriter" | "glitch" | "decrypt" | "wave" | "rainbow" | "split" | "reveal" | "gradientShift";

const GLYPHS = "!<>-_\\/[]{}—=+*^?#ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

export function EffectText({ text, effect, speed = 1, loop = false, pauseMs = 1300, as: Tag = "span", className, style, cursor = true }: {
  text: string; effect: TextEffect; speed?: number; loop?: boolean; pauseMs?: number; as?: any; className?: string; style?: CSSProperties; cursor?: boolean;
}) {
  const [out, setOut] = useState(text);
  const [mounted, setMounted] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setMounted(true);
    const clear = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = []; };
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    if (reducedMotion() || effect === "none" || !text) { setOut(text); return clear; }

    if (effect === "typewriter") {
      const step = 70 / speed;
      const type = (i: number) => {
        setOut(text.slice(0, i));
        if (i < text.length) later(() => type(i + 1), step + Math.random() * step * .6);
        else if (loop) later(() => erase(text.length), pauseMs);
      };
      const erase = (i: number) => {
        setOut(text.slice(0, i));
        if (i > 0) later(() => erase(i - 1), step * .5);
        else later(() => type(1), 400);
      };
      type(0);
    } else if (effect === "decrypt") {
      const run = () => {
        let frame = 0;
        const total = Math.ceil(text.length * 1.6 + 10);
        const tick = () => {
          frame++;
          setOut(text.split("").map((ch, i) => (ch === " " ? " " : frame > i * 1.6 + 6 ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(""));
          if (frame < total) later(tick, 40 / speed);
          else { setOut(text); if (loop) later(run, pauseMs + 1500); }
        };
        tick();
      };
      run();
    } else if (effect === "glitch") {
      const run = () => {
        const n = 3 + Math.floor(Math.random() * 4);
        let k = 0;
        const g = () => {
          setOut(text.split("").map((ch) => (ch !== " " && Math.random() < .25 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ch)).join(""));
          if (++k < n) later(g, 45); else setOut(text);
        };
        g();
        later(run, (1800 + Math.random() * 2600) / speed);
      };
      later(run, 600);
    } else setOut(text);
    return clear;
  }, [text, effect, speed, loop, pauseMs]);

  const dur = `${(2.4 / speed).toFixed(2)}s`;
  if (effect === "wave" || effect === "split" || effect === "reveal") {
    const cls = effect === "wave" ? "fx-wave" : effect === "split" ? "fx-split" : "fx-reveal";
    return (
      <Tag className={className} style={style} aria-label={text}>
        {text.split("").map((ch, i) => (
          <span key={i} aria-hidden className={mounted ? cls : undefined} style={{ animationDelay: `${(i * (effect === "wave" ? 0.08 : 0.035)) / speed}s`, animationDuration: effect === "wave" ? dur : `${(0.6 / speed).toFixed(2)}s` }}>
            {ch === " " ? " " : ch}
          </span>
        ))}
      </Tag>
    );
  }
  const cls = effect === "rainbow" ? "fx-rainbow" : effect === "gradientShift" ? "fx-gshift" : effect === "glitch" ? "fx-glitch" : "";
  return (
    <Tag className={[className, cls].filter(Boolean).join(" ")} style={{ ...style, animationDuration: cls ? dur : undefined }} aria-label={text} data-text={text}>
      <span aria-hidden>{out}</span>
      {effect === "typewriter" && cursor && mounted && <span aria-hidden className="fx-caret">|</span>}
    </Tag>
  );
}
