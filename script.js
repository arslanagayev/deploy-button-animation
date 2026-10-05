import { mountReel, sleep } from './reel/reel.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const card = document.querySelector('.deploy');
const fx = card.querySelector('.fx');
const log = card.querySelector('.term-log');
const button = card.querySelector('.ship');
const labels = [...button.querySelectorAll('.ship-text')];
const env = card.querySelector('.term-env');

// Each step owns a slice of the button's fill (from -> to).
const STEPS = [
  { name: 'build', ms: 900, result: '1.2s', to: 0.3 },
  { name: 'test', ms: 800, result: '128 passed', to: 0.55 },
  { name: 'upload', ms: 1300, result: '2.4 MB', to: 0.85, bar: true },
];
const SPINNER = ['|', '/', '-', '\\'];

// Vector-display rocket (viewBox 64 x 128, drawn at 80 x 160). Every ".line" is drawn on stroke by stroke before ignition.
const ROCKET = `
  <svg viewBox="0 0 64 128">
    <path class="flame" d="M24 94 Q32 128 40 94 Q32 106 24 94 Z"/>
    <path class="line" d="M18 60 L6 90 L18 84 M46 60 L58 90 L46 84"/>
    <path class="line" d="M24 84 L22 92 L42 92 L40 84"/>
    <path class="line" d="M32 4 C45 18 49 42 46 84 L18 84 C15 42 19 18 32 4 Z"/>
    <circle class="line" cx="32" cy="38" r="7"/>
    <path class="line" d="M21 64 L43 64"/>
  </svg>`;

const setState = (state) => { card.dataset.state = state; };
const setLabel = (text) => labels.forEach((label) => { label.textContent = text; });
const setFill = (p) => button.style.setProperty('--p', p.toFixed(3));

/** Centre of an element in the card's own coordinates (ignores any CSS scale on the page). */
function centreIn(el) {
  const c = card.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const scale = c.width / card.offsetWidth;
  return { x: (r.left + r.width / 2 - c.left) / scale, y: (r.top + r.height / 2 - c.top) / scale };
}

/* ---------- Terminal log ---------- */

function logLine() {
  const li = document.createElement('li');
  li.innerHTML = '<span class="log-ps">&gt;</span><span class="log-name"></span><span class="log-value"></span>';
  log.append(li);
  return { name: li.querySelector('.log-name'), value: li.querySelector('.log-value') };
}

async function type(el, text) {
  for (const ch of text) {
    el.textContent += ch;
    if (!reducedMotion) await sleep(32);
  }
}

const asciiBar = (p) => {
  const filled = Math.round(p * 12);
  return `[${'#'.repeat(filled)}${'-'.repeat(12 - filled)}] ${String(Math.round(p * 100)).padStart(3)}%`;
};

/** One pipeline step: a spinner (or an ASCII progress bar) until it finishes, then [  OK  ]. */
async function runStep(step, from) {
  const { name, value } = logLine();
  await type(name, step.name);
  const start = performance.now();
  for (let frame = 0; ; frame++) {
    const t = Math.min(1, (performance.now() - start) / step.ms);
    value.textContent = step.bar ? asciiBar(1 - (1 - t) ** 2) : SPINNER[frame % SPINNER.length];
    setFill(from + (step.to - from) * t);
    if (t === 1) break;
    await sleep(70);
  }
  value.innerHTML = `<b>[  OK  ]</b> <span class="dim">${step.result}</span>`;
}

/* ---------- Liftoff ---------- */

