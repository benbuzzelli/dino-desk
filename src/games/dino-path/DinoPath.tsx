import { useRef, useCallback } from 'react';
import { drawDino, drawCustomCursor, drawBackButton, drawStickerPopup, drawScore, drawInstructions, drawEasyModeButton } from '../shared/draw';
import { spawnCelebration, updateParticles, drawParticles } from '../shared/particles';
import { playStep, playCelebration, playSticker } from '../shared/audio';
import { earnSticker, trackProgress } from '../shared/stickers';
import { isEasyMode, toggleEasyMode } from '../shared/easyMode';
import { getDifficulty } from '../shared/difficulty';
import type { Difficulty } from '../shared/difficulty';
import { trackDinoEncounter } from '../shared/collection';
import { useGameCanvas } from '../shared/useGameCanvas';
import type { Particle, Point } from '../shared/types';

const W = 800;
const H = 600;

const PATHS: Point[][] = [
  // gentle wide curve
  Array.from({ length: 14 }, (_, i) => ({
    x: 100 + i * 45,
    y: 300 + Math.sin(i * 0.35) * 60,
  })),
  // gentle S-curve
  Array.from({ length: 14 }, (_, i) => ({
    x: 80 + i * 48,
    y: 300 + Math.sin(i * 0.45) * 80,
  })),
  // mild zigzag (toddler-friendly)
  Array.from({ length: 12 }, (_, i) => ({
    x: 100 + i * 52,
    y: i % 2 === 0 ? 260 : 340,
  })),
  // gentle loop
  Array.from({ length: 16 }, (_, i) => ({
    x: 400 + Math.cos(i * 0.45) * (60 + i * 6),
    y: 300 + Math.sin(i * 0.45) * (60 + i * 6),
  })),
];

interface Decoy {
  forkIdx: number;    // main-path dot where the decoy branches off
  dots: Point[];      // decoy dots; last one is the dead-end
}

interface Level {
  path: Point[];
  decoy?: Decoy;
}

// Hard paths: longer, twistier, with one decoy branch each
const HARD_LEVELS: Level[] = [
  // long S with upward decoy
  {
    path: Array.from({ length: 18 }, (_, i) => ({
      x: 70 + i * 40,
      y: 310 + Math.sin(i * 0.5) * 90,
    })),
    decoy: {
      forkIdx: 6,
      dots: [
        { x: 330, y: 210 },
        { x: 370, y: 160 },
        { x: 420, y: 120 },
        { x: 470, y: 90 },
      ],
    },
  },
  // gentle curve with downward decoy
  {
    path: Array.from({ length: 16 }, (_, i) => ({
      x: 90 + i * 45,
      y: 280 + Math.sin(i * 0.4) * 70,
    })),
    decoy: {
      forkIdx: 9,
      dots: [
        { x: 545, y: 410 },
        { x: 555, y: 465 },
        { x: 550, y: 520 },
      ],
    },
  },
  // zigzag with side decoy
  {
    path: Array.from({ length: 15 }, (_, i) => ({
      x: 90 + i * 45,
      y: 260 + (i % 2 === 0 ? 0 : 80),
    })),
    decoy: {
      forkIdx: 5,
      dots: [
        { x: 330, y: 200 },
        { x: 320, y: 145 },
        { x: 300, y: 100 },
      ],
    },
  },
];

function getLevel(level: number, difficulty: Difficulty): Level {
  if (difficulty === 'hard') {
    return HARD_LEVELS[level % HARD_LEVELS.length];
  }
  return { path: PATHS[level % PATHS.length] };
}

function getPath(level: number): Point[] {
  return PATHS[level % PATHS.length];
}

