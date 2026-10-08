import { useRef, useCallback } from 'react';
import { drawDino, drawCustomCursor, drawBackButton } from '../games/shared/draw';
import { getDinoImage } from '../games/shared/dino-svgs';
import { useGameCanvas } from '../games/shared/useGameCanvas';
import { getAllSlots, getCollectionCount } from '../games/shared/collection';
import type { CollectionSlot } from '../games/shared/collection';

const W = 800;
const H = 600;

const SLOT_W = 82;
const SLOT_H = 95;
const GAP = 10;
const COLS = 6;

const DINO_COLORS: Record<string, string> = {
  rex: '#4CAF50',
  stego: '#FF9800',
  bronto: '#9C27B0',
  raptor: '#2196F3',
  ankylo: '#009688',
  para: '#E91E63',
  spino: '#3F51B5',
  ptera: '#00BCD4',
  tric: '#8BC34A',
};

const GAME_LABELS: Record<string, string> = {
  'spell-dino': 'Spelling',
  'dino-match': 'Matching',
  'volcano-escape': 'Volcano',
  'dino-path': 'Dino Path',
  'jungle-explorer': 'Jungle',
  'egg-hunt': 'Egg Hunt',
};

const NEW_THRESHOLD_MS = 5 * 60 * 1000;

interface DetailState {
  slot: CollectionSlot;
  x: number;
  y: number;
  timer: number;
}

