# Smart Slot Emulator Phase Plan

## Purpose

This project aims to create a specification-driven smart slot emulator using HTML and Canvas, while organizing the documents needed to reason about Japanese smart slot type-test and inspection requirements.

Important scope note: an actual Japanese slot machine type test applies to a complete machine type, including hardware, control boards, firmware, cabinet, power behavior, credit/payment behavior, display, sound, and ROM contents. A browser emulator cannot itself be submitted as a real machine type. This project therefore separates:

- Regulatory and type-test oriented design documents.
- Emulator implementation documents and executable behavior.
- Gaps that must be filled when moving from emulator to physical machine.

## Final Deliverables

- Regulatory research notes and compliance matrix.
- Complete game specification documents.
- Mathematical design and simulation reports.
- HTML + Canvas smart slot emulator.
- Batch simulator for long-run verification.
- Test logs and reproducible reports.
- Limitations document covering emulator-versus-real-machine differences.

## Phase 0: Regulatory Scope Definition

Goal: clarify the legal and technical scope before designing game behavior.

Deliverables:

- Applicable law, regulation, notice, and interpretation reference list.
- Type-test and public safety commission inspection flow summary.
- Smart slot specific scope assumptions.
- Emulator scope and non-emulator hardware scope split.
- Risk register for uncertain or institution-dependent requirements.

Key decisions:

- Which machine category and rule set the design targets.
- Which regulatory checks can be simulated in software.
- Which items require real hardware documentation later.

Exit criteria:

- The team can explain what the emulator proves and what it does not prove.
- All future specification files have a known regulatory reference point.

## Phase 1: Game Specification Draft

Goal: define the machine behavior in a way that can be implemented and tested.

Deliverables:

- Machine concept specification.
- Game state specification.
- Reel strip table.
- Symbol definition table.
- Role and payout table.
- Setting-based lottery tables.
- Replay, small role, bonus, AT, and special state behavior.
- Credit, bet, payout, and smart slot credit-management assumptions.
- Stop-control specification.
- Winning judgment specification.
- Error, reset, and power recovery assumptions.

Key decisions:

- Number of reels, symbols, lines, and stop buttons.
- Base game, bonus, AT, and special state model.
- Setting count and setting-specific probability design.
- Internal flag lifetime and state transition rules.

Exit criteria:

- A developer can implement the core engine without asking design questions.
- A simulator can run from structured data files rather than hard-coded guesses.

## Phase 2: Type-Test Document Package Design

Goal: create a document structure close to what a real machine development project would need.

Deliverables:

- Type overview document.
- Machine specification table.
- Game operation manual.
- Structural explanation document.
- Electrical and control-system explanation document.
- Main-control and sub-control specification split.
- Program behavior specification.
- Random-number and lottery explanation document.
- Stop-control explanation document.
- Winning and payout explanation document.
- Compliance checklist.
- Pre-submission review checklist.

Key decisions:

- Which documents are emulator-only.
- Which documents are placeholders for physical machine development.
- Which values must be generated from implementation and simulation.

Exit criteria:

- Documentation folders and templates exist.
- Each required document has an owner, source of truth, and completion condition.

## Phase 3: Mathematics and Simulation

Goal: verify that the designed behavior produces expected statistical results.

Deliverables:

- Deterministic random-number generator interface.
- Batch simulation runner.
- Auto-play strategy for regulatory-style testing.
- Role appearance report.
- Payout rate report by setting.
- Short, medium, and long-run performance reports.
- AT entry and continuation report.
- Advantageous section and net-difference management report, if applicable.
- Boundary and abnormal-state test report.

Key decisions:

- Simulation game count targets.
- Report format.
- Seed handling for reproducible results.
- Acceptance thresholds between design values and simulated values.

Exit criteria:

- Long-run simulation is reproducible from the command line.
- Reports identify deviations from the specification.
- The implementation can be tested before Canvas UI work begins.

## Phase 4: Emulator Architecture

Goal: build a browser emulator that stays aligned with the specification.

Recommended structure:

```text
src/
  core/
    rng.ts
    reel.ts
    lottery.ts
    stop-control.ts
    payout.ts
    game-state.ts
    regulation-checker.ts
  simulator/
    batch-runner.ts
    report.ts
  ui/
    canvas-renderer.ts
    input.ts
    sound.ts
    panels.ts
  data/
    symbols.json
    reels.json
    roles.json
    tables.json
    settings.json
docs/
  plan/
  regulatory/
  spec/
  test-reports/
```

Deliverables:

- Core game engine independent from UI.
- Canvas renderer for reels, symbols, lamps, panels, and counters.
- Input layer for bet, lever, and stop buttons.
- Sound and effect hooks.
- Debug panel for flags, state, seed, and counters.
- Auto-play mode.
- Log export.

Key decisions:

- TypeScript or plain JavaScript.
- Build tool and test framework.
- Canvas rendering resolution and scaling policy.
- Data-file format for game tables.

Exit criteria:

- Manual play works in the browser.
- Auto-play and UI use the same core engine.
- UI state can be verified against core logs.

## Phase 5: Implementation Milestones

Milestone 1: repository foundation

- Create document folders.
- Create core source folders.
- Add build, lint, and test tooling.
- Add initial README and contribution notes.

Milestone 2: minimum playable engine

- Implement RNG.
- Implement reels and symbols.
- Implement role lottery.
- Implement stop buttons.
- Implement winning judgment.
- Implement payout and credit handling.

Milestone 3: verification engine

- Add automated simulation.
- Add statistical reports.
- Add deterministic seeds.
- Add basic compliance checks.

Milestone 4: Canvas emulator

- Draw reels and symbols.
- Add bet, lever, and stop interactions.
- Add counters and machine status.
- Add basic animations.
- Add debug and auto-play controls.

Milestone 5: advanced game states

- Add bonus and AT states.
- Add advantageous-section style management if selected by the specification.
- Add state transition reports.
- Add boundary tests.

Milestone 6: document alignment

- Generate tables from source data.
- Compare implementation values against specification values.
- Produce final simulation reports.
- Complete limitations and compliance notes.

## Phase 6: Final Review and Release

Goal: make the repository usable as both a design package and emulator.

Deliverables:

- Completed documentation index.
- Completed specification set.
- Latest simulation report bundle.
- Browser app build.
- Reproducible test command list.
- Known limitations list.
- Next-step list for physical machine development.

Exit criteria:

- A new developer can run the emulator from the README.
- A reviewer can trace game behavior from document to data file to code.
- Simulation reports can be regenerated.
- Remaining gaps for actual type-test submission are explicit.

## Initial Work Order

1. Create the regulatory reference and compliance matrix.
2. Choose the initial technical stack.
3. Define a minimal three-reel slot specification.
4. Implement the core engine before UI effects.
5. Add batch simulation and reports.
6. Build the Canvas UI.
7. Expand game states and regulatory-oriented checks.
8. Finalize documents from implementation data.

## Open Questions

- Should the emulator be TypeScript-based or plain JavaScript?
- Should the first version target a minimal normal/bonus model, or include AT from the beginning?
- What level of visual fidelity is required for the first Canvas prototype?
- Which exact smart slot assumptions should be modeled for credit and external unit behavior?
- Will future physical-machine documentation be maintained in this repository or split into a separate package?
