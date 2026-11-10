/*
 * Sound playback. Uses the files listed in CONFIG.sounds when they exist,
 * otherwise plays a synthesized fallback so the game works with no assets.
 */
const Sound = (() => {
  // Fallback synth: list of notes { f: frequency Hz, d: duration s, at: start offset s, type }
  const FALLBACK = {
    countdown: [{ f: 660, d: 0.15 }],
    go:        [{ f: 880, d: 0.12 }, { f: 1320, d: 0.3, at: 0.12 }],
    lock:      [{ f: 520, d: 0.06 }, { f: 780, d: 0.1, at: 0.06 }],
    tick:      [{ f: 1200, d: 0.05, type: 'square' }],
    buzzer:    [{ f: 130, d: 0.7, type: 'sawtooth' }, { f: 98, d: 0.7, type: 'sawtooth' }],
    win:       [523, 659, 784, 1047].map((f, i) => ({ f, d: 0.25, at: i * 0.12 })),
  };

  const files = {};    // name -> [HTMLAudioElement, ...] that loaded
  const lastPick = {}; // name -> index played last time
  let ctx = null;

  function init() {
    for (const [name, paths] of Object.entries(CONFIG.sounds)) {
      for (const path of [].concat(paths || [])) { // accepts one path or a list
        if (!path) continue;
        const audio = new Audio();
        audio.preload = 'auto';
        audio.addEventListener('canplaythrough', () => { (files[name] ||= []).push(audio); }, { once: true });
        audio.src = path;
      }
    }
  }

  // Random loaded variant, avoiding an immediate repeat when there's a choice
  function pick(name) {
    const loaded = files[name];
    if (!loaded) return null;
    if (loaded.length === 1) return loaded[0];
    let i;
    do i = Math.floor(Math.random() * loaded.length); while (i === lastPick[name]);
    lastPick[name] = i;
    return loaded[i];
  }

  // Call from a user gesture so the browser allows audio later
  function unlock() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function beep(name) {
    const notes = FALLBACK[name];
    if (!notes) return;
    unlock();
    const now = ctx.currentTime;
    for (const { f, d, at = 0, type = 'sine' } of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      const start = now + at;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + d + 0.02);
    }
  }

  function play(name) {
    const audio = pick(name);
    if (!audio) return beep(name);
    const clip = audio.cloneNode(); // clone so rapid repeats can overlap
    clip.volume = CONFIG.volume;
    clip.play().catch(() => beep(name));
  }

  return { init, unlock, play };
})();