export function DinoCollection({ onBack }: { onBack: () => void }) {
  const bgGradRef = useRef<CanvasGradient | null>(null);
  const detailRef = useRef<DetailState | null>(null);
  const sparklesRef = useRef<{ x: number; y: number; seed: number }[]>(
    Array.from({ length: 20 }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      seed: i * 7.3,
    })),
  );

  const { canvasRef } = useGameCanvas({
    width: W,
    height: H,
    title: 'Dino Collection',
    onDraw(ctx, mouse, dt) {
      const slots = getAllSlots();
      const count = getCollectionCount();
      const now = Date.now();

      if (detailRef.current) {
        detailRef.current.timer = Math.min(1, detailRef.current.timer + dt * 4);
      }

      // --- Cave background ---
      if (!bgGradRef.current) {
        bgGradRef.current = ctx.createLinearGradient(0, 0, 0, H);
        bgGradRef.current.addColorStop(0, '#1a0e0a');
        bgGradRef.current.addColorStop(0.15, '#2a1810');
        bgGradRef.current.addColorStop(0.5, '#1e1412');
        bgGradRef.current.addColorStop(0.85, '#261a14');
        bgGradRef.current.addColorStop(1, '#1a0e08');
      }
      ctx.fillStyle = bgGradRef.current;
      ctx.fillRect(0, 0, W, H);

      // cave rock texture
      const th = (a: number, b: number) => {
        const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
        return n - Math.floor(n);
      };
      for (let i = 0; i < 15; i++) {
        const rx = th(i, 20) * W;
        const ry = th(i, 21) * H;
        const rw = 40 + th(i, 22) * 80;
        const rh = 20 + th(i, 23) * 40;
        ctx.fillStyle = `rgba(60,40,30,${0.05 + th(i, 24) * 0.08})`;
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw, rh, th(i, 25) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }

      // stalactites along top
      for (let i = 0; i < 12; i++) {
        const sx = 30 + (i / 11) * (W - 60) + th(i, 30) * 20;
        const sh = 15 + th(i, 31) * 30;
        const sw = 6 + th(i, 32) * 10;
        ctx.fillStyle = `rgba(80,55,40,${0.3 + th(i, 33) * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(sx - sw, 0);
        ctx.lineTo(sx + sw, 0);
        ctx.lineTo(sx + sw * 0.3, sh);
        ctx.lineTo(sx - sw * 0.3, sh * 0.8);
        ctx.fill();
      }

      // torch glow effects on sides
      const drawTorch = (tx: number, ty: number) => {
        const flicker = 0.7 + Math.sin(mouse.time * 8 + tx) * 0.15 + Math.sin(mouse.time * 13 + tx * 2) * 0.1;
        const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, 120 * flicker);
        grad.addColorStop(0, `rgba(255,150,50,${0.25 * flicker})`);
        grad.addColorStop(0.3, `rgba(255,100,20,${0.12 * flicker})`);
        grad.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(tx - 120, ty - 120, 240, 240);

        // torch bracket
        ctx.fillStyle = 'rgba(100,70,40,0.6)';
        ctx.fillRect(tx - 3, ty - 10, 6, 20);
        ctx.fillRect(tx - 8, ty + 6, 16, 4);

        // flame
        ctx.fillStyle = `rgba(255,${180 + Math.sin(mouse.time * 12 + tx) * 40},50,${0.7 * flicker})`;
        ctx.beginPath();
        ctx.ellipse(tx, ty - 14, 5 * flicker, 8 * flicker, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,220,100,${0.5 * flicker})`;
        ctx.beginPath();
        ctx.ellipse(tx, ty - 16, 3 * flicker, 5 * flicker, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      drawTorch(25, 200);
      drawTorch(W - 25, 200);
      drawTorch(25, 420);
      drawTorch(W - 25, 420);

      // title with museum plaque style
      ctx.fillStyle = 'rgba(60,40,25,0.6)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 130, 8, 260, 52, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,140,80,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(W / 2 - 130, 8, 260, 52, 8);
      ctx.stroke();

      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 22px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Dino Museum', W / 2, 34);

      // progress bar
      const barW = 180;
      const barH = 8;
      const barX = W / 2 - barW / 2;
      const barY = 42;
      const pct = count / slots.length;

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 4);
      ctx.fill();

      if (pct > 0) {
        const progGrad = ctx.createLinearGradient(barX, 0, barX + barW * pct, 0);
        progGrad.addColorStop(0, '#FFD700');
        progGrad.addColorStop(1, '#FFA000');
        ctx.fillStyle = progGrad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, Math.max(barH, barW * pct), barH, 4);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '11px Fredoka, sans-serif';
      ctx.fillText(`${count}/${slots.length} discovered`, W / 2, barY + barH + 12);

      const v0Slots = slots.filter((s) => s.version === 0);
      const v1Slots = slots.filter((s) => s.version === 1);

      // v0 section
      const v0Rows = Math.ceil(v0Slots.length / COLS);
      const v0GridW = Math.min(COLS, v0Slots.length) * SLOT_W + (Math.min(COLS, v0Slots.length) - 1) * GAP;
      const v0StartX = (W - v0GridW) / 2;
      const v0StartY = 78;

      drawSectionLabel(ctx, 'Classic Dinos', v0StartX, v0StartY, v0GridW,
        v0Slots.filter((s) => s.record).length, v0Slots.length);

      drawSlotGrid(ctx, v0Slots, v0StartX, v0StartY + 14, mouse.time, mouse.mouseX, mouse.mouseY, now);

      // v1 section
      const v1GridW = Math.min(COLS, v1Slots.length) * SLOT_W + (Math.min(COLS, v1Slots.length) - 1) * GAP;
      const v1StartX = (W - v1GridW) / 2;
      const v1StartY = v0StartY + 14 + v0Rows * (SLOT_H + GAP) + 18;

      drawSectionLabel(ctx, 'Special Dinos', v1StartX, v1StartY, v1GridW,
        v1Slots.filter((s) => s.record).length, v1Slots.length);

      drawSlotGrid(ctx, v1Slots, v1StartX, v1StartY + 14, mouse.time, mouse.mouseX, mouse.mouseY, now);

      // ambient sparkles on discovered slots
      for (const sp of sparklesRef.current) {
        const sx = (sp.x + Math.sin(mouse.time * 0.5 + sp.seed) * 30) % W;
        const sy = (sp.y + Math.cos(mouse.time * 0.3 + sp.seed * 1.3) * 20);
        if (sy < 70 || sy > H - 30) continue;
        const alpha = 0.15 + Math.sin(mouse.time * 3 + sp.seed) * 0.15;
        if (alpha <= 0) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFD700';
        drawSparkle(ctx, sx, sy, 3 + Math.sin(mouse.time * 2 + sp.seed) * 1);
        ctx.restore();
      }

      // footer
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Play games to discover new dinos! Click a dino for details.', W / 2, H - 14);

      // detail popup
      if (detailRef.current) {
        drawDetailPopup(ctx, detailRef.current, mouse.time, mouse.mouseX, mouse.mouseY);
      }

      drawBackButton(ctx, W - 110, 10, mouse.mouseX, mouse.mouseY);
      drawCustomCursor(ctx, mouse.mouseX, mouse.mouseY, !mouse.isTouch, mouse.mouseDown);
    },
  });

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      let clientX: number, clientY: number;
      if ('changedTouches' in e) {
        if (e.changedTouches.length === 0) return;
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = (clientX - rect.left) * (W / rect.width);
      const my = (clientY - rect.top) * (H / rect.height);

      if (mx > W - 110 && mx < W && my > 10 && my < 54) {
        onBack();
        return;
      }

      // close detail popup on any click
      if (detailRef.current) {
        detailRef.current = null;
        return;
      }

      // check slot clicks
      const slots = getAllSlots();
      const v0Slots = slots.filter((s) => s.version === 0);
      const v1Slots = slots.filter((s) => s.version === 1);

      const v0GridW = Math.min(COLS, v0Slots.length) * SLOT_W + (Math.min(COLS, v0Slots.length) - 1) * GAP;
      const v0StartX = (W - v0GridW) / 2;
      const v0StartY = 78 + 14;

      const clicked = findClickedSlot(mx, my, v0Slots, v0StartX, v0StartY);
      if (clicked && clicked.record) {
        detailRef.current = { slot: clicked, x: mx, y: my, timer: 0 };
        return;
      }

      const v0Rows = Math.ceil(v0Slots.length / COLS);
      const v1GridW = Math.min(COLS, v1Slots.length) * SLOT_W + (Math.min(COLS, v1Slots.length) - 1) * GAP;
      const v1StartX = (W - v1GridW) / 2;
      const v1StartY = 78 + 14 + v0Rows * (SLOT_H + GAP) + 18 + 14;

      const clicked2 = findClickedSlot(mx, my, v1Slots, v1StartX, v1StartY);
      if (clicked2 && clicked2.record) {
        detailRef.current = { slot: clicked2, x: mx, y: my, timer: 0 };
      }
    },
    [onBack],
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onTouchEnd={handleClick}
      role="application"
      aria-label="Dino Collection - view your discovered dinosaurs"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W, outline: 'none' }}
    />
  );
}

