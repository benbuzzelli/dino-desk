import { useRef, useCallback } from 'react';
import { drawDino, drawCustomCursor, drawBackButton, drawStickerPopup, drawScore, drawInstructions, drawHintButton, drawKeyboardOverlay, drawEasyModeButton } from '../shared/draw';
import type { DinoSpecies } from '../shared/draw';
import { spawnCelebration, updateParticles, drawParticles } from '../shared/particles';
import { playKeyPress, playWrongKey, playCelebration, playSticker } from '../shared/audio';
import { earnSticker, trackProgress } from '../shared/stickers';
import { isEasyMode, toggleEasyMode } from '../shared/easyMode';
import { trackDinoEncounter } from '../shared/collection';
import { useGameCanvas } from '../shared/useGameCanvas';
import type { Particle } from '../shared/types';

const W = 800;
const H = 600;

const DINOS: { name: string; color: string; label: string; species: DinoSpecies; version?: number }[] = [
  // Base dinos (v0)
  { name: 'REX', color: '#4CAF50', label: 'T-Rex', species: 'rex' },
  { name: 'STEGO', color: '#FF9800', label: 'Stegosaurus', species: 'stego' },
  { name: 'TRI', color: '#8BC34A', label: 'Triceratops', species: 'tric' },
  { name: 'RAPTOR', color: '#2196F3', label: 'Raptor', species: 'raptor' },
  { name: 'BRONTO', color: '#9C27B0', label: 'Brontosaurus', species: 'bronto' },
  { name: 'ANKYLO', color: '#009688', label: 'Ankylosaurus', species: 'ankylo' },
  { name: 'PARA', color: '#E91E63', label: 'Parasaurolophus', species: 'para' },
  { name: 'SPINO', color: '#3F51B5', label: 'Spinosaurus', species: 'spino' },
  { name: 'PTERA', color: '#00BCD4', label: 'Pteranodon', species: 'ptera' },
  // Fun v1 dinos
  { name: 'TINY REX', color: '#E91E63', label: 'Tiny Rex', species: 'rex', version: 1 },
  { name: 'WILD RAPTOR', color: '#FF5722', label: 'Wild Raptor', species: 'raptor', version: 1 },
  { name: 'BRAVE STEGO', color: '#8BC34A', label: 'Brave Stego', species: 'stego', version: 1 },
  { name: 'BIG BRONTO', color: '#673AB7', label: 'Big Bronto', species: 'bronto', version: 1 },
  { name: 'COOL ANKYLO', color: '#00897B', label: 'Cool Ankylo', species: 'ankylo', version: 1 },
  { name: 'HAPPY PARA', color: '#C2185B', label: 'Happy Para', species: 'para', version: 1 },
  { name: 'FAST SPINO', color: '#1A237E', label: 'Fast Spino', species: 'spino', version: 1 },
  { name: 'LUCKY PTERA', color: '#0097A7', label: 'Lucky Ptera', species: 'ptera', version: 1 },
];

