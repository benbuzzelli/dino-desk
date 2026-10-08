import { useRef, useCallback } from 'react';
import { drawDino, drawCustomCursor, drawBackButton, drawStickerPopup, drawScore, drawEasyModeButton } from '../shared/draw';
import type { DinoSpecies } from '../shared/draw';
import { getFoliageImage, getBushImage } from '../shared/dino-svgs';
import landscapeUrl from '../shared/sprites/backgrounds/landscape.png';
import { spawnCelebration, updateParticles, drawParticles } from '../shared/particles';
import { playPop, playCelebration, playSticker } from '../shared/audio';
import { earnSticker, trackProgress } from '../shared/stickers';
import { isEasyMode, toggleEasyMode } from '../shared/easyMode';
import { trackDinoEncounter } from '../shared/collection';
import { useGameCanvas } from '../shared/useGameCanvas';
import type { Particle } from '../shared/types';

const W = 800;
const H = 600;

const ALL_DINOS: { species: DinoSpecies; version: number; color: string }[] = [
  { species: 'rex', version: 0, color: '#4CAF50' },
  { species: 'stego', version: 0, color: '#FF9800' },
  { species: 'bronto', version: 0, color: '#9C27B0' },
  { species: 'raptor', version: 0, color: '#2196F3' },
  { species: 'ankylo', version: 0, color: '#009688' },
  { species: 'para', version: 0, color: '#E91E63' },
  { species: 'spino', version: 0, color: '#3F51B5' },
  { species: 'ptera', version: 0, color: '#00BCD4' },
  { species: 'tric', version: 0, color: '#8BC34A' },
  { species: 'rex', version: 1, color: '#E91E63' },
  { species: 'stego', version: 1, color: '#8BC34A' },
  { species: 'raptor', version: 1, color: '#FF5722' },
  { species: 'bronto', version: 1, color: '#673AB7' },
  { species: 'ankylo', version: 1, color: '#00897B' },
];

interface HiddenDino {
  species: DinoSpecies;
  version: number;
  color: string;
  x: number;
  y: number;
  size: number;
  found: boolean;
  foundTimer: number;
  coverSeed: number;
  facingLeft: boolean;
}

interface FoliageItem {
  x: number;
  y: number;
  seed: number;
  scale: number;
  flip: boolean;
}

