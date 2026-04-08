const Onboarding = (() => {
  const STORAGE_KEY = 'sudoku-onboarding-done';

  const overlay = document.getElementById('onboarding-overlay');
  const tooltip = document.getElementById('onboarding-tooltip');
  const textEl = document.getElementById('onboarding-text');
  const nextBtn = document.getElementById('onboarding-next');
  const skipBtn = document.getElementById('onboarding-skip');

  let stepIndex = -1;
  let steps = [];
  let currentSpotlight = null;
  let waitCleanup = null;

  function defineSteps() {
    return [
      {
        text: '👋 <strong>Welcome to Sudoku!</strong> Let me walk you through the game. You\'ll learn by doing — just follow along!',
        target: null,
        position: 'center',
        nextLabel: "Let's go!"
      },
      {
        text: '📋 This is the <strong>Sudoku board</strong>. Every row, column, and 3×3 box must contain the numbers 1–9 without repeats.',
        target: '#board',
        position: 'below'
      },
      {
        text: '👆 <strong>Tap any empty cell</strong> to select it.',
        target: '#board',
        position: 'below',
        waitFor: 'cell-select'
      },
      {
        text: '✨ See the <strong>highlighting</strong>? The row, column, and box are shown — these are the zones where each number must be unique.',
        target: '#board',
        position: 'below'
      },
      {
        text: '🔢 Now <strong>tap a number</strong> on the pad below to place it in the cell.',
        target: '.numpad',
        position: 'above',
        waitFor: 'number-enter'
      },
      {
        text: '👍 Nice! You just placed a number. If it conflicts with another, it\'ll turn <strong style="color:var(--text-error)">red</strong>.',
        target: '#board',
        position: 'below'
      },
      {
        text: '↩ Made a mistake? <strong>Undo</strong> takes back your last move.',
        target: '#btn-undo',
        position: 'below'
      },
      {
        text: '⌫ <strong>Erase</strong> clears the selected cell completely.',
        target: '#btn-erase',
        position: 'below'
      },
      {
        text: '💡 Stuck? <strong>Hint</strong> won\'t just give you the answer — it\'ll explain <em>why</em> a number goes there, so you actually learn.',
        target: '#btn-hint',
        position: 'below'
      },
      {
        text: '🎚️ Choose your <strong>difficulty</strong> here. Start with <strong>Beginner</strong> — it uses the simplest technique.',
        target: '#difficulty',
        position: 'below'
      },
      {
        text: '✅ Enable <strong>Check Moves</strong> to prevent wrong entries, or <strong>Auto Notes</strong> to see all possibilities automatically.',
        target: '.toolbar',
        position: 'below'
      },
      {
        text: '🎉 <strong>You\'re all set!</strong> Solve the puzzle by filling every cell. The timer tracks your speed. Have fun! 🧩',
        target: null,
        position: 'center',
        nextLabel: 'Start Playing!'
      }
    ];
  }

  function spotlightOn(selector) {
    spotlightOff();
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) {
      el.classList.add('onboarding-spotlight');
      currentSpotlight = el;
    }
  }

  function spotlightOff() {
    if (currentSpotlight) {
      currentSpotlight.classList.remove('onboarding-spotlight');
      currentSpotlight = null;
    }
  }

  function positionTooltip(step) {
    const target = step.target ? document.querySelector(step.target) : null;

    if (!target || step.position === 'center') {
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    tooltip.style.transform = 'translateX(-50%)';
    const rect = target.getBoundingClientRect();

    if (step.position === 'above') {
      let top = rect.top - 10;
      tooltip.style.top = '';
      tooltip.style.bottom = (window.innerHeight - top) + 'px';
      tooltip.style.removeProperty('top');
    } else {
      tooltip.style.bottom = '';
      tooltip.style.top = (rect.bottom + 10) + 'px';
    }
  }

  function cleanupWait() {
    if (waitCleanup) {
      waitCleanup();
      waitCleanup = null;
    }
  }

  function showStep() {
    cleanupWait();
    const step = steps[stepIndex];
    if (!step) { finish(); return; }

    textEl.innerHTML = step.text;
    nextBtn.textContent = step.nextLabel || 'Next';
    spotlightOn(step.target);
    positionTooltip(step);

    overlay.classList.add('visible');
    tooltip.classList.add('visible');

    if (step.waitFor === 'cell-select') {
      nextBtn.style.display = 'none';
      const handler = () => {
        nextBtn.style.display = '';
        advance();
      };
      const board = document.getElementById('board');
      board.addEventListener('click', handler, { once: true });
      waitCleanup = () => board.removeEventListener('click', handler);
    } else if (step.waitFor === 'number-enter') {
      nextBtn.style.display = 'none';
      const handler = () => {
        nextBtn.style.display = '';
        advance();
      };
      const numpad = document.querySelector('.numpad');
      numpad.addEventListener('click', handler, { once: true });
      waitCleanup = () => numpad.removeEventListener('click', handler);
    } else {
      nextBtn.style.display = '';
    }
  }

  function advance() {
    stepIndex++;
    if (stepIndex >= steps.length) {
      finish();
    } else {
      showStep();
    }
  }

  function finish() {
    cleanupWait();
    spotlightOff();
    overlay.classList.remove('visible');
    tooltip.classList.remove('visible');
    tooltip.style.top = '';
    tooltip.style.bottom = '';
    localStorage.setItem(STORAGE_KEY, 'true');
    stepIndex = -1;
  }

  function start() {
    steps = defineSteps();
    stepIndex = 0;
    showStep();
  }

  function shouldShow() {
    return !localStorage.getItem(STORAGE_KEY);
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
  }

  nextBtn.addEventListener('click', advance);
  skipBtn.addEventListener('click', finish);

  return { start, finish, shouldShow, reset };
})();
