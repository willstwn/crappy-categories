/*
 * Sound playback. Every file listed in CONFIG.sounds is fetched and decoded
 * up front (Sound.init), so the first play has no loading delay. Any sound
 * with no usable file plays a synthesized fallback, so the game works with
 * no assets. Everything goes through one master volume (Sound.setVolume).
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

  // Browsers start this suspended until a user gesture; unlock() resumes it.
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  let volume = 1;

  const clips = {};    // name -> [AudioBuffer | HTMLAudioElement, ...] ready to play
  const lastPick = {}; // name -> index played last time

  const add = (name, clip) => (clips[name] ||= []).push(clip);

  async function load(name, path) {
    let data;
    try {
      const res = await fetch(path);
      if (!res.ok) return; // missing file: synth fallback
      data = await res.arrayBuffer();
    } catch {
      // fetch is blocked when the page is opened as a file://, so let an <audio> element load it
      const audio = new Audio();
      audio.preload = 'auto';
      audio.addEventListener('canplaythrough', () => add(name, audio), { once: true });
      audio.src = path;
      return;
    }
    try { add(name, await ctx.decodeAudioData(data)); } catch { /* unreadable file: synth fallback */ }
  }

  function init() {
    for (const [name, paths] of Object.entries(CONFIG.sounds)) {
      for (const path of [].concat(paths || [])) { // accepts one path or a list
        if (path) load(name, path);
      }
    }
  }

  // Random loaded variant, avoiding an immediate repeat when there's a choice
  function pick(name) {
    const loaded = clips[name];
    if (!loaded) return null;
    if (loaded.length === 1) return loaded[0];
    let i;
    do i = Math.floor(Math.random() * loaded.length); while (i === lastPick[name]);
    lastPick[name] = i;
    return loaded[i];
  }

  // Call from a user gesture so the browser allows audio
  function unlock() {
    if (ctx.state === 'suspended') ctx.resume();
  }

  function setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    master.gain.value = volume;
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
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + d + 0.02);
    }
  }

  function play(name) {
    const clip = pick(name);
    if (!clip) return beep(name);
    unlock();
    if (clip instanceof AudioBuffer) {
      const src = ctx.createBufferSource(); // a fresh source per play, so rapid repeats overlap
      src.buffer = clip;
      src.connect(master);
      src.start();
    } else {
      const el = clip.cloneNode();
      el.volume = volume;
      el.play().catch(() => beep(name));
    }
  }

  return { init, unlock, play, setVolume };
})();