function findClickedSlot(
  mx: number,
  my: number,
  slots: CollectionSlot[],
  startX: number,
  startY: number,
): CollectionSlot | null {
  for (let i = 0; i < slots.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = startX + col * (SLOT_W + GAP);
    const y = startY + row * (SLOT_H + GAP);
    if (mx > x && mx < x + SLOT_W && my > y && my < y + SLOT_H) {
      return slots[i];
    }
  }
  return null;
}

function drawSectionLabel(
  ctx: CanvasRenderingContext2D,
  title: string,
  x: number,
  y: number,
  gridW: number,
  found: number,
  total: number,
) {
  ctx.fillStyle = 'rgba(180,140,80,0.25)';
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 6, gridW + 12, 18, 4);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,215,0,0.6)';
  ctx.font = 'bold 12px Fredoka, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x, y + 6);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '11px Fredoka, sans-serif';
  ctx.fillText(`${found}/${total}`, x + gridW, y + 6);
}

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 - Math.PI / 4;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
  }
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 1, 0, Math.PI * 2);
  ctx.fill();
}

function drawDinoSilhouette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  species: string,
  version: number,
) {
  const img = getDinoImage(species as any, undefined, 0, version);
  if (!img.complete || img.naturalWidth === 0) return;

  const renderH = size * 1.4;
  const aspect = img.naturalWidth / img.naturalHeight;
  const renderW = renderH * aspect;

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.drawImage(img, x - renderW / 2, y - renderH * 0.4, renderW, renderH);
  ctx.restore();
}

function drawSlotGrid(
  ctx: CanvasRenderingContext2D,
  slots: CollectionSlot[],
  startX: number,
  startY: number,
  time: number,
  mx: number,
  my: number,
  now: number,
) {
  for (let i = 0; i < slots.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = startX + col * (SLOT_W + GAP);
    const y = startY + row * (SLOT_H + GAP);
    const slot = slots[i];
    const discovered = slot.record !== null;
    const color = DINO_COLORS[slot.species] ?? '#4CAF50';
    const isHovered = mx > x && mx < x + SLOT_W && my > y && my < y + SLOT_H;
    const isNew = discovered && (now - slot.record!.firstSeen) < NEW_THRESHOLD_MS;

    // card background
    ctx.fillStyle = discovered
      ? 'rgba(255,255,255,0.15)'
      : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(x, y, SLOT_W, SLOT_H, 12);
    ctx.fill();

    // colored border for discovered
    if (discovered) {
      ctx.save();
      ctx.shadowColor = isHovered ? color : 'transparent';
      ctx.shadowBlur = isHovered ? 10 : 0;
      ctx.strokeStyle = color;
      ctx.globalAlpha = isHovered ? 0.8 : 0.4;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, SLOT_W, SLOT_H, 12);
      ctx.stroke();
      ctx.restore();

      // subtle colored glow at bottom of card
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y + SLOT_H - 25, SLOT_W, 25, [0, 0, 12, 12]);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, SLOT_W, SLOT_H, 12);
      ctx.stroke();
    }

    if (discovered) {
      const bob = Math.sin(time * 2 + i * 0.7) * 2;
      drawDino(ctx, x + SLOT_W / 2, y + 30 + bob, 35, color, false, slot.species, 0, slot.version);

      // sparkle on hover
      if (isHovered) {
        for (let s = 0; s < 3; s++) {
          const sx = x + 10 + Math.sin(time * 4 + s * 2) * (SLOT_W - 20) * 0.5 + (SLOT_W - 20) * 0.5;
          const sy = y + 10 + Math.cos(time * 3 + s * 2.5) * 15 + 15;
          ctx.save();
          ctx.globalAlpha = 0.4 + Math.sin(time * 5 + s) * 0.3;
          ctx.fillStyle = '#FFD700';
          drawSparkle(ctx, sx, sy, 2.5);
          ctx.restore();
        }
      }

      // name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(slot.label, x + SLOT_W / 2, y + SLOT_H - 18);

      // encounters
      if (slot.record) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '9px Fredoka, sans-serif';
        ctx.fillText(`seen ${slot.record.encounters}x`, x + SLOT_W / 2, y + SLOT_H - 7);
      }

      // "NEW!" badge
      if (isNew) {
        const badgeX = x + SLOT_W - 8;
        const badgeY = y + 6;
        const pulse = 0.85 + Math.sin(time * 5) * 0.15;

        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.roundRect(badgeX - 18, badgeY - 6, 22, 13, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NEW', badgeX - 7, badgeY + 4);
        ctx.restore();
      }
    } else {
      // silhouette of the actual dino
      drawDinoSilhouette(ctx, x + SLOT_W / 2, y + 30, 35, slot.species, slot.version);

      // lock icon
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔒', x + SLOT_W / 2, y + 15);

      // name placeholder
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '10px Fredoka, sans-serif';
      ctx.fillText('???', x + SLOT_W / 2, y + SLOT_H - 18);

      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '9px Fredoka, sans-serif';
      ctx.fillText('undiscovered', x + SLOT_W / 2, y + SLOT_H - 7);
    }
  }
}

