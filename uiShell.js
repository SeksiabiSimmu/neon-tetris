import { SettingsPanel } from './src/ui/SettingsPanel.js';

// js/uiShell.js
//
// The UI shell owns navigation, menus, HUD, and game overlays. Settings
// controls and key rebinding live in SettingsPanel.
// Like EffectsManager/UIAnimator, this only ever *reads* Game/Scoring/
// Progression and calls their public methods (start, pause, equip,
// set) — it owns no gameplay state itself.
//
// Screens are plain DOM sections toggled with a `.active` class (CSS
// handles the fade/scale transition); this file's job is deciding which
// one is active and keeping each one's dynamic content in sync with the
// underlying data right before it's shown.

const TETRIS = window.TETRIS;

TETRIS.UIShell = class UIShell {
  constructor({ game, progression, settings, renderer, input, modeRecords, audio }) {
    this.game = game;
    this.progression = progression;
    this.settings = settings;
    this.renderer = renderer;
    this.input = input;
    this.modeRecords = modeRecords;
    this.audio = audio;

    this.screens = {};
    document.querySelectorAll('.screen').forEach((el) => {
      this.screens[el.id.replace('screen-', '')] = el;
    });

    this.currentScreen = null;
    this.hasShownScreen = false;
    this.screenBeforePause = null; // so Settings-from-Pause returns to Pause, not the main menu
    this.pendingModeConfig = {}; // modeId -> chosen config, while browsing mode-select
    this.settingsPanel = new SettingsPanel({
      game, progression, settings, renderer, input, audio,
      onProfileReset: () => {
        TETRIS.applyCosmetics(this.renderer, this.progression);
        this._renderMainMenu();
      },
    });

    this._bindMenu();
    this._bindPauseOverlay();
    this._bindGameOverOverlay();
    this.settingsPanel.bind();
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && !this.currentScreen) {
        const dialog = document.getElementById('pause-overlay').classList.contains('visible')
          ? document.getElementById('pause-overlay')
          : document.getElementById('game-over-overlay').classList.contains('visible')
            ? document.getElementById('game-over-overlay')
            : null;
        if (dialog) this._trapDialogFocus(event, dialog);
      }
      if (event.code !== 'Escape' || event.repeat || !this.currentScreen || this.settingsPanel.isRebinding) return;
      event.preventDefault();
      this._returnFromScreen();
    });

    this.showScreen('main-menu');
  }

  _trapDialogFocus(event, dialog) {
    const controls = Array.from(dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((element) => element.offsetParent !== null);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  // --- screen navigation ---------------------------------------------------

  showScreen(name) {
    const el = this.screens[name];
    if (!el) return;
    if (this.settingsPanel.isRebinding && name !== 'settings') this.settingsPanel.cancelRebinding();
    const previous = this.currentScreen;
    Object.values(this.screens).forEach((el) => el.classList.remove('active'));
    el.classList.add('active');
    this.currentScreen = name;
    this.input.setGameplayEnabled(false);
    if (this.hasShownScreen && previous !== name && this.audio) this.audio.play('menu');
    this.hasShownScreen = true;
    this._populateScreen(name);
    const firstFocusable = el.querySelector('button, input, select, a[href]');
    if (firstFocusable) firstFocusable.focus({ preventScroll: true });
  }

  hideAllScreens() {
    this.settingsPanel.cancelRebinding();
    Object.values(this.screens).forEach((el) => el.classList.remove('active'));
    this.currentScreen = null;
    this.input.setGameplayEnabled(true);
  }

  _returnFromScreen(backTarget = 'main-menu') {
    const target = this.screenBeforePause && this.currentScreen === 'settings'
      ? this.screenBeforePause
      : backTarget;
    this.screenBeforePause = null;
    if (target === 'pause') {
      this.hideAllScreens();
      if (this.audio) this.audio.play('menu');
      document.getElementById('resume-button').focus({ preventScroll: true });
    } else {
      this.showScreen(target);
    }
  }

  _populateScreen(name) {
    if (name === 'main-menu') this._renderMainMenu();
    else if (name === 'mode-select') this._renderModeSelectScreen();
    else if (name === 'progression') this._renderProgressionScreen();
    else if (name === 'achievements') this._renderAchievementsScreen();
    else if (name === 'statistics') this._renderStatisticsScreen();
    else if (name === 'customization') this._renderCustomizationScreen();
    else if (name === 'settings') this.settingsPanel.render();
  }

  // --- main menu -----------------------------------------------------------

  _bindMenu() {
    document.getElementById('menu-play-button').addEventListener('click', () => this.showScreen('mode-select'));
    document.getElementById('menu-resume-button').addEventListener('click', () => {
      this.hideAllScreens();
      if (this.audio) this.audio.play('menu');
      this.game.resume();
    });

    document.querySelectorAll('.menu-nav__btn').forEach((btn) => {
      btn.addEventListener('click', () => this.showScreen(btn.dataset.screen));
    });

    document.querySelectorAll('.screen-back').forEach((btn) => {
      btn.addEventListener('click', () => this._returnFromScreen(btn.dataset.back || 'main-menu'));
    });

    document.getElementById('menu-button').addEventListener('click', () => {
      if (this.game.state === TETRIS.GameState.PLAYING) this.game.pause();
      this.showScreen('main-menu');
    });

    document.getElementById('pause-button').addEventListener('click', () => this.game.togglePause());
  }

  _renderMainMenu() {
    document.getElementById('menu-player-level').textContent = this.progression.level;
    document.getElementById('menu-resume-button').classList.toggle('visible', this.game.state === TETRIS.GameState.PAUSED);
  }

  // --- mode select -----------------------------------------------------

  _renderModeSelectScreen() {
    const grid = document.getElementById('mode-select-grid');
    Object.values(TETRIS.GAME_MODES).forEach((mode) => {
      if (!this.pendingModeConfig[mode.id]) this.pendingModeConfig[mode.id] = { ...mode.defaultConfig };
    });
    grid.innerHTML = Object.values(TETRIS.GAME_MODES).map((mode) => this._modeCardHtml(mode)).join('');

    Object.values(TETRIS.GAME_MODES).forEach((mode) => {
      const card = grid.querySelector(`[data-mode-id="${mode.id}"]`);
      const select = card.querySelector('.mode-config-select');
      if (select) {
        select.addEventListener('change', () => {
          this._setPendingConfig(mode, select);
          card.querySelector('.mode-record').innerHTML = this._modeRecordHtml(mode);
        });
        this._setPendingConfig(mode, select);
      }
      card.querySelector('.mode-play-btn').addEventListener('click', () => {
        if (this.audio) this.audio.play('menu');
        this.hideAllScreens();
        this.game.start(mode.id, this.pendingModeConfig[mode.id]);
      });
    });
  }

  _setPendingConfig(mode, select) {
    if (mode.id === 'challenge') {
      this.pendingModeConfig[mode.id] = { challengeId: select.value };
    } else {
      const key = Object.keys(mode.configOptions)[0];
      this.pendingModeConfig[mode.id] = { [key]: Number(select.value) || select.value };
    }
  }

  _modeCardHtml(mode) {
    let configHtml = '';
    const config = this.pendingModeConfig[mode.id] || mode.defaultConfig;
    if (mode.id === 'challenge') {
      configHtml = `<select class="mode-config-select">${TETRIS.CHALLENGES.map((c) => `<option value="${c.id}" ${c.id === config.challengeId ? 'selected' : ''}>${c.name}</option>`).join('')}</select>`;
    } else if (mode.configOptions) {
      const key = Object.keys(mode.configOptions)[0];
      const options = mode.configOptions[key];
      configHtml = `<select class="mode-config-select">${options.map((v) => `<option value="${v}" ${v === config[key] ? 'selected' : ''}>${this._configOptionLabel(key, v)}</option>`).join('')}</select>`;
    }
    return `
      <div class="mode-card" data-mode-id="${mode.id}" style="--mode-accent:${mode.accent}">
        <h2>${mode.name}</h2>
        <p class="mode-tagline">${mode.tagline}</p>
        ${configHtml}
        <p class="mode-record">${this._modeRecordHtml(mode)}</p>
        <button type="button" class="mode-play-btn">Play ${mode.name}</button>
      </div>`;
  }

  _configOptionLabel(key, value) {
    if (key === 'targetLines') return `${value} lines`;
    if (key === 'maxLevel') return `Level cap ${value}`;
    if (key === 'timeLimitMs') return `${Math.round(value / 60000)} min`;
    if (key === 'gravityMultiplier') return value <= 1.5 ? 'Gentle' : value <= 2.5 ? 'Relaxed' : 'Very Slow';
    return String(value);
  }

  _modeRecordHtml(mode) {
    if (!mode.tracksRecords) return 'No records tracked — just relax.';
    const config = this.pendingModeConfig[mode.id] || mode.defaultConfig;
    const key = mode.id === 'challenge' ? config.challengeId : String(Object.values(config)[0] || 'default');
    const record = this.modeRecords.get(mode.id, key);
    if (!record) return 'No record yet — be the first!';
    if (mode.id === 'sprint') return `Best: <strong>${this._formatDuration(record.value)}</strong>`;
    if (mode.id === 'challenge') return `Best: <strong>${this._formatDuration(record.value)}</strong>`;
    return `Best: <strong>${Math.round(record.value).toLocaleString()}</strong>`;
  }

  // --- pause overlay ---------------------------------------------------

  _bindPauseOverlay() {
    document.getElementById('resume-button').addEventListener('click', () => {
      if (this.audio) this.audio.play('menu');
      this.game.resume();
    });
    document.getElementById('pause-restart-button').addEventListener('click', () => {
      if (this.audio) this.audio.play('menu');
      this.game.restart();
    });
    document.getElementById('pause-menu-button').addEventListener('click', () => {
      this.hideAllScreens();
      this.showScreen('main-menu');
    });
    document.getElementById('pause-settings-button').addEventListener('click', () => {
        this.screenBeforePause = 'pause';
      this.showScreen('settings');
    });
  }

  // --- game over overlay -------------------------------------------------

  _bindGameOverOverlay() {
    document.getElementById('gameover-menu-button').addEventListener('click', () => {
      document.getElementById('game-over-overlay').classList.remove('visible');
      this.showScreen('main-menu');
    });
  }

  // Called from main.js right when the game transitions to GAME_OVER —
  // this is the one moment the overlay needs a fresh snapshot of what just
  // happened (XP/achievements earned this run, best-score comparison, and
  // whether this run set a new personal record for its mode).
  populateGameOver(bestScoreBeforeThisGame, recordResult) {
    const s = this.game.scoring;
    const titles = { win: 'Complete!', lose: 'Objective Failed', timeout: "Time's Up!", topout: 'Game Over' };
    document.getElementById('game-over-title').textContent = titles[this.game.result] || 'Game Over';
    document.getElementById('game-over-reason').textContent = this.game.resultReason || '';
    document.getElementById('record-banner').classList.toggle('visible', !!(recordResult && recordResult.isNewRecord));
    document.getElementById('final-score-value').textContent = s.score.toLocaleString();
    document.getElementById('final-level-value').textContent = s.level;
    document.getElementById('final-lines-value').textContent = s.lines;
    document.getElementById('final-xp-value').textContent = `+${this.progression.xpAwardedThisGame}`;

    const compareEl = document.getElementById('final-best-comparison');
    if (s.score > bestScoreBeforeThisGame) {
      compareEl.textContent = bestScoreBeforeThisGame > 0 ? 'New best score!' : 'First run on the books!';
    } else {
      compareEl.textContent = `Best score: ${bestScoreBeforeThisGame.toLocaleString()}`;
    }

    const achEl = document.getElementById('final-achievements');
    achEl.innerHTML = '';
    this.progression.achievementsThisGame.forEach((id) => {
      const ach = TETRIS.PROGRESSION_DATA.ACHIEVEMENTS.find((a) => a.id === id);
      if (!ach) return;
      const span = document.createElement('span');
      span.textContent = ach.name;
      achEl.appendChild(span);
    });
  }

  // --- HUD (called every frame from main.js) --------------------------

  updateHud() {
    const level = this.progression.level;
    document.getElementById('hud-player-level').textContent = level;
    const into = this.progression.xpIntoCurrentLevel;
    const forNext = this.progression.xpForNextLevel;
    document.getElementById('hud-xp-fill').style.width = `${forNext > 0 ? Math.min(100, (into / forNext) * 100) : 100}%`;

    this._updateModeHud();
  }

  _updateModeHud() {
    const fields = this.game.modeController.hudFields || [];
    document.getElementById('hud-mode-panel').classList.toggle('visible', fields.some((field) => ['timer', 'linesRemaining', 'objective'].includes(field)));
    const timerRow = document.getElementById('hud-mode-timer-row');
    const linesRow = document.getElementById('hud-mode-lines-row');
    const objectiveRow = document.getElementById('hud-mode-objective-row');

    const showsTimer = fields.includes('timer');
    timerRow.classList.toggle('visible', showsTimer);
    if (showsTimer) {
      const config = this.game.modeConfig;
      const remainingMs = config.timeLimitMs != null
        ? Math.max(0, config.timeLimitMs - this.game.modeTimer)
        : (this.game.modeState.challenge && this.game.modeState.challenge.timeLimitMs != null
          ? Math.max(0, this.game.modeState.challenge.timeLimitMs - this.game.modeTimer)
          : this.game.modeTimer);
      document.getElementById('hud-mode-timer').textContent = this._clock(remainingMs);
    }

    const showsLines = fields.includes('linesRemaining');
    linesRow.classList.toggle('visible', showsLines);
    if (showsLines) {
      const remaining = Math.max(0, this.game.modeConfig.targetLines - this.game.scoring.lines);
      document.getElementById('hud-mode-lines-remaining').textContent = remaining;
    }

    const showsObjective = fields.includes('objective');
    objectiveRow.classList.toggle('visible', showsObjective);
    if (showsObjective && this.game.modeState.challenge) {
      document.getElementById('hud-mode-objective').textContent = this.game.modeState.challenge.description;
    }
  }

  _clock(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // --- progression screen ------------------------------------------------

  _renderProgressionScreen() {
    const p = this.progression;
    document.getElementById('prog-level').textContent = p.level;
    const into = p.xpIntoCurrentLevel;
    const forNext = p.xpForNextLevel;
    document.getElementById('prog-xp-fill').style.width = `${forNext > 0 ? Math.min(100, (into / forNext) * 100) : 100}%`;
    document.getElementById('prog-xp-label').textContent = `${into} / ${forNext} XP (${p.totalXp} total)`;

    const recentList = document.getElementById('prog-recent-list');
    const unlockedItems = TETRIS.PROGRESSION_DATA.UNLOCKABLES.filter((u) => p.isUnlocked(u.id) && u.requirement.type !== 'default');
    recentList.innerHTML = unlockedItems.length
      ? unlockedItems.slice(-5).reverse().map((u) => `<li>${u.name}<span class="li-sub">${this._categoryLabel(u.category)}</span></li>`).join('')
      : '<li>Nothing unlocked yet — keep playing!</li>';

    const upcomingList = document.getElementById('prog-upcoming-list');
    const upcoming = TETRIS.PROGRESSION_DATA.UNLOCKABLES
      .filter((u) => !p.isUnlocked(u.id))
      .slice(0, 5);
    upcomingList.innerHTML = upcoming.length
      ? upcoming.map((u) => `<li>${u.name}<span class="li-sub">${this._requirementLabel(u.requirement)}</span></li>`).join('')
      : '<li>Everything is unlocked!</li>';

    const timeline = document.getElementById('prog-timeline');
    const byLevel = TETRIS.PROGRESSION_DATA.UNLOCKABLES
      .filter((u) => u.requirement.type === 'level')
      .sort((a, b) => a.requirement.value - b.requirement.value);
    timeline.innerHTML = byLevel.map((u) => `
      <li class="${p.isUnlocked(u.id) ? 'is-unlocked' : ''}">
        <span>Lv ${u.requirement.value} — ${u.name}</span>
        <span class="ut-req">${this._categoryLabel(u.category)}</span>
      </li>`).join('');
  }

  _categoryLabel(category) {
    return {
      pieceSkins: 'Piece Skin', blockMaterials: 'Block Material', boardThemes: 'Board Theme', backgrounds: 'Background',
      particleEffects: 'Particle Effect', clearEffects: 'Clear Effect', uiThemes: 'UI Theme',
    }[category] || category;
  }

  _requirementLabel(req) {
    if (req.type === 'level') return `Reach player level ${req.value}`;
    if (req.type === 'stat') return `${this._statLabel(req.stat)}: ${req.value}`;
    if (req.type === 'achievement') {
      const ach = TETRIS.PROGRESSION_DATA.ACHIEVEMENTS.find((a) => a.id === req.id);
      return `Unlock "${ach ? ach.name : req.id}"`;
    }
    return 'Unlocked from the start';
  }

  _statLabel(stat) {
    return {
      bestScore: 'Best score', bestGameLevel: 'Best level', bestCombo: 'Best combo',
      bestBackToBackStreak: 'Best back-to-back', totalLines: 'Total lines', totalTetrises: 'Total Tetrises',
      totalTSpins: 'Total T-spins', totalPerfectClears: 'Total perfect clears', totalPlayTimeMs: 'Play time',
      totalPiecesPlaced: 'Pieces placed', gamesPlayed: 'Games played',
    }[stat] || stat;
  }

  // --- achievements screen -------------------------------------------------

  _renderAchievementsScreen() {
    const p = this.progression;
    const all = TETRIS.PROGRESSION_DATA.ACHIEVEMENTS;
    const unlockedCount = all.filter((a) => p.hasAchievement(a.id)).length;
    document.getElementById('achievements-summary').textContent = `${unlockedCount} / ${all.length} unlocked`;

    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = all.map((a) => {
      const unlocked = p.hasAchievement(a.id);
      let progressPct = unlocked ? 100 : 0;
      let progressLabel = '';
      if (!unlocked && a.requirement.type === 'stat') {
        const current = p.stats.lifetime[a.requirement.stat] || 0;
        progressPct = Math.min(100, (current / a.requirement.value) * 100);
        progressLabel = `<div class="ach-progress"><div class="ach-progress-fill" style="width:${progressPct}%"></div></div>
          <p class="ach-reward">${Math.min(current, a.requirement.value)} / ${a.requirement.value}</p>`;
      } else if (!unlocked && a.requirement.type === 'level') {
        progressLabel = `<p class="ach-reward">Requires player level ${a.requirement.value} (currently ${p.level})</p>`;
      }
      return `
        <div class="achievement-card ${unlocked ? '' : 'is-locked'}">
          <div class="achievement-card__rarity rarity-${a.rarity}"></div>
          <h3>${a.name}</h3>
          <p>${a.description}</p>
          ${progressLabel}
          ${a.rewardXp ? `<p class="ach-reward">Reward: ${a.rewardXp} XP</p>` : ''}
        </div>`;
    }).join('');
  }

  // --- statistics screen -------------------------------------------------

  _renderStatisticsScreen() {
    const p = this.progression;
    const renderGrid = (stats) => Object.keys(stats).map((key) => {
      let value = stats[key];
      if (key === 'totalPlayTimeMs') value = this._formatDuration(value);
      return `<dt>${this._statLabel(key)}</dt><dd>${typeof value === 'number' ? value.toLocaleString() : value}</dd>`;
    }).join('');

    document.getElementById('stats-lifetime').innerHTML = renderGrid(p.stats.lifetime);
    document.getElementById('stats-session').innerHTML = renderGrid(p.stats.session);

    const highlights = [];
    if (p.stats.lifetime.bestScore > 0) highlights.push(`Best score ever: ${p.stats.lifetime.bestScore.toLocaleString()}`);
    if (p.stats.lifetime.totalTetrises > 0) highlights.push(`${p.stats.lifetime.totalTetrises} lifetime Tetrises`);
    if (p.stats.lifetime.totalPerfectClears > 0) highlights.push(`${p.stats.lifetime.totalPerfectClears} perfect clear(s) achieved`);
    const rarest = TETRIS.PROGRESSION_DATA.ACHIEVEMENTS
      .filter((a) => p.hasAchievement(a.id))
      .sort((a, b) => this._rarityRank(b.rarity) - this._rarityRank(a.rarity))[0];
    if (rarest) highlights.push(`Rarest achievement: ${rarest.name} (${rarest.rarity})`);
    document.getElementById('stats-highlights').innerHTML = highlights.length
      ? highlights.map((h) => `<li>${h}</li>`).join('')
      : '<li>Play a few games to build up highlights.</li>';
  }

  _rarityRank(r) {
    return { common: 0, rare: 1, epic: 2, legendary: 3 }[r] || 0;
  }

  _formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  }

  // --- customization screen ------------------------------------------------

  _renderCustomizationScreen() {
    const p = this.progression;
    const container = document.getElementById('customization-categories');
    container.innerHTML = TETRIS.PROGRESSION_DATA.CATEGORIES.map((category) => {
      const items = TETRIS.PROGRESSION_DATA.UNLOCKABLES.filter((u) => u.category === category);
      const cards = items.map((u) => {
        const unlocked = p.isUnlocked(u.id);
        const equipped = p.getEquipped(category) && p.getEquipped(category).id === u.id;
        return `
          <button type="button" class="cosmetic-card ${unlocked ? '' : 'is-locked'} ${equipped ? 'is-equipped' : ''}" data-item-id="${u.id}" data-unlocked="${unlocked}" ${unlocked ? '' : 'disabled'}>
            <div class="cosmetic-card__swatch" style="background:${u.preview}"></div>
            <div class="cosmetic-card__name">${u.name}</div>
            <span class="cosmetic-card__state">${equipped ? 'Equipped' : unlocked ? 'Tap to equip' : this._requirementLabel(u.requirement)}</span>
          </button>`;
      }).join('');
      return `<div class="customization-category"><h2>${this._categoryLabel(category)}</h2><div class="customization-grid">${cards}</div></div>`;
    }).join('');

    container.querySelectorAll('.cosmetic-card').forEach((card) => {
      card.addEventListener('click', () => {
        if (card.dataset.unlocked !== 'true') return;
        this.progression.equip(card.dataset.itemId);
        TETRIS.applyCosmetics(this.renderer, this.progression);
        this.settings.applyTo({ renderer: this.renderer, input: this.input, audio: this.audio });
        this._renderCustomizationScreen();
      });
    });
  }

};
