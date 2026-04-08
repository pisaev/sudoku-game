document.addEventListener('DOMContentLoaded', () => {
  const boardEl = document.getElementById('board');
  const timerEl = document.getElementById('timer');
  const difficultyEl = document.getElementById('difficulty');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTime = document.getElementById('modal-time');
  const modalDifficulty = document.getElementById('modal-difficulty');

  let puzzle = [];
  let solution = [];
  let current = [];
  let notes = Array.from({ length: 81 }, () => new Set());
  let selected = -1;
  let noteMode = false;
  let autoNotesEnabled = false;
  let checkMovesEnabled = false;
  let history = [];
  let timerSeconds = 0;
  let timerInterval = null;
  let gameComplete = false;

  function newGame() {
    const diff = difficultyEl.value;
    const classified = ['beginner', 'novice'];
    const result = classified.includes(diff)
      ? SudokuTechniques.generateClassified(diff)
      : Sudoku.generate(diff);
    puzzle = result.puzzle;
    solution = result.solution;
    current = [...puzzle];
    notes = Array.from({ length: 81 }, () => new Set());
    selected = -1;
    noteMode = false;
    history = [];
    activeHint = null;
    gameComplete = false;
    timerSeconds = 0;
    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
    updateNoteButton();
    if (autoNotesEnabled) fillAutoNotes();
    render();
    updateNumpadCompletion();
  }

  function tick() {
    timerSeconds++;
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
    const s = String(timerSeconds % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }

  function render() {
    boardEl.innerHTML = '';
    const errors = Sudoku.validate(current);

    for (let i = 0; i < 81; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;

      if (puzzle[i] !== 0) {
        cell.classList.add('given');
        cell.textContent = puzzle[i];
      } else if (current[i] !== 0) {
        cell.classList.add('entered');
        cell.textContent = current[i];
        if (errors.has(i)) cell.classList.add('error');
      } else if (notes[i].size > 0) {
        const notesDiv = document.createElement('div');
        notesDiv.className = 'notes';
        for (let n = 1; n <= 9; n++) {
          const span = document.createElement('span');
          span.textContent = notes[i].has(n) ? n : '';
          notesDiv.appendChild(span);
        }
        cell.appendChild(notesDiv);
      }

      if (activeHint && i === activeHint.index) {
        cell.classList.add('hint-target');
      } else if (activeHint && activeHint.highlights && activeHint.highlights.includes(i)) {
        cell.classList.add('hint-highlight');
      } else if (i === selected) {
        cell.classList.add('selected');
      } else if (selected >= 0) {
        const sr = Sudoku.getRow(selected), sc = Sudoku.getCol(selected), sb = Sudoku.getBox(selected);
        const cr = Sudoku.getRow(i), cc = Sudoku.getCol(i), cb = Sudoku.getBox(i);
        if (cr === sr || cc === sc || cb === sb) {
          cell.classList.add('highlighted');
        }
        if (current[selected] !== 0 && current[i] === current[selected] && i !== selected) {
          cell.classList.add('same-number');
        }
      }

      cell.addEventListener('click', () => selectCell(i));
      boardEl.appendChild(cell);
    }
  }

  function selectCell(index) {
    if (gameComplete) return;
    dismissHint();
    selected = (selected === index) ? -1 : index;
    render();
  }

  function enterNumber(num) {
    if (selected < 0 || puzzle[selected] !== 0 || gameComplete) return;
    dismissHint();

    if (noteMode) {
      history.push({ index: selected, value: current[selected], notes: new Set(notes[selected]) });
      if (notes[selected].has(num)) {
        notes[selected].delete(num);
      } else {
        notes[selected].add(num);
      }
      current[selected] = 0;
    } else {
      if (checkMovesEnabled && num !== solution[selected]) {
        showMistakeWarning(`${num} is not correct here`);
        return;
      }
      history.push({ index: selected, value: current[selected], notes: new Set(notes[selected]) });
      current[selected] = (current[selected] === num) ? 0 : num;
      notes[selected].clear();
      if (current[selected] !== 0) {
        removeNoteFromPeers(selected, current[selected]);
      }
      if (autoNotesEnabled) fillAutoNotes();
    }

    render();
    updateNumpadCompletion();
    checkWin();
  }

  function removeNoteFromPeers(index, num) {
    const r = Sudoku.getRow(index), c = Sudoku.getCol(index), b = Sudoku.getBox(index);
    for (let i = 0; i < 81; i++) {
      if (i !== index && (Sudoku.getRow(i) === r || Sudoku.getCol(i) === c || Sudoku.getBox(i) === b)) {
        notes[i].delete(num);
      }
    }
  }

  function fillAutoNotes() {
    const candidates = SudokuTechniques.getCandidates(current);
    for (let i = 0; i < 81; i++) {
      if (current[i] === 0) {
        notes[i] = candidates[i];
      } else {
        notes[i] = new Set();
      }
    }
  }

  function showMistakeWarning(message) {
    const el = document.createElement('div');
    el.className = 'mistake-flash';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  function erase() {
    if (selected < 0 || puzzle[selected] !== 0 || gameComplete) return;
    history.push({ index: selected, value: current[selected], notes: new Set(notes[selected]) });
    current[selected] = 0;
    notes[selected].clear();
    render();
    updateNumpadCompletion();
  }

  function undo() {
    if (history.length === 0 || gameComplete) return;
    const last = history.pop();
    current[last.index] = last.value;
    notes[last.index] = last.notes;
    render();
    updateNumpadCompletion();
  }

  function toggleNoteMode() {
    noteMode = !noteMode;
    updateNoteButton();
  }

  function updateNoteButton() {
    const btn = document.getElementById('btn-notes');
    btn.classList.toggle('active', noteMode);
  }

  let activeHint = null;

  function showHint() {
    if (gameComplete) return;
    dismissHint();

    const move = SudokuTechniques.findNextMove(current);
    if (!move) return;

    activeHint = move;
    selected = move.index;

    const hintBanner = document.getElementById('hint-banner');
    const hintText = document.getElementById('hint-text');
    hintText.textContent = move.explanation;
    hintBanner.classList.add('visible');

    render();
  }

  function applyHint() {
    if (!activeHint) return;
    const { index, value } = activeHint;
    history.push({ index, value: current[index], notes: new Set(notes[index]) });
    current[index] = value;
    notes[index].clear();
    dismissHint();
    render();
    updateNumpadCompletion();
    checkWin();
  }

  function dismissHint() {
    activeHint = null;
    document.getElementById('hint-banner').classList.remove('visible');
  }

  function updateNumpadCompletion() {
    for (let n = 1; n <= 9; n++) {
      const count = current.filter(v => v === n).length;
      const btn = document.querySelector(`.numpad button[data-num="${n}"]`);
      if (btn) btn.classList.toggle('completed', count >= 9);
    }
  }

  function checkWin() {
    if (Sudoku.isSolved(current)) {
      gameComplete = true;
      clearInterval(timerInterval);
      const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const s = String(timerSeconds % 60).padStart(2, '0');
      modalTime.textContent = `${m}:${s}`;
      modalDifficulty.textContent = difficultyEl.value.charAt(0).toUpperCase() + difficultyEl.value.slice(1);
      modalOverlay.classList.add('visible');
    }
  }

  document.addEventListener('keydown', (e) => {
    if (gameComplete) return;

    if (e.key >= '1' && e.key <= '9') {
      enterNumber(parseInt(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      erase();
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      undo();
    } else if (e.key === 'n') {
      toggleNoteMode();
    } else if (selected >= 0) {
      const r = Sudoku.getRow(selected), c = Sudoku.getCol(selected);
      if (e.key === 'ArrowUp' && r > 0) selectCell(selected - 9);
      else if (e.key === 'ArrowDown' && r < 8) selectCell(selected + 9);
      else if (e.key === 'ArrowLeft' && c > 0) selectCell(selected - 1);
      else if (e.key === 'ArrowRight' && c < 8) selectCell(selected + 1);
    }
  });

  document.querySelectorAll('.numpad button').forEach(btn => {
    btn.addEventListener('click', () => enterNumber(parseInt(btn.dataset.num)));
  });

  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-erase').addEventListener('click', erase);
  document.getElementById('btn-notes').addEventListener('click', toggleNoteMode);
  document.getElementById('btn-hint').addEventListener('click', showHint);
  document.getElementById('hint-apply').addEventListener('click', applyHint);
  document.getElementById('hint-dismiss').addEventListener('click', () => { dismissHint(); render(); });
  document.getElementById('btn-new').addEventListener('click', newGame);
  document.getElementById('chk-auto-notes').addEventListener('change', (e) => {
    autoNotesEnabled = e.target.checked;
    if (autoNotesEnabled) fillAutoNotes();
    else notes = Array.from({ length: 81 }, () => new Set());
    render();
  });
  document.getElementById('chk-check-moves').addEventListener('change', (e) => {
    checkMovesEnabled = e.target.checked;
  });
  difficultyEl.addEventListener('change', newGame);

  // Tutorial
  const tutorialSteps = [
    {
      title: '🎯 Welcome to Sudoku!',
      body: '<p>Sudoku is a number puzzle. The goal is simple: fill every cell with a number from 1 to 9.</p><p>But there\'s a catch — each number can appear <strong>only once</strong> in every row, column, and 3×3 box.</p>'
    },
    {
      title: '📐 Rows, Columns & Boxes',
      body: '<p>The board has <strong>9 rows</strong> (horizontal), <strong>9 columns</strong> (vertical), and <strong>9 boxes</strong> (the 3×3 sections).</p><p>Each must contain all numbers 1–9, with no repeats. When you select a cell, its row, column, and box are highlighted.</p>'
    },
    {
      title: '🔢 Naked Single',
      body: '<p>The simplest technique: if a cell\'s row, column, and box already contain 8 of the 9 numbers, the missing number <strong>must</strong> go there.</p><p>Example: if a row has 1,2,3,4,5,6,7,8 — the empty cell must be <strong>9</strong>.</p><p>Start with <strong>Beginner</strong> difficulty to practice this!</p>'
    },
    {
      title: '🔍 Hidden Single',
      body: '<p>Sometimes a number can only fit in <strong>one cell</strong> within a row, column, or box — even though that cell has multiple candidates.</p><p>Look for where a number is "hiding" — it has only one home in its unit.</p><p><strong>Novice</strong> difficulty puzzles use this technique.</p>'
    },
    {
      title: '✏️ Notes & Auto-Notes',
      body: '<p>Use <strong>Notes mode</strong> (✏️ button or <kbd>N</kbd> key) to write small candidate numbers in cells — helps you track possibilities.</p><p>Or enable <strong>Auto Notes</strong> in the toolbar to let the game fill candidates automatically!</p>'
    },
    {
      title: '💡 Smart Hints',
      body: '<p>Stuck? Tap the <strong>💡 Hint</strong> button. It won\'t just give you the answer — it\'ll explain <em>why</em> that number goes there, teaching you the technique.</p><p>You can <strong>Apply</strong> the hint or <strong>dismiss</strong> it and try yourself.</p>'
    },
    {
      title: '🎮 Controls',
      body: '<p><strong>Tap a cell</strong> to select it, then tap a number to place it.</p><p><strong>↩ Undo</strong> — take back your last move</p><p><strong>⌫ Erase</strong> — clear the selected cell</p><p><strong>Check Moves</strong> — enable to prevent wrong entries</p><p>Keyboard: <kbd>1</kbd>–<kbd>9</kbd>, arrows, <kbd>Backspace</kbd>, <kbd>Ctrl+Z</kbd></p>'
    },
    {
      title: '🚀 Ready to Play!',
      body: '<p>Start with <strong>Beginner</strong> and work your way up. Each difficulty teaches new techniques naturally.</p><p><strong>Beginner</strong> → naked singles<br><strong>Novice</strong> → hidden singles<br><strong>Easy/Medium/Hard</strong> → full challenge</p><p>Have fun! 🧩</p>'
    }
  ];

  let tutorialStep = 0;
  const tutorialOverlay = document.getElementById('tutorial-overlay');
  const tutorialStepEl = document.getElementById('tutorial-step');
  const tutorialProgress = document.getElementById('tutorial-progress');

  function showTutorial() {
    tutorialStep = 0;
    renderTutorialStep();
    tutorialOverlay.classList.add('visible');
  }

  function renderTutorialStep() {
    const step = tutorialSteps[tutorialStep];
    tutorialStepEl.innerHTML = `<h2>${step.title}</h2>${step.body}`;
    tutorialProgress.textContent = `${tutorialStep + 1} / ${tutorialSteps.length}`;
    document.getElementById('tutorial-prev').style.visibility = tutorialStep === 0 ? 'hidden' : 'visible';
    document.getElementById('tutorial-next').textContent = tutorialStep === tutorialSteps.length - 1 ? 'Start Playing!' : 'Next →';
  }

  document.getElementById('btn-tutorial').addEventListener('click', showTutorial);
  document.getElementById('tutorial-prev').addEventListener('click', () => {
    if (tutorialStep > 0) { tutorialStep--; renderTutorialStep(); }
  });
  document.getElementById('tutorial-next').addEventListener('click', () => {
    if (tutorialStep < tutorialSteps.length - 1) { tutorialStep++; renderTutorialStep(); }
    else { tutorialOverlay.classList.remove('visible'); }
  });

  // Learn mode
  const lessons = [
    {
      id: 'naked-single',
      title: '🔢 Naked Single',
      desc: 'When a cell has only one possible candidate left, that\'s a naked single. All other numbers are eliminated by its row, column, or box. This is the most basic solving technique.',
      difficulty: 'beginner'
    },
    {
      id: 'hidden-single',
      title: '🔍 Hidden Single',
      desc: 'When a number can only fit in one cell within a row, column, or box, that\'s a hidden single. The cell may have other candidates, but this number has no other home in that unit.',
      difficulty: 'novice'
    },
    {
      id: 'naked-pair',
      title: '👯 Naked Pair',
      desc: 'When two cells in the same unit share the exact same two candidates, those values can be eliminated from all other cells in that unit. This often reveals hidden or naked singles.',
      difficulty: 'medium'
    }
  ];

  let selectedLesson = null;
  const learnOverlay = document.getElementById('learn-overlay');

  function showLearnMenu() {
    selectedLesson = null;
    const menu = document.getElementById('learn-menu');
    menu.innerHTML = '';
    for (const lesson of lessons) {
      const btn = document.createElement('button');
      btn.innerHTML = `${lesson.title}<span class="lesson-tag">Difficulty: ${lesson.difficulty}</span>`;
      btn.addEventListener('click', () => selectLesson(lesson));
      menu.appendChild(btn);
    }
    document.getElementById('learn-title').textContent = '📚 Learn Techniques';
    document.getElementById('learn-desc').textContent = 'Choose a technique to learn and practice:';
    document.getElementById('learn-practice').style.display = 'none';
    menu.style.display = 'flex';
    learnOverlay.classList.add('visible');
  }

  function selectLesson(lesson) {
    selectedLesson = lesson;
    document.getElementById('learn-title').textContent = lesson.title;
    document.getElementById('learn-desc').textContent = lesson.desc;
    document.getElementById('learn-practice').style.display = 'inline-block';
    document.getElementById('learn-menu').style.display = 'none';
  }

  function startPractice() {
    if (!selectedLesson) return;
    learnOverlay.classList.remove('visible');
    difficultyEl.value = selectedLesson.difficulty;
    newGame();
    autoNotesEnabled = true;
    document.getElementById('chk-auto-notes').checked = true;
    fillAutoNotes();
    render();
  }

  document.getElementById('btn-learn').addEventListener('click', showLearnMenu);
  document.getElementById('learn-practice').addEventListener('click', startPractice);
  document.getElementById('learn-close').addEventListener('click', () => learnOverlay.classList.remove('visible'));

  document.getElementById('btn-play-again').addEventListener('click', () => {
    modalOverlay.classList.remove('visible');
    newGame();
  });

  newGame();
});
