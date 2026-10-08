import { getDinoImage, getBabyDinoImage, getMouseImage, getWalkDinoFrame, WALK_FRAME_COUNT } from './dino-svgs';

// Canvas equivalent of the React <Button> primitive — same stone-bevel look
// so back/easy-mode/hint/keyboard buttons in games match the sticker-book
// back button and the quest-overlay action buttons.
type StoneButtonVariant = 'primary' | 'secondary';

interface StoneButtonOptions {
  label?: string;
  icon?: string;
  // For when a text character isn't enough — draws a custom icon at the
  // button's center. Receives ctx, centerX, centerY, and the variant so it
  // can pick contrasting colors.
  drawIcon?: (ctx: CanvasRenderingContext2D, cx: number, cy: number, variant: StoneButtonVariant) => void;
  variant?: StoneButtonVariant;
  hovered?: boolean;
  fontSize?: number;
  borderRadius?: number;
}

export function drawStoneButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: StoneButtonOptions = {},
) {
  const {
    label,
    icon,
    drawIcon,
    variant = 'secondary',
    hovered = false,
    fontSize = 16,
    borderRadius = 12,
  } = opts;

  const isPrimary = variant === 'primary';

  // Bottom bevel — a darker rounded rect peeking out 3px below the button.
  ctx.save();
  ctx.fillStyle = isPrimary ? '#1B5E20' : '#6D4C41';
  ctx.beginPath();
  ctx.roundRect(x, y + 3, w, h, borderRadius);
  ctx.fill();
  ctx.restore();

  // Main button body with vertical gradient.
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  if (isPrimary) {
    grad.addColorStop(0, '#7CC07A');
    grad.addColorStop(0.55, '#4CAF50');
    grad.addColorStop(1, '#2E7D32');
  } else {
    grad.addColorStop(0, '#F3E0B3');
    grad.addColorStop(0.55, '#DEC08C');
    grad.addColorStop(1, '#B89266');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, borderRadius);
  ctx.fill();

  // Border.
  ctx.strokeStyle = isPrimary ? '#2E5D2F' : '#6F4E37';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inset highlight (top edge) — sells the bevel.
  ctx.strokeStyle = isPrimary
    ? 'rgba(255,255,255,0.35)'
    : 'rgba(255,250,220,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + borderRadius, y + 1.5);
  ctx.lineTo(x + w - borderRadius, y + 1.5);
  ctx.stroke();

  // Hover wash — a faint lightening on top of the gradient.
  if (hovered) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, borderRadius);
    ctx.fill();
  }
  ctx.restore();

  // Custom-drawn icon takes precedence.
  if (drawIcon) {
    drawIcon(ctx, x + w / 2, y + h / 2, variant);
  } else {
    // Label / emoji icon.
    ctx.save();
    ctx.fillStyle = isPrimary ? '#fff' : '#3E2723';
    ctx.font = `bold ${fontSize}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = isPrimary
      ? 'rgba(0,0,0,0.35)'
      : 'rgba(255,250,220,0.6)';
    ctx.shadowOffsetY = 1;
    ctx.shadowBlur = 0;
    ctx.fillText(icon ?? label ?? '', x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }

  return { x, y, w, h };
}

// Small painted keyboard icon — two rows of four keys + a space bar on a
// rounded backing plate. Designed to sit inside the 44×44 hint button at
// ~30×20 size. Picks colors based on the variant so the icon reads on both
// tan (secondary) and green (primary/active) stone-bevel buttons.
export function drawKeyboardIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  variant: StoneButtonVariant = 'secondary',
) {
  const w = 30;
  const h = 20;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const isPrimary = variant === 'primary';

  // Backing plate
  const plate = isPrimary ? '#1B5E20' : '#3E2723';
  const plateLight = isPrimary ? '#2E7D32' : '#5D4037';
  const keyFill = isPrimary ? '#C9A77A' : '#FFF5DC';
  const keyShade = isPrimary ? '#7A5A38' : '#6F4E37';

  // Outer plate with 1px inner highlight line
  ctx.save();
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 3);
  ctx.fill();

  ctx.strokeStyle = plateLight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 2.5);
  ctx.stroke();
  ctx.restore();

  // Top row: 4 keys
  const pad = 2.5;
  const rowH = 4.5;
  const gap = 1.2;
  const cols = 4;
  const innerW = w - pad * 2;
  const keyW = (innerW - gap * (cols - 1)) / cols;

  // Row 1
  let ky = y + pad;
  for (let i = 0; i < cols; i++) {
    const kx = x + pad + i * (keyW + gap);
    ctx.save();
    ctx.fillStyle = keyFill;
    ctx.strokeStyle = keyShade;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.roundRect(kx, ky, keyW, rowH, 1.2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Row 2
  ky = y + pad + rowH + gap;
  for (let i = 0; i < cols; i++) {
    const kx = x + pad + i * (keyW + gap);
    ctx.save();
    ctx.fillStyle = keyFill;
    ctx.strokeStyle = keyShade;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.roundRect(kx, ky, keyW, rowH, 1.2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Row 3: space bar (wide single key)
  ky = y + pad + (rowH + gap) * 2;
  const spaceW = innerW * 0.78;
  const spaceX = x + w / 2 - spaceW / 2;
  ctx.save();
  ctx.fillStyle = keyFill;
  ctx.strokeStyle = keyShade;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.roundRect(spaceX, ky, spaceW, rowH - 0.5, 1.2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function expandHex(hex: string): string {
  if (hex.length === 4) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  return hex;
}

function darken(hex: string, amount: number): string {
  hex = expandHex(hex);
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

function lighten(hex: string, amount: number): string {
  hex = expandHex(hex);
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

export type DinoSpecies = 'rex' | 'stego' | 'bronto' | 'raptor' | 'ankylo' | 'para' | 'spino' | 'ptera' | 'tric';

export function drawDino(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color = '#4CAF50',
  facingLeft = false,
  species: DinoSpecies = 'rex',
  pose = 0,
  version = 0,
) {
  const img = getDinoImage(species, color, pose, version);
  if (!img.complete || img.naturalWidth === 0) return;

  ctx.save();
  if (facingLeft) {
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.translate(-x, -y);
  }

  const renderH = size * 1.4;
  const aspect = img.naturalWidth / img.naturalHeight;
  const renderW = renderH * aspect;

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(x, y + renderH * 0.35, renderW * 0.35, renderH * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(img, x - renderW / 2, y - renderH * 0.4, renderW, renderH);
  ctx.restore();
}

export type WalkDirection = 'up' | 'down' | 'left' | 'right';

const DIR_ROTATION: Record<WalkDirection, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

export function drawWalkDino(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  direction: WalkDirection,
  time: number,
  animSpeed = 8,
) {
  const frame = Math.floor(time * animSpeed) % WALK_FRAME_COUNT;
  const img = getWalkDinoFrame(frame);
  if (!img.complete || img.naturalWidth === 0) return;

  const renderH = size * 1.4;
  const aspect = img.naturalWidth / img.naturalHeight;
  const renderW = renderH * aspect;
  const rotation = DIR_ROTATION[direction];

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(0, renderH * 0.35, renderW * 0.35, renderH * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(img, -renderW / 2, -renderH * 0.4, renderW, renderH);
  ctx.restore();
}

export function drawBabyDino(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  _color = '#81C784',
  speciesIndex = -1,
) {
  const idx = speciesIndex >= 0
    ? speciesIndex
    : Math.abs(Math.round(x * 7 + y * 13));
  const img = getBabyDinoImage(idx);
  if (!img.complete || img.naturalWidth === 0) return;

  ctx.save();
  const renderH = size * 1.4;
  const aspect = img.naturalWidth / img.naturalHeight;
  const renderW = renderH * aspect;

  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.beginPath();
  ctx.ellipse(x, y + renderH * 0.3, renderW * 0.3, renderH * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(img, x - renderW / 2, y - renderH * 0.4, renderW, renderH);
  ctx.restore();
}

export function drawEgg(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  spots: string,
  wobble = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(wobble * 8) * 0.1);

  const s = size / 40;

  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(2, 18 * s, 13 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const eggGrad = ctx.createRadialGradient(-4 * s, -6 * s, 2 * s, 0, 2 * s, 20 * s);
  eggGrad.addColorStop(0, lighten(color, 40));
  eggGrad.addColorStop(0.5, color);
  eggGrad.addColorStop(1, darken(color, 20));
  ctx.fillStyle = eggGrad;
  ctx.strokeStyle = darken(color, 40);
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.ellipse(0, 0, 15 * s, 20 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = spots;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 + 0.3;
    const r = 8 * s;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r, Math.sin(angle) * r * 0.8, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-4 * s, -8 * s, 4 * s, 7 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawVolcano(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const grad = ctx.createLinearGradient(x, y, x, y - h);
  grad.addColorStop(0, '#6D4C41');
  grad.addColorStop(0.5, '#8D6E63');
  grad.addColorStop(1, '#A1887F');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.bezierCurveTo(x - w / 3, y - h * 0.3, x - w / 5, y - h * 0.9, x - w / 6, y - h);
  ctx.lineTo(x + w / 6, y - h);
  ctx.bezierCurveTo(x + w / 5, y - h * 0.9, x + w / 3, y - h * 0.3, x + w / 2, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#5D4037';
  ctx.lineWidth = 2;
  ctx.stroke();

  const craterGrad = ctx.createRadialGradient(x, y - h, 2, x, y - h + 4, w / 4);
  craterGrad.addColorStop(0, '#FFAB00');
  craterGrad.addColorStop(0.5, '#FF6D00');
  craterGrad.addColorStop(1, '#D32F2F');
  ctx.fillStyle = craterGrad;
  ctx.beginPath();
  ctx.ellipse(x, y - h + 2, w / 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCustomCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  visible = true,
  clicking = false,
) {
  if (!visible) return;
  const img = getMouseImage(clicking);
  if (!img.complete || img.naturalWidth === 0) return;

  ctx.save();
  const size = 40;
  const aspect = img.naturalWidth / img.naturalHeight;
  const w = size * aspect;
  const h = size;
  ctx.drawImage(img, x - w * 0.3, y - h * 0.1, w, h);
  ctx.restore();
}

export function drawDinoFootprint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color = '#ffffff',
  strokeColor = 'rgba(0,0,0,0.15)',
) {
  ctx.save();
  const s = size / 40;

  ctx.fillStyle = color;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5 * s;

  ctx.beginPath();
  ctx.ellipse(x, y + 6 * s, 10 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const toes = [
    { ox: -10 * s, oy: -10 * s, rx: 6 * s, ry: 7 * s, angle: -0.3 },
    { ox: 0, oy: -16 * s, rx: 6 * s, ry: 7 * s, angle: 0 },
    { ox: 10 * s, oy: -10 * s, rx: 6 * s, ry: 7 * s, angle: 0.3 },
  ];
  for (const t of toes) {
    ctx.beginPath();
    ctx.ellipse(x + t.ox, y + t.oy, t.rx, t.ry, t.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

export function drawScore(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  count: number,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 80, 40, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Fredoka, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${emoji} ${count}`, 20, 40);
  ctx.restore();
}

