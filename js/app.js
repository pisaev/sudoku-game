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

  document.getElementById('btn-play-again').addEventListener('click', () => {
    modalOverlay.classList.remove('visible');
    newGame();
  });

  newGame();
});
