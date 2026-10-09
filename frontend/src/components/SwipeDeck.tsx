import clsx from "clsx";
import { Heart, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { texts, useTexts } from "../lib/i18n";

const TX = texts(
  { yes: "Yes", pass: "Pass", actions: "Swipe actions", undo: "Undo last swipe", undoShort: "Undo", passKey: "Pass (left arrow key)", rightKey: "right arrow key", hint: "Drag the card or use the arrow keys ← →" },
  { yes: "Da", pass: "Nu", actions: "Acțiuni swipe", undo: "Anulează ultimul swipe", undoShort: "Anulează", passKey: "Nu acum (săgeata stânga)", rightKey: "săgeata dreapta", hint: "Trage cardul sau folosește săgețile ← →" },
);

export type Direction = "left" | "right";

const THRESHOLD = 110; // px of drag that counts as a swipe
const FLY_MS = 320;

interface Props<T> {
  cards: T[]; // remaining cards, the first one is on top
  cardKey: (c: T) => string;
  render: (c: T) => ReactNode;
  onSwipe: (c: T, dir: Direction) => void;
  onUndo: () => void;
  canUndo: boolean;
  likeLabel: string;
}

/** Tinder-style card stack: drag the top card, or use the buttons / arrow keys. */
export function SwipeDeck<T>({ cards, cardKey, render, onSwipe, onUndo, canUndo, likeLabel }: Props<T>) {
  const tx = useTexts(TX);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<Direction | null>(null);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const top = cards[0];

  const fly = useCallback(
    (dir: Direction) => {
      if (!top || leaving) return;
      setDrag((d) => ({ ...d, active: false }));
      setLeaving(dir);
      window.setTimeout(() => {
        onSwipe(top, dir);
        setLeaving(null);
        setDrag({ x: 0, y: 0, active: false });
      }, FLY_MS);
    },
    [top, leaving, onSwipe],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, dialog")) return;
      if (e.key === "ArrowRight") fly("right");
      else if (e.key === "ArrowLeft") fly("left");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fly]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (leaving || e.button !== 0 || (e.target as HTMLElement).closest("a, button")) return;
    start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current) setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const speed = Math.abs(dx) / Math.max(1, performance.now() - start.current.t);
    start.current = null;
    if (Math.abs(dx) > THRESHOLD || (Math.abs(dx) > 40 && speed > 0.6)) fly(dx > 0 ? "right" : "left");
    else setDrag({ x: 0, y: 0, active: false });
  };

  const width = typeof window === "undefined" ? 1200 : window.innerWidth;
  const x = leaving ? (leaving === "right" ? 1 : -1) * (width * 0.7 + 260) : drag.x;
  const y = leaving ? drag.y + 30 : drag.y * 0.25;
  const progress = Math.min(1, Math.abs(x) / THRESHOLD);
  const like = Math.max(0, Math.min(1, x / THRESHOLD));
  const nope = Math.max(0, Math.min(1, -x / THRESHOLD));
  const stack = cards.slice(0, 3);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="grid w-full max-w-md">
        {stack
          .map((c, i) => {
            const isTop = i === 0;
            // cards behind grow as the top card moves away
            const depth = isTop ? 0 : Math.max(0, i - progress);
            const style = isTop
              ? {
                  transform: `translate(${x}px, ${y}px) rotate(${x / 18}deg)`,
                  transition: drag.active ? "none" : `transform ${FLY_MS}ms cubic-bezier(.2,.7,.2,1)`,
                }
              : {
                  transform: `translateY(${depth * 14}px) scale(${1 - depth * 0.045})`,
                  transition: drag.active ? "none" : `transform ${FLY_MS}ms ease`,
                };
            return (
              <div
                key={cardKey(c)}
                className={clsx("relative min-w-0 [grid-area:1/1]", isTop ? "z-10 cursor-grab touch-pan-y active:cursor-grabbing" : "pointer-events-none")}
                style={{ ...style, zIndex: 10 - i }}
                aria-hidden={!isTop}
                {...(isTop ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } : {})}
              >
                {render(c)}
                {isTop && (
                  <>
                    <span
                      className="pointer-events-none absolute top-6 left-5 -rotate-12 rounded-xl border-4 border-success px-3 py-1 text-3xl font-black tracking-wider text-success uppercase"
                      style={{ opacity: like }}
                      aria-hidden
                    >
                      {tx.yes}
                    </span>
                    <span
                      className="pointer-events-none absolute top-6 right-5 rotate-12 rounded-xl border-4 border-danger px-3 py-1 text-3xl font-black tracking-wider text-danger uppercase"
                      style={{ opacity: nope }}
                      aria-hidden
                    >
                      {tx.pass}
                    </span>
                  </>
                )}
              </div>
            );
          })
          .reverse()}
      </div>

      <div className="flex items-center gap-5" role="group" aria-label={tx.actions}>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || !!leaving}
          className="inline-flex size-12 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-warning shadow-card transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={tx.undo}
          title={tx.undoShort}
        >
          <RotateCcw className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => fly("left")}
          disabled={!top || !!leaving}
          className="inline-flex size-16 cursor-pointer items-center justify-center rounded-full border-2 border-danger/40 bg-card text-danger shadow-card transition hover:scale-105 hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={tx.passKey}
          title={tx.pass}
        >
          <X className="size-8" strokeWidth={2.5} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => fly("right")}
          disabled={!top || !!leaving}
          className="inline-flex size-16 cursor-pointer items-center justify-center rounded-full bg-success text-success-fg shadow-card transition hover:scale-105 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`${likeLabel} (${tx.rightKey})`}
          title={likeLabel}
        >
          <Heart className="size-8 fill-current" aria-hidden />
        </button>
      </div>
      <p className="text-sm text-muted-fg">{tx.hint}</p>
    </div>
  );
}
