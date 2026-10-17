/**
 * App-wide motion: 3D tilt + light glare on cards.
 *
 * One delegated pointer listener for the whole app, so pages need no
 * changes: any small card under the cursor leans toward it. Large panels
 * (tables, forms) are skipped because tilting them hurts readability, and
 * everything is off for prefers-reduced-motion or touch-only devices.
 */

const SELECTOR = "[data-tilt], main .rounded-2xl, main .rounded-xl.border";
const MAX_WIDTH = 640;     // wider elements don't tilt
const MAX_DEG = 7;

let active = null;

function reset(el) {
  el.style.removeProperty("--rx");
  el.style.removeProperty("--ry");
  el.removeAttribute("data-tilting");
}

function canTilt(el) {
  if (el.hasAttribute("data-tilt")) return true;
  if (el.closest("[data-no-tilt]")) return false;
  const { width } = el.getBoundingClientRect();
  if (width > MAX_WIDTH) return false;
  return !el.querySelector("input, textarea, select, table");
}

function onMove(e) {
  const el = e.target.closest?.(SELECTOR);
  if (active && active !== el) { reset(active); active = null; }
  if (!el || !canTilt(el)) return;

  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width;   // 0..1
  const py = (e.clientY - r.top) / r.height;
  // Smaller cards tilt more; a 600px panel barely moves.
  const strength = MAX_DEG * Math.max(0.25, 1 - r.width / (MAX_WIDTH * 1.4));
  el.style.setProperty("--rx", `${((0.5 - py) * strength).toFixed(2)}deg`);
  el.style.setProperty("--ry", `${((px - 0.5) * strength).toFixed(2)}deg`);
  el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
  el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
  el.setAttribute("data-tilting", "");
  active = el;
}

function onLeave() {
  if (active) { reset(active); active = null; }
}

export function initFx() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (reduced || !finePointer) return;
  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onLeave);
}