export function SpellDino({ onBack }: { onBack: () => void }) {
  const stateRef = useRef({
    currentDino: 0,
    wordIndex: 0,
    letterIndex: 0,
    particles: [] as Particle[],
    completed: 0,
    celebrating: 0,
    wordCelebrating: 0,
    wrongFlash: 0,
    stickerPopup: '',
    stickerPopupTimer: 0,
    lastKey: '',
    lastKeyTimer: 0,
    bgGrad: null as CanvasGradient | null,
    showHint: false,
    easyMode: isEasyMode(),
  });

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    const s = stateRef.current;
    if (s.celebrating > 0 || s.wordCelebrating > 0) return;

    const dino = DINOS[s.currentDino];
    const words = dino.name.split(' ');
    const currentWord = words[s.wordIndex];
    const expected = currentWord[s.letterIndex];
    const pressed = e.key.toUpperCase();

    s.lastKey = pressed;
    s.lastKeyTimer = 0.5;

    if (pressed === expected) {
      playKeyPress();
      const totalW = currentWord.length * 60;
      const startX = W / 2 - totalW / 2;
      const letterX = startX + s.letterIndex * 60 + 25;
      const kbUp = s.showHint || s.easyMode;
      s.particles.push(...spawnCelebration(letterX, kbUp ? 290 : 410, 6));
      s.letterIndex++;

      if (s.letterIndex >= currentWord.length) {
        if (s.wordIndex < words.length - 1) {
          s.wordCelebrating = 0.8;
          s.particles.push(...spawnCelebration(W / 2, 300, 12));
          playCelebration();
        } else {
          s.completed++;
          s.celebrating = 2.5;
          playCelebration();
          s.particles.push(...spawnCelebration(W / 2, 300, 30));
          trackDinoEncounter(dino.species, dino.version ?? 0, 'spell-dino');

          const total = trackProgress('spell-dino');
          if (total === 1) {
            earnSticker('spell-dino-1');
            s.stickerPopup = '🔤 First Word!';
            s.stickerPopupTimer = 3;
            playSticker();
          } else if (total === 3) {
            earnSticker('spell-dino-3');
            s.stickerPopup = '📖 Dino Scholar!';
            s.stickerPopupTimer = 3;
            playSticker();
          }
        }
      }
    } else if (pressed.length === 1 && pressed >= 'A' && pressed <= 'Z' && !s.easyMode) {
      playWrongKey();
      s.wrongFlash = 0.5;
    }
  }, []);

  const { canvasRef, safeTimeout } = useGameCanvas({
    width: W,
    height: H,
    title: 'Spell the Dino',
    onKeyDown,
    onDraw(ctx, mouse, dt) {
      const s = stateRef.current;

      if (s.wordCelebrating > 0) {
        s.wordCelebrating -= dt;
        if (s.wordCelebrating <= 0) {
          s.wordIndex++;
          s.letterIndex = 0;
        }
      }
      if (s.celebrating > 0) {
        s.celebrating -= dt;
        if (s.celebrating <= 0) {
          s.currentDino = (s.currentDino + 1) % DINOS.length;
          s.wordIndex = 0;
          s.letterIndex = 0;
        }
      }
      if (s.wrongFlash > 0) s.wrongFlash -= dt;
      if (s.stickerPopupTimer > 0) s.stickerPopupTimer -= dt;
      if (s.lastKeyTimer > 0) s.lastKeyTimer -= dt;
      s.particles = updateParticles(s.particles, dt);

      const dino = DINOS[s.currentDino];
      const words = dino.name.split(' ');
      const currentWord = words[s.wordIndex] ?? words[words.length - 1];
      const kbVisible = (s.showHint || s.easyMode) && s.celebrating <= 0;

      if (!s.bgGrad) {
        s.bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        s.bgGrad.addColorStop(0, '#C4E0A8');
        s.bgGrad.addColorStop(0.3, '#B5D99A');
        s.bgGrad.addColorStop(0.6, '#8FC47A');
        s.bgGrad.addColorStop(1, '#6DA85E');
      }
      ctx.fillStyle = s.bgGrad;
      ctx.fillRect(0, 0, W, H);

      // rocky ground texture
      const th = (a: number, b: number) => {
        const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
        return n - Math.floor(n);
      };
      for (let i = 0; i < 8; i++) {
        const rx = th(i, 0) * W;
        const ry = H * 0.85 + th(i, 1) * H * 0.12;
        const rw = 30 + th(i, 2) * 40;
        const rh = 12 + th(i, 3) * 15;
        ctx.fillStyle = `rgba(140,120,95,${0.15 + th(i, 4) * 0.15})`;
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // background palm trees / ferns along edges
      const drawPalm = (px: number, py: number, size: number, lean: number) => {
        ctx.fillStyle = 'rgba(90,65,40,0.4)';
        ctx.fillRect(px - 3, py - size * 0.4, 6, size * 0.4);
        ctx.fillStyle = 'rgba(60,140,45,0.35)';
        for (let f = -3; f <= 3; f++) {
          ctx.beginPath();
          ctx.moveTo(px, py - size * 0.4);
          const angle = -Math.PI / 2 + f * 0.4 + lean;
          const len = size * 0.5;
          ctx.quadraticCurveTo(
            px + Math.cos(angle) * len * 0.5, py - size * 0.4 + Math.sin(angle) * len * 0.5,
            px + Math.cos(angle + 0.15) * len, py - size * 0.4 + Math.sin(angle + 0.15) * len
          );
          ctx.lineTo(px, py - size * 0.4);
          ctx.fill();
        }
      };
      drawPalm(35, H * 0.95, 200, -0.15);
      drawPalm(W - 40, H * 0.95, 180, 0.15);
      drawPalm(120, H, 140, -0.1);
      drawPalm(W - 130, H, 150, 0.1);

      // ground ferns
      for (let i = 0; i < 15; i++) {
        const gx = (i * 56 + 10) % W;
        const gy = H * 0.88 + th(i, 5) * H * 0.1;
        const gs = 8 + th(i, 6) * 8;
        ctx.fillStyle = `rgba(50,${120 + th(i, 7) * 50},35,0.3)`;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 3, gy - gs);
        ctx.lineTo(gx + 1, gy - gs * 0.7);
        ctx.lineTo(gx + 4, gy - gs * 0.85);
        ctx.lineTo(gx + 2, gy);
        ctx.fill();
      }

      if (s.wrongFlash > 0) {
        ctx.fillStyle = `rgba(255,0,0,${s.wrongFlash * 0.2})`;
        ctx.fillRect(0, 0, W, H);
      }

      const dinoY = kbVisible ? 110 : 160;
      const bounce = s.celebrating > 0 ? Math.sin(mouse.time * 8) * 10 : Math.sin(mouse.time * 2) * 3;
      drawDino(ctx, W / 2, dinoY + bounce, kbVisible ? 65 : 80, dino.color, false, dino.species, 0, dino.version ?? 0);

      ctx.fillStyle = dino.color;
      ctx.font = 'bold 24px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dino.label, W / 2, kbVisible ? 230 : 310);

      // word progress indicator for multi-word names
      if (words.length > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.font = '16px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Word ${s.wordIndex + 1} of ${words.length}`, W / 2, kbVisible ? 252 : 372);
      }

      // letter boxes
      const totalW = currentWord.length * 60;
      const startX = W / 2 - totalW / 2;
      const boxY = kbVisible ? 260 : 380;

      for (let i = 0; i < currentWord.length; i++) {
        const bx = startX + i * 60;
        const isCompleted = i < s.letterIndex;
        const isCurrent = i === s.letterIndex && s.celebrating <= 0 && s.wordCelebrating <= 0;

        ctx.fillStyle = isCompleted ? dino.color : isCurrent ? '#FFF9C4' : '#F5F0E0';
        ctx.beginPath();
        ctx.roundRect(bx, boxY, 50, 60, 12);
        ctx.fill();

        ctx.strokeStyle = isCurrent ? '#FF6B6B' : 'rgba(0,0,0,0.1)';
        ctx.lineWidth = isCurrent ? 3 : 1;
        ctx.beginPath();
        ctx.roundRect(bx, boxY, 50, 60, 12);
        ctx.stroke();

        if (isCompleted) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 32px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(currentWord[i], bx + 25, boxY + 42);
        } else if (isCurrent) {
          const pulse = 0.4 + Math.sin(mouse.time * 3) * 0.3;
          ctx.fillStyle = `rgba(0,0,0,${pulse})`;
          ctx.font = 'bold 32px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(currentWord[i], bx + 25, boxY + 42);

          if (!kbVisible) {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.font = '14px Fredoka, sans-serif';
            ctx.fillText(`Press "${currentWord[i]}"`, bx + 25, boxY + 80);
          }
        }
      }

      if (s.lastKeyTimer > 0 && !kbVisible) {
        ctx.save();
        ctx.globalAlpha = s.lastKeyTimer * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = 'bold 48px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.lastKey, W / 2, 530);
        ctx.restore();
      }

      drawParticles(ctx, s.particles);

      if (s.wordCelebrating > 0 && !s.celebrating) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, s.wordCelebrating * 2);
        ctx.font = 'bold 28px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        const celY = kbVisible ? 250 : 340;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(`${currentWord}! Next word...`, W / 2, celY);
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`${currentWord}! Next word...`, W / 2, celY);
        ctx.restore();
      }

      if (s.celebrating > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, s.celebrating);
        ctx.font = 'bold 36px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        const celY = kbVisible ? 250 : 340;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText(`You spelled ${dino.label}! 🎉`, W / 2, celY);
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`You spelled ${dino.label}! 🎉`, W / 2, celY);
        ctx.restore();
      }

      if (s.celebrating <= 0 && !kbVisible) {
        drawInstructions(ctx, 'Press the letter on your keyboard!', W / 2, 560);
      }

      drawScore(ctx, '📖', s.completed);

      if ((s.showHint || s.easyMode) && s.celebrating <= 0 && s.wordCelebrating <= 0) {
        const target = currentWord[s.letterIndex] ?? '';
        drawKeyboardOverlay(ctx, target, mouse.time, W, H, 'qwerty');
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
        stateRef.current.easyMode = toggleEasyMode();
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
      aria-label="Spell the Dino - press keyboard letters to spell dinosaur names"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W, outline: 'none' }}
    />
  );
}
