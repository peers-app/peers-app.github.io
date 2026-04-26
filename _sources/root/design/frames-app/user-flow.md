# Frames App — User Flow (MVP)

What a session looks like end to end for capabilities 1 (build) and 2
(check). See `README.md` for design decisions.

---

## Entry Points

There are three ways to start building an argument:

### A. Start from text
1. User creates a new frame (gives it a title).
2. User writes their argument in the text view — prose, bullet points,
   stream of consciousness. No structure imposed.
3. User triggers **Parse** (explicit action, e.g., a button).
4. AI proposes a structured interpretation: blocks with roles and edges.
   This appears as a reviewable proposal (diff view).
5. User accepts, modifies, or rejects the proposal.
6. On accept → structured view is populated. Text view remains as-is.

### B. Start from chat
1. User creates a new frame.
2. User describes their argument to the AI assistant: "I want to argue
   that we should invest in renewable energy because coal is uneconomical
   and the transition creates jobs."
3. AI proposes a structured frame (same proposal/diff view as above).
4. User accepts → structured view is populated. AI can also generate
   initial text view content if the user wants it.

### C. Start from structure
1. User creates a new frame.
2. User works directly in the structured view — creating new blocks,
   pulling in existing blocks from other frames, assigning roles, and
   drawing edges.
3. No text view content exists yet (null in the snapshot). The user can
   generate it later via Regenerate, or never — the text view is
   optional.

All three entry points converge on the same state: a frame with blocks,
roles, and edges in the structured view.

---

## The Core Loop

Once the structured view is populated:

```
  ┌──────────────┐
  │   Validate    │──── Structural errors shown on affected blocks
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │    Review     │──── LLM warnings + suggestions shown on blocks
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │    Refine     │──── User addresses issues (edit, reclassify,
  └──────┬───────┘      add blocks, remove blocks, adjust edges)
         │
         └──── loops back to Validate
```

**Validate** runs automatically after every structural change. It's
deterministic and fast — just graph checks. Results: structural errors
(circularity, is/ought violations).

**Review** runs automatically after validate completes (or on-demand if
expensive). It's LLM-powered. Results: warnings (unsupported claims, weak
inferences, implicit assumptions) and suggestions (missing definitions,
alternative framings).

**Refine** is the user's response. They can:
- Edit a block's text content
- Change a block's role
- Add a new block (directly or via chat)
- Pull in an existing block from another frame
- Remove a block
- Add or remove edges between blocks
- Split a block into two (e.g., separating is from ought)
- Merge blocks

**Shared block warning:** If a block appears in multiple frames, editing
its content affects all of them. The UI must make multi-frame membership
clearly visible and confirm the user's intent before applying content
edits to shared blocks. (Changing a block's role or edges is frame-scoped
and doesn't affect other frames.)

Each refinement triggers re-validation and re-review.

---

## Switching Between Views

At any point, the user can switch between text view and structured view.

**Structured → Text (structure has changed):**
Text view shows an "out of sync" indicator. User can:
- Continue editing stale text (ignore the indicator)
- Trigger "Regenerate" → AI proposes updated text reflecting structural
  changes → user reviews the diff and accepts/rejects

**Text → Structured (text has changed):**
Structured view shows an "out of sync" indicator. User can:
- Continue working in stale structure
- Trigger "Re-parse" → AI proposes structural changes reflecting the
  text edits → user reviews the diff and accepts/rejects

The key principle: switching views never auto-modifies anything. The user
always explicitly triggers sync and reviews the proposed changes.

---

## Chat Interactions (Available Throughout)

The AI assistant is available alongside either view. Examples:

**Questions (read-only):**
- "What's the weakest part of my argument?"
- "Am I missing any assumptions?"
- "Does this conclusion follow from my premises?"

**Structural edits (produce proposals):**
- "Add an assumption that scientific consensus is reliable"
- "Split the conclusion into the factual and normative parts"
- "What evidence would I need to support this inference?"

All AI-initiated edits appear as reviewable proposals. The user accepts,
modifies, or rejects.

---

## Example Session

1. User creates frame: "The case for renewable energy investment"
2. Writes in text view:
   > Coal plants are becoming uneconomical as maintenance costs rise and
   > cheaper alternatives emerge. The renewable energy sector is creating
   > more jobs per dollar invested than fossil fuels. Climate change
   > requires urgent action. Therefore, governments should redirect energy
   > subsidies from fossil fuels to renewables.
3. Triggers Parse → AI proposes:
   - Block: "Coal plants are becoming uneconomical..." (observation)
   - Block: "Renewable energy creates more jobs..." (observation)
   - Block: "Climate change requires urgent action" (value)
   - Block: "Governments should redirect subsidies..." (conclusion)
   - Edges: first three blocks → supports → conclusion
   - Edge: conclusion depends_on all three
4. User accepts. Structured view populates.
5. Validate runs: **is/ought warning** — the conclusion ("should") depends
   directly on observations ("is") and a value without explicit bridging.
6. Review runs: **warnings** — "Coal becoming uneconomical" is unsupported
   (no evidence cited). "Climate change requires urgent action" mixes
   factual claim with normative judgment — consider splitting.
7. User refines:
   - Splits "Climate change requires urgent action" into:
     - "Climate change is accelerating" (observation)
     - "We have a moral obligation to act on climate" (value)
   - Adds "IEA 2025 report on coal plant economics" as a new observation
     that supports the coal claim
   - Adds an inference: "Given rising costs and better alternatives,
     continued fossil fuel investment is economically irrational"
   - Re-links edges so the conclusion flows through the inference
8. Validate re-runs: passes.
9. Review re-runs: remaining suggestion — "Consider defining what counts
   as 'renewable energy' — does it include nuclear?"
10. User adds a definition block: "By 'renewable energy' I mean solar,
    wind, hydro, and geothermal — excluding nuclear."
11. Argument is now well-structured with no errors and one minor
    suggestion remaining.
