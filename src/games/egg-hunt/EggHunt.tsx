import { useRef, useCallback } from 'react';
import { drawCustomCursor, drawBackButton, drawStickerPopup, drawScore, drawEasyModeButton } from '../shared/draw';
import { getEggImage, EGG_TYPE_COUNT } from '../shared/dino-svgs';
import type { EggStage } from '../shared/dino-svgs';
import { spawnCelebration, updateParticles, drawParticles } from '../shared/particles';
import { playHatch, playPop, playSticker } from '../shared/audio';
import { earnSticker, trackProgress } from '../shared/stickers';
import { isEasyMode, toggleEasyMode } from '../shared/easyMode';
import { getDifficulty } from '../shared/difficulty';
import type { Difficulty } from '../shared/difficulty';
import { useGameCanvas } from '../shared/useGameCanvas';
import type { Particle } from '../shared/types';

const W = 800;
const H = 600;

interface Egg {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  eggType: number;
  stage: EggStage;
  wobble: number;
}

function randomVelocity(difficulty: Difficulty): { vx: number; vy: number } {
  if (difficulty !== 'hard') return { vx: 0, vy: 0 };
  const speed = 55 + Math.random() * 35;
  const angle = Math.random() * Math.PI * 2;
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

let nextEggType = 0;
function spawnEgg(difficulty: Difficulty, existing: Egg[] = []): Egg {
  const size = 90 + Math.random() * 20;
  let x: number, y: number;
  let attempts = 0;
  do {
    x = 100 + Math.random() * (W - 200);
    y = 140 + Math.random() * (H - 310);
    attempts++;
  } while (
    attempts < 50 &&
    existing.some((e) => {
      const minDist = (e.size + size) * 0.45;
      const dx = e.x - x;
      const dy = e.y - y;
      return dx * dx + dy * dy < minDist * minDist;
    })
  );
  const { vx, vy } = randomVelocity(difficulty);
  return { x, y, vx, vy, size, eggType: nextEggType++ % EGG_TYPE_COUNT, stage: 'whole', wobble: 0 };
}

function drawSpriteEgg(ctx: CanvasRenderingContext2D, egg: Egg, time: number) {
  const img = getEggImage(egg.eggType, egg.stage);
  if (!img.complete || img.naturalWidth === 0) return;

  ctx.save();
  const aspect = img.naturalWidth / img.naturalHeight;
  const h = egg.size;
  const w = h * aspect;

  // wobble on click + continuous shake when hatched
  let wobbleAngle = 0;
  if (egg.wobble > 0) {
    wobbleAngle = Math.sin((time - egg.wobble) * 20) * 0.08 * Math.max(0, 1 - (time - egg.wobble) * 3);
  }
  if (egg.stage === 'hatched') {
    wobbleAngle += Math.sin(time * 12) * 0.04 + Math.sin(time * 17) * 0.02;
  }

  ctx.translate(egg.x, egg.y);
  ctx.rotate(wobbleAngle);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.4, w * 0.35, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function EggHunt({ onBack }: { onBack: () => void }) {
  const initialDiff = getDifficulty();
  const stateRef = useRef({
    eggs: (() => {
      const eggs: Egg[] = [];
      for (let i = 0; i < 3; i++) eggs.push(spawnEgg(initialDiff, eggs));
      return eggs;
    })(),
    difficulty: initialDiff,
    particles: [] as Particle[],
    hatched: 0,
    stickerPopup: '',
    stickerPopupTimer: 0,
    hatchPopupTimer: 0,
    hatchPopupEggType: 0,
    bgGrad: null as CanvasGradient | null,
    easyMode: isEasyMode(),
    gameTime: 0,
  });

  const { canvasRef, safeTimeout } = useGameCanvas({
    width: W,
    height: H,
    title: 'Dino Egg Hunt',
    onDraw(ctx, mouse, dt) {
      const s = stateRef.current;
      s.gameTime = mouse.time;

      if (s.stickerPopupTimer > 0) s.stickerPopupTimer -= dt;
      if (s.hatchPopupTimer > 0) s.hatchPopupTimer -= dt;
      s.particles = updateParticles(s.particles, dt);

      // egg drift (hard mode): whole eggs float around and bounce off bounds
      for (const egg of s.eggs) {
        if (egg.stage !== 'whole') {
          egg.vx = 0;
          egg.vy = 0;
          continue;
        }
        if (egg.vx === 0 && egg.vy === 0) continue;
        egg.x += egg.vx * dt;
        egg.y += egg.vy * dt;
        const halfW = egg.size * 0.45;
        const halfH = egg.size * 0.55;
        if (egg.x < halfW + 20) { egg.x = halfW + 20; egg.vx = Math.abs(egg.vx); }
        if (egg.x > W - halfW - 20) { egg.x = W - halfW - 20; egg.vx = -Math.abs(egg.vx); }
        if (egg.y < halfH + 60) { egg.y = halfH + 60; egg.vy = Math.abs(egg.vy); }
        if (egg.y > H - halfH - 60) { egg.y = H - halfH - 60; egg.vy = -Math.abs(egg.vy); }
      }

      if (!s.bgGrad) {
        s.bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        s.bgGrad.addColorStop(0, '#5BA3CF');
        s.bgGrad.addColorStop(0.35, '#7DBDE5');
        s.bgGrad.addColorStop(0.5, '#4A8C3F');
        s.bgGrad.addColorStop(0.75, '#3B7A30');
        s.bgGrad.addColorStop(1, '#2D5E24');
      }
      ctx.fillStyle = s.bgGrad;
      ctx.fillRect(0, 0, W, H);

      // distant mountains
      ctx.fillStyle = '#6B9B5A';
      ctx.beginPath();
      ctx.moveTo(0, H * 0.5);
      ctx.lineTo(80, H * 0.32);
      ctx.lineTo(180, H * 0.45);
      ctx.lineTo(280, H * 0.28);
      ctx.lineTo(380, H * 0.42);
      ctx.lineTo(500, H * 0.3);
      ctx.lineTo(620, H * 0.4);
      ctx.lineTo(720, H * 0.33);
      ctx.lineTo(W, H * 0.45);
      ctx.lineTo(W, H * 0.5);
      ctx.closePath();
      ctx.fill();

      // clouds
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 190 + mouse.time * 12) % (W + 120)) - 60;
        const cy = 35 + i * 22;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 45, 16, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 25, cy - 5, 30, 14, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - 20, cy + 2, 25, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // prehistoric ferns (background layer)
      const fh = (i: number, s: number) => Math.sin(i * 127.1 + s * 311.7) * 43758.5453 % 1;
      for (let i = 0; i < 12; i++) {
        const fx = (i * 72 + 20) % W;
        const fy = H * 0.48 + Math.abs(fh(i, 0)) * H * 0.12;
        const fsize = 18 + Math.abs(fh(i, 1)) * 14;
        ctx.fillStyle = `rgba(50,${120 + Math.abs(fh(i, 2)) * 40},35,0.6)`;
        for (let j = -2; j <= 2; j++) {
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          const angle = -Math.PI / 2 + j * 0.35;
          ctx.quadraticCurveTo(
            fx + Math.cos(angle) * fsize * 0.6,
            fy + Math.sin(angle) * fsize * 0.6 - 5,
            fx + Math.cos(angle + 0.2) * fsize,
            fy + Math.sin(angle + 0.2) * fsize
          );
          ctx.quadraticCurveTo(
            fx + Math.cos(angle) * fsize * 0.4,
            fy + Math.sin(angle) * fsize * 0.4,
            fx, fy
          );
          ctx.fill();
        }
      }

      // grass tufts scattered across ground
      for (let i = 0; i < 30; i++) {
        const gx = (i * 28 + 5) % W;
        const gy = H * 0.52 + (i % 7) * 30 + Math.abs(fh(i, 3)) * 40;
        const gh = 8 + Math.abs(fh(i, 4)) * 10;
        ctx.fillStyle = `rgba(55,${130 + Math.abs(fh(i, 5)) * 40},40,0.5)`;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 3, gy - gh);
        ctx.lineTo(gx + 1, gy - gh * 0.7);
        ctx.lineTo(gx + 4, gy - gh * 0.9);
        ctx.lineTo(gx + 2, gy);
        ctx.fill();
      }

      // draw eggs
      for (const egg of s.eggs) {
        drawSpriteEgg(ctx, egg, mouse.time);

        // hover glow on clickable eggs
        if (egg.stage !== 'grown') {
          const dx = mouse.mouseX - egg.x;
          const dy = mouse.mouseY - egg.y;
          if (dx * dx + dy * dy < (egg.size * 0.6) ** 2) {
            ctx.save();
            ctx.shadowColor = 'rgba(255,255,100,0.8)';
            ctx.shadowBlur = 20;
            ctx.fillStyle = 'rgba(255,255,100,0.15)';
            ctx.beginPath();
            ctx.ellipse(egg.x, egg.y, egg.size * 0.4, egg.size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      drawParticles(ctx, s.particles);

      // easy mode hint
      if (s.easyMode) {
        const target = s.eggs.find((e) => e.stage !== 'grown');
        if (target) {
          const pulse = 0.5 + Math.sin(mouse.time * 3) * 0.5;
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.strokeStyle = '#FF6D00';
          ctx.lineWidth = 4;
          ctx.shadowColor = 'rgba(255,100,0,0.6)';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.ellipse(target.x, target.y, target.size * 0.4, target.size * 0.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.globalAlpha = 0.7 + Math.sin(mouse.time * 4) * 0.3;
          ctx.font = 'bold 18px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.strokeText('Tap!', target.x, target.y - target.size * 0.55);
          ctx.fillStyle = '#FF6D00';
          ctx.fillText('Tap!', target.x, target.y - target.size * 0.55);
          ctx.restore();
        }
      }

      drawScore(ctx, '🐣', s.hatched);
      drawEasyModeButton(ctx, 100, 14, mouse.mouseX, mouse.mouseY, s.easyMode);

      // Hatch popup — shows the "grown" sprite
      if (s.hatchPopupTimer > 0) {
        const grownImg = getEggImage(s.hatchPopupEggType, 'grown');
        if (grownImg.complete && grownImg.naturalWidth > 0) {
          ctx.save();
          const cx = W / 2;
          const cy = H / 2 - 20;

          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.45, s.hatchPopupTimer * 0.5)})`;
          ctx.fillRect(0, 0, W, H);

          const enter = Math.min(1, (2.5 - s.hatchPopupTimer) * 4);
          const scale = 0.5 + enter * 0.5;
          const alpha = Math.min(1, s.hatchPopupTimer * 1.5);

          ctx.globalAlpha = alpha;
          ctx.translate(cx, cy);
          ctx.scale(scale, scale);
          ctx.translate(-cx, -cy);

          ctx.shadowColor = 'rgba(255,215,0,0.5)';
          ctx.shadowBlur = 25;

          const cardW = 280;
          const cardH = 300;
          ctx.fillStyle = 'rgba(20,20,40,0.92)';
          ctx.beginPath();
          ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 24);
          ctx.fill();

          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 24);
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.fillStyle = 'rgba(255,215,0,0.6)';
          ctx.font = 'bold 16px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🐣 Hatched! 🐣', cx, cy - cardH / 2 + 35);

          const dinoSize = 160;
          const aspect = grownImg.naturalWidth / grownImg.naturalHeight;
          const dw = dinoSize * aspect;
          const dh = dinoSize;
          const bounce = Math.sin(mouse.time * 4) * 5;
          ctx.drawImage(grownImg, cx - dw / 2, cy - dh / 2 + 15 + bounce, dw, dh);

          ctx.fillStyle = '#FFD700';
          ctx.font = 'bold 22px Fredoka, sans-serif';
          ctx.fillText('A new baby dino!', cx, cy + cardH / 2 - 30);

          ctx.restore();
        }
      }

      drawStickerPopup(ctx, s.stickerPopup, s.stickerPopupTimer, W, H);
      drawBackButton(ctx, W - 110, 10, mouse.mouseX, mouse.mouseY);
      drawCustomCursor(ctx, mouse.mouseX, mouse.mouseY, !mouse.isTouch, mouse.mouseDown);
    },
  });

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      let clientX: number, clientY: number;
      if ('touches' in e) {
        if (e.changedTouches.length === 0) return;
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const mx = (clientX - rect.left) * (W / rect.width);
      const my = (clientY - rect.top) * (H / rect.height);
      const s = stateRef.current;

      if (mx > 100 && mx < 180 && my > 14 && my < 48) {
        s.easyMode = toggleEasyMode();
        s.difficulty = getDifficulty();
        // if the new difficulty is hard, set drift velocities on any currently-whole eggs
        for (const egg of s.eggs) {
          if (egg.stage === 'whole') {
            if (s.difficulty === 'hard' && egg.vx === 0 && egg.vy === 0) {
              const v = randomVelocity('hard');
              egg.vx = v.vx;
              egg.vy = v.vy;
            } else if (s.difficulty !== 'hard') {
              egg.vx = 0;
              egg.vy = 0;
            }
          }
        }
        return;
      }
      if (mx > W - 110 && mx < W && my > 10 && my < 54) {
        onBack();
        return;
      }

      for (const egg of s.eggs) {
        if (egg.stage === 'grown') continue;
        const dx = mx - egg.x;
        const dy = my - egg.y;
        const hitMult = s.easyMode ? 0.8 : 0.5;
        if (dx * dx + dy * dy < (egg.size * hitMult) ** 2) {
          playPop();
          egg.wobble = s.gameTime;
          s.particles.push(...spawnCelebration(egg.x, egg.y, 6));

          if (egg.stage === 'whole') {
            egg.stage = 'broken';
          } else if (egg.stage === 'broken') {
            egg.stage = 'hatched';
          } else if (egg.stage === 'hatched') {
            egg.stage = 'grown';
            s.hatched++;
            playHatch();
            s.particles.push(...spawnCelebration(egg.x, egg.y, 20));

            s.hatchPopupEggType = egg.eggType;
            s.hatchPopupTimer = 2.5;

            safeTimeout(() => {
              const idx = s.eggs.indexOf(egg);
              if (idx !== -1) {
                s.eggs.splice(idx, 1);
                const others = s.eggs.filter((e) => e.stage !== 'grown');
                s.eggs.push(spawnEgg(s.difficulty, others));
              }
            }, 2500);

            const total = trackProgress('egg-hunt');
            if (total === 1) {
              earnSticker('egg-hunt-1');
              s.stickerPopup = '🥚 First Hatch!';
              s.stickerPopupTimer = 3;
              playSticker();
            } else if (total === 5) {
              earnSticker('egg-hunt-5');
              s.stickerPopup = '🐣 Egg Expert!';
              s.stickerPopupTimer = 3;
              playSticker();
            }
          }
          break;
        }
      }
    },
    [onBack, safeTimeout],
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onTouchEnd={handleClick}
      role="application"
      aria-label="Dino Egg Hunt - click eggs to hatch baby dinosaurs"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W }}
    />
  );
}