export function drawBackButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mouseX: number,
  mouseY: number,
) {
  const bw = 100;
  const bh = 44;
  const hovered = mouseX > x && mouseX < x + bw && mouseY > y && mouseY < y + bh;
  return drawStoneButton(ctx, x, y, bw, bh, {
    label: '← Back',
    variant: 'secondary',
    hovered,
    fontSize: 16,
  });
}

export function drawStickerPopup(
  ctx: CanvasRenderingContext2D,
  text: string,
  timer: number,
  canvasW: number,
  canvasH = 600,
) {
  if (timer <= 0) return;
  ctx.save();

  const cx = canvasW / 2;
  const cy = canvasH / 2 - 20;

  // dark overlay
  ctx.fillStyle = `rgba(0,0,0,${Math.min(0.5, timer * 0.6)})`;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // entrance animation
  const enter = Math.min(1, (3 - timer) * 3);
  const scale = 0.5 + enter * 0.5;
  const alpha = Math.min(1, timer * 1.2);

  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);

  // glow behind card
  ctx.shadowColor = 'rgba(255,215,0,0.6)';
  ctx.shadowBlur = 30;

  // card background
  const cardW = 300;
  const cardH = 160;
  ctx.fillStyle = 'rgba(20,20,40,0.92)';
  ctx.beginPath();
  ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 24);
  ctx.fill();

  // gold border
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 24);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // "New Sticker!" label
  ctx.fillStyle = 'rgba(255,215,0,0.6)';
  ctx.font = 'bold 14px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⭐ NEW STICKER! ⭐', cx, cy - 45);

  // emoji + name (parsed from text like "🥚 First Hatch!")
  const emoji = text.slice(0, 2).trim();
  const label = text.slice(2).trim();

  ctx.shadowColor = 'rgba(255,215,0,0.8)';
  ctx.shadowBlur = 12;
  ctx.font = '52px serif';
  ctx.fillText(emoji, cx, cy + 15);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 22px Fredoka, sans-serif';
  ctx.fillText(label, cx, cy + 55);

  ctx.restore();
}

