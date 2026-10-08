import { FONT, gradient } from './theme';

// Wooden plank banner with two nail-head accents in the top corners.
// Used under stickers, and anywhere else a small labeled "plaque" reads right.
export function Placard({
  label,
  dim = false,
  fullWidth = false,
}: {
  label: string;
  dim?: boolean;
  fullWidth?: boolean;
}) {
  const nail = (side: 'left' | 'right') => (
    <span
      style={{
        position: 'absolute',
        top: 3,
        [side]: 4,
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: dim ? '#3E2723' : '#2E1B0E',
        boxShadow: 'inset 0 1px 0 rgba(255,230,180,0.4)',
      }}
    />
  );

  return (
    <div
      style={{
        position: 'relative',
        minWidth: fullWidth ? '100%' : '85%',
        maxWidth: '100%',
        background: dim ? gradient.woodDim : gradient.wood,
        border: `2px solid ${dim ? '#4E342E' : '#5D3E1F'}`,
        borderRadius: 10,
        padding: '5px 12px',
        boxShadow: dim
          ? '0 2px 0 rgba(62,39,35,0.35), inset 0 1px 0 rgba(255,240,200,0.22)'
          : '0 3px 0 rgba(62,39,35,0.45), 0 5px 10px rgba(62,39,35,0.25), inset 0 1px 0 rgba(255,240,200,0.45)',
        color: dim ? 'rgba(255,245,220,0.55)' : '#FFF5DC',
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 700,
        textAlign: 'center',
        letterSpacing: 0.3,
        lineHeight: 1.2,
        textShadow: '0 1px 1px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {nail('left')}
      {nail('right')}
      {label}
    </div>
  );
}