function drawDetailPopup(
  ctx: CanvasRenderingContext2D,
  detail: DetailState,
  time: number,
  _mx: number,
  _my: number,
) {
  const slot = detail.slot;
  if (!slot.record) return;

  const pw = 360;
  const ph = 320;
  const px = W / 2 - pw / 2;
  const py = H / 2 - ph / 2;
  const color = DINO_COLORS[slot.species] ?? '#4CAF50';
  const t = detail.timer;
  const scale = 0.8 + t * 0.2;

  ctx.save();
  ctx.globalAlpha = t;
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H / 2);

  // backdrop dim
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-W, -H, W * 3, H * 3);

  // popup card
  ctx.fillStyle = 'rgba(30,20,15,0.95)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 20);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 20);
  ctx.stroke();

  // colored top accent
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, pw, 60, [20, 20, 0, 0]);
  ctx.clip();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = color;
  ctx.fillRect(px, py, pw, 60);
  ctx.restore();

  // dino sprite — centered and large
  const bounce = Math.sin(time * 3) * 3;
  drawDino(ctx, px + pw / 2, py + 110 + bounce, 80, color, false, slot.species, 0, slot.version);

  // name
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(slot.label, px + pw / 2, py + 38);

  // version badge
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '13px Fredoka, sans-serif';
  ctx.fillText(slot.version === 0 ? 'Classic' : 'Special', px + pw / 2, py + 55);

  // stats row
  const statsY = py + 195;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Encounters: ${slot.record.encounters}`, px + pw / 2, statsY);

  // found in game
  if (slot.record.foundIn) {
    const gameName = GAME_LABELS[slot.record.foundIn] ?? slot.record.foundIn;
    ctx.fillText(`Found in: ${gameName}`, px + pw / 2, statsY + 20);
  }

  // first seen date
  const date = new Date(slot.record.firstSeen);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  ctx.fillText(`First seen: ${dateStr}`, px + pw / 2, statsY + 40);

  // fun fact
  const facts: Record<string, string> = {
    rex: 'T-Rex had tiny arms but huge jaws!',
    stego: 'Stego had plates on its back!',
    bronto: 'Bronto was super tall and gentle!',
    raptor: 'Raptors were fast and clever!',
    ankylo: 'Ankylo had armor like a tank!',
    para: 'Para had a cool head crest!',
    spino: 'Spino loved swimming in rivers!',
    ptera: 'Ptera could fly through the sky!',
    tric: 'Tric had three awesome horns!',
  };
  const fact = facts[slot.species] ?? '';
  if (fact) {
    ctx.fillStyle = 'rgba(255,215,0,0.6)';
    ctx.font = 'italic 14px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`"${fact}"`, px + pw / 2, py + ph - 25);
  }

  // tap to close hint
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '11px Fredoka, sans-serif';
  ctx.fillText('Click anywhere to close', px + pw / 2, py + ph - 8);

  ctx.restore();
}