const QWERTY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const ARROW_KEYS = [
  { label: '↑', key: 'ArrowUp', col: 1, row: 0 },
  { label: '←', key: 'ArrowLeft', col: 0, row: 1 },
  { label: '↓', key: 'ArrowDown', col: 1, row: 1 },
  { label: '→', key: 'ArrowRight', col: 2, row: 1 },
];

export function drawEasyModeButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mouseX: number,
  mouseY: number,
  active: boolean,
) {
  const bw = 80;
  const bh = 34;
  const hovered = mouseX > x && mouseX < x + bw && mouseY > y && mouseY < y + bh;
  return drawStoneButton(ctx, x, y, bw, bh, {
    label: active ? '⭐ Easy' : 'Easy',
    variant: active ? 'primary' : 'secondary',
    hovered,
    fontSize: 13,
    borderRadius: 10,
  });
}

export function drawHintButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mouseX: number,
  mouseY: number,
  active: boolean,
) {
  const bw = 44;
  const bh = 44;
  const hovered = mouseX > x && mouseX < x + bw && mouseY > y && mouseY < y + bh;
  return drawStoneButton(ctx, x, y, bw, bh, {
    drawIcon: (c, cx, cy, variant) => drawKeyboardIcon(c, cx, cy, variant),
    variant: active ? 'primary' : 'secondary',
    hovered,
    borderRadius: 12,
  });
}

