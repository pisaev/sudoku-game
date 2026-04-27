// Pure helpers for managing per-difficulty saved games.
// No DOM, no localStorage — caller is responsible for I/O.
const GameStorage = (() => {
  function buildState({ puzzle, solution, current, notes, timerSeconds, gameComplete, difficulty }) {
    return {
      puzzle, solution, current,
      timerSeconds: timerSeconds || 0,
      gameComplete: !!gameComplete,
      difficulty,
      notes: notes ? notes.map(s => [...s]) : Array.from({ length: 81 }, () => [])
    };
  }

  function isValidState(state) {
    return !!(state
      && Array.isArray(state.puzzle) && state.puzzle.length === 81
      && Array.isArray(state.solution) && state.solution.length === 81
      && Array.isArray(state.current) && state.current.length === 81
      && typeof state.difficulty === 'string');
  }

  function setSlot(allStates, state) {
    if (!isValidState(state)) return { ...(allStates || {}) };
    return { ...(allStates || {}), [state.difficulty]: state };
  }

  function getSlot(allStates, difficulty) {
    if (!allStates || !difficulty) return null;
    const s = allStates[difficulty];
    return isValidState(s) ? s : null;
  }

  function removeSlot(allStates, difficulty) {
    if (!allStates || !(difficulty in allStates)) return { ...(allStates || {}) };
    const next = { ...allStates };
    delete next[difficulty];
    return next;
  }

  // Convert the legacy single-slot save (`sudoku-game-state`) into a per-difficulty map.
  // Returns null if the legacy value is missing or unusable.
  function migrateLegacy(legacyState) {
    if (!isValidState(legacyState)) return null;
    return { [legacyState.difficulty]: legacyState };
  }

  // Pick which saved game to restore on startup.
  // 1. If preferredDifficulty has an in-progress save, use it.
  // 2. Otherwise return any other in-progress save (deterministic by key order).
  // 3. Otherwise null.
  function selectSavedGame(allStates, preferredDifficulty) {
    if (!allStates) return null;
    const preferred = getSlot(allStates, preferredDifficulty);
    if (preferred && !preferred.gameComplete) return preferred;
    for (const key of Object.keys(allStates)) {
      const s = allStates[key];
      if (isValidState(s) && !s.gameComplete) return s;
    }
    return null;
  }

  return { buildState, isValidState, setSlot, getSlot, removeSlot, migrateLegacy, selectSavedGame };
})();

if (typeof module !== 'undefined') module.exports = GameStorage;
