import { useCallback } from 'react';
import { FONT, color, radius, gradient, bevel, textShadow } from './theme';

export type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  // When a button row uses flex, this lets each button fill equal share.
  flex?: boolean;
  // Compact mode for tighter contexts (e.g. TesterNotes).
  compact?: boolean;
  title?: string;
}

// Shared stone-bevel button. Coordinates color, border, shadow, text-shadow,
// and the mouse-down dip so every call site looks and feels identical.
export function Button({
  label,
  onClick,
  variant = 'secondary',
  disabled = false,
  flex = true,
  compact = false,
  title,
}: ButtonProps) {
  const isPrimary = variant === 'primary';

  const restShadow = isPrimary ? bevel.primary.rest : bevel.secondary.rest;
  const pressedShadow = isPrimary ? bevel.primary.pressed : bevel.secondary.pressed;

  const onDown = useCallback(
    (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
      if (disabled) return;
      e.currentTarget.style.transform = 'translateY(2px)';
      e.currentTarget.style.boxShadow = pressedShadow;
    },
    [pressedShadow, disabled],
  );

  const onReset = useCallback(
    (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
      if (disabled) return;
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = restShadow;
    },
    [restShadow, disabled],
  );

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseDown={onDown}
      onTouchStart={onDown}
      onMouseUp={onReset}
      onTouchEnd={onReset}
      onMouseLeave={onReset}
      title={title}
      disabled={disabled}
      style={{
        flex: flex ? 1 : 'initial',
        background: isPrimary ? gradient.primary : gradient.secondary,
        color: isPrimary ? '#fff' : color.woodDarkest,
        border: `2px solid ${isPrimary ? '#2E5D2F' : '#6F4E37'}`,
        borderRadius: radius.lg,
        padding: compact ? '8px 14px' : '9px 14px',
        fontFamily: FONT,
        fontSize: compact ? 15 : 15,
        fontWeight: 700,
        letterSpacing: 0.3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textShadow: isPrimary
          ? textShadow.plaque
          : '0 1px 0 rgba(255,250,220,0.6)',
        boxShadow: restShadow,
        transform: 'translateY(0)',
        transition: 'transform 100ms, box-shadow 100ms',
      }}
    >
      {label}
    </button>
  );
}