export function drawKeyboardOverlay(
  ctx: CanvasRenderingContext2D,
  highlightKey: string,
  time: number,
  canvasW: number,
  canvasH: number,
  mode: 'qwerty' | 'arrows' = 'qwerty',
) {
  ctx.save();

  if (mode === 'arrows') {
    const keyS = 48;
    const gap = 4;
    const blockW = 3 * keyS + 2 * gap;
    const blockH = 2 * keyS + gap;
    const ox = canvasW / 2 - blockW / 2;
    const oy = canvasH - blockH - 30;

    // background panel
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(ox - 16, oy - 16, blockW + 32, blockH + 32, 16);
    ctx.fill();

    for (const ak of ARROW_KEYS) {
      const kx = ox + ak.col * (keyS + gap);
      const ky = oy + ak.row * (keyS + gap);
      const isTarget = ak.key === highlightKey;

      ctx.fillStyle = isTarget ? '#FFD700' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.roundRect(kx, ky, keyS, keyS, 8);
      ctx.fill();

      if (isTarget) {
        ctx.shadowColor = 'rgba(255,215,0,0.6)';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(kx, ky, keyS, keyS, 8);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = isTarget ? '#333' : 'rgba(255,255,255,0.7)';
      ctx.font = `bold ${isTarget ? 22 : 18}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(ak.label, kx + keyS / 2, ky + keyS / 2 + 7);

      if (isTarget) {
        const bounce = Math.sin(time * 5) * 6;
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 24px Fredoka, sans-serif';
        ctx.fillText('▼', kx + keyS / 2, ky - 8 + bounce);
      }
    }

    ctx.restore();
    return;
  }

  // QWERTY mode
  const keyW = 42;
  const keyH = 42;
  const gap = 4;
  const rowWidths = QWERTY_ROWS.map((r) => r.length * keyW + (r.length - 1) * gap);
  const maxW = Math.max(...rowWidths);
  const totalH = 3 * keyH + 2 * gap;
  const ox = canvasW / 2 - maxW / 2;
  const oy = canvasH - totalH - 30;

  // background panel
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath();
  ctx.roundRect(ox - 20, oy - 20, maxW + 40, totalH + 40, 16);
  ctx.fill();

  for (let ri = 0; ri < QWERTY_ROWS.length; ri++) {
    const row = QWERTY_ROWS[ri];
    const rowW = row.length * keyW + (row.length - 1) * gap;
    const rowOx = canvasW / 2 - rowW / 2;
    const ry = oy + ri * (keyH + gap);

    for (let ci = 0; ci < row.length; ci++) {
      const letter = row[ci];
      const kx = rowOx + ci * (keyW + gap);
      const isTarget = letter === highlightKey.toUpperCase();

      // key background
      if (isTarget) {
        ctx.shadowColor = 'rgba(255,215,0,0.6)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFD700';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
      }
      ctx.beginPath();
      ctx.roundRect(kx, ry, keyW, keyH, 7);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isTarget) {
        ctx.strokeStyle = '#FFF8E1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(kx, ry, keyW, keyH, 7);
        ctx.stroke();
      }

      // letter
      ctx.fillStyle = isTarget ? '#333' : 'rgba(255,255,255,0.6)';
      ctx.font = `bold ${isTarget ? 20 : 16}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(letter, kx + keyW / 2, ry + keyH / 2 + 6);

      // bouncing arrow above target key
      if (isTarget) {
        const bounce = Math.sin(time * 5) * 6;
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 20px Fredoka, sans-serif';
        ctx.fillText('▼', kx + keyW / 2, ry - 6 + bounce);
      }
    }
  }

  ctx.restore();
}

export function drawInstructions(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  const tw = ctx.measureText(text).width + 30;
  ctx.roundRect(x - tw / 2, y - 18, tw, 28, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '16px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.restore();
}
