/*
 * ============================================================
 *  CONFIG — the one place to change assets and defaults.
 * ============================================================
 *
 *  SOUNDS live in:  assets/sounds/
 *  IMAGES live in:  assets/images/
 *
 *  Drop a file in with the matching name (or change the path below).
 *  Any sound file that is missing falls back to a built-in synth beep,
 *  and any image that is missing is simply not shown — so nothing breaks.
 *  Set a path to null to disable it entirely.
 *  A sound can also be a list of paths — one is picked at random each time
 *  it plays (never the same one twice in a row). Missing files in a list
 *  are skipped.
 */
const CONFIG = {
  sounds: {
    countdown: 'assets/sounds/countdown.mp3', // each 3-2-1 beat
    go:        'assets/sounds/go.mp3',        // round starts
    lock:      'assets/sounds/lock.mp3',      // a letter gets used
    tick:      'assets/sounds/tick.mp3',      // last few seconds of a turn
    buzzer: [                                 // time ran out — random pick
      'assets/sounds/buzzer-1.mp3',
      'assets/sounds/buzzer-2.mp3',
      'assets/sounds/buzzer-3.mp3',
    ],
    win:       'assets/sounds/win.mp3',       // all 26 letters used
  },

  images: {
    logo:       'assets/images/logo.png',       // shown above the title on the setup screen
    background: 'assets/images/background.jpg', // full-page background (covers the gradient)
  },

  // Setup values used the very first time (after that, your last settings are remembered)
  defaults: {
    category: '',
    timeLimit: 5,
    pauseAfterFail: true,
    lives: 3,
    players: [], // names, in turn order
  },

  countdownSeconds: 3, // pre-round 3-2-1
  firstTurnBonus: 1,   // extra seconds on the first turn (the GO! overlay covers the screen briefly)
  warnSeconds: 3,      // timer turns red + ticks below this
  volume: 0.8,         // 0..1, for sound files
};
