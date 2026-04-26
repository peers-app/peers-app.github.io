# Frames App — Alignment

Living document. Source of truth for the current state of the Frames design.
See `archived/frames-app.md` and `use-cases.md` for earlier exploration.

---

## Vision

**Working one-liner:** A compiler / type-checker for thoughts, arguments, and reasoning.

Users express reasoning — in natural language or structured blocks. The system
(powered by AI) parses, validates, and gives feedback: logical gaps, implicit
assumptions, contradictions, fallacies. Like a compiler turns source code into
errors and warnings, Frames turns reasoning into actionable feedback.

---

## Core Concepts (Agreed)

### Blocks
Atomic units of reasoning — statements. A block is content + identity, nothing
more. It has no intrinsic "type." What was previously called a block's type
(observation, assumption, conclusion, etc.) is actually a relationship — an edge
from the block to a role, assigned within the context of a frame. The same block
can function as an observation in one frame and a disputed claim in another.

**Block reuse:** Blocks are designed to be shared across frames. The parse phase
should attempt to match against existing blocks (via semantic similarity) rather
than always creating new ones. When a block appears in multiple frames, the UI
must make this clearly visible — editing the content of a shared block affects
every frame it appears in, and the user must understand that before confirming
the edit.

### Frames
Collections of blocks (plus edges between them) that form a coherent argument or
perspective. A frame can include other frames (no special "meta-frame" concept
needed — any frame that references another frame is just a frame). Frames are the
primary unit users interact with.

### Everything is blocks and edges
Blocks reference other blocks via edges. Frames group blocks and assign
frame-scoped edges (like role classifications and reasoning relationships).
This naturally forms a graph, but users don't need to think in graph terms. The
original design overstated this as two separate graph systems — it's really one
data model with blocks, frames, and edges.

### Three-phase pipeline
The vision uses a "compiler" analogy, but the implementation vocabulary is more
precise:

1. **Parse** — LLM converts natural language into proposed structure (blocks +
   roles + edges). User reviews and confirms.
2. **Validate** — System checks the confirmed graph deterministically.
   Structural constraints operate on the metadata (roles, edge types, graph
   shape), not on the natural language content. This is why the parse step
   matters: the user confirms the structure, and then we can mechanically verify
   its correctness.
3. **Review** — LLM analyzes reasoning quality: warnings, suggestions,
   identified weaknesses. Advisory only.

**Structural constraints (validate phase, deterministic):**
A small set of rules enforced on the confirmed graph. Start minimal, add more
later — it's easy to promote a review-phase warning to a structural constraint
but hard to demote one.

MVP constraints (always on):
- Circularity: no cycles in `depends_on` edges. Cycles are fundamentally broken
  reasoning, never intentional.
- Is/ought separation: a `conclusion` block can't have `depends_on` edges
  leading to both `value` and `observation` blocks without an explicit bridge.

