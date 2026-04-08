const Sudoku = (() => {
  function createEmpty() {
    return Array.from({ length: 81 }, () => 0);
  }

  function getRow(i) { return Math.floor(i / 9); }
  function getCol(i) { return i % 9; }
  function getBox(i) { return Math.floor(getRow(i) / 3) * 3 + Math.floor(getCol(i) / 3); }

  function peers(index) {
    const r = getRow(index), c = getCol(index), b = getBox(index);
    const result = [];
    for (let i = 0; i < 81; i++) {
      if (i !== index && (getRow(i) === r || getCol(i) === c || getBox(i) === b)) {
        result.push(i);
      }
    }
    return result;
  }

  const peerCache = Array.from({ length: 81 }, (_, i) => peers(i));

  function isValid(board, index, num) {
    return peerCache[index].every(p => board[p] !== num);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function solve(board, randomize = false) {
    const b = [...board];

    function backtrack(idx) {
      if (idx === 81) return true;
      if (b[idx] !== 0) return backtrack(idx + 1);

      const nums = randomize
        ? shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])
        : [1, 2, 3, 4, 5, 6, 7, 8, 9];

      for (const n of nums) {
        if (isValid(b, idx, n)) {
          b[idx] = n;
          if (backtrack(idx + 1)) return true;
          b[idx] = 0;
        }
      }
      return false;
    }

    return backtrack(0) ? b : null;
  }

  function countSolutions(board, limit = 2) {
    const b = [...board];
    let count = 0;

    function backtrack(idx) {
      if (count >= limit) return;
      if (idx === 81) { count++; return; }
      if (b[idx] !== 0) { backtrack(idx + 1); return; }

      for (let n = 1; n <= 9; n++) {
        if (isValid(b, idx, n)) {
          b[idx] = n;
          backtrack(idx + 1);
          b[idx] = 0;
          if (count >= limit) return;
        }
      }
    }

    backtrack(0);
    return count;
  }

  function generate(difficulty = 'medium') {
    const clueCount = { easy: 38, medium: 30, hard: 24, extreme: 20 };
    const target = clueCount[difficulty] || 30;

    const solution = solve(createEmpty(), true);
    if (!solution) throw new Error('Failed to generate puzzle');

    const puzzle = [...solution];
    const indices = shuffle([...Array(81).keys()]);

    let removed = 0;
    for (const idx of indices) {
      if (81 - removed <= target) break;
      const backup = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle) !== 1) {
        puzzle[idx] = backup;
      } else {
        removed++;
      }
    }

    return { puzzle, solution };
  }

  function validate(board) {
    const errors = new Set();
    for (let i = 0; i < 81; i++) {
      if (board[i] === 0) continue;
      for (const p of peerCache[i]) {
        if (board[p] === board[i]) {
          errors.add(i);
          errors.add(p);
        }
      }
    }
    return errors;
  }

  function isSolved(board) {
    return board.every(v => v !== 0) && validate(board).size === 0;
  }

  return { generate, validate, isSolved, getRow, getCol, getBox };
})();

if (typeof module !== 'undefined') module.exports = Sudoku;
