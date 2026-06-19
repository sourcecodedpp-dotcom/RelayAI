import { OnboardingController } from './onboarding';
import { BriefingController } from './briefing';
import { CommandBarController } from './command';
import { PanelController } from './panels';
import { OrbitEngine } from './orbit';

export const AppController = (() => {
  let activeScreen = 'briefing'; // onboarding, briefing, orbit

  const init = () => {
    // 1. Resolve DOM elements
    const canvasEl = document.getElementById('orbit-canvas-el') as HTMLCanvasElement | null;
    const briefingScreen = document.getElementById('screen-briefing');
    const onboardingScreen = document.getElementById('screen-onboarding');

    const backdrop = document.getElementById('panel-backdrop');
    const panel = document.getElementById('intel-panel');

    const cmdOverlay = document.getElementById('command-overlay');
    const cmdBar = document.getElementById('command-bar');
    const cmdInput = document.getElementById('command-input') as HTMLInputElement | null;
    const cmdResults = document.getElementById('command-results');

    // 2. Initialize Sub-Controllers
    if (backdrop && panel) {
      PanelController.init(backdrop, panel);
    }

    if (cmdOverlay && cmdBar && cmdInput && cmdResults) {
      CommandBarController.init(cmdOverlay, cmdBar, cmdInput, cmdResults);
    }

    if (onboardingScreen) {
      OnboardingController.init(onboardingScreen);
    }

    if (briefingScreen) {
      BriefingController.init(briefingScreen);
    }

    if (canvasEl) {
      OrbitEngine.init(canvasEl);
    }

    // 3. Wire Global Listeners
    setupEventListeners();

    // 4. Onboarding check routing
    if (!localStorage.getItem('relay_onboarded')) {
      navigate('onboarding');
    } else {
      navigate('briefing');
    }
  };

  const navigate = (screenName: string) => {
    activeScreen = screenName;

    // Toggle active classes on wrapper screens
    document.querySelectorAll('.screen').forEach(el => {
      el.classList.remove('active');
    });

    if (screenName === 'onboarding') {
      const screen = document.getElementById('screen-onboarding');
      if (screen) screen.classList.add('active');
      OnboardingController.startOnboarding();
    } else if (screenName === 'briefing') {
      const screen = document.getElementById('screen-briefing');
      if (screen) screen.classList.add('active');
      BriefingController.loadBriefing();
    } else if (screenName === 'orbit') {
      const orbitScreen = document.getElementById('screen-orbit');
      if (orbitScreen) {
        orbitScreen.classList.add('active');
        orbitScreen.classList.add('entering');
        setTimeout(() => {
          orbitScreen.classList.remove('entering');
        }, 800);
      }
      
      OrbitEngine.resize();
      OrbitEngine.resetCamera();
    }
  };

  const setupEventListeners = () => {
    // Onboarding complete
    document.addEventListener('onboardingFinished', () => {
      localStorage.setItem('relay_onboarded', 'true');
      navigate('briefing');
    });

    // Briefing card click
    document.addEventListener('briefingActionClicked', (e: Event) => {
      const nodeId = (e as CustomEvent).detail as string;
      navigate('orbit');
      
      setTimeout(() => {
        OrbitEngine.selectNodeById(nodeId);
      }, 500);
    });

    // Canvas node selection
    document.addEventListener('nodeSelected', (e: Event) => {
      const node = (e as CustomEvent).detail;
      if (node.type === 'person') {
        PanelController.openPersonPanel(node.data);
      } else if (node.type === 'goal') {
        PanelController.openGoalPanel(node.data);
      }
    });

    // Details panel close -> zoom out camera
    document.addEventListener('panelClosed', () => {
      OrbitEngine.setTargetZoom(1.0);
    });

    // Canvas clicked empty area
    document.addEventListener('canvasCleared', () => {
      PanelController.closePanel();
    });

    // Drill-down focus node
    document.addEventListener('focusNode', (e: Event) => {
      const nodeId = (e as CustomEvent).detail as string;
      OrbitEngine.selectNodeById(nodeId);
    });

    // Search bar navigations
    document.addEventListener('commandSelectPerson', (e: Event) => {
      const personId = (e as CustomEvent).detail as string;
      if (activeScreen !== 'orbit') navigate('orbit');
      setTimeout(() => {
        OrbitEngine.selectNodeById(personId);
      }, 300);
    });

    document.addEventListener('commandSelectGoal', (e: Event) => {
      const goalId = (e as CustomEvent).detail as string;
      if (activeScreen !== 'orbit') navigate('orbit');
      setTimeout(() => {
        OrbitEngine.selectNodeById(goalId);
      }, 300);
    });

    // Global Keydowns
    window.addEventListener('keydown', handleGlobalKeydown);

    // Header logo back to dashboard
    document.querySelectorAll('.js-go-briefing').forEach(el => {
      el.addEventListener('click', () => {
        PanelController.closePanel();
        navigate('briefing');
      });
    });

    // Zoom Floating Toolbar
    const zoomIn = document.getElementById('zoom-in-btn');
    if (zoomIn) {
      zoomIn.addEventListener('click', () => {
        OrbitEngine.setTargetZoom(1.4);
      });
    }
    const zoomOut = document.getElementById('zoom-out-btn');
    if (zoomOut) {
      zoomOut.addEventListener('click', () => {
        OrbitEngine.setTargetZoom(0.65);
      });
    }
    const zoomReset = document.getElementById('zoom-reset-btn');
    if (zoomReset) {
      zoomReset.addEventListener('click', () => {
        OrbitEngine.resetCamera();
      });
    }
  };

  const handleGlobalKeydown = (e: KeyboardEvent) => {
    // 1. Search overlay (Cmd/Ctrl + K)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      CommandBarController.toggle();
    }

    // 2. Escape close modals
    if (e.key === 'Escape') {
      CommandBarController.close();
      PanelController.closePanel();
      closeKeyboardShortcuts();
    }

    // 3. Return to Daily Briefing (Cmd/Ctrl + B)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      PanelController.closePanel();
      navigate('briefing');
    }

    // 4. Guide Guide (?)
    const activeTag = document.activeElement?.tagName;
    if (e.key === '?' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
      e.preventDefault();
      toggleKeyboardShortcuts();
    }
  };

  const toggleKeyboardShortcuts = () => {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.classList.toggle('open');
  };

  const closeKeyboardShortcuts = () => {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.classList.remove('open');
  };

  return {
    init,
    navigate
  };
})();

// Initialize application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  AppController.init();
  
  const shortcutsModal = document.getElementById('shortcuts-modal');
  if (shortcutsModal) {
    shortcutsModal.addEventListener('click', (e) => {
      if (e.target === shortcutsModal) {
        shortcutsModal.classList.remove('open');
      }
    });
  }

  // Bind enter briefing transition handler
  const enterBtn = document.getElementById('enter-orbit-btn');
  if (enterBtn) {
    enterBtn.addEventListener('click', () => {
      const briefing = document.getElementById('screen-briefing');
      if (briefing) {
        briefing.classList.add('exiting');
        setTimeout(() => {
          briefing.classList.remove('exiting');
          AppController.navigate('orbit');
        }, 800);
      }
    });
  }
});
