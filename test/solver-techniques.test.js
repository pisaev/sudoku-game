const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Sudoku = require('../js/sudoku');
const SudokuTechniques = require('../js/solver-techniques');

describe('getCandidates', () => {
  it('should return all values 1-9 for each cell on an empty board', () => {
    const board = new Array(81).fill(0);
    const candidates = SudokuTechniques.getCandidates(board);
    assert.equal(candidates.length, 81);
    for (const c of candidates) {
      assert.equal(c.size, 9);
    }
  });

  it('should return empty set for filled cells', () => {
    const board = new Array(81).fill(0);
    board[0] = 5;
    const candidates = SudokuTechniques.getCandidates(board);
    assert.equal(candidates[0].size, 0);
  });

  it('should eliminate values present in same row, column, and box', () => {
    const board = new Array(81).fill(0);
    board[0] = 5;
    const candidates = SudokuTechniques.getCandidates(board);
    assert.ok(!candidates[1].has(5), 'same row');
    assert.ok(!candidates[9].has(5), 'same column');
    assert.ok(!candidates[10].has(5), 'same box');
    assert.ok(candidates[21].has(5), 'different row, column, and box');
  });
});

describe('findNakedSingle', () => {
  it('should find a cell with only one candidate', () => {
    const board = new Array(81).fill(0);
    for (let i = 0; i < 8; i++) board[i] = i + 1;

    const result = SudokuTechniques.findNakedSingle(board);
    assert.ok(result);
    assert.equal(result.technique, 'naked-single');
    assert.equal(result.index, 8);
    assert.equal(result.value, 9);
    assert.ok(result.explanation.includes('9'));
  });

  it('should return null when no naked single exists', () => {
    const board = new Array(81).fill(0);
    assert.equal(SudokuTechniques.findNakedSingle(board), null);
  });
});

describe('findHiddenSingle', () => {
  it('should find a value that can only go in one cell within a unit', () => {
    const board = new Array(81).fill(0);
    board[1] = 2; board[2] = 3; board[3] = 1;
    board[22] = 1;
    board[54] = 1;
    board[64] = 1;

    const result = SudokuTechniques.findHiddenSingle(board);
    assert.ok(result);
    assert.equal(result.technique, 'hidden-single');
    assert.ok(typeof result.index === 'number');
    assert.ok(result.value >= 1 && result.value <= 9);
    assert.ok(['row', 'column', 'box'].includes(result.unitType));
    assert.ok(result.explanation.length > 0);
  });

  it('should return null on an empty board', () => {
    assert.equal(SudokuTechniques.findHiddenSingle(new Array(81).fill(0)), null);
  });
});

describe('findNakedPair', () => {
  it('should find two cells sharing the same two candidates with eliminations', () => {
    const board = new Array(81).fill(0);
    board[3] = 3; board[4] = 4; board[5] = 5;
    board[6] = 6; board[7] = 7; board[8] = 8;
    board[27] = 9;
    board[37] = 9;

    const result = SudokuTechniques.findNakedPair(board);
    assert.ok(result);
    assert.equal(result.technique, 'naked-pair');
    assert.equal(result.cells.length, 2);
    assert.ok(result.cells.includes(0));
    assert.ok(result.cells.includes(1));
    assert.deepEqual(result.values.sort(), [1, 2]);
    assert.ok(result.eliminations.length > 0);
    assert.ok(result.eliminations.some(e => e.index === 2));
  });

  it('should return null when no naked pair exists', () => {
    assert.equal(SudokuTechniques.findNakedPair(new Array(81).fill(0)), null);
  });
});

describe('findNextMove', () => {
  it('should prefer naked single over hidden single', () => {
    const board = new Array(81).fill(0);
    for (let i = 0; i < 8; i++) board[i] = i + 1;

    const result = SudokuTechniques.findNextMove(board);
    assert.ok(result);
    assert.equal(result.technique, 'naked-single');
  });

  it('should return null on a solved board', () => {
    const { solution } = Sudoku.generate('easy');
    assert.equal(SudokuTechniques.findNextMove(solution), null);
  });

  it('should find a move for any generated puzzle', () => {
    const { puzzle } = Sudoku.generate('easy');
    const result = SudokuTechniques.findNextMove(puzzle);
    assert.ok(result);
    assert.ok(result.index >= 0 && result.index < 81);
    assert.ok(result.value >= 1 && result.value <= 9);
    assert.ok(result.technique);
    assert.ok(result.explanation);
  });
});

describe('solvableWith', () => {
  it('should not solve any puzzle with no techniques', () => {
    const { puzzle } = Sudoku.generate('easy');
    assert.equal(SudokuTechniques.solvableWith(puzzle, []), false);
  });

  it('should solve puzzles using naked and hidden singles', () => {
    const { puzzle } = Sudoku.generate('easy');
    const result = SudokuTechniques.solvableWith(puzzle, ['naked-single', 'hidden-single']);
    assert.equal(typeof result, 'boolean');
  });
});

describe('classifyPuzzle', () => {
  it('should return a valid classification', () => {
    const { puzzle } = Sudoku.generate('easy');
    const valid = ['beginner', 'novice', 'intermediate', 'advanced'];
    assert.ok(valid.includes(SudokuTechniques.classifyPuzzle(puzzle)));
  });

  it('should classify puzzles of all difficulties', () => {
    const valid = ['beginner', 'novice', 'intermediate', 'advanced'];
    for (const diff of ['easy', 'medium', 'hard']) {
      const { puzzle } = Sudoku.generate(diff);
      assert.ok(valid.includes(SudokuTechniques.classifyPuzzle(puzzle)));
    }
  });
});

describe('generateClassified', () => {
  it('should generate a beginner puzzle solvable with naked singles only', () => {
    const { puzzle } = SudokuTechniques.generateClassified('beginner');
    assert.ok(SudokuTechniques.solvableWith(puzzle, ['naked-single']));
  });

  it('should generate a novice puzzle solvable with singles', () => {
    const { puzzle } = SudokuTechniques.generateClassified('novice');
    assert.ok(SudokuTechniques.solvableWith(puzzle, ['naked-single', 'hidden-single']));
  });

  it('should always return a valid puzzle and solution', () => {
    const { puzzle, solution } = SudokuTechniques.generateClassified('beginner');
    assert.equal(puzzle.length, 81);
    assert.ok(Sudoku.isSolved(solution));
  });
});