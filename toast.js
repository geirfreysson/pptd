// The toast view (toast.html). main sends 'toast' with { text, kind, undo }; the page reports
// its size, main fits the view to it and answers 'toast-placed', and the card animates in.
// A new toast while one is up replaces it in place.
const t = window.toast;
const $ = (id) => document.getElementById(id);
const card = $('card'), text = $('text'), badge = $('badge'), undo = $('undo'), sep = $('sep'), timer = $('timer');

const ICONS = {
  info: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.4l2.6 2.6L11 4.4"/></svg>',
  error: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 3.5v4.2"/><circle cx="7" cy="10.4" r=".4" fill="currentColor"/></svg>',
  busy: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 1.8a5.2 5.2 0 1 1-5.2 5.2" /></svg>',
};
const LIFE = { info: 5000, undo: 7000, error: 9000, busy: 60000 };

let state = 'hidden';            // hidden | waiting (for 'toast-placed') | shown | leaving
let deadline = 0, remaining = 0, clock = null;

function startClock(ms) {
  clearTimeout(clock);
  remaining = ms;
  deadline = Date.now() + ms;
  clock = setTimeout(dismiss, ms);
  timer.classList.remove('run');
  void timer.offsetWidth;        // restart the hairline animation
  timer.style.setProperty('--life', `${ms}ms`);
  timer.classList.add('run');
}

t.onShow(({ text: msg, kind = 'info', undo: canUndo = false, hint = '' } = {}) => {
  kind = ICONS[kind] ? kind : 'info';
  text.textContent = msg;
  $('hintText').textContent = hint;
  $('hint').hidden = !hint;
  card.title = hint ? `${msg} ${hint}` : msg;
  card.classList.toggle('error', kind === 'error');
  card.classList.toggle('busy', kind === 'busy');
  badge.innerHTML = ICONS[kind];
  undo.hidden = sep.hidden = !canUndo;

  const r = document.body.getBoundingClientRect();
  t.size(Math.ceil(r.width), Math.ceil(r.height));

  if (state === 'shown') {
    card.classList.remove('bump');
    void card.offsetWidth;
    card.classList.add('bump');
  } else {
    card.classList.remove('in', 'out', 'bump');
    state = 'waiting';
  }
  startClock(LIFE[kind === 'info' && (canUndo || hint) ? 'undo' : kind]);
});

t.onPlaced(() => {
  if (state !== 'waiting') return;
  state = 'shown';
  void card.offsetWidth;
  card.classList.add('in');
});

function dismiss() {
  clearTimeout(clock);
  if (state === 'hidden' || state === 'leaving') return;
  state = 'leaving';
  card.classList.remove('in', 'bump');
  card.classList.add('out');
}
t.onDismiss(dismiss);

card.addEventListener('animationend', (e) => {
  if (e.target !== card || e.animationName !== 'out' || state !== 'leaving') return;
  state = 'hidden';
  card.classList.remove('out');
  t.hidden();
});

// Hovering holds the toast; leaving gives it what it had left (at least a moment to read).
card.addEventListener('mouseenter', () => {
  if (state !== 'shown') return;
  clearTimeout(clock);
  remaining = Math.max(0, deadline - Date.now());
});
card.addEventListener('mouseleave', () => {
  if (state !== 'shown') return;
  const ms = Math.max(remaining, 1500);
  deadline = Date.now() + ms;
  clock = setTimeout(dismiss, ms);
});

$('close').addEventListener('click', () => { t.action('close'); dismiss(); });
undo.addEventListener('click', () => t.action('undo'));
