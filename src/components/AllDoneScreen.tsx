import { useGameCanvas } from '../games/shared/useGameCanvas';
import { drawDino } from '../games/shared/draw';

const W = 800;
const H = 600;

export function AllDoneScreen() {
  const { canvasRef } = useGameCanvas({
    width: W,
    height: H,
    title: 'All Done!',
    onDraw(ctx, mouse) {
      const t = mouse.time;

      // night sky gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0a0a2e');
      bg.addColorStop(0.6, '#16213e');
      bg.addColorStop(1, '#1a3a1a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // moon
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,200,0.4)';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#FFF8E1';
      ctx.beginPath();
      ctx.arc(650, 80, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0a2e';
      ctx.beginPath();
      ctx.arc(665, 70, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // twinkling stars
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97 + 30) % W;
        const sy = (i * 53 + 15) % (H * 0.55);
        const twinkle = 0.2 + Math.sin(t * 1.5 + i * 2.3) * 0.3;
        ctx.globalAlpha = Math.max(0, twinkle);
        ctx.beginPath();
        ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ground
      ctx.fillStyle = '#2a5a2a';
      ctx.beginPath();
      ctx.ellipse(W / 2, H + 40, W * 0.7, 120, 0, Math.PI, Math.PI * 2);
      ctx.fill();

      // sleeping dino (gentle breathing)
      const breathe = Math.sin(t * 1.2) * 3;
      drawDino(ctx, W / 2, H - 140 + breathe, 90, '#4CAF50', false, 'bronto');

      // zzz bubbles
      for (let i = 0; i < 3; i++) {
        const zx = W / 2 + 60 + i * 25;
        const zy = H - 200 - i * 30 + Math.sin(t * 0.8 + i) * 5;
        const zSize = 12 + i * 4;
        ctx.globalAlpha = 0.3 + i * 0.15;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `bold ${zSize}px Fredoka, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('z', zx, zy);
      }
      ctx.globalAlpha = 1;

      // main text
      ctx.save();
      ctx.font = 'bold 52px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeText('All Done! Great Job!', W / 2, 200);
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = 'rgba(255,215,0,0.4)';
      ctx.shadowBlur = 16;
      ctx.fillText('All Done! Great Job!', W / 2, 200);
      ctx.restore();

      // subtitle
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '20px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Time for a break. See you next time! 🦕', W / 2, 245);
    },
  });

  return (
    <canvas
      ref={canvasRef}
      role="application"
      aria-label="Session complete - time for a break"
      style={{ borderRadius: 16, display: 'block', width: '100%', maxWidth: W }}
    />
  );
}
