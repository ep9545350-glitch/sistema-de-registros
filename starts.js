// ===== ESTRELLAS SIDEBAR =====
const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const starColors = [
  '255,255,255',
  '180,160,255',
  '100,220,255',
  '255,180,100',
  '100,255,180',
  '255,120,180',
];

const stars = Array.from({ length: 80 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.2 + 0.2,
  alpha: Math.random() * 0.6 + 0.2,
  twinkleSpeed: Math.random() * 0.02 + 0.005,
  twinkleOffset: Math.random() * Math.PI * 2,
  color: starColors[Math.floor(Math.random() * starColors.length)],
}));

const shootingStars = [];

const shootingColors = [
  '255,255,255',
  '180,160,255',
  '100,220,255',
  '255,180,100',
  '100,255,180',
  '255,120,180',
];

function spawnShootingStar() {
  const len = Math.random() * 80 + 60;
  shootingStars.push({
    x: Math.random() * canvas.width,
    y: -len,                          // 🔥 nace fuera del borde superior
    len: len,
    speed: Math.random() * 4 + 3,
    angle: Math.PI / 2,               // 🔥 vertical hacia abajo
    alpha: 1,
    life: 0,
    maxLife: Math.random() * 40 + 200,
    color: shootingColors[Math.floor(Math.random() * shootingColors.length)],
  });
}

setInterval(spawnShootingStar, 200);

let frame = 0;

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  frame++;

  // Estrellas estáticas con parpadeo
  stars.forEach(s => {
    const alpha = s.alpha * (0.6 + 0.4 * Math.sin(frame * s.twinkleSpeed + s.twinkleOffset));
    ctx.beginPath();
    ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${s.color},${alpha})`;
    ctx.fill();
  });

  // Estrellas fugaces verticales
  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const ss = shootingStars[i];
    ss.life++;
    ss.x += Math.cos(ss.angle) * ss.speed;  // cos(90°) = 0, no se mueve en X
    ss.y += Math.sin(ss.angle) * ss.speed;  // sin(90°) = 1, cae recto
    ss.alpha = 1 - ss.life / ss.maxLife;

    if (ss.alpha <= 0) {
      shootingStars.splice(i, 1);
      continue;
    }

    // Estela arriba del punto actual
    const tailX = ss.x;
    const tailY = ss.y - ss.len;  // 🔥 estela vertical hacia arriba

    const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
    grad.addColorStop(0, `rgba(${ss.color},0)`);
    grad.addColorStop(1, `rgba(${ss.color},${ss.alpha})`);

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(ss.x, ss.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Punto brillante en la punta
    ctx.beginPath();
    ctx.arc(ss.x, ss.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${ss.color},${ss.alpha})`;
    ctx.fill();
  }

  requestAnimationFrame(draw);
}

draw();