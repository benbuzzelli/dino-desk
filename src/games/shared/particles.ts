import type { Particle } from './types';

const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF69B4', '#DDA0DD'];

export function spawnCelebration(x: number, y: number, count = 12): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 80 + Math.random() * 120;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 0.6 + Math.random() * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 6,
    });
  }
  return particles;
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  let writeIdx = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt;
    p.life -= dt / p.maxLife;
    if (p.life > 0) {
      particles[writeIdx++] = p;
    }
  }
  particles.length = writeIdx;
  return particles;
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