interface SceneData {
  dinos: HiddenDino[];
  bgFoliage: FoliageItem[];
  fgFoliage: FoliageItem[];
  flowers: { x: number; y: number; color: string }[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// River center X at a given Y — the river runs from upper-center to lower-right
function riverCenterX(y: number): number {
  const t = (y - 180) / (H - 180);
  return 380 + t * 250;
}

// River width widens toward the bottom
function riverHalfWidth(y: number): number {
  const t = (y - 180) / (H - 180);
  return 25 + t * 45;
}

function isOnGrass(x: number, y: number): boolean {
  // above the grass line — mountains/volcano/sky
  if (y < 300) return false;
  // too close to the river
  const rcx = riverCenterX(y);
  const rhw = riverHalfWidth(y) + 30;
  if (Math.abs(x - rcx) < rhw) return false;
  // keep away from edges
  if (x < 30 || x > W - 30) return false;
  return true;
}

function randomGrassPoint(yMin: number, yMax: number): { x: number; y: number } {
  for (let i = 0; i < 80; i++) {
    const x = 40 + Math.random() * (W - 80);
    const y = yMin + Math.random() * (yMax - yMin);
    if (isOnGrass(x, y)) return { x, y };
  }
  return { x: 150, y: 420 };
}

function generateScene(easy: boolean): SceneData {
  const count = easy ? 3 : 5;
  const picked = shuffle(ALL_DINOS).slice(0, count);

  const zones: { x: number; y: number }[] = [];
  const minDist = 120;

  for (const _d of picked) {
    let pos: { x: number; y: number };
    let attempts = 0;
    do {
      pos = randomGrassPoint(320, 520);
      attempts++;
    } while (
      attempts < 50 &&
      zones.some((z) => Math.abs(z.x - pos.x) < minDist && Math.abs(z.y - pos.y) < 60)
    );
    zones.push(pos);
  }

  const dinos: HiddenDino[] = picked.map((d, i) => ({
    ...d,
    x: zones[i].x,
    y: zones[i].y,
    size: 40 + Math.random() * 15,
    found: false,
    foundTimer: 0,
    coverSeed: Math.floor(Math.random() * 1000),
    facingLeft: Math.random() > 0.5,
  }));

  // background foliage — on grass only
  const bgFoliage: FoliageItem[] = [];
  for (let i = 0; i < 10; i++) {
    const pos = randomGrassPoint(340, H - 20);
    bgFoliage.push({
      x: pos.x,
      y: pos.y,
      seed: Math.floor(Math.random() * 1000),
      scale: 0.6 + Math.random() * 0.5,
      flip: Math.random() > 0.5,
    });
  }

  // foreground foliage — on grass only
  const fgFoliage: FoliageItem[] = [];
  for (let i = 0; i < 8; i++) {
    const pos = randomGrassPoint(360, H - 30);
    fgFoliage.push({
      x: pos.x,
      y: pos.y,
      seed: 500 + Math.floor(Math.random() * 500),
      scale: 0.7 + Math.random() * 0.6,
      flip: Math.random() > 0.5,
    });
  }

  // edge palms — left side only (right side has river exit)
  for (let i = 0; i < 4; i++) {
    bgFoliage.push({
      x: 25 + Math.random() * 50,
      y: 330 + Math.random() * 40,
      seed: 2000 + i,
      scale: 1.0 + Math.random() * 0.4,
      flip: Math.random() > 0.5,
    });
  }

  const flowers: SceneData['flowers'] = [];
  const flowerColors = ['#FF6B6B', '#FFD93D', '#FF8ED4', '#C084FC', '#FFA726'];
  for (let i = 0; i < 8; i++) {
    const pos = randomGrassPoint(340, H - 20);
    flowers.push({
      x: pos.x,
      y: pos.y,
      color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
    });
  }

  return { dinos, bgFoliage, fgFoliage, flowers };
}

export function JungleExplorer({ onBack }: { onBack: () => void }) {
  const stateRef = useRef({
    scene: generateScene(isEasyMode()),
    particles: [] as Particle[],
    found: 0,
    completed: 0,
    celebrating: 0,
    stickerPopup: '',
    stickerPopupTimer: 0,
    bgImg: null as HTMLImageElement | null,
    easyMode: isEasyMode(),
  });

  const { canvasRef } = useGameCanvas({
    width: W,
    height: H,
    title: 'Jungle Explorer',
    onDraw(ctx, mouse, dt) {
      const s = stateRef.current;
      const t = mouse.time;

      if (s.stickerPopupTimer > 0) s.stickerPopupTimer -= dt;
      s.particles = updateParticles(s.particles, dt);

      for (const d of s.scene.dinos) {
        if (d.found && d.foundTimer < 1) d.foundTimer = Math.min(1, d.foundTimer + dt * 2);
      }

      if (s.celebrating > 0) {
        s.celebrating -= dt;
        if (s.celebrating <= 0) {
          s.scene = generateScene(s.easyMode);
          s.found = 0;
        }
      }

      // background landscape
      if (!s.bgImg) {
        const img = new Image();
        img.src = landscapeUrl;
        s.bgImg = img;
      }
      if (s.bgImg.complete && s.bgImg.naturalWidth > 0) {
        ctx.drawImage(s.bgImg, 0, 0, W, H);
      } else {
        ctx.fillStyle = '#4A7C2E';
        ctx.fillRect(0, 0, W, H);
      }

      // collect all drawable elements and sort by Y (lower Y drawn first, higher Y on top)
      type Drawable =
        | { type: 'foliage'; item: FoliageItem; y: number }
        | { type: 'flower'; item: { x: number; y: number; color: string }; y: number }
        | { type: 'dino'; item: HiddenDino; y: number };

      const drawables: Drawable[] = [];

      for (const f of s.scene.bgFoliage) {
        drawables.push({ type: 'foliage', item: f, y: f.y });
      }
      for (const f of s.scene.fgFoliage) {
        drawables.push({ type: 'foliage', item: f, y: f.y });
      }
      for (const f of s.scene.flowers) {
        drawables.push({ type: 'flower', item: f, y: f.y });
      }
      for (const dino of s.scene.dinos) {
        const sortY = dino.found
          ? H + 1
          : dino.y + dino.size * 0.15 + dino.size * 1.1 * 0.7;
        drawables.push({ type: 'dino', item: dino, y: sortY });
      }

      drawables.sort((a, b) => a.y - b.y);

      for (const d of drawables) {
        if (d.type === 'foliage') {
          drawFoliageSprite(ctx, d.item as FoliageItem);
        } else if (d.type === 'flower') {
          const f = d.item as { x: number; y: number; color: string };
          ctx.fillStyle = 'rgba(40,100,30,0.5)';
          ctx.fillRect(f.x - 1, f.y, 2, 10);
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFE082';
          ctx.beginPath();
          ctx.arc(f.x, f.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawHiddenDino(ctx, d.item as HiddenDino, t, s.easyMode);
        }
      }

      drawParticles(ctx, s.particles);

      // UI: how many left
      const total = s.scene.dinos.length;
      const remaining = total - s.found;

      if (s.celebrating <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(W / 2 - 105, 8, 210, 32, 10);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          remaining > 0
            ? `Find ${remaining} hidden dino${remaining > 1 ? 's' : ''}!`
            : 'All found!',
          W / 2,
          30,
        );
      }

      // easy mode hint
      if (s.easyMode && s.celebrating <= 0) {
        for (const dino of s.scene.dinos) {
          if (!dino.found) {
            const pulse = 0.15 + Math.sin(t * 3) * 0.1;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(dino.x, dino.y - dino.size * 0.3, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // celebration
      if (s.celebrating > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, s.celebrating);
        ctx.font = 'bold 38px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText('You found them all! 🎉', W / 2, H / 2 - 40);
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FFD700';
        ctx.fillText('You found them all! 🎉', W / 2, H / 2 - 40);
        ctx.restore();
      }

      drawScore(ctx, '🔍', s.completed);
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
      const s = stateRef.current;

      if (mx > 100 && mx < 180 && my > 14 && my < 48) {
        s.easyMode = toggleEasyMode();
        s.scene = generateScene(s.easyMode);
        s.found = 0;
        return;
      }
      if (mx > W - 110 && mx < W && my > 10 && my < 54) {
        onBack();
        return;
      }

      if (s.celebrating > 0) return;

      const hitR = s.easyMode ? 55 : 40;
      for (const dino of s.scene.dinos) {
        if (dino.found) continue;
        const dx = mx - dino.x;
        const dy = my - (dino.y - dino.size * 0.3);
        if (dx * dx + dy * dy < hitR * hitR) {
          dino.found = true;
          dino.foundTimer = 0;
          s.found++;
          playPop();
          s.particles.push(...spawnCelebration(dino.x, dino.y - dino.size * 0.3, 15));
          trackDinoEncounter(dino.species, dino.version, 'jungle-explorer');

          if (s.found >= s.scene.dinos.length) {
            s.completed++;
            s.celebrating = 3;
            playCelebration();
            s.particles.push(...spawnCelebration(W / 2, H / 2, 35));

            const total = trackProgress('jungle-explorer');
            if (total === 1) {
              earnSticker('jungle-explorer-1');
              s.stickerPopup = '🔍 First Discovery!';
              s.stickerPopupTimer = 3;
              playSticker();
            } else if (total === 3) {
              earnSticker('jungle-explorer-3');
              s.stickerPopup = '🌴 Jungle Expert!';
              s.stickerPopupTimer = 3;
              playSticker();
            }
          }
          break;
        }
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
      aria-label="Jungle Explorer - find hidden dinosaurs in the jungle"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W }}
    />
  );
}

function drawFoliageSprite(ctx: CanvasRenderingContext2D, f: FoliageItem) {
  const img = getFoliageImage(f.seed);
  if (!img.complete || img.naturalWidth === 0) return;

  const aspect = img.naturalWidth / img.naturalHeight;
  const renderH = 80 * f.scale;
  const renderW = renderH * aspect;

  ctx.save();
  ctx.translate(f.x, f.y);
  if (f.flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -renderW / 2, -renderH, renderW, renderH);
  ctx.restore();
}

function drawHiddenDino(
  ctx: CanvasRenderingContext2D,
  dino: HiddenDino,
  t: number,
  _easy: boolean,
) {
  ctx.save();

  if (dino.found) {
    const popScale = 0.8 + dino.foundTimer * 0.4;
    const bounce = Math.sin(t * 4) * 3 * (1 - dino.foundTimer * 0.5);

    ctx.translate(dino.x, dino.y + bounce);
    ctx.scale(popScale, popScale);
    ctx.translate(-dino.x, -(dino.y + bounce));

    drawDino(ctx, dino.x, dino.y + bounce - 10, dino.size * 1.1, dino.color, dino.facingLeft, dino.species, 0, dino.version);

    ctx.globalAlpha = dino.foundTimer;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(dino.x - 35, dino.y + bounce + dino.size * 0.35, 70, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      dino.species.charAt(0).toUpperCase() + dino.species.slice(1),
      dino.x,
      dino.y + bounce + dino.size * 0.35 + 14,
    );
  } else {
    const peek = Math.sin(t * 2 + dino.x * 0.1) * 2;
    ctx.globalAlpha = 0.85;
    const dinoY = dino.y + peek;
    drawDino(ctx, dino.x, dinoY - 5, dino.size * 0.85, dino.color, dino.facingLeft, dino.species, 0, dino.version);

    // overlay foliage sprite as cover
    ctx.globalAlpha = 1;
    const coverY = dinoY + dino.size * 0.15;

    // use a bush sprite as cover (seeded by dino position for consistency)
    const coverImg = getBushImage(dino.coverSeed);
    if (coverImg.complete && coverImg.naturalWidth > 0) {
      const coverAspect = coverImg.naturalWidth / coverImg.naturalHeight;
      const coverH = dino.size * 1.1;
      const coverW = coverH * coverAspect;

      ctx.save();
      ctx.translate(dino.x, coverY + coverH * 0.1);
      if (dino.facingLeft) ctx.scale(-1, 1);
      ctx.drawImage(coverImg, -coverW / 2, -coverH * 0.4, coverW, coverH);
      ctx.restore();
    }
  }

  ctx.restore();
}
