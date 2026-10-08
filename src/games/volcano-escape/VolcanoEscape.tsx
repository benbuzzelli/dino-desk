import { useRef, useCallback } from 'react';
import { drawWalkDino, drawCustomCursor, drawBackButton, drawStickerPopup, drawScore, drawInstructions, drawHintButton, drawKeyboardOverlay, drawEasyModeButton } from '../shared/draw';
import { normalizeMoveKey } from '../shared/input';
import type { WalkDirection } from '../shared/draw';
import { getVolcanoImage, getGrassTileImage, getWallTileImage, getArrowImage, getFinishImage } from '../shared/dino-svgs';
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
const TILE = 50;
const COLS = 15;
const ROWS = 11;

type Cell = 'empty' | 'wall' | 'start' | 'end';

function floodFill(grid: Cell[][], startR: number, startC: number): Set<string> {
  const visited = new Set<string>();
  const queue: [number, number][] = [[startR, startC]];
  visited.add(`${startR},${startC}`);
  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited.has(key) && grid[nr][nc] !== 'wall') {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }
  return visited;
}

function findEnd(grid: Cell[][]): [number, number] {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === 'end') return [r, c];
    }
  }
  return [1, 1];
}

function bestDirection(grid: Cell[][], pr: number, pc: number): string {
  const [er, ec] = findEnd(grid);
  if (pr === er && pc === ec) return '';

  // BFS from end to find distances
  const dist = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
  dist[er][ec] = 0;
  const queue: [number, number][] = [[er, ec]];
  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && dist[nr][nc] === -1 && grid[nr][nc] !== 'wall') {
        dist[nr][nc] = dist[r][c] + 1;
        queue.push([nr, nc]);
      }
    }
  }

  const dirs: { key: string; dr: number; dc: number }[] = [
    { key: 'ArrowUp', dr: -1, dc: 0 },
    { key: 'ArrowDown', dr: 1, dc: 0 },
    { key: 'ArrowLeft', dr: 0, dc: -1 },
    { key: 'ArrowRight', dr: 0, dc: 1 },
  ];

  let bestKey = '';
  let bestDist = Infinity;
  for (const d of dirs) {
    const nr = pr + d.dr;
    const nc = pc + d.dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && dist[nr][nc] >= 0 && dist[nr][nc] < bestDist) {
      bestDist = dist[nr][nc];
      bestKey = d.key;
    }
  }
  return bestKey;
}

function generateMaze(_level: number, difficulty: Difficulty = 'medium'): Cell[][] {
  const grid: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => 'wall' as Cell),
  );

  // iterative recursive backtracking
  const stack: [number, number][] = [[1, 1]];
  grid[1][1] = 'empty';

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const dirs = (
      [[0, 2], [0, -2], [2, 0], [-2, 0]] as [number, number][]
    ).filter(([dr, dc]) => {
      const nr = r + dr;
      const nc = c + dc;
      return nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1 && grid[nr][nc] === 'wall';
    });

    if (dirs.length === 0) {
      stack.pop();
      continue;
    }

    const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
    grid[r + dr / 2][c + dc / 2] = 'empty';
    grid[r + dr][c + dc] = 'empty';
    stack.push([r + dr, c + dc]);
  }

  // widen passages for toddlers (easy/medium only — hard keeps tight corridors)
  if (difficulty !== 'hard') {
    const widenChance = difficulty === 'easy' ? 0.6 : 0.5;
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (grid[r][c] === 'empty') {
          if (r + 1 < ROWS - 1 && grid[r + 1][c] === 'wall' && Math.random() < widenChance) {
            grid[r + 1][c] = 'empty';
          }
          if (c + 1 < COLS - 1 && grid[r][c + 1] === 'wall' && Math.random() < widenChance) {
            grid[r][c + 1] = 'empty';
          }
        }
      }
    }
  }

  grid[1][1] = 'start';

  // find exit: farthest reachable cell from start
  const reachable = floodFill(grid, 1, 1);
  let bestR = 1;
  let bestC = 1;
  let bestDist = 0;
  for (const key of reachable) {
    const [r, c] = key.split(',').map(Number);
    const dist = Math.abs(r - 1) + Math.abs(c - 1);
    if (dist > bestDist) {
      bestDist = dist;
      bestR = r;
      bestC = c;
    }
  }
  grid[bestR][bestC] = 'end';

  return grid;
}

