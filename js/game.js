/*
 * Game logic. States:
 *   setup -> countdown -> running <-> paused -> (setup | done)
 */
(() => {
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const STORAGE_KEY = 'crappy-categories.settings';
  const MAX_HEARTS = 5; // above this, lives show as "♥ ×n"
  const $ = (id) => document.getElementById(id);

  const els = {
    setup: $('setup'),
    game: $('game'),
    form: $('setup-form'),
    category: $('category'),
    timeLimit: $('time-limit'),
    lives: $('lives'),
    pauseAfterFail: $('pause-after-fail'),
    playerList: $('player-list'),
    playerName: $('player-name'),
    addPlayer: $('add-player'),
    volume: $('volume'),
    volumeOut: $('volume-out'),
    testSound: $('test-sound'),
    logo: $('logo'),
    categoryDisplay: $('category-display'),
    turn: $('turn'),
    turnName: $('turn-name'),
    turnNext: $('turn-next'),
    timerNumber: $('timer-number'),
    timerFill: $('timer-fill'),
    letters: $('letters'),
    roster: $('roster'),
    lettersLeft: $('letters-left'),
    status: $('status'),
    overlay: $('overlay'),
  };

  let settings = loadSettings();
  let state = 'setup';
  let used = new Set();
  let history = []; // { letter, turn } or { fail: playerIndex, turn } — for undo
  let players = []; // { name, lives } during a game
  let turn = -1;    // index into players, -1 when playing without players
  let remaining = 0;
  let lastFrame = 0;
  let expired = false; // timer hit zero and we're waiting on the GM
  let countdownTimers = [];
  const tiles = {};

  const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  // ---------- settings ----------

  function loadSettings() {
    try {
      const s = { ...CONFIG.defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
      const v = Number(s.volume);
      return {
        ...s,
        players: Array.isArray(s.players) ? [...s.players] : [],
        volume: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : CONFIG.defaults.volume,
      };
    } catch {
      return { ...CONFIG.defaults, players: [...CONFIG.defaults.players] };
    }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }

  function fillForm() {
    els.category.value = settings.category;
    els.timeLimit.value = settings.timeLimit;
    els.lives.value = settings.lives;
    els.pauseAfterFail.checked = settings.pauseAfterFail;
    els.volume.value = Math.round(settings.volume * 100);
    els.volumeOut.textContent = `${els.volume.value}%`;
    renderPlayerList();
  }

  function readForm() {
    const t = parseFloat(els.timeLimit.value);
    const l = parseInt(els.lives.value, 10);
    settings = {
      ...settings,
      category: els.category.value.trim(),
      timeLimit: Number.isFinite(t) && t >= 0.5 ? t : CONFIG.defaults.timeLimit,
      lives: Number.isFinite(l) && l >= 1 ? Math.min(l, 99) : CONFIG.defaults.lives,
      pauseAfterFail: els.pauseAfterFail.checked,
    };
    els.timeLimit.value = settings.timeLimit;
    els.lives.value = settings.lives;
  }

  // ---------- setup: players ----------

  function renderPlayerList() {
    els.playerList.innerHTML = '';
    settings.players.forEach((name, i) => {
      const li = document.createElement('li');
      li.className = 'player-chip';
      const label = document.createElement('span');
      label.textContent = name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-remove';
      remove.textContent = '×';
      remove.title = `Remove ${name}`;
      remove.addEventListener('click', () => {
        settings.players.splice(i, 1);
        saveSettings();
        renderPlayerList();
      });
      li.append(label, remove);
      els.playerList.append(li);
    });
    els.playerList.hidden = settings.players.length === 0;
  }

  function openNameInput() {
    els.playerName.hidden = false;
    els.playerName.focus();
  }

  function closeNameInput() {
    els.playerName.value = '';
    els.playerName.hidden = true;
  }

  function commitName() {
    const name = els.playerName.value.trim();
    if (!name) return false;
    settings.players = [...settings.players, name];
    saveSettings();
    renderPlayerList();
    els.playerName.value = '';
    return true;
  }

  els.addPlayer.addEventListener('click', () => {
    if (els.playerName.hidden) openNameInput();
    else { commitName(); els.playerName.focus(); }
  });

  els.playerName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // don't submit the setup form
      if (!commitName()) closeNameInput(); // Enter on empty = done adding
    } else if (e.key === 'Escape') {
      closeNameInput();
    }
  });

  els.playerName.addEventListener('blur', () => {
    // small delay so clicking "+ Add player" still sees the typed name
    setTimeout(() => {
      if (document.activeElement !== els.playerName && !els.playerName.value.trim()) closeNameInput();
    }, 150);
  });

  // ---------- setup: volume ----------

  els.volume.addEventListener('input', () => {
    settings.volume = els.volume.value / 100;
    els.volumeOut.textContent = `${els.volume.value}%`;
    Sound.setVolume(settings.volume);
  });
  els.volume.addEventListener('change', saveSettings); // once the slider is let go

  els.testSound.addEventListener('click', () => {
    Sound.unlock();
    Sound.play('go');
  });

  // ---------- setup: misc ----------

  function buildTiles() {
    for (const letter of LETTERS) {
      const tile = document.createElement('button');
      tile.className = 'tile';
      tile.textContent = letter;
      tile.tabIndex = -1;
      tile.addEventListener('mousedown', (e) => e.preventDefault()); // don't steal focus (space would click it)
      tile.addEventListener('click', () => useLetter(letter));
      els.letters.append(tile);
      tiles[letter] = tile;
    }
  }

  function loadImages() {
    const { logo, background } = CONFIG.images;
    if (logo) {
      const img = new Image();
      img.onload = () => { els.logo.src = logo; els.logo.hidden = false; };
      img.src = logo;
    }
    if (background) {
      const img = new Image();
      img.onload = () => document.body.style.setProperty('--bg-image', `url("${background}")`);
      img.src = background;
    }
  }

  function showScreen(name) {
    els.setup.classList.toggle('active', name === 'setup');
    els.game.classList.toggle('active', name === 'game');
  }

  // ---------- overlay ----------

  function showOverlay(kind, html) {
    els.overlay.dataset.kind = kind;
    els.overlay.innerHTML = html;
    els.overlay.hidden = false;
  }

  function hideOverlay() {
    els.overlay.hidden = true;
    els.overlay.dataset.kind = '';
  }

  // ---------- pause banner (under the timer, doesn't cover the board) ----------

  function showStatus(kind, title, detail = '') {
    els.status.dataset.kind = kind;
    els.status.innerHTML = `
      <span class="status-tag">${title}</span>
      ${detail ? `<span class="status-detail">${detail}</span>` : ''}
      <span class="status-actions">
        <button class="btn-ghost btn-small" data-action="resume"><kbd>Space</kbd> Resume</button>
        <button class="btn-ghost btn-small" data-action="exit"><kbd>Esc</kbd> Exit</button>
      </span>`;
  }

  function clearStatus() {
    els.status.innerHTML = '';
    els.status.dataset.kind = '';
  }

  // ---------- players during a game ----------

  const alive = () => players.filter((p) => p.lives > 0);

  function nextAlive(from) {
    for (let i = 1; i <= players.length; i++) {
      const idx = (from + i) % players.length;
      if (players[idx].lives > 0) return idx;
    }
    return from;
  }

  function advanceTurn() {
    if (players.length) turn = nextAlive(turn);
    renderTurn();
  }

  // Returns a finish message if the round is over because of lives, else null
  function livesGameOver() {
    if (!players.length) return null;
    const left = alive();
    if (players.length > 1 && left.length === 1) return { title: `${esc(left[0].name)} wins!`, detail: 'Last one standing.' };
    if (left.length === 0) return { title: 'Game over', detail: 'Everyone is out of lives.' };
    return null;
  }

  // ---------- game flow ----------

  function startGame() {
    readForm();
    saveSettings();
    Sound.unlock();

    used = new Set();
    history = [];
    players = settings.players.map((name) => ({ name, lives: settings.lives }));
    turn = players.length ? 0 : -1;
    for (const tile of Object.values(tiles)) tile.className = 'tile';
    els.categoryDisplay.textContent = settings.category || 'Anything goes';
    remaining = settings.timeLimit + CONFIG.firstTurnBonus;
    expired = false;

    els.game.classList.toggle('has-players', players.length > 0);
    showScreen('game');
    renderRoster();
    renderTurn();
    render();
    runCountdown();
  }

  function runCountdown() {
    state = 'countdown';
    const n = CONFIG.countdownSeconds;
    const at = (ms, fn) => countdownTimers.push(setTimeout(fn, ms));

    for (let i = 0; i < n; i++) {
      at(i * 1000, () => {
        showOverlay('countdown', `<div class="count-num">${n - i}</div>`);
        Sound.play('countdown');
      });
    }
    at(n * 1000, () => {
      showOverlay('countdown', `<div class="count-num go">GO!</div>`);
      Sound.play('go');
      state = 'running';
      lastFrame = performance.now();
    });
    at(n * 1000 + 700, () => {
      if (els.overlay.dataset.kind === 'countdown') hideOverlay();
    });
  }

  function clearCountdown() {
    countdownTimers.forEach(clearTimeout);
    countdownTimers = [];
  }

  function pause(kind = 'paused', title = '⏸ Paused', detail = '') {
    clearCountdown();
    if (els.overlay.dataset.kind === 'countdown') hideOverlay(); // paused during "GO!"
    state = 'paused';
    els.game.classList.add('paused');
    showStatus(kind, title, detail);
  }

  function resume() {
    if (expired) {
      remaining = settings.timeLimit;
      expired = false;
    }
    state = 'running';
    lastFrame = performance.now();
    els.game.classList.remove('paused');
    clearStatus();
  }

  function timeUp() {
    remaining = 0;
    Sound.play('buzzer');
    flash('fail');

    let detail = '';
    if (players.length) {
      const failed = turn;
      const p = players[failed];
      history.push({ fail: failed, turn });
      p.lives--;
      renderRoster();
      retrigger(els.roster.children[failed], 'hurt');

      const over = livesGameOver();
      if (over) return finish(over.title, over.detail);

      advanceTurn();
      detail = p.lives > 0
        ? `${esc(p.name)} loses a life — ${p.lives} left`
        : `${esc(p.name)} is out!`;
      detail += ` · Up next: <strong>${esc(players[turn].name)}</strong>`;
    }

    if (settings.pauseAfterFail) {
      expired = true;
      pause('timeup', "Time's up!", detail);
    } else {
      remaining = settings.timeLimit;
    }
  }

  function useLetter(letter) {
    if (state !== 'running' && state !== 'paused') return;
    const tile = tiles[letter];
    if (used.has(letter)) {
      retrigger(tile, 'shake');
      return;
    }
    used.add(letter);
    history.push({ letter, turn });
    tile.classList.add('used');
    retrigger(tile, 'pop');
    Sound.play('lock');

    // next player's turn
    remaining = settings.timeLimit;
    expired = false;
    advanceTurn();
    if (state === 'paused') pause(); // a "Time's up!" banner would now be stale

    if (used.size === LETTERS.length) finish('Round complete!', 'genuinely how');
  }

  function undo() {
    if (state !== 'running' && state !== 'paused') return;
    const entry = history.pop();
    if (!entry) return;
    if (entry.letter) {
      used.delete(entry.letter);
      tiles[entry.letter].classList.remove('used', 'pop');
    } else {
      players[entry.fail].lives++;
      renderRoster();
    }
    turn = entry.turn;
    remaining = settings.timeLimit; // the restored player gets a fresh turn
    expired = false;
    renderTurn();
    if (state === 'paused') pause();
  }

  function finish(title, detail) {
    state = 'done';
    els.game.classList.remove('paused');
    clearStatus();
    Sound.play('win');
    showOverlay('done', `
      <div class="panel">
        <h2>${title}</h2>
        <p>${detail}</p>
        <div class="panel-actions">
          <button class="btn-primary" data-action="exit"><kbd>Space</kbd> Back to setup</button>
        </div>
      </div>`);
  }

  function exitToSetup() {
    clearCountdown();
    state = 'setup';
    hideOverlay();
    els.game.classList.remove('paused');
    clearStatus();
    fillForm();
    showScreen('setup');
    els.category.focus();
  }

  // ---------- rendering ----------

  function retrigger(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }

  function flash(kind) {
    retrigger(els.game, `flash-${kind}`);
  }

  function hearts(lives) {
    if (settings.lives > MAX_HEARTS) return `♥ ×${lives}`;
    return '♥'.repeat(lives) + `<span class="lost">${'♥'.repeat(settings.lives - lives)}</span>`;
  }

  function renderRoster() {
    els.roster.hidden = players.length === 0;
    els.roster.innerHTML = players.map((p, i) => `
      <div class="roster-row${i === turn ? ' current' : ''}${p.lives <= 0 ? ' out' : ''}">
        <span class="roster-name">${esc(p.name)}</span>
        <span class="roster-lives">${hearts(Math.max(0, p.lives))}</span>
      </div>`).join('');
  }

  function renderTurn() {
    els.turn.hidden = players.length === 0;
    if (!players.length) return;
    els.turnName.textContent = players[turn].name;
    const next = nextAlive(turn);
    els.turnNext.textContent = next === turn ? '—' : players[next].name;
    retrigger(els.turn, 'bump');
    [...els.roster.children].forEach((row, i) => row.classList.toggle('current', i === turn));
  }

  function render() {
    const ratio = Math.min(1, Math.max(0, remaining / settings.timeLimit));
    els.timerNumber.textContent = remaining.toFixed(1);
    els.timerFill.style.transform = `scaleX(${ratio})`;
    els.game.classList.toggle('warn', remaining <= CONFIG.warnSeconds && state !== 'countdown');
    const left = LETTERS.length - used.size;
    els.lettersLeft.textContent = `${left} letter${left === 1 ? '' : 's'} left`;
  }

  function frame(now) {
    const dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (state === 'running') {
      const prev = remaining;
      remaining -= dt;
      if (remaining > 0 && remaining <= CONFIG.warnSeconds && Math.ceil(remaining) < Math.ceil(prev)) {
        Sound.play('tick');
      }
      if (remaining <= 0) timeUp();
    }
    if (state !== 'setup') render();
    requestAnimationFrame(frame);
  }

  // ---------- input ----------

  document.addEventListener('keydown', (e) => {
    if (state === 'setup' || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      if (state === 'running') pause();
      else if (state === 'paused') resume();
      else if (state === 'done') exitToSetup();
      return;
    }
    if (e.key === 'Escape') {
      if (state !== 'running') exitToSetup(); // paused, done, or mid-countdown
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      undo();
      return;
    }
    if (/^[a-z]$/i.test(e.key) && !e.repeat) {
      useLetter(e.key.toUpperCase());
    }
  });

  for (const el of [els.overlay, els.status]) {
    el.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus off buttons (Space would click them)
    el.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'resume' && state === 'paused') resume();
      if (action === 'exit') exitToSetup();
    });
  }

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    startGame();
  });

  // ---------- boot ----------

  buildTiles();
  fillForm();
  loadImages();
  Sound.init();
  Sound.setVolume(settings.volume);
  requestAnimationFrame((now) => { lastFrame = now; frame(now); });
})();
