import type { CSSProperties } from 'react';
import { FONT, color, fontSize } from './theme';

// Small-caps label used for subtitles, section headers, and accent tags.
// Optional tone override for placing on dark vs light backgrounds.
export function Label({
  children,
  tone = 'dark',
  size = 'xs',
  style,
}: {
  children: React.ReactNode;
  tone?: 'dark' | 'light';
  size?: 'xs' | 'xxs' | 'sm';
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: FONT,
        fontSize: fontSize[size],
        textTransform: 'uppercase',
        letterSpacing: 1.6,
        fontWeight: 600,
        color: tone === 'dark' ? color.wood : color.woodCream,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
