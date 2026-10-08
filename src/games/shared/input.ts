// Normalize WASD → arrow keys so games that already branch on e.key can
// accept both without touching their downstream logic.
//
//   W / w → ArrowUp
//   S / s → ArrowDown
//   A / a → ArrowLeft
//   D / d → ArrowRight
//
// Non-movement keys pass through unchanged.
export function normalizeMoveKey(key: string): string {
  switch (key) {
    case 'w': case 'W': return 'ArrowUp';
    case 's': case 'S': return 'ArrowDown';
    case 'a': case 'A': return 'ArrowLeft';
    case 'd': case 'D': return 'ArrowRight';
    default: return key;
  }
}
