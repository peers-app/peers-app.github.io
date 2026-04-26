# Frames App — Data Model (MVP)

Minimal data model for capabilities 1 (build) and 2 (check).
See `README.md` for the design decisions behind this.

---

## Entities

### Block

A statement. The atomic unit of reasoning.

| Field   | Type      | Notes                                       |
|---------|-----------|---------------------------------------------|
| id      | string    | Peer ID (25 char alphanumeric)              |
| content | string    | The current statement text                  |
| setAt   | timestamp | When the current content was set            |
| setBy   | string    | User ID who set the current content         |
| history | hashmap   | Previous content versions, keyed by Peer ID |

Blocks have no intrinsic type or role. They're just text + identity.
A block can appear in multiple frames with different roles.

`history` is a hashmap (not an array — Peers tracks diffs on objects but
not arrays, and arrays risk key collisions between offline users):
```
{
  [peerID]: { content: string, setAt: timestamp, setBy: string },
  [peerID]: { content: string, setAt: timestamp, setBy: string },
  ...
}
```

When content changes, the old value is stored in history (keyed by a new
Peer ID via `newid()`) before updating. `setAt` is the key field for
staleness detection: if `block.setAt` is newer than a frame's last
validate/review, that frame needs rechecking.

### Frame

An argument or perspective. The primary workspace.

| Field      | Type      | Notes                                       |
|------------|-----------|---------------------------------------------|
| id         | string    | Peer ID                                     |
| title      | string    | What this argument is about                 |
| setAt      | timestamp | When this frame was last modified           |
| setBy      | string    | User ID who last modified it                |
| snapshots  | hashmap   | Versioned text+structure pairs (see below)  |

The text view and structured view are stored together as versioned pairs
called **snapshots**. Either side can be null (text-first has structure
null, structure-first has text null, synced has both populated).

`snapshots` is a hashmap keyed by Peer ID:
```
{
  [peerID]: {
    textContent: string | null,
    structuredContent: {
      members: [{ blockId: string, role: string | null }],
      edges: [{ sourceBlockId: string, targetBlockId: string, kind: string }]
    } | null,
    setAt: timestamp,
    setBy: string
  },
  ...
}
```

Snapshots are created when:
- A sync occurs (parse or regenerate) — both sides populated
- The user accepts an AI edit — the edited side is populated, the other
  side is null (now stale)
- The user manually triggers a snapshot

When syncing fills in a null side, the existing snapshot is **updated in
place** rather than creating a new one (more efficient, and Peers' diff
tracking captures the change). Exception: if the non-null side has been
edited in the working state since the snapshot was created, a new
snapshot is created instead (since both sides have changed).

The latest snapshot (by `setAt`) is the current frame state. The working
state (live textContent being typed, live FrameMembers/Edges being
manipulated) may diverge from the latest snapshot between sync points.

Structured content in snapshots is a **full serialized snapshot**
(denormalized). This makes snapshots self-contained — any two can be
diffed, any one can be restored, no need to reconstruct state from
timestamps.

### FrameMember

A block's membership in a frame, including its role in that frame.

| Field   | Type        | Notes                                        |
|---------|-------------|----------------------------------------------|
| id      | string      | Peer ID                                      |
| frameId | string      | Which frame                                  |
| blockId | string      | Which block                                  |
| role    | string/null | One of the 6 core roles, or null (unassigned) |

Core roles: `observation`, `assumption`, `definition`, `value`,
`inference`, `conclusion`.

A block can appear in multiple frames with different roles. Within a
single frame, a block has exactly one role (or null if not yet classified).

### Edge

A directed relationship between two blocks within a frame.

| Field         | Type   | Notes                                    |
|---------------|--------|------------------------------------------|
| id            | string | Peer ID                                  |
| frameId       | string | Which frame this edge belongs to         |
| sourceBlockId | string | The block this edge comes from           |
| targetBlockId | string | The block this edge points to            |
| kind          | string | One of the core kinds, or custom         |

Core kinds: `supports`, `contradicts`, `depends_on`.

Edges are always frame-scoped. The same two blocks can have different
relationships in different frames (or no relationship at all).

---

## Cross-Frame Relationships (Computed, Not Stored)

There is no explicit "frame includes frame" entity. Relationships between
frames are computed from shared blocks. If Frame B's conclusion is used
as an observation in Frame A, that's a detectable cross-frame link.

This is better than an explicit FrameInclude table because:
- The relationship is emergent from actual argumentative structure
- Block reuse across frames is the mechanism for connecting arguments
- No separate entity to maintain or keep in sync

For MVP, cross-frame relationships don't need to be surfaced. Block
reuse is supported from the start; the system can detect and display
cross-frame connections when capability 4 (compare perspectives) is
built.

---

## Structural Constraints (Validate Phase)

These are enforced on the graph formed by FrameMembers and Edges within a
single frame:

**Circularity (always on):**
No cycles in `depends_on` edges. Given the set of edges with
kind=`depends_on` in a frame, the directed graph they form must be a DAG.

**Is/ought separation (always on):**
A block with role `conclusion` cannot have a path of `depends_on` edges
leading to both `value`-roled blocks and `observation`-roled blocks
without passing through an explicitly marked bridge. (The exact bridge
mechanism TBD — for MVP, flag the violation rather than requiring a
specific bridge structure.)

---

## What's NOT in this model

- **Working state** — The live text being typed and live FrameMembers/Edges
  being manipulated between snapshots. This is the "unsaved" state held
  in the UI. It becomes a snapshot when the user syncs, accepts an AI
  edit, or manually snapshots.
- **Validation/review results** — Errors, warnings, and suggestions are
  computed on the fly, not stored. They're a function of the current
  graph state.
- **Custom edges** — Supported in the future via the same Edge entity
  with non-core `kind` values. The structural validator ignores them.
- **User-defined constraints** — Future feature. Would likely be stored
  as frame-level configuration.
