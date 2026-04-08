const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Sudoku = require('../js/sudoku');

describe('getRow / getCol / getBox', () => {
  it('should return correct row for cell indices', () => {
    assert.equal(Sudoku.getRow(0), 0);
    assert.equal(Sudoku.getRow(8), 0);
    assert.equal(Sudoku.getRow(9), 1);
    assert.equal(Sudoku.getRow(40), 4);
    assert.equal(Sudoku.getRow(80), 8);
  });

  it('should return correct column for cell indices', () => {
    assert.equal(Sudoku.getCol(0), 0);
    assert.equal(Sudoku.getCol(8), 8);
    assert.equal(Sudoku.getCol(9), 0);
    assert.equal(Sudoku.getCol(40), 4);
    assert.equal(Sudoku.getCol(80), 8);
  });

  it('should return correct box for cell indices', () => {
    assert.equal(Sudoku.getBox(0), 0);
    assert.equal(Sudoku.getBox(2), 0);
    assert.equal(Sudoku.getBox(3), 1);
    assert.equal(Sudoku.getBox(27), 3);
    assert.equal(Sudoku.getBox(40), 4);
    assert.equal(Sudoku.getBox(80), 8);
  });
});

describe('validate', () => {
  it('should return empty set for a valid complete board', () => {
    const { solution } = Sudoku.generate('easy');
    const errors = Sudoku.validate(solution);
    assert.equal(errors.size, 0);
  });

  it('should ignore empty cells', () => {
    const board = new Array(81).fill(0);
    const errors = Sudoku.validate(board);
    assert.equal(errors.size, 0);
  });

  it('should detect row conflict', () => {
    const board = new Array(81).fill(0);
    board[0] = 5;
    board[1] = 5;
    const errors = Sudoku.validate(board);
    assert.ok(errors.has(0));
    assert.ok(errors.has(1));
  });

  it('should detect column conflict', () => {
    const board = new Array(81).fill(0);
    board[0] = 3;
    board[9] = 3;
    const errors = Sudoku.validate(board);
    assert.ok(errors.has(0));
    assert.ok(errors.has(9));
  });

  it('should detect box conflict', () => {
    const board = new Array(81).fill(0);
    board[0] = 7;
    board[10] = 7;
    const errors = Sudoku.validate(board);
    assert.ok(errors.has(0));
    assert.ok(errors.has(10));
  });
});

describe('isSolved', () => {
  it('should return true for a valid complete board', () => {
    const { solution } = Sudoku.generate('easy');
    assert.equal(Sudoku.isSolved(solution), true);
  });

  it('should return false for an incomplete board', () => {
    const { puzzle } = Sudoku.generate('easy');
    assert.equal(Sudoku.isSolved(puzzle), false);
  });

  it('should return false for a complete board with conflicts', () => {
    const { solution } = Sudoku.generate('easy');
    const bad = [...solution];
    bad[0] = bad[1];
    assert.equal(Sudoku.isSolved(bad), false);
  });
});

describe('generate', () => {
  it('should return a puzzle and solution', () => {
    const result = Sudoku.generate('medium');
    assert.ok(Array.isArray(result.puzzle));
    assert.ok(Array.isArray(result.solution));
    assert.equal(result.puzzle.length, 81);
    assert.equal(result.solution.length, 81);
  });

  it('should produce a valid solved solution', () => {
    const { solution } = Sudoku.generate('medium');
    assert.equal(Sudoku.isSolved(solution), true);
  });

  it('should match solution values at given positions', () => {
    const { puzzle, solution } = Sudoku.generate('medium');
    for (let i = 0; i < 81; i++) {
      if (puzzle[i] !== 0) {
        assert.equal(puzzle[i], solution[i],
          `Mismatch at index ${i}: puzzle=${puzzle[i]}, solution=${solution[i]}`);
      }
    }
  });

  for (const [difficulty, target] of [['easy', 38], ['medium', 30], ['hard', 24], ['extreme', 20]]) {
    it(`should produce close to ${target} clues for ${difficulty} difficulty`, () => {
      const { puzzle } = Sudoku.generate(difficulty);
      const clues = puzzle.filter(v => v !== 0).length;
      assert.ok(clues >= target && clues <= target + 4,
        `Expected ${target}-${target + 4} clues for ${difficulty}, got ${clues}`);
    });
  }

  it('should produce different puzzles on successive calls', () => {
    const a = Sudoku.generate('easy').puzzle.join(',');
    const b = Sudoku.generate('easy').puzzle.join(',');
    assert.notEqual(a, b);
  });

  it('should only contain values 0-9', () => {
    const { puzzle, solution } = Sudoku.generate('medium');
    assert.ok(puzzle.every(v => v >= 0 && v <= 9));
    assert.ok(solution.every(v => v >= 1 && v <= 9));
  });
});
