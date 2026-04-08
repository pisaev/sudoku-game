const SudokuTechniques = ((Sudoku) => {
  const { getRow, getCol, getBox } = Sudoku;

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

  function unitCells(type, idx) {
    const cells = [];
    if (type === 'row') {
      for (let c = 0; c < 9; c++) cells.push(idx * 9 + c);
    } else if (type === 'column') {
      for (let r = 0; r < 9; r++) cells.push(r * 9 + idx);
    } else {
      const sr = Math.floor(idx / 3) * 3, sc = (idx % 3) * 3;
      for (let r = sr; r < sr + 3; r++)
        for (let c = sc; c < sc + 3; c++)
          cells.push(r * 9 + c);
    }
    return cells;
  }

  const allUnits = [];
  for (let i = 0; i < 9; i++) {
    allUnits.push({ type: 'row', index: i, cells: unitCells('row', i) });
    allUnits.push({ type: 'column', index: i, cells: unitCells('column', i) });
    allUnits.push({ type: 'box', index: i, cells: unitCells('box', i) });
  }

  function getCandidates(board) {
    const candidates = Array.from({ length: 81 }, () => new Set());
    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0) continue;
      for (let n = 1; n <= 9; n++) {
        if (peerCache[i].every(p => board[p] !== n)) {
          candidates[i].add(n);
        }
      }
    }
    return candidates;
  }

  function findNakedSingle(board, candidates) {
    if (!candidates) candidates = getCandidates(board);
    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0 || candidates[i].size !== 1) continue;
      const value = [...candidates[i]][0];
      return {
        technique: 'naked-single',
        index: i,
        value,
        highlights: peerCache[i].filter(p => board[p] !== 0),
        explanation: `Cell r${getRow(i) + 1}c${getCol(i) + 1} can only be ${value} — all other values are eliminated by its peers.`
      };
    }
    return null;
  }

  function findHiddenSingle(board, candidates) {
    if (!candidates) candidates = getCandidates(board);
    for (const unit of allUnits) {
      const empty = unit.cells.filter(i => board[i] === 0);
      for (let n = 1; n <= 9; n++) {
        if (unit.cells.some(i => board[i] === n)) continue;
        const possible = empty.filter(i => candidates[i].has(n));
        if (possible.length === 1) {
          const index = possible[0];
          return {
            technique: 'hidden-single',
            index,
            value: n,
            unitType: unit.type,
            unitIndex: unit.index,
            highlights: empty.filter(i => i !== index),
            explanation: `${n} can only go in r${getRow(index) + 1}c${getCol(index) + 1} within this ${unit.type} — no other cell in ${unit.type} ${unit.index + 1} can hold ${n}.`
          };
        }
      }
    }
    return null;
  }

  function findNakedPair(board, candidates) {
    if (!candidates) candidates = getCandidates(board);
    for (const unit of allUnits) {
      const empty = unit.cells.filter(i => board[i] === 0);
      for (let a = 0; a < empty.length; a++) {
        if (candidates[empty[a]].size !== 2) continue;
        for (let b = a + 1; b < empty.length; b++) {
          if (candidates[empty[b]].size !== 2) continue;
          const setA = candidates[empty[a]], setB = candidates[empty[b]];
          if (![...setA].every(v => setB.has(v))) continue;

          const values = [...setA];
          const cellA = empty[a], cellB = empty[b];
          const eliminations = [];
          for (const other of empty) {
            if (other === cellA || other === cellB) continue;
            for (const v of values) {
              if (candidates[other].has(v)) {
                eliminations.push({ index: other, value: v });
              }
            }
          }

          if (eliminations.length > 0) {
            return {
              technique: 'naked-pair',
              cells: [cellA, cellB],
              values,
              unitType: unit.type,
              unitIndex: unit.index,
              eliminations,
              highlights: [cellA, cellB, ...eliminations.map(e => e.index)],
              explanation: `Cells r${getRow(cellA) + 1}c${getCol(cellA) + 1} and r${getRow(cellB) + 1}c${getCol(cellB) + 1} both contain only {${values.join(', ')}} in this ${unit.type}. These values can be removed from other cells in the ${unit.type}.`
            };
          }
        }
      }
    }
    return null;
  }

  function findNextMove(board) {
    const candidates = getCandidates(board);
    return findNakedSingle(board, candidates)
      || findHiddenSingle(board, candidates)
      || findNakedPair(board, candidates)
      || null;
  }

  function solvableWith(board, techniques) {
    const b = [...board];
    const hasPair = techniques.includes('naked-pair');

    while (true) {
      let candidates = getCandidates(b);
      let progress = false;

      if (hasPair) {
        let eliminated = true;
        while (eliminated) {
          eliminated = false;
          const pair = findNakedPair(b, candidates);
          if (pair) {
            for (const { index, value } of pair.eliminations) {
              candidates[index].delete(value);
            }
            eliminated = true;
          }
        }
      }

      if (techniques.includes('naked-single')) {
        const result = findNakedSingle(b, candidates);
        if (result) { b[result.index] = result.value; progress = true; continue; }
      }

      if (techniques.includes('hidden-single')) {
        const result = findHiddenSingle(b, candidates);
        if (result) { b[result.index] = result.value; progress = true; continue; }
      }

      if (!progress) break;
    }

    return b.every(v => v !== 0);
  }

  function classifyPuzzle(board) {
    if (solvableWith(board, ['naked-single'])) return 'beginner';
    if (solvableWith(board, ['naked-single', 'hidden-single'])) return 'novice';
    if (solvableWith(board, ['naked-single', 'hidden-single', 'naked-pair'])) return 'intermediate';
    return 'advanced';
  }

  function generateClassified(targetClass, maxAttempts) {
    maxAttempts = maxAttempts || 50;
    const diffMap = { beginner: 'easy', novice: 'easy', intermediate: 'medium', advanced: 'hard' };
    const baseDifficulty = diffMap[targetClass] || 'medium';

    for (let i = 0; i < maxAttempts; i++) {
      const result = Sudoku.generate(baseDifficulty);
      if (classifyPuzzle(result.puzzle) === targetClass) return result;
    }
    return Sudoku.generate(baseDifficulty);
  }

  return {
    getCandidates,
    findNakedSingle,
    findHiddenSingle,
    findNakedPair,
    findNextMove,
    solvableWith,
    classifyPuzzle,
    generateClassified
  };
})(typeof Sudoku !== 'undefined' ? Sudoku : require('./sudoku'));

if (typeof module !== 'undefined') module.exports = SudokuTechniques;
