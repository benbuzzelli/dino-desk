import { useEffect, useRef, useState } from 'react';
import { getQuillEmoteUrl } from '../games/shared/quill';
import type { QuillEmote } from '../games/shared/quill';
import { FONT, color, fontSize, shadow } from '../ui';

export interface QuillBubbleEventDetail {
  emote: QuillEmote;
  message: string;
  durationMs?: number; // default 4500
}

export const QUILL_EVENT = 'quill:bubble';

export function emitQuillBubble(detail: QuillBubbleEventDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<QuillBubbleEventDetail>(QUILL_EVENT, { detail }));
}

// Listens on window for quill:bubble events and renders a floating portrait
// in the bottom-right for ~4.5s. Non-blocking (pointerEvents passthrough on the
// outer layer) so it can pop up mid-game without stealing taps from the canvas.
export function QuillBubble() {
  const [current, setCurrent] = useState<QuillBubbleEventDetail | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const removeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onBubble = (e: Event) => {
      const detail = (e as CustomEvent<QuillBubbleEventDetail>).detail;
      if (!detail) return;
      if (hideTimerRef.current != null) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current != null) clearTimeout(removeTimerRef.current);

      setCurrent(detail);
      // fade-in on next frame so the transition plays
      requestAnimationFrame(() => setVisible(true));

      const duration = detail.durationMs ?? 4500;
      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        removeTimerRef.current = window.setTimeout(() => setCurrent(null), 400);
      }, duration);
    };

    window.addEventListener(QUILL_EVENT, onBubble as EventListener);
    return () => {
      window.removeEventListener(QUILL_EVENT, onBubble as EventListener);
      if (hideTimerRef.current != null) clearTimeout(hideTimerRef.current);
      if (removeTimerRef.current != null) clearTimeout(removeTimerRef.current);
    };
  }, []);

  if (!current) return null;

  return (
    <div
      // outer wrapper is pointer-events: none so it doesn't block the canvas.
      // The inner card re-enables pointer events so the child can tap to dismiss.
      style={{
        position: 'absolute',
        right: 14,
        bottom: 14,
        zIndex: 30,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        transition: 'opacity 280ms ease-out, transform 280ms ease-out',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        maxWidth: 360,
      }}
    >
      <div
        onClick={() => {
          if (hideTimerRef.current != null) clearTimeout(hideTimerRef.current);
          setVisible(false);
          if (removeTimerRef.current != null) clearTimeout(removeTimerRef.current);
          removeTimerRef.current = window.setTimeout(() => setCurrent(null), 300);
        }}
        style={{
          pointerEvents: 'auto',
          cursor: 'pointer',
          background: 'linear-gradient(180deg, #fff7e0 0%, #ffd9a3 100%)',
          border: `3px solid ${color.woodMid}`,
          borderRadius: 18,
          boxShadow: shadow.floating,
          padding: '12px 14px 12px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: FONT,
          color: color.woodDarkest,
        }}
      >
        <img
          src={getQuillEmoteUrl(current.emote)}
          alt="Quill"
          style={{
            width: 72,
            height: 72,
            objectFit: 'contain',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.85)',
            border: `2px solid ${color.woodMid}`,
            flexShrink: 0,
          }}
        />
        <div style={{ fontSize: fontSize.lg, lineHeight: 1.3, fontWeight: 600 }}>
          {current.message}
        </div>
      </div>
    </div>
  );
}
