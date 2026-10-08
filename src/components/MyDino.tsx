import { useRef, useCallback } from 'react';
import { drawCustomCursor, drawBackButton } from '../games/shared/draw';
import { useGameCanvas } from '../games/shared/useGameCanvas';
import { playPop } from '../games/shared/audio';
import {
  getAvatar,
  drawAvatarSprite,
  getEarnedStickerCount,
  getGrowthStage,
  getNextStage,
  GROWTH_STAGES,
  AVATAR_SPECIES,
} from '../games/shared/avatar';

const W = 800;
const H = 600;

export function MyDino({
  onBack,
  onOpenStickerBook,
}: {
  onBack: () => void;
  onOpenStickerBook?: () => void;
}) {
  const backHitRef = useRef({ x: 16, y: 16, w: 100, h: 44 });
  const stickerBtnRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const { canvasRef } = useGameCanvas({
    width: W,
    height: H,
    title: 'My Dino',
    onDraw(ctx, mouse) {
      // background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#FFD8B5');
      bg.addColorStop(0.5, '#FFEAB5');
      bg.addColorStop(1, '#C8E6A0');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // soft sparkles
      for (let i = 0; i < 24; i++) {
        const sx = (i * 137) % W;
        const sy = 30 + ((i * 73) % 240);
        const a = 0.18 + Math.sin(mouse.time * 1.4 + i) * 0.18;
        if (a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const avatar = getAvatar();
      if (!avatar) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 28px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No dino yet!', W / 2, H / 2);
        drawBackButton(ctx, 16, 16, mouse.mouseX, mouse.mouseY);
        drawCustomCursor(ctx, mouse.mouseX, mouse.mouseY, !mouse.isTouch, mouse.mouseDown);
        return;
      }

      const stickers = getEarnedStickerCount();
      const stage = getGrowthStage(stickers);
      const next = getNextStage(stickers);
      const speciesLabel =
        AVATAR_SPECIES.find((s) => s.species === avatar.species)?.label ?? avatar.species;

      // title
      ctx.fillStyle = '#5D4037';
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.font = 'bold 34px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText('My Dino', W / 2, 60);
      ctx.fillText('My Dino', W / 2, 60);

      // big portrait card
      const cardX = 60;
      const cardY = 90;
      const cardW = 360;
      const cardH = 380;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 22);
      ctx.fill();
      ctx.restore();

      const portraitCx = cardX + cardW / 2;
      const portraitCy = cardY + 170;
      const bob = Math.sin(mouse.time * 2.4) * 6;
      drawAvatarSprite(ctx, portraitCx, portraitCy + bob, 150, avatar.species, stage.index);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 26px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stage.name, portraitCx, cardY + 290);

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = '15px Fredoka, sans-serif';
      ctx.fillText(speciesLabel, portraitCx, cardY + 312);

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = '15px Fredoka, sans-serif';
      ctx.fillText(stage.description, portraitCx, cardY + 348);

      // right side: progress + timeline
      const rightX = 460;
      const rightW = 290;
      const rightY = 90;

      // progress card
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(rightX, rightY, rightW, 130, 18);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#333';
      ctx.font = 'bold 18px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⭐ ${stickers} stickers earned`, rightX + 18, rightY + 32);

      if (next) {
        const span = next.threshold - stage.threshold;
        const into = Math.max(0, stickers - stage.threshold);
        const pct = Math.max(0, Math.min(1, span > 0 ? into / span : 1));
        const remaining = Math.max(0, next.threshold - stickers);

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.font = '14px Fredoka, sans-serif';
        ctx.fillText(
          `${remaining} more to grow into ${next.name}`,
          rightX + 18,
          rightY + 56,
        );

        // progress bar
        const barX = rightX + 18;
        const barY = rightY + 72;
        const barW = rightW - 36;
        const barH = 22;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 11);
        ctx.fill();

        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.roundRect(barX, barY, Math.max(barH, barW * pct), barH, 11);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.font = 'bold 13px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(`${stickers - stage.threshold} / ${span}`, barX + barW / 2, barY + barH - 6);
        ctx.fillText(`${stickers - stage.threshold} / ${span}`, barX + barW / 2, barY + barH - 6);
      } else {
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 16px Fredoka, sans-serif';
        ctx.fillText('Fully grown! 🎉', rightX + 18, rightY + 64);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '13px Fredoka, sans-serif';
        ctx.fillText('Keep collecting stickers!', rightX + 18, rightY + 86);
      }

      // timeline card
      const tlY = rightY + 150;
      const tlH = H - tlY - 40;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(rightX, tlY, rightW, tlH, 18);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#333';
      ctx.font = 'bold 16px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Growth journey', rightX + 18, tlY + 26);

      const rowH = 36;
      const rowsTop = tlY + 44;
      for (let i = 0; i < GROWTH_STAGES.length; i++) {
        const s = GROWTH_STAGES[i];
        const y = rowsTop + i * rowH;
        const reached = stickers >= s.threshold;
        const isCurrent = s.index === stage.index;

        // mini sprite
        ctx.save();
        if (!reached) ctx.globalAlpha = 0.35;
        drawAvatarSprite(ctx, rightX + 36, y + rowH / 2 - 4, 18, avatar.species, s.index);
        ctx.restore();

        // text
        ctx.fillStyle = reached ? (isCurrent ? '#2E7D32' : '#333') : 'rgba(0,0,0,0.45)';
        ctx.font = isCurrent ? 'bold 14px Fredoka, sans-serif' : '13px Fredoka, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${s.name}`, rightX + 70, y + rowH / 2 + 5);

        ctx.fillStyle = reached ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)';
        ctx.font = '12px Fredoka, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(
          reached ? '✓ unlocked' : `${s.threshold} stickers`,
          rightX + rightW - 18,
          y + rowH / 2 + 5,
        );
      }

      // "See my stickers" button, bottom-right
      const btnW = 200;
      const btnH = 44;
      const btnX = W - btnW - 24;
      const btnY = H - btnH - 18;
      const btnHover =
        mouse.mouseX >= btnX && mouse.mouseX <= btnX + btnW &&
        mouse.mouseY >= btnY && mouse.mouseY <= btnY + btnH;
      stickerBtnRef.current = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.save();
      ctx.fillStyle = btnHover ? '#FFD54F' : '#FFB300';
      ctx.strokeStyle = '#6F4E37';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = btnHover ? 'rgba(255,213,79,0.5)' : 'transparent';
      ctx.shadowBlur = btnHover ? 14 : 0;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 14);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#3E2723';
      ctx.font = 'bold 17px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐ My Stickers →', btnX + btnW / 2, btnY + btnH / 2 + 1);

      // back button
      drawBackButton(ctx, 16, 16, mouse.mouseX, mouse.mouseY);
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
      const b = backHitRef.current;
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        playPop();
        onBack();
        return;
      }
      const sb = stickerBtnRef.current;
      if (sb && mx >= sb.x && mx <= sb.x + sb.w && my >= sb.y && my <= sb.y + sb.h) {
        playPop();
        onOpenStickerBook?.();
      }
    },
    [onBack, onOpenStickerBook],
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onTouchEnd={handleClick}
      role="application"
      aria-label="My Dino, view your dinosaur's growth"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W }}
    />
  );
}
