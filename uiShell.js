import { SettingsPanel } from './src/ui/SettingsPanel.js';
import { CustomizationPreview3D } from './src/ui/CustomizationPreview3D.js';

// js/uiShell.js
//
// The UI shell owns navigation, menus, HUD, and game overlays. Settings
// controls and key rebinding live in SettingsPanel.
// Like EffectsManager/UIAnimator, this only ever *reads* Game/Scoring/
// Progression and calls their public methods (start, pause, equip,
// set) — it owns no gameplay state itself.
//
// Screens are plain DOM sections toggled with a `.active` class (CSS
// handles their brief entrance); this file's job is deciding which
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
    this.customizationCategory = 'pieceSkins';
    this.customizationSelections = {};
    this.customizationMode = 'endless';
    this.customizationPreview = null;
    this.customizationPreviewFailed = false;
    this.customizationThumbnails = {};
    this.customizationScroll = {};
    this.settingsPanel = new SettingsPanel({
      game, progression, settings, renderer, input, audio,
      onProfileReset: () => {
        TETRIS.applyCosmetics(this.renderer, this.progression);
        this._renderMainMenu();
      },
    });

    this._bindMenu();
    this._bindCustomization();
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
    document.getElementById('pause-overlay').classList.remove('visible');
    document.getElementById('game-over-overlay').classList.remove('visible');
    const previous = this.currentScreen;
    if (previous === 'customization' && name !== 'customization') this._closeCustomizationPreview();
    if (name === 'customization' && previous !== 'customization') {
      this.customizationSelections = Object.fromEntries(TETRIS.PROGRESSION_DATA.CATEGORIES.map((category) =>
        [category, this.progression.getEquipped(category)?.id]));
      this.customizationScroll = {};
    }
    Object.values(this.screens).forEach((el) => el.classList.remove('active'));
    el.classList.add('active');
    this.currentScreen = name;
    document.querySelector('.game-wrap').inert = true;
    this.input.setGameplayEnabled(false);
    if (this.hasShownScreen && previous !== name && this.audio) this.audio.play('menu');
    this.hasShownScreen = true;
    this._populateScreen(name);
    const firstFocusable = el.querySelector('button, input, select, a[href]');
    if (firstFocusable) firstFocusable.focus({ preventScroll: true });
  }

  hideAllScreens() {
    this.settingsPanel.cancelRebinding();
    if (this.currentScreen === 'customization') this._closeCustomizationPreview();
    Object.values(this.screens).forEach((el) => el.classList.remove('active'));
    this.currentScreen = null;
    document.querySelector('.game-wrap').inert = false;
    this.input.setGameplayEnabled(true);
  }

  _returnFromScreen(backTarget = 'main-menu') {
    const target = this.screenBeforePause && this.currentScreen === 'settings'
      ? this.screenBeforePause
      : backTarget;
    this.screenBeforePause = null;
    if (target === 'pause') {
      this.hideAllScreens();
      document.getElementById('pause-overlay').classList.add('visible');
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
        document.getElementById('game-mode-name').textContent = mode.name;
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
      configHtml = `<select class="mode-config-select" aria-label="${mode.name} objective">${TETRIS.CHALLENGES.map((c) => `<option value="${c.id}" ${c.id === config.challengeId ? 'selected' : ''}>${c.name}</option>`).join('')}</select>`;
    } else if (mode.configOptions) {
      const key = Object.keys(mode.configOptions)[0];
      const options = mode.configOptions[key];
      configHtml = `<select class="mode-config-select" aria-label="${mode.name} objective">${options.map((v) => `<option value="${v}" ${v === config[key] ? 'selected' : ''}>${this._configOptionLabel(key, v)}</option>`).join('')}</select>`;
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
      pieceSkins: 'Piece Skin', blockMaterials: 'Block Theme', fallingEffects: 'Falling Effect', boardThemes: 'Board Theme', backgrounds: 'Background',
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

  _bindCustomization() {
    document.getElementById('customization-categories').addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      this.customizationScroll[this.customizationCategory] = document.getElementById('customization-items').scrollTop;
      this.customizationCategory = button.dataset.category;
      this._renderCustomizationScreen();
      document.querySelector(`#customization-categories [data-category="${this.customizationCategory}"]`)?.focus({ preventScroll: true });
    });
    document.getElementById('customization-items').addEventListener('click', (event) => {
      const button = event.target.closest('[data-item-id]');
      if (!button) return;
      this.customizationScroll[this.customizationCategory] = document.getElementById('customization-items').scrollTop;
      this.customizationSelections[this.customizationCategory] = button.dataset.itemId;
      this._renderCustomizationScreen();
      document.querySelector(`#customization-items [data-item-id="${button.dataset.itemId}"]`)?.focus({ preventScroll: true });
    });
    document.getElementById('customization-mode').addEventListener('change', (event) => {
      this.customizationMode = event.target.value;
      this.customizationPreview?.setMode(this.customizationMode);
      this.customizationThumbnails = {};
      this._renderCustomizationScreen();
    });
    document.getElementById('customization-demo').addEventListener('click', (event) => {
      const button = event.target.closest('[data-demo]');
      if (button) this.customizationPreview?.demonstrate(button.dataset.demo);
    });
    document.getElementById('customization-equip').addEventListener('click', () => {
      const id = this.customizationSelections[this.customizationCategory];
      if (!this.progression.equip(id)) return;
      TETRIS.applyCosmetics(this.renderer, this.progression);
      this.settings.applyTo({ renderer: this.renderer, input: this.input, audio: this.audio });
      this._renderCustomizationScreen();
    });
  }

  _closeCustomizationPreview() {
    this.customizationPreview?.dispose();
    this.customizationPreview = null;
    this.customizationPreviewFailed = false;
    this.customizationThumbnails = {};
    const canvas = document.getElementById('customization-preview-canvas');
    canvas?.replaceWith(canvas.cloneNode(false));
  }

  updateCustomizationPreview(dt) {
    if (this.currentScreen !== 'customization' || !this.customizationPreview) return;
    try {
      this.customizationPreview.render(dt);
    } catch (error) {
      console.warn('Customization preview stopped; gameplay remains available.', error);
      this.customizationPreview.dispose();
      this.customizationPreview = null;
      this.customizationPreviewFailed = true;
      document.getElementById('customization-preview-fallback').hidden = false;
    }
  }

  _customizationDescription(item) {
    if (item.description) return item.description;
    const descriptions = {
      material_ceramic: 'Quiet porcelain faces with a crisp inset edge and soft reflected light.',
      material_ion_glass: 'A luminous inner panel behind a sharply etched perimeter.',
      material_carbon_lattice: 'Matte woven cells with a tight technical grid.',
      material_aurora_alloy: 'Brushed metal whose fine bands catch the key light.',
      material_prism_shell: 'Angular facets that separate light and shade on each cell.',
      material_void_chrome: 'Dark mirror faces framed by a bright machined rim.',
      skin_classic: 'The original seven-color arcade palette.',
      skin_pastel: 'Softened colors with the full seven-piece distinction.',
      skin_mono: 'A precise tonal palette with a distinct value for each piece.',
      skin_circuit: 'Cool engineering colors with sharp contrast.',
      skin_aurora: 'Pearlescent hues inspired by northern light.',
      skin_gilded: 'Warm metallic tones earned with a perfect clear.',
    };
    if (descriptions[item.id]) return descriptions[item.id];
    if (item.category === 'backgrounds') return `A ${item.name.toLowerCase()} treatment across the selected 3D world, shown here with the sample board.`;
    if (item.category === 'fallingEffects') return 'A short trail while a piece falls and a restrained accent when it lands.';
    if (item.category === 'boardThemes') return 'Changes the board surface, grid, and edge contrast without affecting placement.';
    if (item.category === 'particleEffects') return 'Changes the shape and color of ambient gameplay particles.';
    if (item.category === 'clearEffects') return 'Changes the color and shape of line-clear feedback.';
    return 'Changes the interface accent throughout menus and gameplay.';
  }

  _customizationThumbnail(item) {
    if ((item.category === 'backgrounds' || item.category === 'blockMaterials') && this.customizationThumbnails[item.id]) {
      return `<img src="${this.customizationThumbnails[item.id]}" alt="" />`;
    }
    if (item.category === 'pieceSkins' || item.category === 'blockMaterials') {
      const colors = item.category === 'pieceSkins' ? item.apply.colors : this.progression.getAppliedData('pieceSkins')?.colors;
      const color = colors?.T || item.preview;
      return `<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="24" y="1" width="15" height="15" fill="${color}"/><rect x="8" y="17" width="15" height="15" fill="${colors?.J || color}"/><rect x="24" y="17" width="15" height="15" fill="${color}"/><rect x="40" y="17" width="15" height="15" fill="${colors?.L || color}"/></svg>`;
    }
    if (item.category === 'fallingEffects') {
      const motif = {
        none: '<path d="M12 34L52 12"/>',
        fire: '<path d="M32 6C18 24 39 21 27 42C47 37 51 19 32 6Z"/>',
        bubbles: '<circle cx="22" cy="30" r="7"/><circle cx="41" cy="19" r="9"/><circle cx="28" cy="9" r="3"/>',
        water: '<path d="M31 5C24 17 19 24 19 31A13 13 0 0 0 45 31C45 24 38 17 31 5Z"/>',
        smoke: '<path d="M19 39C9 27 29 27 20 17M31 42C23 30 44 29 35 15M44 38C34 29 54 22 44 10"/>',
        frost: '<path d="M32 5V43M11 14L53 34M11 34L53 14M25 12L32 19L39 12M25 36L32 29L39 36"/>',
        lightning: '<path d="M37 4L21 26H32L26 44L48 18H35Z"/>',
        lava: '<path d="M16 37Q17 28 24 28Q23 16 32 7Q31 23 41 22Q50 24 47 37Q32 46 16 37Z"/>',
        wind: '<path d="M8 20Q29 8 49 18Q57 24 48 27M14 31Q30 23 51 32M21 40Q38 36 48 42"/>',
        stardust: '<path d="M30 4L33 15L45 18L34 22L30 34L26 22L15 18L26 15ZM49 31L51 36L57 38L51 40L49 46L47 40L41 38L47 36Z"/>',
        'cherry-blossoms': '<path d="M32 12Q24 3 20 13Q10 13 16 24Q11 33 22 35Q25 45 33 38Q43 43 44 32Q54 26 45 20Q46 9 36 12Z"/>',
        'digital-glitch': '<path d="M10 13H32V20H49M17 21H31V31H54M8 38H22V31H37M38 8H51V16"/>',
        ink: '<path d="M12 37Q25 17 51 9M18 42Q40 40 54 28M38 19Q47 22 48 31"/>',
        fireflies: '<circle cx="20" cy="31" r="3"/><circle cx="43" cy="16" r="4"/><circle cx="37" cy="38" r="2"/><path d="M18 17L21 12M47 34L51 30"/>',
        'soap-film': '<circle cx="28" cy="25" r="14"/><circle cx="44" cy="33" r="9"/><path d="M17 20Q28 9 39 20"/>',
        'autumn-leaves': '<path d="M27 6Q8 18 23 29Q34 34 39 13Q35 20 27 6ZM42 28Q31 34 40 43Q49 45 53 34Z"/>',
        comet: '<path d="M8 42Q24 29 38 18M11 27Q26 24 38 18M38 18A10 10 0 1 0 58 18A10 10 0 1 0 38 18"/>',
      }[item.apply.effectId] || '<path d="M23 8L39 25L25 41"/>';
      return `<svg viewBox="0 0 64 48" aria-hidden="true"><g fill="none" stroke="${item.preview}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${motif}</g></svg>`;
    }
    if (item.category === 'backgrounds') return this._backgroundThumbnailSvg(item);
    return `<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M5 40H59M5 28H59M5 16H59M17 5V43M32 5V43M47 5V43" stroke="${item.preview}" stroke-width="1.2" opacity=".8"/><rect x="18" y="17" width="13" height="10" fill="${item.preview}"/></svg>`;
  }

  _backgroundThumbnailSvg(item) {
    const art = {
      'japanese-courtyard': '<path d="M7 65H129M21 58V24H50V58M13 23H58M17 17H54M84 57Q103 31 120 57M89 42H119"/>',
      'rainy-observatory': '<path d="M9 62H128M54 60V36Q67 9 97 36V60M48 37Q67 2 103 37M24 57L51 17M20 22L32 16"/>',
      'desert-monument': '<path d="M4 67Q35 55 60 65Q94 45 134 63M20 58V19H44V58M50 58V19H74V58M17 18H76M18 10H75"/>',
      'underwater-ruins': '<path d="M8 64H130M26 63V22M40 63V22M54 63V22M18 22Q40 2 63 22M82 61V35M98 61V30M114 61V39"/>',
      'lunar-outpost': '<path d="M3 66Q38 58 67 65Q91 54 132 63M36 55V37Q51 26 67 37V55M73 54H109M86 54V21M69 21H119V44H69ZM18 16A8 8 0 1 0 34 16A8 8 0 1 0 18 16"/>',
      'alpine-retreat': '<path d="M4 67L37 32L55 48L78 16L127 65M49 66V36H113V66M62 36L81 19L103 36M74 66V47H89V66"/>',
      'cloud-sanctuary': '<path d="M4 68Q24 54 42 66Q57 50 74 65Q101 45 133 64M28 53H111M36 53V33H101V53M46 33L69 13L92 33M58 22H80"/>',
      'autumn-library': '<path d="M8 66V10H125V66M22 61V17M43 61V17M64 61V17M86 61V17M108 61V17M14 28H119M14 47H119M29 20V27M72 32V46M95 50V61"/>',
      'volcanic-coast': '<path d="M3 67Q29 45 48 64Q69 38 83 61Q110 45 134 60M8 54L29 19L49 54M22 24L29 7L36 24M86 42Q108 29 131 39"/>',
      'paper-landscape': '<path d="M4 66L32 35L53 63L75 19L103 63L132 39M75 19L84 66M32 35L42 66M5 66H133M95 27L116 10L127 31"/>',
      'clockmakers-workshop': '<circle cx="83" cy="37" r="27"/><circle cx="83" cy="37" r="12"/><path d="M83 10V64M56 37H110M83 37L94 25M8 65V18H42V65M14 28H37M14 42H37"/>',
      'rainforest-temple': '<path d="M7 67H130M39 64V25H97V64M32 26H104M45 17H91M54 9H83M14 64Q27 35 39 49M119 64Q104 25 94 42"/>',
      cityLights: '<path d="M4 68V40H19V29H32V50H44V20H58V42H70V31H85V52H100V24H113V41H132V68M11 46H14M50 27H53M104 32H107"/>',
      orbit: '<circle cx="87" cy="39" r="24"/><ellipse cx="87" cy="39" rx="42" ry="14"/><circle cx="35" cy="25" r="6"/>',
      solar: '<circle cx="95" cy="34" r="20"/><path d="M10 68Q59 51 132 64M80 7L74 1M122 14L130 9M95 4V0"/>',
      aurora: '<path d="M13 58Q28 12 40 48Q49 64 62 20Q73 3 80 42Q92 64 106 21Q116 6 130 51"/>',
      prism: '<path d="M10 68L32 14L56 67M46 67L74 8L99 67M89 67L111 26L133 67"/>',
      meteors: '<path d="M18 60L71 10M56 67L115 5M98 69L130 37M68 11L72 9M112 6L117 3"/>',
      clockwork: '<circle cx="86" cy="38" r="28"/><circle cx="86" cy="38" r="15"/><path d="M86 10V66M58 38H114M86 38L99 25"/>',
      nebula: '<path d="M3 62Q26 34 50 45Q75 8 101 27Q119 38 133 12M11 21L14 25M37 12L40 16M107 59L110 63"/>',
    };
    const motif = art[item.apply.sceneId || item.apply.style] || art.nebula;
    const colors = item.apply.nebulaColors || [item.preview, '#182433'];
    return `<svg viewBox="0 0 136 80" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="136" height="80" fill="${colors[1] || colors[0]}"/><rect width="136" height="80" fill="${colors[0]}" opacity=".28"/><g fill="none" stroke="#e4e9df" stroke-width="2" opacity=".8" stroke-linejoin="round" stroke-linecap="round">${motif}</g></svg>`;
  }

  _renderCustomizationScreen() {
    const p = this.progression;
    const categories = TETRIS.PROGRESSION_DATA.CATEGORIES;
    if (!categories.includes(this.customizationCategory)) this.customizationCategory = categories[0];
    const category = this.customizationCategory;
    const items = TETRIS.PROGRESSION_DATA.UNLOCKABLES.filter((item) => item.category === category);
    let selected = items.find((item) => item.id === this.customizationSelections[category]);
    if (!selected) {
      selected = p.getEquipped(category) || items[0];
      this.customizationSelections[category] = selected.id;
    }
    const nav = document.getElementById('customization-categories');
    nav.innerHTML = categories.map((name) => `<button type="button" class="customization-category ${name === category ? 'is-selected' : ''}" data-category="${name}" aria-current="${name === category ? 'true' : 'false'}">${this._categoryLabel(name)}</button>`).join('');
    document.getElementById('customization-category-title').textContent = this._categoryLabel(category);
    document.getElementById('customization-count').textContent = `${items.filter((item) => p.isUnlocked(item.id)).length} / ${items.length} owned`;
    if (!this.customizationPreview && !this.customizationPreviewFailed) {
      try {
        this.customizationPreview = new CustomizationPreview3D(document.getElementById('customization-preview-canvas'), this.customizationMode);
        document.getElementById('customization-preview-fallback').hidden = true;
      } catch (error) {
        console.warn('Customization 3D preview unavailable.', error);
        this.customizationPreviewFailed = true;
        document.getElementById('customization-preview-fallback').hidden = false;
      }
    }
    const modeSelect = document.getElementById('customization-mode');
    modeSelect.innerHTML = Object.values(TETRIS.GAME_MODES).map((mode) => `<option value="${mode.id}">${mode.name}</option>`).join('');
    modeSelect.value = this.customizationMode;
    const apply = (name) => TETRIS.PROGRESSION_DATA.UNLOCKABLES.find((item) => item.id === this.customizationSelections[name])?.apply || p.getAppliedData(name);
    this.customizationPreview?.setCombination({ skin: apply('pieceSkins'), material: apply('blockMaterials'),
      fallingEffect: apply('fallingEffects'), board: apply('boardThemes'), background: apply('backgrounds'), particles: apply('particleEffects'),
      clearEffect: apply('clearEffects'), settings: this.settings.values });
    document.getElementById('customization-preview-caption').textContent = this.settings.get('background3D') === false
      ? '3D backgrounds are disabled in Settings · shown here for inspection'
      : this.settings.get('colorblindMode')
        ? 'Accessible piece palette active · sample board · actual game world'
        : 'Sample board · all seven pieces · actual game world';
    document.querySelector('.customization-inspector').style.setProperty('--accent', apply('uiThemes')?.accent || 'var(--accent)');
    if (category === 'backgrounds' && this.customizationPreview && !this.customizationThumbnails[selected.id]) {
      this.customizationThumbnails[selected.id] = this.customizationPreview.captureBackgroundThumbnail(selected.apply);
    }
    if (category === 'blockMaterials' && this.customizationPreview && !this.customizationThumbnails[items[0].id]) {
      items.forEach((item) => { this.customizationThumbnails[item.id] = this.customizationPreview.captureMaterialThumbnail(item.apply); });
    }
    const list = document.getElementById('customization-items');
    const scroll = this.customizationScroll[category] ?? 0;
    list.innerHTML = items.map((item) => {
      const unlocked = p.isUnlocked(item.id);
      const equipped = p.getEquipped(category)?.id === item.id;
      const state = equipped ? 'Equipped' : unlocked ? 'Available' : 'Locked';
      return `<button type="button" class="cosmetic-card ${item.id === selected.id ? 'is-selected' : ''} ${equipped ? 'is-equipped' : ''} ${unlocked ? '' : 'is-locked'}" data-item-id="${item.id}" aria-pressed="${item.id === selected.id}" aria-label="${item.name}, ${state}"><span class="cosmetic-card__thumb" style="--thumb-color:${item.preview}">${this._customizationThumbnail(item)}</span><span class="cosmetic-card__copy"><span class="cosmetic-card__name">${item.name}</span><span class="cosmetic-card__state">${state}</span></span></button>`;
    }).join('');
    list.scrollTop = scroll;
    document.querySelectorAll('#customization-demo button').forEach((button) => {
      button.disabled = !this.customizationPreview || this.settings.get('reducedMotion');
      button.title = this.settings.get('reducedMotion') ? 'Animated demonstrations are paused by Reduced Motion' : '';
    });
    const unlocked = p.isUnlocked(selected.id);
    const equipped = p.getEquipped(category)?.id === selected.id;
    document.getElementById('customization-item-state').textContent = equipped ? 'Equipped' : unlocked ? 'Available to equip' : 'Locked · preview only';
    document.getElementById('customization-item-name').textContent = selected.name;
    document.getElementById('customization-item-description').textContent = this._customizationDescription(selected);
    document.getElementById('customization-item-requirement').textContent = unlocked ? '' : this._requirementLabel(selected.requirement);
    const equip = document.getElementById('customization-equip');
    equip.disabled = !unlocked || equipped;
    equip.textContent = equipped ? 'Equipped' : unlocked ? 'Equip' : 'Locked';
    this.customizationPreview?.render(0);
  }

};