Future: constraints become configurable per frame. Always-on rules can't be
disabled. Other rules default on but can be toggled. Users can also define
custom review rules in natural language ("flag any economic claim not backed by
data") — the LLM evaluates these during the review phase. The LLM IS the rule
engine for custom rules.

**Semantic analysis (review phase, LLM advisory):**
Everything else. "Unsupported claim," "weak assertion," "this inference doesn't
follow," "you're assuming X without stating it." These are warnings the user can
address or ignore.

### AI is fundamental
LLMs handle the semantic analysis: parsing natural language into structure,
identifying relationships between blocks, checking consistency, surfacing gaps
and fallacies. This app is only possible because of modern AI. Since this is a
peers-app, AI Assistants (LLMs and Agents) are built in.

### Collaboration model
Handled entirely by Peers' built-in Groups system. Every user has a Personal
group (full ownership). Users can create shared groups and invite others with
read/write/admin permissions. Writers+ have joint ownership of all data in the
group — including all frames, blocks, and edges.

The system tracks which user makes changes and when, but ownership and
permissions are handled at the group level, not the frame level.

**Comparison is the collaboration.** Two users in the same group can build
separate frames attacking the same idea and compare them to find agreements and
divergences. Each user works on their own frame; the diff view is read-only.
Future UX could explicitly link frames for real-time collaborative refinement,
but each user still edits their own frame.

### Editing model: two views + chat
Text and structure are two separate representations of the same argument. They
are NOT kept in live sync.

**Text view:** Natural language prose — the human-readable form of the argument.
This is the primary input surface. Users write or edit their reasoning as text.

**Structured view:** Blocks, roles, and edges — the machine-readable form. This
is where the "compiled" structure lives. Users can directly manipulate blocks,
reclassify roles, add/remove edges.

**Chat (always available):** Conversational AI assistant alongside either view.
Users can ask questions ("what's weak here?") or request changes ("split that
conclusion into factual and normative parts").

**Sync is explicit, not automatic.** When one view changes, the other becomes
stale. Switching to the stale view shows an "out of sync" indicator. The user
triggers sync explicitly:
- Text changed → "Re-parse" → AI shows proposed structural changes → user
  reviews and accepts
- Structure changed → "Regenerate" → AI produces updated prose → user reviews
  and accepts

**AI edits always produce a reviewable proposal.** Whether triggered from chat
or from a sync step, the AI never silently modifies the user's work. It proposes
changes via a diff view; the user accepts, rejects, or modifies.

**User edits apply directly.** When the user types in the text view or
manipulates blocks in the structured view, changes apply immediately. Only
AI-initiated changes go through the proposal step.

**Undo/redo is per-view.** Each view has its own edit history. Sync steps and
accepted AI proposals are undoable as single units.

---

## Core Capabilities

Consolidated from 15 original use cases into 5 core capabilities.

### 1. Build structured reasoning
Forward from assumptions to conclusions, or backward from a thesis to required
premises. The primary creative act in the app.

*Original use cases: 1 (Structured Reasoning), 4 (Thesis Construction)*

### 2. Check reasoning quality
Validate + Review output. Surface structural violations, fallacies, gaps,
unsupported claims, circular reasoning, implicit assumptions, missing evidence.
This is what makes the app more than a note-taking tool.

*Original use cases: 10 (Assumption Surfacing), 11 (Argument Quality Analysis),
14 (Reasoning Traceability)*

### 3. Explore implications
"What follows from this assumption?" / "What breaks if I change this?" Traverse
downstream consequences, surface second-order effects and conflicts.

*Original use cases: 3 (Implication Exploration), 15 (Evolving Reasoning)*

### 4. Compare perspectives
Diff two frames. Find common ground. See where they diverge and why. Identify
shared vs disputed propositions and differing assumptions.

*Original use cases: 7 (Frame Comparison), 9 (Shared Ground Discovery),
12 (Reframing & Perspective Shifting)*

### 5. Analyze goals and values
Separate is from ought. Surface hidden value assumptions. Compare competing
values. Detect when a conclusion smuggles in an unstated goal.

*Original use cases: 5 (Goal/Value Analysis), 6 (Goal Reframing),
13 (Multi-Goal Evaluation)*

### Deferred
- **Knowledge base** (use case 2) — emerges naturally as blocks accumulate, not
  a feature to design for explicitly.
- **Mediation / conflict resolution** (use case 8) — falls out of compare +
  goals, but the structured negotiation UX is a later concern.

---

### Blocks and frames are separate entity types (confirmed)
Blocks are statements. Frames are arguments. They serve fundamentally different
purposes, have different properties, and are thought of differently by users.
Blocks have text content. Frames have membership lists, text view content,
sync state, constraint configuration. Unifying them into one type with a
discriminator would add complexity to every query and blur the mental model for
no meaningful gain.

### Feedback UX (confirmed direction, details TBD)
Validation errors and review warnings appear in the **structured view only** —
the text view is for writing, not for showing problems. Specific rendering
(inline on blocks vs a persistent panel vs both) will be determined during
implementation. Severity levels: error (structural violations from validate) /
warning (LLM-identified issues from review) / suggestion (LLM ideas).

### Edge vocabulary (confirmed)
A core set the system understands, plus open-ended edges it treats as
informational.

**Role edges (block → role, frame-scoped):**
- `observation` — empirical claim, supportable by evidence
- `assumption` — taken as given, not defended in this argument
- `definition` — what a key term means in this argument
- `value` — normative, what matters, what should be
- `inference` — derived intermediate claim
- `conclusion` — final claim of the argument

**Relationship edges (block → block):**
- `supports` — provides evidence or reasoning for
- `contradicts` — is in tension with
- `depends_on` — requires this to be true

9 total core edges. The LLM can use finer-grained language in advisory output.
Custom edges can exist but the structural validator ignores them.

Design note: `observation` may not be the ideal name — it implies direct sensory
experience, which doesn't cover established facts or historical claims well.
`fact` is more intuitive but feels too strong for weak/uncertain claims. Revisit
naming for UX if user testing surfaces confusion.

Roles not included and why:
- Warrant (the principle connecting evidence to claim) — modeled as an implicit
  `assumption` the LLM surfaces during lint.
- Qualifier (degree of certainty) — better as an annotation/property on a block,
  not a role. LLM can flag overconfident claims.
- Rebuttal/Objection — modeled as any block with a `contradicts` edge.

### MVP scope (confirmed)
Capabilities 1 (build) and 2 (check). The core loop:
articulate → parse → confirm structure → validate → review → refine.
Single user. No frame comparison, no implication exploration, no goals analysis.
Those layer on after the core loop proves satisfying.

---

## What This Is NOT

- **Not a note-taking app** — though it involves writing. The structure and
  feedback loop are the point, not the prose.
- **Not a debate platform** — though it handles multiple perspectives. The goal
  is clarity, not winning.
- **Not a knowledge graph tool** — though a graph exists underneath. Users
  shouldn't have to think in nodes and edges.
- **Not a formal logic system** — it's AI-assisted and pragmatic, not
  mathematically rigorous.

---

## Next Steps

1. Review and refine data model (`data-model.md`).
2. Review and refine user flow (`user-flow.md`).
3. Begin implementation planning — what to build first.
