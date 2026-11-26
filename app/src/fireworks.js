const COLOURS = ['#facc15', '#ffffff', '#f97316', '#38bdf8', '#a3e635'];
const BURST_INTERVAL_MS = 500;
const PARTICLES_PER_BURST = 60;

// Runs a canvas firework display for durationMs and returns a function that stops it early.
export function playFireworks(canvas, durationMs = 4000) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const started = performance.now();
  let lastBurst = -Infinity;
  let frame = 0;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.hidden = false;

  const burst = (x, y) => {
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        colour: COLOURS[i % COLOURS.length],
      });
    }
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.hidden = true;
  };

  const tick = (now) => {
    if (now - started >= durationMs) {
      stop();
      return;
    }
    if (now - lastBurst >= BURST_INTERVAL_MS) {
      burst(Math.random() * canvas.width, Math.random() * canvas.height * 0.6);
      lastBurst = now;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= 0.015;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
  return stop;
}
