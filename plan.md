# Sudoku Training Mode — Implementation Plan

## Problem
Beginners who don't know Sudoku rules or solving techniques have no way to learn from the app. We want an education mode that teaches rules, explains moves, and progressively develops skills.

## Approach
Ship as a sequence of independent PRs, each adding one complete feature. Order is based on value delivered to learners — each PR is useful on its own.

---

## PR 1: Solving Technique Detection Engine
**What:** Pure logic module (`js/solver-techniques.js`) that can analyze a board and identify which technique solves each cell — naked single, hidden single, naked pair, etc. No UI changes.
**Why first:** This is the foundation that Smart Hints, Progressive Difficulty, and Technique Lessons all depend on. Building and testing it in isolation keeps things clean.
**Tests:** Verify each technique detection against known board positions.

## PR 2: Smart Hints (Explain WHY)
**What:** Replace the current hint (which just reveals the answer) with a hint that shows the reasoning: "Row 3 already has 1,2,3,4,6,7,8,9 — so this cell must be **5**" with relevant cells highlighted.
**Why:** Highest-impact teaching feature. Turns passive answer-giving into active learning.
**Depends on:** PR 1 (technique detection).

## PR 3: Auto-Notes
**What:** Add an "Auto Notes" toggle button. When enabled, automatically fills and maintains pencil marks as the player enters numbers. Keeps notes consistent by removing values from peers when a number is placed.
**Why:** Removes bookkeeping friction so beginners can focus on logic. Also helps them see what auto-notes look like so they learn to do it themselves.
**Depends on:** Nothing (independent of technique engine).

## PR 4: Mistake Prevention
**What:** Add a "Check Moves" toggle. When enabled, warn the player *before* confirming a wrong number — flash the conflicting cells and show a brief explanation ("5 already exists in this column"). Optionally, also check against the solution (not just conflicts).
**Why:** Prevents frustration. Beginners learn rules faster when mistakes are caught early.
**Depends on:** Nothing (independent).

## PR 5: Progressive Difficulty (Technique-Gated Puzzles)
**What:** Add difficulty sub-levels that guarantee the puzzle is solvable using only specific techniques:
- "Beginner" — naked singles only
- "Novice" — naked + hidden singles
- "Intermediate" — adds naked pairs
- "Advanced" — current hard mode
The generator filters puzzles by checking which techniques are required.
**Why:** Players naturally learn new techniques as they level up.
**Depends on:** PR 1 (technique detection, to verify which techniques a puzzle requires).

## PR 6: Interactive Tutorial
**What:** A guided walkthrough accessible from a "How to Play" button. Walks through:
1. The rules (row, column, box uniqueness) with a highlighted example board
2. How to use the UI (select cell, enter number, notes, undo)
3. Solving a first cell together using naked single
Implemented as an overlay with step-by-step narration and board highlighting.
**Why:** First-time users need orientation. But most value comes from learning-by-doing (PRs 2, 5), which is why this comes later.
**Depends on:** Nothing (but better after PR 2 so hints are already smart).

## PR 7: Technique Lessons
**What:** A "Learn" section with one lesson per technique. Each lesson:
1. Explains the technique with a diagram
2. Presents a practice puzzle pre-set to a position where that technique applies
3. Asks the player to find the cell/number (guided with progressive hints)
Techniques covered: naked single, hidden single, naked pairs, pointing pairs.
**Why:** Structured practice for specific skills, complements the organic learning from PRs 2 and 5.
**Depends on:** PR 1 (technique detection), PR 2 (smart hints).

## PR 8: Progress Tracking
**What:** Track which techniques the player has successfully used. Show a simple skill tree or progress bar on a "My Progress" screen. Persist in localStorage.
**Why:** Motivation and sense of advancement. Comes last because it's polish — the teaching features are what actually matter.
**Depends on:** PR 1 (technique detection to attribute which technique was used per move).

---

## Notes
- PRs 3 and 4 are fully independent and can be done in any order or in parallel with PR 1.
- PR 1 is the critical path — PRs 2, 5, 7, 8 all depend on it.
- All features should be behind UI toggles or separate screens — they must not clutter the core game experience for players who don't need them.
