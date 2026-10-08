import { useRef, useCallback } from 'react';
import { drawCustomCursor } from '../games/shared/draw';
import { useGameCanvas } from '../games/shared/useGameCanvas';
import { playPop, playCelebration } from '../games/shared/audio';
import {
  AVATAR_SPECIES,
  AVATAR_COLORS,
  drawAvatarSprite,
  setAvatar,
} from '../games/shared/avatar';
import type { Avatar } from '../games/shared/avatar';
import { getActiveProfile } from '../games/shared/profile';
import { spawnCelebration, updateParticles, drawParticles } from '../games/shared/particles';
import type { Particle } from '../games/shared/types';

const W = 800;
const H = 600;

interface Hit {
  kind: 'species' | 'next';
  index?: number;
  rect: { x: number; y: number; w: number; h: number };
}

export function DinoCreation({ onDone }: { onDone: () => void }) {
  const speciesRef = useRef(0);
  const hitsRef = useRef<Hit[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  const finish = useCallback(() => {
    const avatar: Avatar = {
      species: AVATAR_SPECIES[speciesRef.current].species,
      color: AVATAR_COLORS[0].value,
    };
    setAvatar(avatar);
    playCelebration();
    onDone();
  }, [onDone]);

  const { canvasRef } = useGameCanvas({
    width: W,
    height: H,
    title: 'Meet your dino',
    onDraw(ctx, mouse, dt) {
      particlesRef.current = updateParticles(particlesRef.current, dt);
      const hits: Hit[] = [];

      // background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#7DC4E8');
      bg.addColorStop(0.5, '#A8D8A8');
      bg.addColorStop(1, '#6BA67A');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // sparkles
      for (let i = 0; i < 18; i++) {
        const sx = ((i * 137) % W);
        const sy = 40 + ((i * 73) % 240);
        const a = 0.15 + Math.sin(mouse.time * 1.6 + i) * 0.15;
        if (a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#FFFDE7';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const speciesIdx = speciesRef.current;

      // title
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.font = 'bold 38px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText('Pick your dino!', W / 2, 70);
      ctx.fillText('Pick your dino!', W / 2, 70);

      // subtitle: active profile
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '14px Fredoka, sans-serif';
      ctx.fillText(`Choosing for ${getActiveProfile()}`, W / 2, 94);

      // preview dino (large, as egg — what they start as)
      const previewCx = W / 2;
      const previewCy = 210;
      const bob = Math.sin(mouse.time * 2.5) * 5;
      drawAvatarSprite(
        ctx,
        previewCx,
        previewCy + bob,
        110,
        AVATAR_SPECIES[speciesIdx].species,
        0, // egg stage — starts as egg
      );

      // hint beneath preview
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '16px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Earn stickers to help your dino grow!', W / 2, 310);

      // species picker row — show the Grown form so kids know what they'll get
      const rowY = 355;
      const gap = 14;
      const boxW = 130;
      const boxH = 160;
      const totalW = AVATAR_SPECIES.length * boxW + (AVATAR_SPECIES.length - 1) * gap;
      const startX = (W - totalW) / 2;

      for (let i = 0; i < AVATAR_SPECIES.length; i++) {
        const x = startX + i * (boxW + gap);
        const y = rowY;
        const selected = i === speciesIdx;
        const hovered =
          mouse.mouseX >= x && mouse.mouseX <= x + boxW &&
          mouse.mouseY >= y && mouse.mouseY <= y + boxH;

        ctx.save();
        ctx.fillStyle = selected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.roundRect(x, y, boxW, boxH, 16);
        ctx.fill();
        if (selected || hovered) {
          ctx.shadowColor = selected ? 'rgba(76,175,80,0.6)' : 'rgba(255,255,255,0.4)';
          ctx.shadowBlur = selected ? 18 : 10;
          ctx.strokeStyle = selected ? '#4CAF50' : 'rgba(255,255,255,0.9)';
          ctx.lineWidth = selected ? 4 : 2;
          ctx.beginPath();
          ctx.roundRect(x, y, boxW, boxH, 16);
          ctx.stroke();
        }
        ctx.restore();

        const sBob = selected ? Math.sin(mouse.time * 4) * 3 : 0;
        drawAvatarSprite(
          ctx,
          x + boxW / 2,
          y + boxH / 2 - 12 + sBob,
          60,
          AVATAR_SPECIES[i].species,
          6, // show the grown form so kids know what they'll become
        );

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.font = 'bold 13px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(AVATAR_SPECIES[i].label, x + boxW / 2, y + boxH - 14);

        hits.push({ kind: 'species', index: i, rect: { x, y, w: boxW, h: boxH } });
      }

      // next/done button
      const btnW = 200;
      const btnH = 54;
      const btnX = (W - btnW) / 2;
      const btnY = H - 90;
      const btnHover =
        mouse.mouseX >= btnX && mouse.mouseX <= btnX + btnW &&
        mouse.mouseY >= btnY && mouse.mouseY <= btnY + btnH;

      ctx.save();
      const btnPulse = 1 + Math.sin(mouse.time * 3) * 0.03;
      ctx.shadowColor = 'rgba(76,175,80,0.5)';
      ctx.shadowBlur = btnHover ? 20 : 12;
      ctx.fillStyle = '#4CAF50';
      ctx.translate(btnX + btnW / 2, btnY + btnH / 2);
      ctx.scale(btnPulse, btnPulse);
      ctx.translate(-(btnX + btnW / 2), -(btnY + btnH / 2));
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 14);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("That's my egg!", btnX + btnW / 2, btnY + btnH / 2 + 7);
      hits.push({ kind: 'next', rect: { x: btnX, y: btnY, w: btnW, h: btnH } });

      drawParticles(ctx, particlesRef.current);
      drawCustomCursor(ctx, mouse.mouseX, mouse.mouseY, !mouse.isTouch, mouse.mouseDown);

      hitsRef.current = hits;
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

      for (const hit of hitsRef.current) {
        if (
          mx >= hit.rect.x && mx <= hit.rect.x + hit.rect.w &&
          my >= hit.rect.y && my <= hit.rect.y + hit.rect.h
        ) {
          if (hit.kind === 'species' && hit.index !== undefined) {
            speciesRef.current = hit.index;
            playPop();
            particlesRef.current.push(
              ...spawnCelebration(hit.rect.x + hit.rect.w / 2, hit.rect.y + hit.rect.h / 2, 4),
            );
          } else if (hit.kind === 'next') {
            finish();
          }
          break;
        }
      }
    },
    [finish],
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onTouchEnd={handleClick}
      role="application"
      aria-label="Create your baby dinosaur"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W }}
    />
  );
}
