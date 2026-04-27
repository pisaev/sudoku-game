const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const GameStorage = require('../js/game-storage');

function makeState(overrides = {}) {
  return {
    puzzle: Array(81).fill(0),
    solution: Array(81).fill(1),
    current: Array(81).fill(0),
    notes: Array.from({ length: 81 }, () => []),
    timerSeconds: 30,
    gameComplete: false,
    difficulty: 'easy',
    ...overrides,
  };
}

describe('GameStorage.buildState', () => {
  it('serializes notes as plain arrays', () => {
    const notes = [new Set([1, 2]), new Set([3])];
    while (notes.length < 81) notes.push(new Set());
    const s = GameStorage.buildState({
      puzzle: Array(81).fill(0), solution: Array(81).fill(0), current: Array(81).fill(0),
      notes, timerSeconds: 5, gameComplete: false, difficulty: 'medium',
    });
    assert.deepEqual(s.notes[0], [1, 2]);
    assert.deepEqual(s.notes[1], [3]);
    assert.deepEqual(s.notes[80], []);
    assert.equal(s.difficulty, 'medium');
    assert.equal(s.timerSeconds, 5);
    assert.equal(s.gameComplete, false);
  });

  it('defaults timerSeconds and notes when missing', () => {
    const s = GameStorage.buildState({
      puzzle: Array(81).fill(0), solution: Array(81).fill(0), current: Array(81).fill(0),
      difficulty: 'beginner',
    });
    assert.equal(s.timerSeconds, 0);
    assert.equal(s.gameComplete, false);
    assert.equal(s.notes.length, 81);
    assert.deepEqual(s.notes[0], []);
  });
});

describe('GameStorage.isValidState', () => {
  it('accepts a well-formed state', () => {
    assert.equal(GameStorage.isValidState(makeState()), true);
  });

  it('rejects null, missing arrays, wrong-length arrays, missing difficulty', () => {
    assert.equal(GameStorage.isValidState(null), false);
    assert.equal(GameStorage.isValidState({}), false);
    assert.equal(GameStorage.isValidState(makeState({ puzzle: [1, 2, 3] })), false);
    assert.equal(GameStorage.isValidState(makeState({ solution: undefined })), false);
    assert.equal(GameStorage.isValidState(makeState({ difficulty: undefined })), false);
  });
});

describe('GameStorage.setSlot / getSlot / removeSlot', () => {
  it('routes a state into its own difficulty slot', () => {
    const s = makeState({ difficulty: 'hard' });
    const all = GameStorage.setSlot({}, s);
    assert.deepEqual(GameStorage.getSlot(all, 'hard'), s);
    assert.equal(GameStorage.getSlot(all, 'easy'), null);
  });

  it('overwrites only the matching difficulty slot', () => {
    const easy = makeState({ difficulty: 'easy', timerSeconds: 10 });
    const hard = makeState({ difficulty: 'hard', timerSeconds: 100 });
    let all = GameStorage.setSlot({}, easy);
    all = GameStorage.setSlot(all, hard);
    const newEasy = makeState({ difficulty: 'easy', timerSeconds: 99 });
    all = GameStorage.setSlot(all, newEasy);
    assert.equal(GameStorage.getSlot(all, 'easy').timerSeconds, 99);
    assert.equal(GameStorage.getSlot(all, 'hard').timerSeconds, 100);
  });

  it('does not mutate the input map (immutable update)', () => {
    const original = {};
    const next = GameStorage.setSlot(original, makeState({ difficulty: 'easy' }));
    assert.notEqual(next, original);
    assert.deepEqual(original, {});
  });

  it('ignores invalid states in setSlot', () => {
    const all = GameStorage.setSlot({ easy: makeState() }, { puzzle: 'nope' });
    assert.deepEqual(Object.keys(all), ['easy']);
  });

  it('removeSlot removes only the named difficulty', () => {
    const all = GameStorage.setSlot(
      GameStorage.setSlot({}, makeState({ difficulty: 'easy' })),
      makeState({ difficulty: 'hard' })
    );
    const after = GameStorage.removeSlot(all, 'easy');
    assert.equal(GameStorage.getSlot(after, 'easy'), null);
    assert.notEqual(GameStorage.getSlot(after, 'hard'), null);
  });

  it('removeSlot is a no-op when the slot is absent', () => {
    const all = GameStorage.setSlot({}, makeState({ difficulty: 'easy' }));
    const after = GameStorage.removeSlot(all, 'medium');
    assert.deepEqual(after, all);
  });

  it('getSlot returns null for an invalid stored state', () => {
    const all = { easy: { puzzle: 'oops' } };
    assert.equal(GameStorage.getSlot(all, 'easy'), null);
  });
});

describe('GameStorage.migrateLegacy', () => {
  it('keys the legacy state by its own difficulty', () => {
    const legacy = makeState({ difficulty: 'novice' });
    const migrated = GameStorage.migrateLegacy(legacy);
    assert.deepEqual(Object.keys(migrated), ['novice']);
    assert.equal(migrated.novice, legacy);
  });

  it('returns null for an invalid legacy payload', () => {
    assert.equal(GameStorage.migrateLegacy(null), null);
    assert.equal(GameStorage.migrateLegacy({}), null);
    assert.equal(GameStorage.migrateLegacy({ puzzle: [1] }), null);
  });
});

describe('GameStorage.selectSavedGame', () => {
  it('prefers an in-progress save matching the current difficulty', () => {
    const all = GameStorage.setSlot(
      GameStorage.setSlot({}, makeState({ difficulty: 'easy', timerSeconds: 10 })),
      makeState({ difficulty: 'medium', timerSeconds: 50 })
    );
    const picked = GameStorage.selectSavedGame(all, 'medium');
    assert.equal(picked.difficulty, 'medium');
    assert.equal(picked.timerSeconds, 50);
  });

  it('falls back to any in-progress save when the preferred slot is missing', () => {
    const all = GameStorage.setSlot({}, makeState({ difficulty: 'hard' }));
    const picked = GameStorage.selectSavedGame(all, 'easy');
    assert.equal(picked.difficulty, 'hard');
  });

  it('skips completed games when picking', () => {
    const all = GameStorage.setSlot(
      GameStorage.setSlot({}, makeState({ difficulty: 'easy', gameComplete: true })),
      makeState({ difficulty: 'hard', gameComplete: false })
    );
    const picked = GameStorage.selectSavedGame(all, 'easy');
    assert.equal(picked.difficulty, 'hard');
  });

  it('returns null when no in-progress games exist', () => {
    const all = GameStorage.setSlot({}, makeState({ difficulty: 'easy', gameComplete: true }));
    assert.equal(GameStorage.selectSavedGame(all, 'easy'), null);
  });

  it('returns null for empty or null input', () => {
    assert.equal(GameStorage.selectSavedGame({}, 'easy'), null);
    assert.equal(GameStorage.selectSavedGame(null, 'easy'), null);
  });
});