export function DinoPath({ onBack }: { onBack: () => void }) {
  const initialDiff = getDifficulty();
  const initialLevel = getLevel(0, initialDiff);
  const stateRef = useRef({
    levelData: initialLevel,
    path: initialLevel.path,
    decoy: initialLevel.decoy,
    nextDot: 1,
    onDecoy: false,
    decoyStep: 0,
    particles: [] as Particle[],
    completed: 0,
    level: 0,
    dinoPos: { x: initialLevel.path[0].x, y: initialLevel.path[0].y },
    trail: [] as Point[],
    celebrating: 0,
    stickerPopup: '',
    stickerPopupTimer: 0,
    mouseDown: false,
    bgGrad: null as CanvasGradient | null,
    easyMode: isEasyMode(),
    difficulty: initialDiff,
  });

  const onMouseDown = useCallback(() => { stateRef.current.mouseDown = true; }, []);
  const onMouseUp = useCallback(() => { stateRef.current.mouseDown = false; }, []);

  const { canvasRef, mouseState, safeTimeout } = useGameCanvas({
    width: W,
    height: H,
    title: 'Dino Path',
    onMouseDown,
    onMouseUp,
    onDraw(ctx, mouse, dt) {
      const s = stateRef.current;

      if (s.stickerPopupTimer > 0) s.stickerPopupTimer -= dt;
      s.particles = updateParticles(s.particles, dt);

      if (s.mouseDown && s.celebrating <= 0) {
        const hitR = s.easyMode ? 65 : 40;

        const tryHit = (target: Point) => {
          const dx = mouse.mouseX - target.x;
          const dy = mouse.mouseY - target.y;
          return dx * dx + dy * dy < hitR * hitR;
        };

        if (s.onDecoy && s.decoy) {
          // travelling along the decoy
          const decoyDots = s.decoy.dots;
          if (s.decoyStep < decoyDots.length) {
            const target = decoyDots[s.decoyStep];
            if (tryHit(target)) {
              playStep();
              s.particles.push(...spawnCelebration(target.x, target.y, 3));
              s.dinoPos = { x: target.x, y: target.y };
              s.trail.push({ x: target.x, y: target.y });
              s.decoyStep++;
            }
          } else {
            // at the dead-end — tap the fork dot to return
            const forkDot = s.path[s.decoy.forkIdx];
            if (tryHit(forkDot)) {
              playStep();
              s.particles.push(...spawnCelebration(forkDot.x, forkDot.y, 4));
              s.dinoPos = { x: forkDot.x, y: forkDot.y };
              s.trail.push({ x: forkDot.x, y: forkDot.y });
              s.onDecoy = false;
              s.decoyStep = 0;
            }
          }
        } else {
          // on main path
          const target = s.path[s.nextDot];
          if (target && tryHit(target)) {
            playStep();
            s.particles.push(...spawnCelebration(target.x, target.y, 4));
            s.dinoPos = { x: target.x, y: target.y };
            s.trail.push({ x: target.x, y: target.y });
            s.nextDot++;

            if (s.nextDot >= s.path.length) {
              s.completed++;
              s.celebrating = 2;
              playCelebration();
              s.particles.push(...spawnCelebration(target.x, target.y, 25));
              trackDinoEncounter('bronto', 0, 'dino-path');

              const total = trackProgress('dino-path');
              if (total === 1) {
                earnSticker('dino-path-1');
                s.stickerPopup = '🦶 First Steps!';
                s.stickerPopupTimer = 3;
                playSticker();
              } else if (total === 3) {
                earnSticker('dino-path-3');
                s.stickerPopup = '🌟 Path Finder!';
                s.stickerPopupTimer = 3;
                playSticker();
              }

              safeTimeout(() => {
                s.level++;
                const next = getLevel(s.level, s.difficulty);
                s.levelData = next;
                s.path = next.path;
                s.decoy = next.decoy;
                s.nextDot = 1;
                s.onDecoy = false;
                s.decoyStep = 0;
                s.dinoPos = { x: next.path[0].x, y: next.path[0].y };
                s.trail = [{ x: next.path[0].x, y: next.path[0].y }];
                s.celebrating = 0;
              }, 2200);
            }
          } else if (s.decoy && s.nextDot === s.decoy.forkIdx + 1) {
            // at the fork — the decoy entry dot is also hittable
            const decoyEntry = s.decoy.dots[0];
            if (tryHit(decoyEntry)) {
              playStep();
              s.particles.push(...spawnCelebration(decoyEntry.x, decoyEntry.y, 3));
              s.dinoPos = { x: decoyEntry.x, y: decoyEntry.y };
              s.trail.push({ x: decoyEntry.x, y: decoyEntry.y });
              s.onDecoy = true;
              s.decoyStep = 1;
            }
          }
        }
      }

      if (s.celebrating > 0) s.celebrating -= dt;

      if (!s.bgGrad) {
        s.bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        s.bgGrad.addColorStop(0, '#6BB8D9');
        s.bgGrad.addColorStop(0.25, '#8DC8E0');
        s.bgGrad.addColorStop(0.4, '#D4C490');
        s.bgGrad.addColorStop(0.6, '#C4AD70');
        s.bgGrad.addColorStop(1, '#A89055');
      }
      ctx.fillStyle = s.bgGrad;
      ctx.fillRect(0, 0, W, H);

      const th = (a: number, b: number) => {
        const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
        return n - Math.floor(n);
      };

      // distant volcanoes / mountains
      ctx.fillStyle = '#8B9E6B';
      ctx.beginPath();
      ctx.moveTo(0, H * 0.42);
      ctx.lineTo(60, H * 0.28);
      ctx.lineTo(130, H * 0.38);
      ctx.lineTo(220, H * 0.22);
      ctx.lineTo(280, H * 0.35);
      ctx.lineTo(W, H * 0.4);
      ctx.lineTo(W, H * 0.42);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#7A8E5C';
      ctx.beginPath();
      ctx.moveTo(W * 0.5, H * 0.42);
      ctx.lineTo(W * 0.65, H * 0.25);
      ctx.lineTo(W * 0.75, H * 0.35);
      ctx.lineTo(W * 0.88, H * 0.2);
      ctx.lineTo(W, H * 0.32);
      ctx.lineTo(W, H * 0.42);
      ctx.closePath();
      ctx.fill();

      // clouds
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 210 + mouse.time * 10) % (W + 100)) - 50;
        const cy = 30 + i * 20;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 40, 14, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 22, cy - 4, 28, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // scattered rocks on sandy ground
      for (let i = 0; i < 10; i++) {
        const rx = th(i, 10) * W;
        const ry = H * 0.5 + th(i, 11) * H * 0.45;
        const rw = 8 + th(i, 12) * 15;
        const rh = 5 + th(i, 13) * 8;
        ctx.fillStyle = `rgba(160,140,100,${0.2 + th(i, 14) * 0.15})`;
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(180,160,120,${0.15 + th(i, 15) * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(rx - 1, ry - 1, rw * 0.7, rh * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // prehistoric plants at edges
      for (let i = 0; i < 8; i++) {
        const px = th(i, 20) * W;
        const py = H * 0.45 + th(i, 21) * H * 0.5;
        const ps = 12 + th(i, 22) * 16;
        ctx.fillStyle = `rgba(80,${130 + th(i, 23) * 40},50,0.3)`;
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          const angle = -Math.PI / 2 + j * 0.5;
          ctx.quadraticCurveTo(
            px + Math.cos(angle) * ps * 0.5, py + Math.sin(angle) * ps * 0.5,
            px + Math.cos(angle + 0.2) * ps, py + Math.sin(angle + 0.2) * ps
          );
          ctx.lineTo(px, py);
          ctx.fill();
        }
      }

      // dotted path
      ctx.setLineDash([8, 12]);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < s.path.length; i++) {
        if (i === 0) ctx.moveTo(s.path[i].x, s.path[i].y);
        else ctx.lineTo(s.path[i].x, s.path[i].y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // completed trail
      if (s.trail.length > 1) {
        ctx.strokeStyle = 'rgba(76,175,80,0.5)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(s.trail[0].x, s.trail[0].y);
        for (let i = 1; i < s.trail.length; i++) {
          ctx.lineTo(s.trail[i].x, s.trail[i].y);
        }
        ctx.stroke();
      }

      // dots
      for (let i = 0; i < s.path.length; i++) {
        const p = s.path[i];
        const isNext = i === s.nextDot;
        const isDone = i < s.nextDot;

        if (isDone) {
          ctx.fillStyle = '#4CAF50';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✓', p.x, p.y + 4);
        } else if (isNext) {
          const pulse = 1 + Math.sin(mouse.time * 4) * 0.3;
          ctx.fillStyle = '#FF6B6B';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 20 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 9 * pulse, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        if (i === s.path.length - 1 && !isDone) {
          ctx.font = '24px serif';
          ctx.textAlign = 'center';
          ctx.fillText('🏠', p.x, p.y - 22);
        }
      }

      // decoy branch rendering (hard mode)
      if (s.decoy) {
        const decoyDots = s.decoy.dots;
        const fork = s.path[s.decoy.forkIdx];

        // dotted line from fork through decoy
        ctx.setLineDash([6, 10]);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fork.x, fork.y);
        for (const d of decoyDots) ctx.lineTo(d.x, d.y);
        ctx.stroke();
        ctx.setLineDash([]);

        for (let i = 0; i < decoyDots.length; i++) {
          const d = decoyDots[i];
          const isLast = i === decoyDots.length - 1;
          const isDone = s.onDecoy && i < s.decoyStep;
          const isNextDecoy = s.onDecoy && i === s.decoyStep;
          const isEntryNext = !s.onDecoy && i === 0 && s.nextDot === s.decoy.forkIdx + 1;

          if (isDone) {
            ctx.fillStyle = '#BDBDBD';
            ctx.beginPath();
            ctx.arc(d.x, d.y, 7, 0, Math.PI * 2);
            ctx.fill();
          } else if (isNextDecoy || isEntryNext) {
            const pulse = 1 + Math.sin(mouse.time * 4) * 0.3;
            ctx.fillStyle = '#FFA726';
            ctx.beginPath();
            ctx.arc(d.x, d.y, 18 * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(d.x, d.y, 8 * pulse, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.beginPath();
            ctx.arc(d.x, d.y, 9, 0, Math.PI * 2);
            ctx.fill();
          }

          // dead-end marker on the last decoy dot
          if (isLast) {
            const pulseDE = s.onDecoy && s.decoyStep >= decoyDots.length
              ? 1 + Math.sin(mouse.time * 5) * 0.15
              : 1;
            ctx.save();
            ctx.shadowColor = 'rgba(244,67,54,0.5)';
            ctx.shadowBlur = s.onDecoy && s.decoyStep >= decoyDots.length ? 14 : 6;
            ctx.font = `${Math.round(22 * pulseDE)}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText('❌', d.x, d.y - 22);
            ctx.restore();
          }
        }

        // helper text when at the dead-end
        if (s.onDecoy && s.decoyStep >= decoyDots.length) {
          ctx.save();
          ctx.font = 'bold 14px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.strokeText('Dead end, go back!', fork.x, fork.y - 28);
          ctx.fillStyle = '#FFCC80';
          ctx.fillText('Dead end, go back!', fork.x, fork.y - 28);
          ctx.restore();
        }
      }

      // easy mode: pulsing guide line + "Go here!" on next dot
      if (s.easyMode && s.nextDot < s.path.length && s.celebrating <= 0) {
        const target = s.path[s.nextDot];
        const pulse = 0.4 + Math.sin(mouse.time * 3) * 0.3;

        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#FF6D00';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(s.dinoPos.x, s.dinoPos.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 0.7 + Math.sin(mouse.time * 4) * 0.3;
        ctx.font = 'bold 14px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText('Go here!', target.x, target.y - 30);
        ctx.fillStyle = '#FF6D00';
        ctx.fillText('Go here!', target.x, target.y - 30);
        ctx.restore();
      }

      // dino
      const bounce = Math.sin(mouse.time * 3) * 3;
      const facingLeft = s.nextDot < s.path.length && s.path[s.nextDot].x < s.dinoPos.x;
      drawDino(ctx, s.dinoPos.x, s.dinoPos.y + bounce - 10, 45, '#4CAF50', facingLeft, 'bronto');

      drawParticles(ctx, s.particles);

      if (s.celebrating > 0) {
        ctx.save();
        ctx.font = 'bold 36px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText('Great job! 🎉', W / 2, 50);
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FFD700';
        ctx.fillText('Great job! 🎉', W / 2, 50);
        ctx.restore();
      } else {
        drawInstructions(ctx, 'Hold the mouse button and follow the dots!', W / 2, 50);
      }

      drawScore(ctx, '⭐', s.completed);

      drawEasyModeButton(ctx, 100, 14, mouse.mouseX, mouse.mouseY, s.easyMode);
      drawStickerPopup(ctx, s.stickerPopup, s.stickerPopupTimer, W, H);
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
      if (mx > 100 && mx < 180 && my > 14 && my < 48) {
        const s = stateRef.current;
        s.easyMode = toggleEasyMode();
        s.difficulty = getDifficulty();
        // refresh current level layout in case difficulty crossed the hard boundary
        const refreshed = getLevel(s.level, s.difficulty);
        s.levelData = refreshed;
        s.path = refreshed.path;
        s.decoy = refreshed.decoy;
        s.nextDot = 1;
        s.onDecoy = false;
        s.decoyStep = 0;
        s.dinoPos = { x: refreshed.path[0].x, y: refreshed.path[0].y };
        s.trail = [{ x: refreshed.path[0].x, y: refreshed.path[0].y }];
        return;
      }
      if (mx > W - 110 && mx < W && my > 10 && my < 54) {
        onBack();
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
      aria-label="Dino Path - follow the dots to guide the dinosaur home"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W }}
    />
  );
}
