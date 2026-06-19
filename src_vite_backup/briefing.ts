import { DATA } from './data';

export const BriefingController = (() => {
  
  const init = (_screen: HTMLElement) => {
    
  };

  /**
   * Render today's customized greeting & greeting summary line
   */
  const renderGreeting = () => {
    const timeGreeting = document.getElementById('briefing-time-greeting');
    const greetingHeadline = document.getElementById('briefing-headline');
    const summaryEl = document.getElementById('briefing-summary');

    if (!timeGreeting || !greetingHeadline || !summaryEl) return;

    // Time-aware greeting
    const hours = new Date().getHours();
    let timeOfDay = "morning";
    if (hours >= 12 && hours < 17) timeOfDay = "afternoon";
    else if (hours >= 17) timeOfDay = "evening";

    timeGreeting.innerText = `Good ${timeOfDay}.`;
    
    const activeCount = DATA.people.filter(p => p.status === 'active').length;
    const outreachCount = DATA.people.filter(p => p.status === 'outreach').length;
    
    greetingHeadline.innerText = `Strategic Briefing`;
    summaryEl.innerHTML = `You have <strong>${activeCount} active threads</strong> and <strong>${outreachCount} pending outreach tasks</strong>. Review today's recommendations below.`;
  };

  /**
   * Render custom recommendation cards with inline quick actions
   */
  const renderCards = () => {
    const container = document.getElementById('briefing-cards-container');
    if (!container) return;
    container.innerHTML = '';

    DATA.briefingItems.forEach((item) => {
      let icon = '';
      let actionHtml = '';
      
      // Determine SVG icon based on item type
      if (item.type === 'reply') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
        actionHtml = `<button class="briefing-card__btn briefing-card__btn--primary js-briefing-copy-draft" data-person-id="${item.targetId}">Copy Draft</button>`;
      } else if (item.type === 'followup') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
        actionHtml = `<button class="briefing-card__btn briefing-card__btn--secondary js-briefing-advance" data-person-id="${item.targetId}">Log Follow-up</button>`;
      } else if (item.type === 'discovery') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        actionHtml = `<button class="briefing-card__btn briefing-card__btn--primary js-briefing-copy-draft" data-person-id="${item.targetId}">Draft Outreach</button>`;
      } else if (item.type === 'milestone') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
        actionHtml = `<button class="briefing-card__btn briefing-card__btn--secondary js-briefing-dismiss" data-goal-id="${item.targetId}">Acknowledge</button>`;
      }

      const card = document.createElement('div');
      card.className = `briefing-card briefing-card--${item.type}`;
      card.setAttribute('data-target-id', item.targetId);
      
      card.innerHTML = `
        <div class="briefing-card__main-content">
          <div class="briefing-card__icon">${icon}</div>
          <div class="briefing-card__content">
            <div class="briefing-card__title">${item.title}</div>
            <div class="briefing-card__desc">${item.desc}</div>
            <div class="briefing-card__meta">${item.meta}</div>
          </div>
          <div class="briefing-card__arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
        <div class="briefing-card__actions" style="margin-top: var(--space-3); padding-left: 36px; display: flex; gap: var(--space-2);">
          ${actionHtml}
        </div>
      `;

      // Clicking main content area -> navigate to spatial node in canvas
      const mainContent = card.querySelector('.briefing-card__main-content');
      if (mainContent) {
        mainContent.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetId = card.getAttribute('data-target-id');
          if (targetId) {
            document.dispatchEvent(new CustomEvent('briefingActionClicked', { detail: targetId }));
          }
        });
      }

      container.appendChild(card);
    });

    // Wire up listeners for inline quick-actions
    container.querySelectorAll('.js-briefing-copy-draft').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetBtn = e.currentTarget as HTMLButtonElement;
        const personId = targetBtn.getAttribute('data-person-id');
        const person = DATA.people.find(p => p.id === personId);
        
        if (person && person.draftOutreach) {
          try {
            await navigator.clipboard.writeText(person.draftOutreach);
            const originalText = targetBtn.innerText;
            targetBtn.innerText = "Copied!";
            targetBtn.disabled = true;
            setTimeout(() => {
              targetBtn.innerText = originalText;
              targetBtn.disabled = false;
            }, 1500);
          } catch (err) {
            console.error("Clipboard copy failed:", err);
          }
        }
      });
    });

    container.querySelectorAll('.js-briefing-advance').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetBtn = e.currentTarget as HTMLButtonElement;
        const personId = targetBtn.getAttribute('data-person-id');
        const person = DATA.people.find(p => p.id === personId);
        
        if (person) {
          if (person.status === 'outreach') {
            person.status = 'active';
            person.timeline.unshift({
              type: 'received',
              label: 'Received reply from contact',
              date: 'Just now'
            });
            person.nextAction = 'Schedule Meeting';
          }
          
          targetBtn.innerText = "Follow-up Logged";
          targetBtn.disabled = true;
          
          // Re-render overview greeting stats
          renderGreeting();
          
          // Notify canvas to redraw the node status color
          document.dispatchEvent(new CustomEvent('dataStateUpdated'));
        }
      });
    });

    container.querySelectorAll('.js-briefing-dismiss').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetBtn = e.currentTarget as HTMLButtonElement;
        const goalId = targetBtn.getAttribute('data-goal-id');
        
        // Remove item from UI list
        const card = targetBtn.closest('.briefing-card');
        if (card) {
          card.classList.add('dismissed');
          setTimeout(() => {
            card.remove();
            // Remove from list in DATA state
            DATA.briefingItems = DATA.briefingItems.filter(item => item.targetId !== goalId);
          }, 300);
        }
      });
    });
  };

  const loadBriefing = () => {
    renderGreeting();
    renderCards();
  };

  return {
    init,
    loadBriefing
  };
})();
