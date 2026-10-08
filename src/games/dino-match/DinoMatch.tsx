import { useRef, useCallback } from 'react';
import { drawDino, drawCustomCursor, drawBackButton, drawStickerPopup, drawScore, drawEasyModeButton } from '../shared/draw';
import type { DinoSpecies } from '../shared/draw';
import { getEggImage } from '../shared/dino-svgs';
import { spawnCelebration, updateParticles, drawParticles } from '../shared/particles';
import { playFlip, playMatch, playMismatch, playCelebration, playSticker } from '../shared/audio';
import { earnSticker, trackProgress } from '../shared/stickers';
import { isEasyMode, toggleEasyMode } from '../shared/easyMode';
import { getDifficulty } from '../shared/difficulty';
import type { Difficulty } from '../shared/difficulty';
import { trackDinoEncounter } from '../shared/collection';
import { useGameCanvas } from '../shared/useGameCanvas';
import type { Particle } from '../shared/types';

const W = 800;
const H = 600;
const GAP = 14;

interface GridLayout {
  cols: number;
  rows: number;
  cardW: number;
  cardH: number;
  gridX: number;
  gridY: number;
}

function getLayout(diff: Difficulty): GridLayout {
  let cols: number;
  let rows: number;
  let cardW: number;
  let cardH: number;
  if (diff === 'easy') {
    cols = 2; rows = 2; cardW = 120; cardH = 140;
  } else if (diff === 'medium') {
    cols = 4; rows = 3; cardW = 120; cardH = 140;
  } else {
    cols = 4; rows = 4; cardW = 100; cardH = 115;
  }
  const gridW = cols * cardW + (cols - 1) * GAP;
  const gridH = rows * cardH + (rows - 1) * GAP;
  return {
    cols,
    rows,
    cardW,
    cardH,
    gridX: (W - gridW) / 2,
    gridY: (H - gridH) / 2 + 20,
  };
}

interface Card {
  species: DinoSpecies;
  version: number;
  flipped: boolean;
  matched: boolean;
  flipAnim: number;
}

