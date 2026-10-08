import { useRef, useCallback } from 'react';
import { drawCustomCursor } from '../games/shared/draw';
import { getEggImage, getVolcanoImage, getFootprintImage, getTitleLogoImage, getStickerImage, getDinoImage, getBushImage } from '../games/shared/dino-svgs';
import { getCollectionCount } from '../games/shared/collection';
import { getAllSlots } from '../games/shared/collection';
import { loadStickers } from '../games/shared/stickers';
import { useGameCanvas } from '../games/shared/useGameCanvas';
import { getActiveProfile } from '../games/shared/profile';
import type { GameId } from '../games/shared/types';

const W = 800;
const H = 600;

interface GameCard {
  id: GameId;
  title: string;
  icon: string;
  color: string;
  desc: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const CARD_GAP = 12;
const CARD_W = 110;
const CARD_H = 140;

function layoutCards(): GameCard[] {
  const defs: { id: GameId; title: string; icon: string; color: string; desc: string }[] = [
    { id: 'egg-hunt', title: 'Egg Hunt', icon: '🥚', color: '#FF6B6B', desc: 'Click eggs to hatch dinos!' },
    { id: 'dino-path', title: 'Dino Path', icon: '🦕', color: '#4ECDC4', desc: 'Follow the dots home!' },
    { id: 'spell-dino', title: 'Spell Dino', icon: '🔤', color: '#FFA726', desc: 'Type letters to spell!' },
    { id: 'volcano-escape', title: 'Volcano Run', icon: '🌋', color: '#FF9800', desc: 'Arrow keys to escape!' },
    { id: 'dino-match', title: 'Dino Match', icon: '🧩', color: '#7E57C2', desc: 'Flip cards to match!' },
    { id: 'jungle-explorer', title: 'Jungle Find', icon: '🌴', color: '#2E7D32', desc: 'Find hidden dinos!' },
    { id: 'dino-dungeon', title: 'Dino Dungeon', icon: '🏰', color: '#795548', desc: 'Sneak and find treasure!' },
  ];

  const row1 = defs.slice(0, 4);
  const row2 = defs.slice(4);
  const row1W = row1.length * CARD_W + (row1.length - 1) * CARD_GAP;
  const row2W = row2.length * CARD_W + (row2.length - 1) * CARD_GAP;
  const row1X = (W - row1W) / 2;
  const row2X = (W - row2W) / 2;
  const row1Y = 160;
  const row2Y = row1Y + CARD_H + CARD_GAP;

  const cards: GameCard[] = [];
  row1.forEach((d, i) => cards.push({ ...d, x: row1X + i * (CARD_W + CARD_GAP), y: row1Y, w: CARD_W, h: CARD_H }));
  row2.forEach((d, i) => cards.push({ ...d, x: row2X + i * (CARD_W + CARD_GAP), y: row2Y, w: CARD_W, h: CARD_H }));
  return cards;
}

const CARDS = layoutCards();

export function HomeScreen({ onSelectGame }: { onSelectGame: (id: GameId) => void }) {
  const selectedRef = useRef<number>(-1);
  const bgGradRef = useRef<CanvasGradient | null>(null);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      selectedRef.current = Math.min(CARDS.length - 1, selectedRef.current + 1);
    } else if (e.key === 'ArrowLeft') {
      selectedRef.current = Math.max(0, selectedRef.current - 1);
    } else if (e.key === 'Enter' && selectedRef.current >= 0) {
      onSelectGame(CARDS[selectedRef.current].id);
    }
  }, [onSelectGame]);

  const { canvasRef } = useGameCanvas({
    width: W,
    height: H,
    title: '',
    onKeyDown,
    onDraw(ctx, mouse, _dt) {
      const t = mouse.time;
      const mx = mouse.mouseX;
      const my = mouse.mouseY;

      if (!bgGradRef.current) {
        bgGradRef.current = ctx.createLinearGradient(0, 0, 0, H);
        bgGradRef.current.addColorStop(0, '#1a1a2e');
        bgGradRef.current.addColorStop(0.5, '#16213e');
        bgGradRef.current.addColorStop(1, '#0f3460');
      }
      ctx.fillStyle = bgGradRef.current;
      ctx.fillRect(0, 0, W, H);

      // stars
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 73 + Math.sin(t * 0.3 + i) * 5) % W;
        const sy = (i * 41 + Math.cos(t * 0.2 + i) * 3) % (H * 0.4);
        ctx.globalAlpha = 0.3 + Math.sin(t * 2 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // title logo sprite
      const titleImg = getTitleLogoImage();
      if (titleImg.complete && titleImg.naturalWidth > 0) {
        const titleH = 80;
        const titleAspect = titleImg.naturalWidth / titleImg.naturalHeight;
        const titleW = titleH * titleAspect;
        ctx.drawImage(titleImg, W / 2 - titleW / 2, 20, titleW, titleH);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '20px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pick a game to play!', W / 2, 130);

      // game cards
      for (let ci = 0; ci < CARDS.length; ci++) {
        const card = CARDS[ci];
        const isHovered =
          mx > card.x && mx < card.x + card.w && my > card.y && my < card.y + card.h;
        const isSelected = ci === selectedRef.current;
        const highlighted = isHovered || isSelected;

        if (isHovered) selectedRef.current = ci;

        const scale = highlighted ? 1.05 : 1;
        const offsetY = highlighted ? -5 : 0;

        ctx.save();
        ctx.translate(card.x + card.w / 2, card.y + card.h / 2 + offsetY);
        ctx.scale(scale, scale);
        ctx.translate(-(card.x + card.w / 2), -(card.y + card.h / 2));

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.roundRect(card.x + 5, card.y + 8, card.w, card.h, 20);
        ctx.fill();

        // bg
        ctx.fillStyle = card.color;
        ctx.beginPath();
        ctx.roundRect(card.x, card.y, card.w, card.h, 20);
        ctx.fill();

        // darker bottom half
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.roundRect(card.x, card.y + card.h / 2, card.w, card.h / 2, [0, 0, 20, 20]);
        ctx.fill();

        // icon — use sprite images
        const iconCx = card.x + card.w / 2;
        const iconCy = card.y + 50;
        const iconBob = Math.sin(t * 2 + ci * 1.5) * 3;
        const iconSize = 60;

        if (card.id === 'egg-hunt') {
          const eggImg = getEggImage(ci, 'whole');
          if (eggImg.complete && eggImg.naturalWidth > 0) {
            const a = eggImg.naturalWidth / eggImg.naturalHeight;
            ctx.drawImage(eggImg, iconCx - iconSize * a / 2, iconCy + iconBob - iconSize / 2, iconSize * a, iconSize);
          }
        } else if (card.id === 'dino-path') {
          const fpImg = getFootprintImage();
          if (fpImg.complete && fpImg.naturalWidth > 0) {
            const a = fpImg.naturalWidth / fpImg.naturalHeight;
            ctx.drawImage(fpImg, iconCx - iconSize * a / 2, iconCy + iconBob - iconSize / 2, iconSize * a, iconSize);
          }
        } else if (card.id === 'spell-dino') {
          const letters = ['A', 'B', 'C'];
          for (let li = 0; li < 3; li++) {
            const lx = iconCx - 28 + li * 28;
            const ly = iconCy + iconBob - 10 + Math.sin(t * 3 + li * 0.8) * 2;
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.roundRect(lx - 10, ly - 12, 22, 26, 5);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Fredoka, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(letters[li], lx + 1, ly + 6);
          }
        } else if (card.id === 'volcano-escape') {
          const volImg = getVolcanoImage();
          if (volImg.complete && volImg.naturalWidth > 0) {
            const a = volImg.naturalWidth / volImg.naturalHeight;
            const vSize = 70;
            ctx.drawImage(volImg, iconCx - vSize * a / 2, iconCy + iconBob - vSize / 2, vSize * a, vSize);
          }
        } else if (card.id === 'dino-match') {
          const matchImg = getDinoImage('stego', undefined, 0, 0);
          if (matchImg.complete && matchImg.naturalWidth > 0) {
            const a = matchImg.naturalWidth / matchImg.naturalHeight;
            const mSize = 50;
            ctx.drawImage(matchImg, iconCx - mSize * a / 2, iconCy + iconBob - mSize / 2, mSize * a, mSize);
          }
        } else if (card.id === 'jungle-explorer') {
          // dino peeking behind a bush sprite
          const dinoImg = getDinoImage('raptor', undefined, 0, 0);
          const bushImg = getBushImage(3);
          const dinoS = 40;
          if (dinoImg.complete && dinoImg.naturalWidth > 0) {
            const dA = dinoImg.naturalWidth / dinoImg.naturalHeight;
            const dH = dinoS * 1.4;
            const dW = dH * dA;
            ctx.drawImage(dinoImg, iconCx - dW / 2, iconCy + iconBob - dH * 0.3, dW, dH);
          }
          if (bushImg.complete && bushImg.naturalWidth > 0) {
            const bA = bushImg.naturalWidth / bushImg.naturalHeight;
            const bH = 50;
            const bW = bH * bA;
            ctx.drawImage(bushImg, iconCx - bW / 2, iconCy + iconBob + 2, bW, bH);
          }
        } else if (card.id === 'dino-dungeon') {
          // treasure chest + sneaky dino
          ctx.font = '28px serif';
          ctx.textAlign = 'center';
          ctx.fillText('💎', iconCx - 14, iconCy + iconBob - 8);
          ctx.fillText('🦴', iconCx + 14, iconCy + iconBob + 8);
          const dinoImg = getDinoImage('rex', undefined, 0, 0);
          if (dinoImg.complete && dinoImg.naturalWidth > 0) {
            const dA = dinoImg.naturalWidth / dinoImg.naturalHeight;
            const dH = 36;
            const dW = dH * dA;
            ctx.drawImage(dinoImg, iconCx - dW / 2, iconCy + iconBob + 10, dW, dH);
          }
        }

        // title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Fredoka, sans-serif';
        ctx.fillText(card.title, card.x + card.w / 2, card.y + 100);

        // description
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '12px Fredoka, sans-serif';
        const words = card.desc.split(' ');
        let line = '';
        let ly = card.y + 120;
        for (const word of words) {
          const test = line + word + ' ';
          if (ctx.measureText(test).width > card.w - 20) {
            ctx.fillText(line.trim(), card.x + card.w / 2, ly);
            line = word + ' ';
            ly += 15;
          } else {
            line = test;
          }
        }
        if (line.trim()) ctx.fillText(line.trim(), card.x + card.w / 2, ly);

        // hover glow
        if (highlighted) {
          ctx.shadowColor = 'rgba(255,255,255,0.4)';
          ctx.shadowBlur = 12;
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(card.x, card.y, card.w, card.h, 20);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        ctx.restore();
      }

      // sticker collection
      const stickers = loadStickers();
      const earnedCount = stickers.filter((s) => s.earned).length;

      const gameColors: Record<string, string> = {
        'egg-hunt': '#FF6B6B', 'dino-path': '#4ECDC4',
        'spell-dino': '#FFA726', 'volcano': '#FF9800',
        'dino-match': '#7E57C2', 'jungle-explorer': '#2E7D32', 'dino-dungeon': '#795548',
      };
      const gameLabels: Record<string, string> = {
        'egg-hunt': 'Egg Hunt', 'dino-path': 'Dino Path',
        'spell-dino': 'Spelling', 'volcano': 'Volcano',
        'dino-match': 'Matching', 'jungle-explorer': 'Jungle', 'dino-dungeon': 'Dungeon',
      };

      const groups = ['egg-hunt', 'dino-path', 'spell-dino', 'volcano', 'dino-match', 'jungle-explorer', 'dino-dungeon'];
      const groupW = Math.min(140, (W - 60) / groups.length - 10);
      const groupGap = 10;
      const totalGW = groups.length * groupW + (groups.length - 1) * groupGap;
      const groupStartX = W / 2 - totalGW / 2;

      // panel background
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.roundRect(groupStartX - 16, 360, totalGW + 32, 140, 16);
      ctx.fill();

      // title + count
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 16px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Sticker Collection', groupStartX - 6, 378);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '14px Fredoka, sans-serif';
      ctx.fillText(`${earnedCount}/${stickers.length}`, groupStartX + totalGW + 6, 378);

      for (let gi = 0; gi < groups.length; gi++) {
        const gKey = groups[gi];
        const gx = groupStartX + gi * (groupW + groupGap);
        const gy = 390;
        const gColor = gameColors[gKey];
        const gStickers = stickers.filter((s) => s.id.startsWith(gKey));

        // group card
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.roundRect(gx, gy, groupW, 90, 12);
        ctx.fill();

        // color accent bar
        ctx.fillStyle = gColor;
        ctx.beginPath();
        ctx.roundRect(gx, gy, groupW, 20, [12, 12, 0, 0]);
        ctx.fill();

        // game label
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(gameLabels[gKey], gx + groupW / 2, gy + 14);

        // sticker slots
        const slotW = Math.min(56, (groupW - 16) / 2 - 4);
        const slotSpacing = slotW + 8;
        const slotsWidth = gStickers.length * slotW + (gStickers.length - 1) * 8;
        const slotStartX = gx + (groupW - slotsWidth) / 2;
        for (let si = 0; si < gStickers.length; si++) {
          const sticker = gStickers[si];
          const slotX = slotStartX + si * slotSpacing;
          const slotY = gy + 30;
          const slotH = 52;

          if (sticker.earned) {
            // earned card
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotW, slotH, 8);
            ctx.fill();

            const stickerImg = getStickerImage(sticker.id);
            if (stickerImg && stickerImg.complete && stickerImg.naturalWidth > 0) {
              ctx.save();
              ctx.shadowColor = 'rgba(255,215,0,0.6)';
              ctx.shadowBlur = 6;
              const imgH = 28;
              const imgAspect = stickerImg.naturalWidth / stickerImg.naturalHeight;
              const imgW = imgH * imgAspect;
              ctx.drawImage(stickerImg, slotX + slotW / 2 - imgW / 2, slotY + 4, imgW, imgH);
              ctx.restore();
            } else {
              ctx.save();
              ctx.shadowColor = 'rgba(255,215,0,0.6)';
              ctx.shadowBlur = 6;
              ctx.font = '26px serif';
              ctx.textAlign = 'center';
              ctx.fillText(sticker.emoji, slotX + slotW / 2, slotY + 24);
              ctx.restore();
            }

            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '9px Fredoka, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(sticker.name, slotX + slotW / 2, slotY + 42);
          } else {
            // locked slot
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotW, slotH, 8);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotW, slotH, 8);
            ctx.stroke();

            // lock icon
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = '16px serif';
            ctx.textAlign = 'center';
            ctx.fillText('🔒', slotX + slotW / 2, slotY + 18);

            // progress bar
            const prog = Math.min(sticker.progress, sticker.threshold);
            const pct = prog / sticker.threshold;
            const barX = slotX + 6;
            const barY = slotY + 30;
            const barW = slotW - 12;
            const barH = 6;

            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 3);
            ctx.fill();

            if (pct > 0) {
              ctx.fillStyle = gColor;
              ctx.beginPath();
              ctx.roundRect(barX, barY, Math.max(barH, barW * pct), barH, 3);
              ctx.fill();
            }

            // progress text
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '8px Fredoka, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${prog}/${sticker.threshold}`, slotX + slotW / 2, slotY + 47);
          }
        }
      }

      // collection button
      const collBtnX = W / 2 - 80;
      const collBtnY = H - 65;
      const collBtnW = 160;
      const collBtnH = 36;
      const collHover = mx > collBtnX && mx < collBtnX + collBtnW && my > collBtnY && my < collBtnY + collBtnH;

      ctx.fillStyle = collHover ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.12)';
      ctx.beginPath();
      ctx.roundRect(collBtnX, collBtnY, collBtnW, collBtnH, 10);
      ctx.fill();
      ctx.strokeStyle = collHover ? 'rgba(255,215,0,0.6)' : 'rgba(255,215,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(collBtnX, collBtnY, collBtnW, collBtnH, 10);
      ctx.stroke();

      const slots = getAllSlots();
      const collected = getCollectionCount();
      ctx.fillStyle = collHover ? '#FFD700' : 'rgba(255,215,0,0.8)';
      ctx.font = 'bold 14px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Dino Collection ${collected}/${slots.length}`, W / 2, collBtnY + 23);

      // player name
      const playerName = getActiveProfile();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = 'bold 13px Fredoka, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Playing as: ${playerName}`, W - 16, H - 14);

      // footer
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click a game or use ← → arrow keys!', W / 2, H - 14);

      drawCustomCursor(ctx, mx, my, !mouse.isTouch, mouse.mouseDown);
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

      // collection button
      const collBtnX = W / 2 - 80;
      const collBtnY = H - 65;
      if (mx > collBtnX && mx < collBtnX + 160 && my > collBtnY && my < collBtnY + 36) {
        onSelectGame('collection' as GameId);
        return;
      }

      for (const card of CARDS) {
        if (mx > card.x && mx < card.x + card.w && my > card.y && my < card.y + card.h) {
          onSelectGame(card.id);
          return;
        }
      }
    },
    [onSelectGame],
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onTouchEnd={handleClick}
      tabIndex={0}
      role="application"
      aria-label="Dino Learn - choose a game to play"
      style={{ cursor: 'none', borderRadius: 16, display: 'block', width: '100%', maxWidth: W, outline: 'none' }}
    />
  );
}
