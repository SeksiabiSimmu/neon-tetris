import '@fontsource/chakra-petch/latin-400.css';
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';

// Keep the existing global-script dependency order while allowing Vite to
// bundle the game and its shared TETRIS namespace into local assets.
import '../constants.js';
import '../gameState.js';
import '../piece.js';
import '../pieceQueue.js';
import '../board.js';
import '../scoring.js';
import '../input.js';
import '../glowRenderer.js';
import '../particleRenderer.js';
import '../backgroundRenderer.js';
import '../effectsManager.js';
import '../audioEffects.js';
import '../uiAnimator.js';
import '../renderer.js';
import '../gameModes.js';
import '../game.js';
import '../progressionData.js';
import '../progressionManager.js';
import '../settingsManager.js';
import '../modeRecords.js';
import '../cosmeticsApplier.js';
import '../uiShell.js';
import '../main.js';

import { PremiumSceneRenderer } from './rendering/PremiumSceneRenderer.js';
import { launchApp } from './launchApp.js';

launchApp(window.TETRIS, PremiumSceneRenderer);