const DINO_POOL: { species: DinoSpecies; version: number }[] = [
  { species: 'rex', version: 0 },
  { species: 'stego', version: 0 },
  { species: 'bronto', version: 0 },
  { species: 'raptor', version: 0 },
  { species: 'ankylo', version: 0 },
  { species: 'ptera', version: 0 },
  { species: 'tric', version: 0 },
  { species: 'para', version: 0 },
  { species: 'spino', version: 0 },
  { species: 'rex', version: 1 },
  { species: 'stego', version: 1 },
  { species: 'raptor', version: 1 },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createCards(diff: Difficulty): Card[] {
  const layout = getLayout(diff);
  const numPairs = (layout.cols * layout.rows) / 2;
  const picked = shuffle(DINO_POOL).slice(0, numPairs);
  const pairs = [...picked, ...picked];
  return shuffle(pairs).map((d) => ({
    species: d.species,
    version: d.version,
    flipped: false,
    matched: false,
    flipAnim: 0,
  }));
}

const HARD_PREVIEW_SEC = 2.5;

function getCardPos(index: number, layout: GridLayout): { x: number; y: number } {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  return {
    x: layout.gridX + col * (layout.cardW + GAP),
    y: layout.gridY + row * (layout.cardH + GAP),
  };
}

export function DinoMatch({ onBack }: { onBack: () => void }) {
  const initialDiff = getDifficulty();
  const stateRef = useRef({
    cards: createCards(initialDiff),
    flippedIndices: [] as number[],
    particles: [] as Particle[],
    matched: 0,
    totalPairs: getLayout(initialDiff).cols * getLayout(initialDiff).rows / 2,
    lockTimer: 0,
    celebrating: 0,
    stickerPopup: '',
    stickerPopupTimer: 0,
    bgGrad: null as CanvasGradient | null,
    difficulty: initialDiff,
    easyMode: initialDiff === 'easy',
    previewTimer: initialDiff === 'hard' ? HARD_PREVIEW_SEC : 0,
  });

  const { canvasRef } = useGameCanvas({
    width: W,
    height: H,
    title: 'Dino Match',
    onDraw(ctx, mouse, dt) {
      const s = stateRef.current;

      if (s.stickerPopupTimer > 0) s.stickerPopupTimer -= dt;
      s.particles = updateParticles(s.particles, dt);
      const layout = getLayout(s.difficulty);

      // hard-mode preview countdown
      if (s.previewTimer > 0) {
        s.previewTimer -= dt;
        if (s.previewTimer <= 0) {
          s.previewTimer = 0;
        }
      }

      // flip animations — during preview, all unmatched cards act flipped
      const previewing = s.previewTimer > 0;
      for (const card of s.cards) {
        const showing = previewing || card.flipped || card.matched;
        if (showing) {
          card.flipAnim = Math.min(1, card.flipAnim + dt * 5);
        } else {
          card.flipAnim = Math.max(0, card.flipAnim - dt * 5);
        }
      }

      // mismatch lock timer
      if (s.lockTimer > 0) {
        s.lockTimer -= dt;
        if (s.lockTimer <= 0) {
          for (const idx of s.flippedIndices) {
            s.cards[idx].flipped = false;
          }
          s.flippedIndices = [];
        }
      }

      // celebration timer
      if (s.celebrating > 0) {
        s.celebrating -= dt;
        if (s.celebrating <= 0) {
          s.cards = createCards(s.difficulty);
          s.flippedIndices = [];
          s.matched = 0;
          s.totalPairs = getLayout(s.difficulty).cols * getLayout(s.difficulty).rows / 2;
          s.previewTimer = s.difficulty === 'hard' ? HARD_PREVIEW_SEC : 0;
        }
      }

      // background
      if (!s.bgGrad) {
        s.bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        s.bgGrad.addColorStop(0, '#2E4057');
        s.bgGrad.addColorStop(0.4, '#3D5A80');
        s.bgGrad.addColorStop(1, '#1B3A4B');
      }
      ctx.fillStyle = s.bgGrad;
      ctx.fillRect(0, 0, W, H);

      // subtle stars
      const th = (a: number, b: number) => {
        const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
        return n - Math.floor(n);
      };
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 25; i++) {
        const sx = th(i, 0) * W;
        const sy = th(i, 1) * H * 0.3;
        ctx.globalAlpha = 0.15 + Math.sin(mouse.time * 1.5 + i) * 0.1;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ground with ferns
      const groundGrad = ctx.createLinearGradient(0, H * 0.85, 0, H);
      groundGrad.addColorStop(0, 'rgba(40,80,40,0.3)');
      groundGrad.addColorStop(1, 'rgba(30,60,30,0.5)');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, H * 0.85, W, H * 0.15);

      for (let i = 0; i < 12; i++) {
        const fx = th(i, 10) * W;
        const fy = H * 0.86 + th(i, 11) * H * 0.1;
        const fs = 8 + th(i, 12) * 10;
        ctx.fillStyle = `rgba(50,${120 + th(i, 13) * 40},35,0.3)`;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx - 2, fy - fs);
        ctx.lineTo(fx + 3, fy - fs * 0.7);
        ctx.fill();
      }

      // title
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 22px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Find the matching dinos!', W / 2, 35);

      // draw cards
      const cw = layout.cardW;
      const ch = layout.cardH;
      for (let i = 0; i < s.cards.length; i++) {
        const card = s.cards[i];
        const pos = getCardPos(i, layout);
        const { x, y } = pos;

        const showFace = card.flipAnim > 0.5;
        const scaleX = Math.abs(Math.cos(card.flipAnim * Math.PI));

        ctx.save();
        ctx.translate(x + cw / 2, y + ch / 2);
        ctx.scale(Math.max(0.02, scaleX), 1);
        ctx.translate(-(x + cw / 2), -(y + ch / 2));

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 6, cw, ch, 14);
        ctx.fill();

        if (showFace) {
          // face up — white card with dino
          ctx.fillStyle = card.matched ? '#E8F5E9' : '#FFFFFF';
          ctx.beginPath();
          ctx.roundRect(x, y, cw, ch, 14);
          ctx.fill();

          ctx.strokeStyle = card.matched ? '#4CAF50' : 'rgba(0,0,0,0.1)';
          ctx.lineWidth = card.matched ? 3 : 1;
          ctx.beginPath();
          ctx.roundRect(x, y, cw, ch, 14);
          ctx.stroke();

          // dino sprite
          const dinoSize = Math.round(cw * 0.46);
          const bounce = card.matched ? Math.sin(mouse.time * 4) * 3 : 0;
          const pose = 0;
          drawDino(ctx, x + cw / 2, y + ch / 2 - 10 + bounce, dinoSize, '#4CAF50', false, card.species, pose, card.version);

          // label
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.font = '12px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(card.species.charAt(0).toUpperCase() + card.species.slice(1), x + cw / 2, y + ch - 12);

          if (card.matched) {
            ctx.save();
            ctx.shadowColor = 'rgba(76,175,80,0.4)';
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x, y, cw, ch, 14);
            ctx.stroke();
            ctx.restore();
          }
        } else {
          // face down — egg pattern back
          const backGrad = ctx.createLinearGradient(x, y, x, y + ch);
          backGrad.addColorStop(0, '#5C6BC0');
          backGrad.addColorStop(1, '#3949AB');
          ctx.fillStyle = backGrad;
          ctx.beginPath();
          ctx.roundRect(x, y, cw, ch, 14);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x + 4, y + 4, cw - 8, ch - 8, 10);
          ctx.stroke();

          // egg icon on back
          const eggImg = getEggImage(i % 5, 'whole');
          if (eggImg.complete && eggImg.naturalWidth > 0) {
            const eggH = Math.round(ch * 0.32);
            const eggA = eggImg.naturalWidth / eggImg.naturalHeight;
            const eggW = eggH * eggA;
            ctx.globalAlpha = 0.5;
            ctx.drawImage(eggImg, x + cw / 2 - eggW / 2, y + ch / 2 - eggH / 2, eggW, eggH);
            ctx.globalAlpha = 1;
          }

          // question mark
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = 'bold 28px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('?', x + cw / 2, y + ch / 2 + 10);
        }

        // hover highlight for clickable cards (not during preview)
        if (!previewing && !card.flipped && !card.matched && s.lockTimer <= 0) {
          const hx = mouse.mouseX - (x + cw / 2);
          const hy = mouse.mouseY - (y + ch / 2);
          if (hx * hx / ((cw / 2) ** 2) + hy * hy / ((ch / 2) ** 2) < 1) {
            ctx.save();
            ctx.shadowColor = 'rgba(255,255,100,0.6)';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = 'rgba(255,255,200,0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(x, y, cw, ch, 14);
            ctx.stroke();
            ctx.restore();
          }
        }

        ctx.restore();
      }

      // preview countdown banner
      if (previewing) {
        const remaining = Math.ceil(s.previewTimer);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(W / 2 - 110, 62, 220, 40, 12);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 18px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Memorize! ${remaining}`, W / 2, 88);
        ctx.restore();
      }

      drawParticles(ctx, s.particles);

      // board complete celebration
      if (s.celebrating > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, s.celebrating);
        ctx.font = 'bold 40px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText('All matched! 🎉', W / 2, H / 2);
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FFD700';
        ctx.fillText('All matched! 🎉', W / 2, H / 2);
        ctx.restore();
      }

      drawScore(ctx, '🧩', s.matched);
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

      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const mx = (clientX - rect.left) * (W / rect.width);
      const my = (clientY - rect.top) * (H / rect.height);
      const s = stateRef.current;

      if (mx > 100 && mx < 180 && my > 14 && my < 48) {
        s.easyMode = toggleEasyMode();
        s.difficulty = getDifficulty();
        s.cards = createCards(s.difficulty);
        s.flippedIndices = [];
        s.matched = 0;
        s.totalPairs = getLayout(s.difficulty).cols * getLayout(s.difficulty).rows / 2;
        s.previewTimer = s.difficulty === 'hard' ? HARD_PREVIEW_SEC : 0;
        return;
      }
      if (mx > W - 110 && mx < W && my > 10 && my < 54) {
        onBack();
        return;
      }

      if (s.lockTimer > 0 || s.celebrating > 0 || s.previewTimer > 0) return;

      const layout = getLayout(s.difficulty);
      const cw = layout.cardW;
      const ch = layout.cardH;
      // find clicked card
      for (let i = 0; i < s.cards.length; i++) {
        const card = s.cards[i];
        if (card.flipped || card.matched) continue;

        const pos = getCardPos(i, layout);
        if (mx >= pos.x && mx <= pos.x + cw && my >= pos.y && my <= pos.y + ch) {
          card.flipped = true;
          s.flippedIndices.push(i);
          playFlip();
          s.particles.push(...spawnCelebration(pos.x + cw / 2, pos.y + ch / 2, 4));

          if (s.flippedIndices.length === 2) {
            const [a, b] = s.flippedIndices;
            const cardA = s.cards[a];
            const cardB = s.cards[b];

            if (cardA.species === cardB.species && cardA.version === cardB.version) {
              cardA.matched = true;
              cardB.matched = true;
              s.matched++;
              s.flippedIndices = [];
              playMatch();
              trackDinoEncounter(cardA.species, cardA.version, 'dino-match');

              const posA = getCardPos(a, layout);
              const posB = getCardPos(b, layout);
              s.particles.push(
                ...spawnCelebration(posA.x + cw / 2, posA.y + ch / 2, 15),
                ...spawnCelebration(posB.x + cw / 2, posB.y + ch / 2, 15),
              );

              if (s.matched >= s.totalPairs) {
                s.celebrating = 3;
                playCelebration();
                s.particles.push(...spawnCelebration(W / 2, H / 2, 40));

                const total = trackProgress('dino-match');
                if (total === 1) {
                  earnSticker('dino-match-1');
                  s.stickerPopup = '🃏 First Match!';
                  s.stickerPopupTimer = 3;
                  playSticker();
                } else if (total === 3) {
                  earnSticker('dino-match-3');
                  s.stickerPopup = '🧠 Memory Master!';
                  s.stickerPopupTimer = 3;
                  playSticker();
                }
              }
            } else {
              playMismatch();
              s.lockTimer = 1.0;
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
      aria-label="Dino Match - flip cards to find matching dinosaur pairs"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W }}
    />
  );
}
