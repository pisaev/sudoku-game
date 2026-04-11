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

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem('sudoku-progress')) || defaultProgress(); }
    catch { return defaultProgress(); }
  }

  function defaultProgress() {
    return { gamesCompleted: {}, techniquesUsed: {}, bestTimes: {} };
  }

  function saveProgress(progress) {
    localStorage.setItem('sudoku-progress', JSON.stringify(progress));
  }

  function recordWin(difficulty, seconds) {
    const progress = loadProgress();
    progress.gamesCompleted[difficulty] = (progress.gamesCompleted[difficulty] || 0) + 1;
    if (!progress.bestTimes[difficulty] || seconds < progress.bestTimes[difficulty]) {
      progress.bestTimes[difficulty] = seconds;
    }
    saveProgress(progress);
  }

  function recordTechnique(technique) {
    const progress = loadProgress();
    progress.techniquesUsed[technique] = (progress.techniquesUsed[technique] || 0) + 1;
    saveProgress(progress);
  }

  function saveGameState() {
    const state = {
      puzzle, solution, current, timerSeconds, gameComplete,
      difficulty: difficultyEl.value,
      notes: notes.map(s => [...s])
    };
    localStorage.setItem('sudoku-game-state', JSON.stringify(state));
  }

  function loadGameState() {
    try {
      const raw = localStorage.getItem('sudoku-game-state');
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (!state.puzzle || !state.solution || !state.current) return null;
      return state;
    } catch { return null; }
  }

  function clearGameState() {
    localStorage.removeItem('sudoku-game-state');
  }

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
    clearGameState();
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
    saveGameState();
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
    saveGameState();
  }

  function undo() {
    if (history.length === 0 || gameComplete) return;
    const last = history.pop();
    current[last.index] = last.value;
    notes[last.index] = last.notes;
    render();
    updateNumpadCompletion();
    saveGameState();
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
    const { index, value, technique } = activeHint;
    history.push({ index, value: current[index], notes: new Set(notes[index]) });
    current[index] = value;
    notes[index].clear();
    recordTechnique(technique);
    dismissHint();
    render();
    updateNumpadCompletion();
    checkWin();
    saveGameState();
  }

  function dismissHint(){
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
      recordWin(difficultyEl.value, timerSeconds);
      clearGameState();
      const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const s = String(timerSeconds % 60).padStart(2, '0');
      modalTime.textContent = `${m}:${s}`;
      modalDifficulty.textContent = difficultyEl.value.charAt(0).toUpperCase() + difficultyEl.value.slice(1);
      modalOverlay.classList.add('visible');
      return;
    }

    const isFull = current.every(v => v !== 0);
    if (!isFull) return;

    const wrongCells = [];
    for (let i = 0; i < 81; i++) {
      if (current[i] !== solution[i]) wrongCells.push(i);
    }

    if (wrongCells.length > 0) {
      showErrorChoice(wrongCells);
    }
  }

  function showErrorChoice(wrongCells) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay visible';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <h2>🤔 Not quite!</h2>
      <p>${wrongCells.length} cell${wrongCells.length > 1 ? 's are' : ' is'} incorrect.</p>
      <p>Would you like to see which ones?</p>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="err-show" style="padding:10px 20px;background:var(--btn-active);color:#fff;border:none;border-radius:8px;cursor:pointer">Show errors</button>
        <button id="err-self" style="padding:10px 20px;background:var(--btn-bg);color:var(--text-primary);border:1px solid var(--border-thin);border-radius:8px;cursor:pointer">I'll find them</button>
      </div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('#err-show').addEventListener('click', () => {
      overlay.remove();
      wrongCells.forEach(i => {
        const cell = boardEl.children[i];
        if (cell) cell.classList.add('error');
      });
    });
    modal.querySelector('#err-self').addEventListener('click', () => {
      overlay.remove();
    });
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

  document.getElementById('btn-tutorial').addEventListener('click', () => {
    Onboarding.reset();
    difficultyEl.value = 'beginner';
    checkMovesEnabled = true;
    document.getElementById('chk-check-moves').checked = true;
    newGame();
    Onboarding.start();
  });
  document.getElementById('tutorial-close').addEventListener('click', () => {
    tutorialOverlay.classList.remove('visible');
  });
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

  // Stats
  function showStats() {
    const progress = loadProgress();
    const statsContent = document.getElementById('stats-content');
    const diffs = ['beginner', 'novice', 'easy', 'medium', 'hard', 'extreme'];
    const techs = [
      { id: 'naked-single', name: 'Naked Single', target: 10 },
      { id: 'hidden-single', name: 'Hidden Single', target: 10 },
      { id: 'naked-pair', name: 'Naked Pair', target: 5 }
    ];

    let html = '<h3>Games Completed</h3>';
    for (const d of diffs) {
      const count = progress.gamesCompleted[d] || 0;
      const best = progress.bestTimes[d];
      const timeStr = best ? `${Math.floor(best / 60)}:${String(best % 60).padStart(2, '0')}` : '—';
      html += `<div class="stat-row"><span>${d.charAt(0).toUpperCase() + d.slice(1)}</span><span class="stat-value">${count} games · best ${timeStr}</span></div>`;
    }

    html += '<h3>Techniques Mastered</h3>';
    for (const t of techs) {
      const count = progress.techniquesUsed[t.id] || 0;
      const pct = Math.min(100, Math.round((count / t.target) * 100));
      html += `<div class="stat-row"><span>${t.name}</span><span class="stat-value">${count} uses</span></div>`;
      html += `<div class="skill-bar"><div class="fill" style="width: ${pct}%"></div></div>`;
    }

    statsContent.innerHTML = html;
    document.getElementById('stats-overlay').classList.add('visible');
  }

  document.getElementById('btn-stats').addEventListener('click', showStats);
  document.getElementById('stats-close').addEventListener('click', () => {
    document.getElementById('stats-overlay').classList.remove('visible');
  });

  // Theme toggle
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('btn-theme').textContent = theme === 'light' ? '☀️' : '🌙';
    localStorage.setItem('sudoku-theme', theme);
  }

  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  applyTheme(localStorage.getItem('sudoku-theme') || 'dark');

  // Export / Import
  document.getElementById('btn-export').addEventListener('click', () => {
    const data = {
      gameState: loadGameState(),
      progress: loadProgress(),
      theme: localStorage.getItem('sudoku-theme') || 'dark',
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sudoku-save.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const importFileEl = document.getElementById('import-file');
  document.getElementById('btn-import').addEventListener('click', () => importFileEl.click());
  importFileEl.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.progress) saveProgress(data.progress);
        if (data.theme) applyTheme(data.theme);
        if (data.gameState && data.gameState.puzzle) {
          localStorage.setItem('sudoku-game-state', JSON.stringify(data.gameState));
          const s = data.gameState;
          puzzle = s.puzzle;
          solution = s.solution;
          current = s.current;
          notes = s.notes.map(a => new Set(a));
          timerSeconds = s.timerSeconds || 0;
          gameComplete = s.gameComplete || false;
          difficultyEl.value = s.difficulty || 'medium';
          selected = -1;
          noteMode = false;
          history = [];
          activeHint = null;
          clearInterval(timerInterval);
          timerInterval = setInterval(tick, 1000);
          updateNoteButton();
          render();
          updateNumpadCompletion();
        }
      } catch { alert('Invalid save file'); }
    };
    reader.readAsText(file);
    importFileEl.value = '';
  });

  document.getElementById('btn-play-again').addEventListener('click', () => {
    modalOverlay.classList.remove('visible');
    newGame();
  });

  // Restore saved game or start new
  const saved = loadGameState();
  if (Onboarding.shouldShow()) {
    difficultyEl.value = 'beginner';
    checkMovesEnabled = true;
    document.getElementById('chk-check-moves').checked = true;
    newGame();
    setTimeout(() => Onboarding.start(), 500);
  } else if (saved && !saved.gameComplete) {
    puzzle = saved.puzzle;
    solution = saved.solution;
    current = saved.current;
    notes = saved.notes.map(a => new Set(a));
    timerSeconds = saved.timerSeconds || 0;
    gameComplete = false;
    difficultyEl.value = saved.difficulty || 'medium';
    selected = -1;
    noteMode = false;
    history = [];
    activeHint = null;
    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
    updateNoteButton();
    render();
    updateNumpadCompletion();
  } else {
    newGame();
  }
});
