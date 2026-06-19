import { DATA } from './data';
import { Person, Goal, RelationshipStatus } from './types';

export const PanelController = (() => {
  let backdropEl: HTMLElement | null = null;
  let panelEl: HTMLElement | null = null;
  let activeTab: 'briefing' | 'history' | 'draft' = 'briefing';

  const init = (backdrop: HTMLElement, panel: HTMLElement) => {
    backdropEl = backdrop;
    panelEl = panel;

    // Click backdrop to close
    backdropEl.addEventListener('click', closePanel);
  };

  const closePanel = () => {
    if (panelEl && backdropEl) {
      panelEl.classList.remove('open');
      backdropEl.classList.remove('visible');
    }
    document.dispatchEvent(new CustomEvent('panelClosed'));
  };

  const openPersonPanel = (person: Person) => {
    if (!panelEl || !backdropEl) return;
    panelEl.classList.remove('goal-panel');

    // Relevance color scheme class
    let relClass = 'low';
    if (person.relevance >= 70) relClass = 'medium';
    if (person.relevance >= 90) relClass = 'high';

    // Render structural container with dossier tabs
    const renderDossierContent = () => {
      // Tags
      const tagsMarkup = person.tags.map(t => `<span class="tag">${t}</span>`).join('');
      
      // Insights
      const insightsMarkup = person.insights.map(i => `
        <div class="insight-item">${i}</div>
      `).join('');

      // Timeline items
      const timelineMarkup = person.timeline.map(item => `
        <div class="timeline-item">
          <div class="timeline-item__dot timeline-item__dot--${item.type}"></div>
          <div class="timeline-item__content">
            <div class="timeline-item__label">${item.label}</div>
            <div class="timeline-item__date">${item.date}</div>
          </div>
        </div>
      `).join('');

      let tabBody = '';
      if (activeTab === 'briefing') {
        tabBody = `
          <!-- Context Brief -->
          <div class="dossier-tab-content">
            <div class="why-matter">${person.whyMatter}</div>
            <div class="panel-section">
              <div class="panel-section__title">AI Strategic Assessment</div>
              <div class="insight-list">${insightsMarkup}</div>
            </div>
            <div class="panel-section">
              <div class="panel-section__title">Shared Context Hub</div>
              <div class="tag-list">${tagsMarkup}</div>
            </div>
          </div>
        `;
      } else if (activeTab === 'history') {
        tabBody = `
          <!-- Timeline History -->
          <div class="dossier-tab-content">
            <div class="panel-section">
              <div class="panel-section__title">Relationship History</div>
              <div class="timeline">${timelineMarkup}</div>
            </div>
          </div>
        `;
      } else if (activeTab === 'draft') {
        tabBody = `
          <!-- AI Draft -->
          <div class="dossier-tab-content">
            <div class="panel-section">
              <div class="panel-section__title">AI Generated Outreach</div>
              <div class="draft-outreach">
                <textarea class="draft-outreach__textarea" id="draft-textarea">${person.draftOutreach}</textarea>
                <div class="draft-outreach__meta">Click text to edit template.</div>
                <button class="btn btn--secondary btn--full" id="js-copy-draft-btn" style="margin-top: var(--space-3);">Copy Outreach Draft</button>
              </div>
            </div>
          </div>
        `;
      }

      panelEl!.innerHTML = `
        <div class="panel-header">
          <div class="person-identity">
            <div class="person-avatar">
              ${person.avatar}
            </div>
            <div>
              <div class="person-name">${person.name}</div>
              <div class="person-role">${person.role} at ${person.company}</div>
            </div>
          </div>
          <button class="panel-close" id="panel-close-btn" aria-label="Close panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div class="panel-body">
          <!-- Interactive Status Selector (Frictionless Update) -->
          <div class="panel-section">
            <div class="panel-section__title">Relationship Stage</div>
            <div class="status-selector-wrap">
              <select class="panel-status-select" id="panel-status-dropdown">
                <option value="undiscovered" ${person.status === 'undiscovered' ? 'selected' : ''}>Undiscovered</option>
                <option value="researched" ${person.status === 'researched' ? 'selected' : ''}>Researched Profile</option>
                <option value="outreach" ${person.status === 'outreach' ? 'selected' : ''}>Outreach Sent</option>
                <option value="active" ${person.status === 'active' ? 'selected' : ''}>Active Conversation</option>
                <option value="scheduled" ${person.status === 'scheduled' ? 'selected' : ''}>Meeting Booked</option>
              </select>
            </div>
          </div>

          <!-- Relevance assessment metrics -->
          <div class="panel-section">
            <div class="panel-section__title">Relevance Assessment</div>
            <div class="relevance-score">
              <div class="relevance-bar">
                <div class="relevance-bar__fill relevance-bar__fill--${relClass}" style="width: ${person.relevance}%"></div>
              </div>
              <div class="relevance-value">${person.relevance}%</div>
            </div>
            <div class="relevance-reason">${person.relevanceReason}</div>
          </div>

          <!-- Tabs Header -->
          <div class="dossier-tabs">
            <button class="dossier-tab ${activeTab === 'briefing' ? 'active' : ''}" data-tab="briefing">Briefing</button>
            <button class="dossier-tab ${activeTab === 'history' ? 'active' : ''}" data-tab="history">History</button>
            <button class="dossier-tab ${activeTab === 'draft' ? 'active' : ''}" data-tab="draft">AI Draft</button>
          </div>

          <!-- Tab Content Body -->
          ${tabBody}
        </div>

        <div class="panel-actions">
          <button class="btn btn--primary btn--full" id="panel-action-primary">${person.nextAction}</button>
        </div>
      `;

      // Bind closing events
      document.getElementById('panel-close-btn')!.addEventListener('click', closePanel);

      // Bind Tab switches
      panelEl!.querySelectorAll('.dossier-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', (e) => {
          activeTab = (e.currentTarget as HTMLButtonElement).getAttribute('data-tab') as 'briefing' | 'history' | 'draft';
          renderDossierContent();
        });
      });

      // Bind status dropdown updates
      const dropdown = document.getElementById('panel-status-dropdown') as HTMLSelectElement | null;
      if (dropdown) {
        dropdown.addEventListener('change', (e) => {
          const newStatus = (e.target as HTMLSelectElement).value as RelationshipStatus;
          
          if (newStatus !== person.status) {
            person.status = newStatus;
            
            // Add to timeline log
            const statusLabels: Record<RelationshipStatus, string> = {
              undiscovered: 'Reset to undiscovered',
              researched: 'Marked as researched profile',
              outreach: 'Logged outreach outreach message',
              active: 'Marked active thread',
              scheduled: 'Logged meeting booked',
              stale: 'Marked as stale'
            };
            
            person.timeline.unshift({
              type: newStatus === 'active' ? 'received' : newStatus === 'outreach' ? 'sent' : newStatus === 'scheduled' ? 'meeting' : 'note',
              label: statusLabels[newStatus],
              date: 'Just now'
            });

            // Adjust CTA button text
            if (newStatus === 'researched') {
              person.nextAction = 'Send Outreach Email';
            } else if (newStatus === 'outreach') {
              person.nextAction = 'Send Follow-up Email';
            } else if (newStatus === 'active') {
              person.nextAction = 'Schedule Meeting';
            } else if (newStatus === 'scheduled') {
              person.nextAction = 'View Calendar Event';
            } else {
              person.nextAction = 'Review Advisor Fit';
            }

            // Refresh UI dossier details
            renderDossierContent();

            // Dispatches update to make the canvas redraw the nodes immediately
            document.dispatchEvent(new CustomEvent('dataStateUpdated'));
          }
        });
      }

      // Bind copy draft outreach
      if (activeTab === 'draft') {
        const copyBtn = document.getElementById('js-copy-draft-btn') as HTMLButtonElement | null;
        const textarea = document.getElementById('draft-textarea') as HTMLTextAreaElement | null;
        if (copyBtn && textarea) {
          copyBtn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(textarea.value);
              copyBtn.innerText = "Draft Copied!";
              copyBtn.disabled = true;
              setTimeout(() => {
                copyBtn.innerText = "Copy Outreach Draft";
                copyBtn.disabled = false;
              }, 1500);
            } catch (err) {
              console.error("Copy failed:", err);
            }
          });
        }
      }

      // Bind CTA button click
      const actionBtn = document.getElementById('panel-action-primary') as HTMLButtonElement | null;
      if (actionBtn) {
        actionBtn.addEventListener('click', () => {
          alert(`Strategic Move: "${person.nextAction}"`);
          
          // Step status forward logically
          if (person.status === 'researched') {
            person.status = 'outreach';
            person.timeline.unshift({ type: "sent", label: "Sent outreach email", date: "Just now" });
            person.nextAction = "Send Follow-up Email";
          } else if (person.status === 'outreach') {
            person.status = 'active';
            person.timeline.unshift({ type: "received", label: "Replied to follow-up", date: "Just now" });
            person.nextAction = "Schedule Meeting";
          } else if (person.status === 'active') {
            person.status = 'scheduled';
            person.timeline.unshift({ type: "meeting", label: "Coffee chat scheduled", date: "Upcoming" });
            person.nextAction = "View Calendar Event";
          }

          renderDossierContent();
          document.dispatchEvent(new CustomEvent('dataStateUpdated'));
        });
      }
    };

    activeTab = 'briefing'; // Reset tab on load
    renderDossierContent();
    
    panelEl.classList.add('open');
    backdropEl.classList.add('visible');
  };

  const openGoalPanel = (goal: Goal) => {
    if (!panelEl || !backdropEl) return;
    panelEl.classList.add('goal-panel');

    const goalPeople = DATA.people.filter(p => p.goalId === goal.id);
    goalPeople.sort((a, b) => b.relevance - a.relevance);

    const contactThumbnails = goalPeople.map(person => `
      <div class="contact-grid__item contact-grid__item--${person.status}" 
           title="${person.name} (${person.relevance}%)"
           data-person-id="${person.id}">
        <span class="person-avatar-thumb">${person.avatar}</span>
      </div>
    `).join('');

    const actionsMarkup = goal.recommendedActions.map(act => `
      <div class="insight-item">${act}</div>
    `).join('');

    panelEl.innerHTML = `
      <div class="panel-header">
        <div class="goal-header">
          <div class="goal-icon">${goal.icon}</div>
          <div>
            <div class="goal-name">${goal.name}</div>
            <div class="goal-desc">${goal.desc}</div>
          </div>
        </div>
        <button class="panel-close" id="panel-close-btn" aria-label="Close panel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="panel-body">
        <!-- Grayscale Completion Progress Ring -->
        <div class="panel-section">
          <div class="panel-section__title">Goal Completion</div>
          <div class="progress-ring-container">
            <div class="progress-ring">
              <svg>
                <circle class="progress-ring__bg" cx="36" cy="36" r="32"></circle>
                <circle class="progress-ring__fill" cx="36" cy="36" r="32" 
                        style="stroke-dasharray: 201; stroke-dashoffset: ${201 - (201 * goal.progress) / 100}"></circle>
              </svg>
              <div class="progress-ring__label">${goal.progress}%</div>
            </div>
            <div class="progress-stats">
              <div class="progress-stat">Contacts Reached: <span class="progress-stat__value">${goal.metrics.reached}/${goal.metrics.target}</span></div>
              <div class="progress-stat">Responses: <span class="progress-stat__value">${goal.metrics.responses}</span></div>
              <div class="progress-stat">Meetings Booked: <span class="progress-stat__value">${goal.metrics.meetings}</span></div>
            </div>
          </div>
        </div>

        <!-- Contacts Grid -->
        <div class="panel-section">
          <div class="panel-section__title">Target Network (${goalPeople.length})</div>
          <div class="contact-grid">${contactThumbnails}</div>
        </div>

        <!-- Recommended moves -->
        <div class="panel-section">
          <div class="panel-section__title">Strategic Next Moves</div>
          <div class="insight-list">${actionsMarkup}</div>
        </div>
      </div>

      <div class="panel-actions">
        <button class="btn btn--secondary btn--full" id="panel-action-cancel">Return to Orbit</button>
      </div>
    `;

    // Listeners
    document.getElementById('panel-close-btn')!.addEventListener('click', closePanel);
    document.getElementById('panel-action-cancel')!.addEventListener('click', closePanel);

    // Grid thumbnails navigation
    panelEl.querySelectorAll('.contact-grid__item').forEach(el => {
      el.addEventListener('click', (e) => {
        const targetId = (e.currentTarget as HTMLElement).getAttribute('data-person-id');
        const personData = DATA.people.find(p => p.id === targetId);
        if (personData) {
          openPersonPanel(personData);
          document.dispatchEvent(new CustomEvent('focusNode', { detail: targetId }));
        }
      });
    });

    panelEl.classList.add('open');
    backdropEl.classList.add('visible');
  };

  return {
    init,
    openPersonPanel,
    openGoalPanel,
    closePanel
  };
})();
