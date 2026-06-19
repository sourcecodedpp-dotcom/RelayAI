import { DATA } from './data';
import { UTILS } from './utils';

export interface CommandMatch {
  id: string;
  type: 'person' | 'goal';
  name: string;
  desc: string;
  meta: string;
  avatar: string;
  color: string;
}

export const CommandBarController = (() => {
  let overlayEl: HTMLElement | null = null;
  let inputEl: HTMLInputElement | null = null;
  let resultsEl: HTMLElement | null = null;
  
  let focusedIndex = -1;
  let matches: CommandMatch[] = [];
  let currentFilter: 'all' | 'people' | 'goals' = 'all';

  const init = (
    overlay: HTMLElement,
    _bar: HTMLElement,
    input: HTMLInputElement,
    results: HTMLElement
  ) => {
    overlayEl = overlay;
    inputEl = input;
    resultsEl = results;

    // Listeners
    inputEl.addEventListener('input', () => {
      focusedIndex = -1;
      handleSearch();
    });
    
    // Close modal on overlay click
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) close();
    });

    // Keyboard navigation inside input
    inputEl.addEventListener('keydown', handleKeyNavigation);
  };

  const open = () => {
    if (!overlayEl || !inputEl) return;
    overlayEl.classList.add('open');
    inputEl.value = '';
    inputEl.focus();
    currentFilter = 'all';
    focusedIndex = -1;
    renderRecentItems();
  };

  const close = () => {
    if (!overlayEl || !inputEl) return;
    overlayEl.classList.remove('open');
    inputEl.blur();
    focusedIndex = -1;
  };

  const toggle = () => {
    if (overlayEl && overlayEl.classList.contains('open')) {
      close();
    } else {
      open();
    }
  };

  const handleSearch = () => {
    if (!inputEl) return;
    const q = inputEl.value.trim();
    if (!q) {
      renderRecentItems();
      return;
    }

    matches = [];

    // 1. Search People (if filter matches)
    const peopleResults: CommandMatch[] = [];
    if (currentFilter === 'all' || currentFilter === 'people') {
      const filteredPeople = DATA.people.filter(p => 
        UTILS.fuzzyMatch(p.name, q) || 
        UTILS.fuzzyMatch(p.company, q) || 
        UTILS.fuzzyMatch(p.role, q)
      );
      
      filteredPeople.forEach(p => {
        peopleResults.push({
          id: p.id,
          type: 'person',
          name: p.name,
          desc: `${p.role} @ ${p.company}`,
          meta: p.status.toUpperCase(),
          avatar: p.avatar,
          color: UTILS.getStatusColor(p.status)
        });
      });
    }

    // 2. Search Goals (if filter matches)
    const goalResults: CommandMatch[] = [];
    if (currentFilter === 'all' || currentFilter === 'goals') {
      const filteredGoals = DATA.goals.filter(g => 
        UTILS.fuzzyMatch(g.name, q) || 
        UTILS.fuzzyMatch(g.desc, q)
      );
      
      filteredGoals.forEach(g => {
        goalResults.push({
          id: g.id,
          type: 'goal',
          name: g.name,
          desc: g.desc,
          meta: 'GOAL',
          avatar: 'G',
          color: '#ffffff'
        });
      });
    }

    matches = [...peopleResults, ...goalResults];
    renderResults();
  };

  const renderRecentItems = () => {
    matches = [];

    if (currentFilter === 'all' || currentFilter === 'people') {
      DATA.people.slice(0, 3).forEach(p => {
        matches.push({
          id: p.id,
          type: 'person',
          name: p.name,
          desc: `${p.role} @ ${p.company}`,
          meta: p.status.toUpperCase(),
          avatar: p.avatar,
          color: UTILS.getStatusColor(p.status)
        });
      });
    }

    if (currentFilter === 'all' || currentFilter === 'goals') {
      DATA.goals.slice(0, 2).forEach(g => {
        matches.push({
          id: g.id,
          type: 'goal',
          name: g.name,
          desc: g.desc,
          meta: 'GOAL',
          avatar: 'G',
          color: '#ffffff'
        });
      });
    }

    renderResults();
  };

  const renderResults = () => {
    if (!resultsEl || !inputEl) return;
    resultsEl.innerHTML = '';

    // Render filter tabs row
    const filterRow = document.createElement('div');
    filterRow.className = 'command-bar__filters';
    filterRow.innerHTML = `
      <button class="command-bar__filter-tab ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
      <button class="command-bar__filter-tab ${currentFilter === 'people' ? 'active' : ''}" data-filter="people">People</button>
      <button class="command-bar__filter-tab ${currentFilter === 'goals' ? 'active' : ''}" data-filter="goals">Goals</button>
    `;
    
    // Attach tab click hooks
    filterRow.querySelectorAll('.command-bar__filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const filter = (e.currentTarget as HTMLButtonElement).getAttribute('data-filter') as 'all' | 'people' | 'goals';
        currentFilter = filter;
        focusedIndex = -1;
        
        if (inputEl!.value.trim()) {
          handleSearch();
        } else {
          renderRecentItems();
        }
        inputEl!.focus();
      });
    });
    
    resultsEl.appendChild(filterRow);

    if (matches.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'command-bar__empty';
      emptyMsg.innerText = `No results found for "${inputEl.value}"`;
      resultsEl.appendChild(emptyMsg);
      return;
    }

    const groupTitle = document.createElement('div');
    groupTitle.className = 'command-bar__group-title';
    groupTitle.innerText = inputEl.value.trim() ? 'Search Results' : 'Suggested';
    resultsEl.appendChild(groupTitle);

    matches.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'command-bar__item';
      if (index === focusedIndex) row.classList.add('focused');
      
      row.innerHTML = `
        <div class="command-bar__item-icon" style="background: var(--color-bg-elevated); border: 1px solid var(--color-border-strong); color: ${item.color}">
          ${item.avatar}
        </div>
        <div class="command-bar__item-info">
          <div class="command-bar__item-name">${item.name}</div>
          <div class="command-bar__item-desc truncate">${item.desc}</div>
        </div>
        <div class="command-bar__item-meta">${item.meta}</div>
      `;

      row.addEventListener('click', () => {
        triggerItem(item);
      });

      resultsEl!.appendChild(row);
    });
  };

  const triggerItem = (item: CommandMatch) => {
    close();
    if (item.type === 'person') {
      document.dispatchEvent(new CustomEvent('commandSelectPerson', { detail: item.id }));
    } else if (item.type === 'goal') {
      document.dispatchEvent(new CustomEvent('commandSelectGoal', { detail: item.id }));
    }
  };

  const handleKeyNavigation = (e: KeyboardEvent) => {
    if (!resultsEl) return;
    const listItems = resultsEl.querySelectorAll('.command-bar__item');
    if (!listItems.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = (focusedIndex + 1) % matches.length;
      updateFocusedItem(listItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = (focusedIndex - 1 + matches.length) % matches.length;
      updateFocusedItem(listItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < matches.length) {
        triggerItem(matches[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // Rotate search filters with Tab key!
      e.preventDefault();
      const filters: ('all' | 'people' | 'goals')[] = ['all', 'people', 'goals'];
      const nextIdx = (filters.indexOf(currentFilter) + 1) % filters.length;
      currentFilter = filters[nextIdx];
      focusedIndex = -1;
      
      if (inputEl && inputEl.value.trim()) {
        handleSearch();
      } else {
        renderRecentItems();
      }
    }
  };

  const updateFocusedItem = (listItems: NodeListOf<Element>) => {
    listItems.forEach((item, index) => {
      if (index === focusedIndex) {
        item.classList.add('focused');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('focused');
      }
    });
  };

  return {
    init,
    open,
    close,
    toggle
  };
})();
