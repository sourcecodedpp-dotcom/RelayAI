import { DATA } from './data';

export const OnboardingController = (() => {
  let screenEl: HTMLElement | null = null;
  let selectedGoalIds: string[] = [];

  const init = (screen: HTMLElement) => {
    screenEl = screen;
    setupStepListeners();
  };

  const setupStepListeners = () => {
    if (!screenEl) return;

    // Handle template card clicks
    const templates = screenEl.querySelectorAll('.goal-template');
    templates.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-goal-id');
        if (!id) return;

        if (selectedGoalIds.includes(id)) {
          selectedGoalIds = selectedGoalIds.filter(g => g !== id);
          card.classList.remove('selected');
        } else {
          selectedGoalIds.push(id);
          card.classList.add('selected');
        }

        // Enable button if at least one goal is chosen
        const nextBtn = document.getElementById('onboarding-next-2') as HTMLButtonElement | null;
        if (nextBtn) {
          nextBtn.disabled = selectedGoalIds.length === 0;
          
          // Live connection counter feedback on button
          const targetMatches = DATA.people.filter(p => selectedGoalIds.includes(p.goalId)).length;
          if (selectedGoalIds.length > 0) {
            nextBtn.innerHTML = `Generate Spatial Network (${targetMatches} Contacts)
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
          } else {
            nextBtn.innerHTML = `Generate Spatial Network
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
          }
        }
      });
    });

    // Step 1 Welcome -> Step 2 Goal Selection
    const next1 = document.getElementById('onboarding-next-1');
    if (next1) {
      next1.addEventListener('click', () => {
        goToStep(2);
      });
    }

    // Step 2 Goal Selection -> Finish immediately (friction-free transition)
    const next2 = document.getElementById('onboarding-next-2');
    if (next2) {
      next2.addEventListener('click', () => {
        // Complete onboarding immediately with no artificial load delays
        document.dispatchEvent(new CustomEvent('onboardingFinished'));
      });
    }
  };

  const goToStep = (step: number) => {
    if (!screenEl) return;
    
    // Hide all step sections
    screenEl.querySelectorAll('.onboarding-step-content').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });

    // Show active step section
    const targetStep = document.getElementById(`onboarding-step-${step}`);
    if (targetStep) {
      targetStep.style.display = 'flex';
    }

    // Update dots indicator
    const dots = screenEl.querySelectorAll('.onboarding-step-dot');
    dots.forEach((dot, idx) => {
      dot.className = 'onboarding-step-dot';
      if (idx + 1 === step) {
        dot.classList.add('active');
      } else if (idx + 1 < step) {
        dot.classList.add('completed');
      }
    });
  };

  const startOnboarding = () => {
    // Reset selection state
    selectedGoalIds = [];
    if (screenEl) {
      screenEl.querySelectorAll('.goal-template').forEach(card => {
        card.classList.remove('selected');
      });
      const nextBtn = document.getElementById('onboarding-next-2') as HTMLButtonElement | null;
      if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.innerHTML = `Generate Spatial Network
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
      }
    }
    goToStep(1);
  };

  return {
    init,
    startOnboarding
  };
})();