export function VolcanoEscape({ onBack }: { onBack: () => void }) {
  const initialDifficulty = getDifficulty();
  const initialGrid = generateMaze(0, initialDifficulty);
  const stateRef = useRef({
    grid: initialGrid,
    playerR: 1,
    playerC: 1,
    particles: [] as Particle[],
    completed: 0,
    level: 0,
    celebrating: 0,
    moveTimer: 0,
    trail: [{ x: 1 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 }] as Point[],
    stickerPopup: '',
    stickerPopupTimer: 0,
    keysHeld: new Set<string>(),
    showHint: false,
    easyMode: isEasyMode(),
    difficulty: initialDifficulty as Difficulty,
    facing: 'down' as WalkDirection,
  });

  const tryMove = useCallback((dr: number, dc: number, key?: string) => {
    const s = stateRef.current;
    if (s.celebrating > 0) return;

    const nr = s.playerR + dr;
    const nc = s.playerC + dc;

    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
    if (s.grid[nr][nc] === 'wall') return;

    if (s.easyMode && key) {
      const best = bestDirection(s.grid, s.playerR, s.playerC);
      if (key !== best) return;
    }

    s.playerR = nr;
    s.playerC = nc;
    if (dr === -1) s.facing = 'up';
    else if (dr === 1) s.facing = 'down';
    else if (dc === -1) s.facing = 'left';
    else if (dc === 1) s.facing = 'right';
    playStep();

    const px = nc * TILE + TILE / 2;
    const py = nr * TILE + TILE / 2;
    s.trail.push({ x: px, y: py });
    s.particles.push(...spawnCelebration(px, py, 2));

    if (s.grid[nr][nc] === 'end') {
      s.completed++;
      s.celebrating = 2.5;
      playCelebration();
      s.particles.push(...spawnCelebration(px, py, 25));
      trackDinoEncounter('rex', 0, 'volcano-escape');

      const total = trackProgress('volcano');
      if (total === 1) {
        earnSticker('volcano-1');
        s.stickerPopup = '🌋 First Escape!';
        s.stickerPopupTimer = 3;
        playSticker();
      } else if (total === 3) {
        earnSticker('volcano-3');
        s.stickerPopup = '🏆 Escape Artist!';
        s.stickerPopupTimer = 3;
        playSticker();
      }
    }
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    const s = stateRef.current;
    const key = normalizeMoveKey(e.key);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      e.preventDefault();
      s.keysHeld.add(key);
      if (s.moveTimer <= 0) {
        const dirs: Record<string, [number, number]> = {
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
          ArrowLeft: [0, -1],
          ArrowRight: [0, 1],
        };
        const d = dirs[key];
        if (d) tryMove(d[0], d[1], key);
        s.moveTimer = 0.18;
      }
    }
  }, [tryMove]);

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    stateRef.current.keysHeld.delete(normalizeMoveKey(e.key));
  }, []);

  const { canvasRef, safeTimeout } = useGameCanvas({
    width: W,
    height: H,
    title: 'Volcano Escape',
    onKeyDown,
    onKeyUp,
    onDraw(ctx, mouse, dt) {
      const s = stateRef.current;

      if (s.moveTimer > 0) s.moveTimer -= dt;
      if (s.stickerPopupTimer > 0) s.stickerPopupTimer -= dt;
      s.particles = updateParticles(s.particles, dt);

      if (s.celebrating > 0) {
        s.celebrating -= dt;
        if (s.celebrating <= 0) {
          s.level++;
          s.grid = generateMaze(s.level, s.difficulty);
          s.playerR = 1;
          s.playerC = 1;
          s.facing = 'down';
          s.trail = [{ x: 1 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 }];
        }
      }

      // repeat movement while key held
      if (s.moveTimer <= 0 && s.keysHeld.size > 0) {
        const dirs: Record<string, [number, number]> = {
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
          ArrowLeft: [0, -1],
          ArrowRight: [0, 1],
        };
        for (const key of s.keysHeld) {
          const d = dirs[key];
          if (d) {
            tryMove(d[0], d[1], key);
            s.moveTimer = 0.18;
            break;
          }
        }
      }

      // background — dark volcanic
      ctx.fillStyle = '#2D1B14';
      ctx.fillRect(0, 0, W, H);

      // grid
      const gridOffsetX = (W - COLS * TILE) / 2;
      ctx.save();
      ctx.translate(gridOffsetX, 0);

      // tile pass — sprite-based
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * TILE;
          const y = r * TILE;
          const cell = s.grid[r][c];

          if (cell === 'wall') {
            const wallImg = getWallTileImage(r, c);
            if (wallImg.complete && wallImg.naturalWidth > 0) {
              ctx.drawImage(wallImg, x, y, TILE, TILE);
            }
          } else {
            const grassImg = getGrassTileImage(r, c);
            if (grassImg.complete && grassImg.naturalWidth > 0) {
              ctx.drawImage(grassImg, x, y, TILE, TILE);
            }
          }

          if (cell === 'start') {
            const pulse = 0.3 + Math.sin(mouse.time * 2) * 0.15;
            ctx.fillStyle = `rgba(100,200,255,${pulse})`;
            ctx.beginPath();
            ctx.roundRect(x + 3, y + 3, TILE - 6, TILE - 6, 6);
            ctx.fill();
          }

          if (cell === 'end') {
            const finImg = getFinishImage();
            if (finImg.complete && finImg.naturalWidth > 0) {
              const bounce = Math.sin(mouse.time * 3) * 3;
              ctx.save();
              ctx.shadowColor = 'rgba(255,215,0,0.6)';
              ctx.shadowBlur = 10 + Math.sin(mouse.time * 2.5) * 5;
              ctx.drawImage(finImg, x, y + bounce, TILE, TILE);
              ctx.restore();
            }
          }
        }
      }

      // trail — directional footprint sprites (hidden in hard mode)
      if (s.difficulty !== 'hard') {
        for (let i = 0; i < s.trail.length - 1; i++) {
          const cur = s.trail[i];
          const next = s.trail[i + 1];
          const dx = next.x - cur.x;
          const dy = next.y - cur.y;
          let dir: string;
          if (Math.abs(dx) > Math.abs(dy)) {
            dir = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
          } else {
            dir = dy > 0 ? 'ArrowDown' : 'ArrowUp';
          }
          const arrowImg = getArrowImage(dir);
          if (arrowImg && arrowImg.complete && arrowImg.naturalWidth > 0) {
            const tx = cur.x - TILE / 2;
            const ty = cur.y - TILE / 2;
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.drawImage(arrowImg, tx, ty, TILE, TILE);
            ctx.restore();
          }
        }
      }

      // arrow key hints — hidden in hard mode unless the hint button is toggled
      const suggested = bestDirection(s.grid, s.playerR, s.playerC);
      const hints = [
        { arrowKey: 'ArrowUp', dr: -1, dc: 0 },
        { arrowKey: 'ArrowDown', dr: 1, dc: 0 },
        { arrowKey: 'ArrowLeft', dr: 0, dc: -1 },
        { arrowKey: 'ArrowRight', dr: 0, dc: 1 },
      ];
      const showArrowHints = s.difficulty !== 'hard' || s.showHint;
      for (const h of (showArrowHints ? hints : [])) {
        const nr = s.playerR + h.dr;
        const nc = s.playerC + h.dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && s.grid[nr][nc] !== 'wall') {
          const hx = nc * TILE;
          const hy = nr * TILE;
          const arrowImg = getArrowImage(h.arrowKey);

          if (s.easyMode && h.arrowKey === suggested) {
            const pulse = 0.6 + Math.sin(mouse.time * 4) * 0.4;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.shadowColor = 'rgba(255,100,0,0.6)';
            ctx.shadowBlur = 10;
            if (arrowImg && arrowImg.complete && arrowImg.naturalWidth > 0) {
              const scale = 0.7;
              const aw = TILE * scale;
              const ah = TILE * scale;
              ctx.drawImage(arrowImg, hx + (TILE - aw) / 2, hy + (TILE - ah) / 2, aw, ah);
            }
            ctx.restore();
          } else if (!s.easyMode) {
            const alpha = 0.3 + Math.sin(mouse.time * 3) * 0.15;
            ctx.save();
            ctx.globalAlpha = alpha;
            if (arrowImg && arrowImg.complete && arrowImg.naturalWidth > 0) {
              const scale = 0.55;
              const aw = TILE * scale;
              const ah = TILE * scale;
              ctx.drawImage(arrowImg, hx + (TILE - aw) / 2, hy + (TILE - ah) / 2, aw, ah);
            }
            ctx.restore();
          }
        }
      }

      // player dino
      const px = s.playerC * TILE + TILE / 2;
      const py = s.playerR * TILE + TILE / 2;
      drawWalkDino(ctx, px, py - 5, 34, s.facing, mouse.time);

      drawParticles(ctx, s.particles);

      ctx.restore();

      // volcano decoration (outside grid area)
      const volcImg = getVolcanoImage();
      if (volcImg.complete && volcImg.naturalWidth > 0) {
        const vw = 80;
        const vh = vw * (volcImg.naturalHeight / volcImg.naturalWidth);
        ctx.drawImage(volcImg, 0, H - vh, vw, vh);
      }

      if (s.celebrating > 0) {
        ctx.save();
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 36px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, s.celebrating);
        ctx.fillText('You escaped! 🎉', W / 2, H - 10);
        ctx.restore();
      } else {
        drawInstructions(ctx, 'Use arrow keys ↑ ↓ ← → to find the star!', W / 2, H - 10);
      }

      drawScore(ctx, '🌋', s.completed);

      if ((s.showHint || s.easyMode) && s.celebrating <= 0) {
        drawKeyboardOverlay(ctx, suggested, mouse.time, W, H, 'arrows');
      }

      drawEasyModeButton(ctx, 100, 14, mouse.mouseX, mouse.mouseY, s.easyMode);
      drawHintButton(ctx, W - 160, 10, mouse.mouseX, mouse.mouseY, s.showHint);
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
        return;
      }
      if (mx > W - 160 && mx < W - 116 && my > 10 && my < 54) {
        stateRef.current.showHint = !stateRef.current.showHint;
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
      tabIndex={0}
      role="application"
      aria-label="Volcano Escape - use arrow keys to navigate the maze"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W, outline: 'none' }}
    />
  );
}