/** A smoke ring that rolls away from (x, y) and fades like phosphor afterglow. */
function puff(x, y, dx, dy, duration = 1100) {
  const ring = document.createElement('span');
  ring.className = 'puff';
  fx.append(ring);
  ring.animate([
    { transform: `translate(${x}px, ${y}px) scale(0.4)`, opacity: 0.9 },
    { transform: `translate(${x + dx}px, ${y + dy}px) scale(2.2)`, opacity: 0 },
  ], { duration, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished.then(() => ring.remove());
}

/** A hot spark that drops out of the nozzle and cools down. */
function spark(x, y) {
  const dot = document.createElement('span');
  dot.className = 'spark';
  fx.append(dot);
  dot.animate([
    { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
    { transform: `translate(${x + (Math.random() - 0.5) * 18}px, ${y + 40 + Math.random() * 40}px) scale(0.2)`, opacity: 0 },
  ], { duration: 650, easing: 'ease-out' }).finished.then(() => dot.remove());
}

const SHAKE = ['0 0', '-3px 2px', '3px -2px', '-2px -1px', '2px 2px', '-1px 1px', '0 0'].map((translate) => ({ translate }));

async function launch() {
  const pad = centreIn(button);
  const padTop = pad.y - button.offsetHeight / 2;
  const x = pad.x - 40;
  const y = padTop - 117; // nozzle sits on the button (rocket box is 80 x 160)

  const rocket = document.createElement('div');
  rocket.className = 'rocket';
  rocket.innerHTML = ROCKET;
  rocket.style.transform = `translate(${x}px, ${y}px)`;
  fx.append(rocket);

  // 1. Draw the outline stroke by stroke, like a vector display.
  await Promise.all([...rocket.querySelectorAll('.line')].map((path, i) => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    return path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
      { duration: 480, delay: i * 70, easing: 'ease-out', fill: 'backwards' }).finished;
  }));

  // 2. Ignition: the flame flickers, smoke rolls out over the pad and the whole card shakes.
  rocket.classList.add('lit');
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    puff(pad.x + side * 12, padTop - 4, side * (40 + Math.random() * 110), -8 - Math.random() * 34, 900 + Math.random() * 500);
  }
  card.animate(SHAKE, { duration: 340, iterations: 2 });
  await sleep(700);

  // 3. Liftoff: accelerate up (t^2.6 feels like thrust) and leave an exhaust trail.
  const distance = y + 1100;
  const duration = 1300;
  const start = performance.now();
  await new Promise((resolve) => {
    let frame = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const dy = distance * t ** 2.6;
      const sway = Math.sin(t * 14) * 2 * (1 - t);
      rocket.style.transform = `translate(${x + sway}px, ${y - dy}px)`;
      rocket.style.setProperty('--thrust', (1 + t * 1.2).toFixed(2)); // the flame grows with speed
      if (t < 0.9) {
        spark(x + 40 + sway, y - dy + 124);
        if (frame++ % 3 === 0) puff(x + 40 + sway, y - dy + 130, (Math.random() - 0.5) * 30, 30, 1300);
      }
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  rocket.remove();
}

/* ---------- The deploy ---------- */

let running = false;

async function deploy() {
  if (running) return;
  running = true;
  reset();
  button.disabled = true;
  setState('deploying');
  setLabel('Deploying');

  let from = 0;
  for (const step of STEPS) {
    await runStep(step, from);
    from = step.to;
  }

  // Countdown on the button and in the log.
  const countdown = logLine();
  await type(countdown.name, 'launch');
  countdown.value.classList.add('hot');
  for (const n of [3, 2, 1]) {
    countdown.value.textContent = `T-${n}`;
    setLabel(`T-${n}`);
    setFill(from + (1 - from) * ((4 - n) / 3));
    await sleep(reducedMotion ? 0 : 520);
  }
  countdown.value.textContent = 'LIFTOFF';
  setLabel('Liftoff');
  if (!reducedMotion) {
    await launch();
    card.animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 500, easing: 'ease-out' }); // CRT bloom flash
  }

  const live = logLine();
  await type(live.name, 'live');
  live.value.innerHTML = '<b>[  OK  ]</b> <span class="url">arslanagayev.dev</span>';
  env.textContent = 'live';
  setState('live');
  setLabel('Live');
  button.disabled = false; // clicking again redeploys
  running = false;
}

function reset() {
  log.replaceChildren();
  fx.replaceChildren();
  setState('idle');
  setLabel('> Deploy');
  setFill(0);
  env.textContent = 'main';
  button.disabled = false;
}

button.addEventListener('click', deploy);

/* ---------- Reel mode ---------- */

mountReel({
  eyebrow: 'UI animation #04',
  title: 'Rocket',
  accent: 'Deploy',
  demo: card,
  demoScale: 1.75,
  file: 'deploy-button-animation/script.js',
  code: `
// Liftoff: accelerate up, leave an exhaust trail
const tick = (now) => {
  const t = Math.min(1, (now - start) / duration);
  const dy = distance * t ** 2.6;   // feels like thrust
  rocket.style.transform =
    \`translate(\${x}px, \${y - dy}px)\`;
  if (t < 0.9) spark(x + 40, y - dy + 124);
  if (t < 1) requestAnimationFrame(tick);
};
requestAnimationFrame(tick);`,
  reset: () => { running = false; reset(); },
  async play({ cursor, sleep, waitFor }) {
    await cursor.click(button);
    await waitFor(() => card.dataset.state === 'live', 20000);
    await sleep(1800);
  },
});
