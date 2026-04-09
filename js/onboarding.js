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
  let guidedMovesLeft = 0;

  function cellRef(index) {
    return `r${Sudoku.getRow(index) + 1}c${Sudoku.getCol(index) + 1}`;
  }

  function buildGuidedMoveStep() {
    const board = document.getElementById('board');
    const move = SudokuTechniques.findNextMove(
      Array.from(board.children).map((c, i) => {
        const v = parseInt(c.textContent);
        return (c.classList.contains('given') || c.classList.contains('entered')) && v ? v : 0;
      })
    );
    if (!move) return null;

    const row = Sudoku.getRow(move.index) + 1;
    const col = Sudoku.getCol(move.index) + 1;
    return {
      text: `🎯 Let's solve one! Look at <strong>row ${row}, column ${col}</strong>. ` +
            move.explanation +
            `<br><br>👆 <strong>Tap that cell</strong>, then <strong>tap ${move.value}</strong> on the numpad.`,
      target: null,
      position: 'top-fixed',
      waitFor: 'guided-move',
      guidedCell: move.index,
      guidedValue: move.value
    };
  }

  function defineSteps() {
    const baseSteps = [
      {
        text: '👋 <strong>Welcome to Sudoku!</strong> Let me walk you through the game — you\'ll learn by doing!',
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
        text: '🔢 Now <strong>tap a number</strong> on the pad below to place it.',
        target: '.numpad',
        position: 'above',
        waitFor: 'number-enter'
      },
      {
        text: '👍 Nice! You can use <strong>↩ Undo</strong> or <strong>⌫ Erase</strong> to fix mistakes. Now let\'s solve a few cells together!',
        target: '#board',
        position: 'below',
        nextLabel: "Let's solve!"
      }
    ];

    guidedMovesLeft = 3;
    return baseSteps;
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

    if (step.position === 'top-fixed') {
      tooltip.style.bottom = '';
      tooltip.style.top = '10px';
      tooltip.style.transform = 'translateX(-50%)';
      return;
    }

    if (!target || step.position === 'center') {
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    tooltip.style.transform = 'translateX(-50%)';
    const rect = target.getBoundingClientRect();

    if (step.position === 'above') {
      tooltip.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
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

  function highlightCell(index) {
    const board = document.getElementById('board');
    const cell = board.children[index];
    if (cell) cell.classList.add('hint-target');
  }

  function clearCellHighlights() {
    document.querySelectorAll('.hint-target').forEach(c => c.classList.remove('hint-target'));
  }

  function showStep() {
    cleanupWait();
    clearCellHighlights();

    const step = steps[stepIndex];
    if (!step) {
      if (guidedMovesLeft > 0) {
        const moveStep = buildGuidedMoveStep();
        if (moveStep) {
          steps.push(moveStep);
          showStep();
          return;
        }
      }
      steps.push({
        text: '🎉 <strong>Great job!</strong> You just solved real cells using logic. Keep going — use the <strong>💡 Hint</strong> button whenever you\'re stuck!',
        target: null,
        position: 'center',
        nextLabel: 'Start Playing!'
      });
      showStep();
      return;
    }

    textEl.innerHTML = step.text;
    nextBtn.textContent = step.nextLabel || 'Next';
    spotlightOn(step.target);
    positionTooltip(step);

    if (step.onEnter) step.onEnter();

    tooltip.classList.add('visible');

    if (step.waitFor === 'guided-move') {
      overlay.classList.remove('visible');
    } else {
      overlay.classList.add('visible');
    }

    if (step.waitFor === 'cell-select') {
      nextBtn.style.display = 'none';
      const handler = () => { nextBtn.style.display = ''; advance(); };
      const board = document.getElementById('board');
      board.addEventListener('click', handler, { once: true });
      waitCleanup = () => board.removeEventListener('click', handler);

    } else if (step.waitFor === 'number-enter') {
      nextBtn.style.display = 'none';
      const handler = () => { nextBtn.style.display = ''; advance(); };
      const numpad = document.querySelector('.numpad');
      numpad.addEventListener('click', handler, { once: true });
      waitCleanup = () => numpad.removeEventListener('click', handler);

    } else if (step.waitFor === 'guided-move') {
      nextBtn.style.display = 'none';
      highlightCell(step.guidedCell);

      const checkSolved = () => {
        const board = document.getElementById('board');
        const cell = board.children[step.guidedCell];
        if (cell && cell.classList.contains('entered') && cell.textContent.trim() === String(step.guidedValue)) {
          setTimeout(() => {
            guidedMovesLeft--;
            clearCellHighlights();
            advance();
          }, 400);
          return true;
        }
        highlightCell(step.guidedCell);
        return false;
      };

      const observer = new MutationObserver(() => {
        if (checkSolved()) observer.disconnect();
      });
      const board = document.getElementById('board');
      observer.observe(board, { childList: true, subtree: true, characterData: true });

      waitCleanup = () => observer.disconnect();
    } else {
      nextBtn.style.display = '';
    }
  }

  function advance() {
    stepIndex++;
    if (stepIndex >= steps.length) {
      if (guidedMovesLeft > 0) {
        showStep();
      } else {
        showStep();
      }
    } else {
      showStep();
    }
  }

  function finish() {
    cleanupWait();
    clearCellHighlights();
    spotlightOff();
    overlay.classList.remove('visible');
    tooltip.classList.remove('visible');
    tooltip.style.top = '';
    tooltip.style.bottom = '';
    localStorage.setItem(STORAGE_KEY, 'true');
    stepIndex = -1;
    guidedMovesLeft = 0;
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
