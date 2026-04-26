# Import Old Peers Data

Migrate tasks and log entries from the old peers system into new peers.

Data source: `peers-data_20260404.json` (93MB, 76,859 records exported from old peers).

## Data Summary

| Type         | Count  |
|--------------|--------|
| Notification | 38,788 |
| LogEntry     | 23,707 |
| Task         | 11,367 |
| Message      | 1,728  |
| Deleted      | 596    |
| Other        | ~600   |
| Group        | 35     |
| User         | 36     |

**Task breakdown:**
- Truly active (no `completeDT`): 2,846
- Completed (has `completeDT`): 8,423
- No status field at all: 98
- Tasks with `parentId` (subtasks): 1,268
- Tasks with `body`: 1,660
- Tasks with `dueDT`: 794
- Tasks with `snoozeDT`: 3,595
- Tasks with `repeats`: 203 (dropped — not supported in new system)

## Status Mapping

Old peers had no explicit "Done" status. Completion was indicated by the presence of `completeDT`.

| Old status    | completeDT? | New status    | Count |
|---------------|-------------|---------------|-------|
| In-Progress   | yes         | Done          | 8,090 |
| In-Progress   | no          | In-Progress   | 43    |
| Queued        | yes         | Done          | 290   |
| Queued        | no          | Queued        | 2,348 |
| Backlog       | yes         | Done          | 43    |
| Backlog       | no          | Backlog       | 455   |
| *(no status)* | yes         | Done          | 98    |
| *(no status)* | no          | Backlog       | 0     |

## User ID Mapping

| User  | Old ID (32-char hex)                     | New ID (25-char alphanumeric)  | Tasks  | Log Entries |
|-------|------------------------------------------|--------------------------------|--------|-------------|
| Mark  | `7194ee666e4c4ab18f1f7466ec525a43`       | `00m87fbwu96jzf8qnwllly0fd`   | 11,035 | 23,304      |
| Blair | `c395c21496a246768ddc0dd5770af19d`       | `00mf91lehygj911akkopt71rq`   | 308    | 372         |
| Other | *(parkerr@ifit.com, test accounts, etc)* | -> Mark's ID (fallback)        | 24     | 31          |

Applies to: `owner` -> `createdByUserId`, `assignedTo`, LogEntry `user` -> `createdByUserId`.

## Task/Entity ID Mapping

Old IDs are 32-char hex. New system requires 25-char alphanumeric from `newid()`.

- Generate a new `taskId` via `newid()` for every imported task.
- Maintain an `oldId -> newId` map to remap `parentId` references.
- Same map used for LogEntry `subject` -> `taskId` linking.

## Field Mapping: Tasks

| Old field                        | New field          | Notes                                              |
|----------------------------------|--------------------|----------------------------------------------------|
| `id`                             | `taskId`           | New ID via `newid()`                                |
| `title`                          | `title`            | Direct copy                                         |
| `body`                           | `body`             | Direct copy                                         |
| `status` + `completeDT`         | `status`           | Mapped per status mapping table above               |
| `sortOrder`                      | `sortOrder`        | Direct copy (epoch ms)                              |
| `dueDT`                          | `dueDT`            | Parse as Date; null/undefined -> omit               |
| `snoozeDT`                       | `snoozeDT`         | Parse as Date; null/undefined -> omit               |
| `completeDT`                     | `completeDT`       | Parse as Date; null/undefined -> omit               |
| `group`                          | `groupId`          | Routed per group routing table below                |
| `parentId`                       | `parentTaskId`     | Remapped via ID map; root tasks get group parent    |
| `_meta.createdAt` or `saveDT`   | `createdAt`        | Parse as Date                                       |
| `modified` (epoch ms)            | `updatedAt`        | `new Date(modified)`                                |
| `owner`                          | `createdByUserId`  | Remapped via user ID map                            |
| `assignedTo`                     | `assignedTo`       | Remapped via user ID map (20 tasks)                 |

**Dropped fields:** `signature`, `signer`, `comments`, `subject`, `category`, `project`, `repeats`, numeric-key artifacts (249 records with a string-spread bug from old `repeats` field).

## Field Mapping: LogEntries

| Old field      | New field          | Notes                                         |
|----------------|--------------------|-----------------------------------------------|
| `id`           | `logEntryId`       | New ID via `newid()`                           |
| `subject`      | `taskId`           | Remapped via task ID map; skip if not found    |
| `entryDT`      | `startDT`          | Parse as Date                                  |
| `hoursLogged`  | `durationMinutes`  | Multiply by 60; null -> 0                      |
| `comments`     | `note`             | Direct copy                                    |
| `group`        | `groupId`          | Routed same as owning task                     |
| `user`         | `createdByUserId`  | Remapped via user ID map                       |

## Group Routing

Each old group's tasks are routed to a data context and nested under a top-level parent task.

| Old Group                 | Old Group ID                             | Tasks (active/done) | Route to                                          |
|---------------------------|------------------------------------------|---------------------|---------------------------------------------------|
| **Home**                  | `b970a408268e44f0a65a7519c2e7cbc7`       | 245 / 2,101         | New Home group (`00mhf0n1d5hz3baav76onpvsw`)      |
| **Peers**                 | `321003cab6014691a7daf6f31974c5f6`       | 499 / 435           | Personal (+ reparent existing tasks)              |
| Personal (user ID)        | `7194ee666e4c4ab18f1f7466ec525a43`       | 400 / 1,756         | Personal as "Personal (Old Peers)"                |
| iFit                      | `5a71b287face4a4dba9d32d30ad33083`       | 308 / 2,433         | Personal                                          |
| Que                       | `f011728640764e1baf8b87dbda2ab3a0`       | 433 / 530           | Personal                                          |
| AI                        | `f426e615ae05458a9bd65de8dcea7eaf`       | 151 / 143           | Personal                                          |
| Host                      | `69157ee0a8df46b296fa4f33d2816ed0`       | 119 / 106           | Personal                                          |
| Cubes                     | `9a02fd686abf4c3ebeb95106a7eea7ce`       | 107 / 74            | Personal                                          |
| CM                        | `6f04e36f65c445b2b497fe9479114301`       | 57 / 271            | Personal                                          |
| TV                        | `e340131663114938aa3462fa00313128`       | 142 / 42            | Personal                                          |
| IHA                       | `fb467e74b5f94605819d978658d81634`       | 14 / 137            | Personal                                          |
| JobTrak                   | `00l04c31qznhzefu14bu9w6vq`             | 24 / 79             | Personal                                          |
| Axon                      | `00mhm3ch6bp9njy1e68ziugtr`             | 14 / 64             | Personal                                          |
| Warframe                  | `79d12251b33d4bb0a53cc71c6e999859`       | 32 / 38             | Personal                                          |
| Baby                      | `e2894ed7c508445094e34c1a1a0a4cd2`       | 17 / 183            | Personal                                          |
| UBO                       | `dcebbcbacc674c28a921790af4838b5a`       | 27 / 35             | Personal                                          |
| Packing                   | `b0a76a23516e436887a6c8c6776e6a20`       | 42 / 16             | Personal                                          |
| Ideas                     | `3bdee33b62f54336b7413327cd88f440`       | 44 / 3              | Personal                                          |
| Amnis                     | `fbb45ec2682840f5bfdfadebecccac1f`       | 22 / 24             | Personal                                          |
| Meals                     | `2264d39f868f4c13be47a00bdda602da`       | 29 / 6              | Personal                                          |
| Gifts                     | `bf45eb8e486348c184d136f20e86ce51`       | 26 / 6              | Personal                                          |
| Silly Bananas             | `72500a76054b418db3bc6ebf337b4bfd`       | 4 / 24              | Personal                                          |
| jRig                      | `4ca5642fe0d74e1995ebbcd0f68b040a`       | 21 / 8              | Personal                                          |
| VRSuit                    | `81080ff9c9544f37b546cc0ffb34e3a1`       | 20 / 7              | Personal                                          |
| Games                     | `8148eabec0324cd09acc7d4f6d329d16`       | 14 / 10             | Personal                                          |
| Linx                      | `96cdb1d28bf14ad99feea2f482d440dc`       | 15 / 0              | Personal                                          |
| Wishlist                  | `cd95604a232644c69fb5d0749409632c`       | 2 / 13              | Personal                                          |
| Gym Buddy                 | `9c9ba93245d849c593947212b6c2fc11`       | 7 / 0               | Personal                                          |
| Insights                  | `5217012311ba403c8b42e35b4cc61933`       | 7 / 0               | Personal                                          |
| Bucket-List               | `cd1b70366668428381ca797b8ad891a4`       | 4 / 0               | Personal                                          |
| Prepper                   | `dcae6c4d1cbb491bb2386badccc05b75`       | 2 / 0               | Personal                                          |
| Songs                     | `820833f3228345c6b2a9b6d189588444`       | 2 / 0               | Personal                                          |
| Blair+Mark                | `e4c96c1f2ee9447aad8316f32b4c9057`       | 0 / 1               | Personal                                          |

For each group, a top-level task with the group name is created. Root-level old tasks become children of that group task. Tasks with existing `parentId` keep their parent relationship (remapped to new IDs). Group tasks get status In-Progress if they have active children, Done otherwise.

## Edge Cases

- **249 tasks with numeric-key artifacts**: Strip any numeric-string keys before import (a string-spread bug from the old `repeats` field).
- **Log entries with no matching task**: Skip with warning (the `subject` task may have been deleted).
- **Null dates**: `snoozeDT: null` and `dueDT: null` -> omit (don't set on the new task).
- **Idempotency**: Check if a group-level parent task with the same title already exists before creating duplicates (allows re-running safely).

## Architecture

Two packages involved. No changes needed in peers-sdk or peers-electron.

1. **peers-core**: New `import-old-tasks` tool with the import logic. Runs server-side (Node.js) for direct DB access and fast bulk writes. Reads the JSON file from disk via `fs`.
2. **peers-ui**: New "Import Old Peers Data" section in the Advanced settings tab. File picker, Dry Run button, Import button, results display. Calls tool via `rpcServerCalls.runTool()`.

**Webpack note:** `peers-core/webpack.package.config.js` must list `'fs': 'commonjs fs'` in `externals` so the tool can use Node.js `fs` at runtime. The default `resolve.fallback: { fs: false }` replaces `require('fs')` with an empty module.

### Tool input schema gotchas

- The `ITool.inputSchema.fields` array and the Zod `inputSchema` must stay in sync. The tool runner builds a *separate* Zod schema from `ITool.inputSchema.fields` (via `fieldsToSchema()`) for input validation — not the tool instance's Zod schema. Fields not listed in the `ITool` fields will be silently dropped, and `optional` must match in both places.
- Array-typed inputs (`z.array(z.string())`) do not work with the tool runner — use a single `z.string()` and parse manually if needed.
- After rebuilding peers-core, `syncPeersCoreBundle()` updates the DB on the next app restart but does NOT re-register tools in memory. A **second** `peers app restart` is required to actually load the new tool code. (Build → Restart #1 → sync writes new bundle to DB → Restart #2 → loads new bundle from DB.)

### Current tool input parameters

| Parameter          | Type    | Required | Description                                                         |
|--------------------|---------|----------|---------------------------------------------------------------------|
| `filePath`         | string  | No*      | Absolute path to the JSON export file                               |
| `dryRun`           | boolean | No*      | If true, analyze only; if false, perform import                     |
| `importGroups`     | string  | No       | Old group ID, or `"all-personal"` for all non-Home groups in one pass |
| `reparentExisting` | boolean | No       | Reparent existing root tasks under the group parent task            |
| `cleanupIds`       | string  | No       | Comma-separated task IDs to delete (cleanup mode)                   |
| `cleanupContext`   | string  | No       | Data context ID for cleanup (defaults to personal)                  |
| `moveParentId`     | string  | No       | Parent task ID whose children to move to another group              |
| `moveTargetGroup`  | string  | No       | Destination group ID for move operation                             |
| `convertBodies`    | boolean | No       | Convert HTML task bodies to markdown                                |
| `convertContext`   | string  | No       | Data context ID for body conversion (defaults to personal)          |
| `testTaskId`       | string  | No       | Convert a single task body into a new [TEST] sibling task           |
| `rebuildIdMap`     | boolean | No       | Rebuild old→new task ID map and save as pvar in Home group          |
| `importLogEntries` | boolean | No       | Import log entries using the saved ID map pvar                      |

*Required when not using `cleanupIds`, `rebuildIdMap`, or `importLogEntries`.

### Import invocation pattern

```bash
# Dry run (analysis only)
peers tools run import-old-tasks '{"filePath": "/path/to/peers-data.json", "dryRun": true}' --json

# Import a single group
peers tools run import-old-tasks '{"filePath": "/path/to/peers-data.json", "dryRun": false, "importGroups": "<old-group-id>"}'

# Import ALL non-Home groups into personal context in one pass
peers tools run import-old-tasks '{"filePath": "/path/to/peers-data.json", "dryRun": false, "importGroups": "all-personal"}'

# Import with reparenting existing root tasks
peers tools run import-old-tasks '{"filePath": "/path/to/peers-data.json", "dryRun": false, "importGroups": "<old-group-id>", "reparentExisting": true}'

# Rebuild old→new task ID map (saved as pvar in Home group)
peers tools run import-old-tasks '{"rebuildIdMap": true, "filePath": "/path/to/peers-data.json"}'

# Import log entries (requires ID map pvar from rebuildIdMap)
peers tools run import-old-tasks '{"importLogEntries": true, "filePath": "/path/to/peers-data.json"}'

# Cleanup: delete junk tasks and unparent their children
peers tools run import-old-tasks '{"cleanupIds": "id1,id2,id3"}'
```

## CLI Reference

The `peers` CLI is the primary way to inspect and manipulate data during development. The database is encrypted and cannot be accessed directly via `sqlite3`.

### Querying the database

```bash
peers db tables                              # List all tables in current context
peers db tables -c personal                  # List tables in personal context
peers db tables -c 00mhf0n1d5hz3baav76onpvsw # List tables in Home group context
peers db <table> -n 100                      # Show first 100 rows from a table
peers db query "SELECT ..." -c personal      # Custom SQL query (read-only)
peers db query "SELECT ..." --json           # JSON output (one object per line)
```

Note: Table names include their table ID suffix, e.g. `Tasks_00mh0wlipkdbeaw8tasks0001`.

### Listing groups

```bash
peers db query "SELECT groupId, name FROM Groups" --json
# Returns: {"groupId":"00mhf0n1d5hz3baav76onpvsw","name":"Home"}, etc.
```

### Listing tools

```bash
peers tools list                             # All registered tools
peers tools list | grep import               # Find specific tools
```

### Running tools

```bash
peers tools run <name> '<json>'              # Run a tool with JSON input
peers tools run import-old-tasks '{"filePath": "/path/to/file.json", "dryRun": true}' --json
```

### Build and reload workflow

After making code changes, the full rebuild cycle is:

```bash
cd peers-core && npm run build               # Rebuild package bundle
cd peers-ui && npm run build                 # Rebuild UI (TypeScript only)
cd peers-electron && npm run build           # Rebuild Electron client bundle
peers app restart                            # Restart to pick up new tools
peers ui reload                              # Reload UI without full restart
```

**Important:** `peers app restart` is required for new tools to appear in `peers tools list`. Just `peers ui reload` is NOT sufficient — the tool registry is loaded on app startup from the package bundle.

---

## Phases

### Phase 1: Tool + UI scaffold ✅

**Goal:** Build the import tool with dry-run support and the settings UI to invoke it.

**Deliverables:**
- `peers-core/src/tasks/tools/import-old-tasks.tool.ts` — tool with `{ filePath, dryRun, reparentExisting }` input; reads JSON, analyzes data, returns summary on dry run.
- Register tool in `peers-core/src/tasks/tools/index.ts` and add ID to `consts.ts`.
- `<ImportOldPeersData />` component in `peers-ui/src/screens/settings/settings-page.tsx` — file picker, dry run button, results display.

**Acceptance criteria:**
- Select the export file in the UI and click Dry Run.
- See a formatted summary: per-group task counts (active/done), status mapping stats, user ID mapping stats, warnings.
- No data is written.

**Result:** Completed. Tool ID: `00mh0wlipkdbeaw8imptsk001`. Dry run verified via CLI and UI.

### Phase 2: Peers group import ✅

**Goal:** Import old "Peers" group tasks and reparent existing personal tasks as a first real test.

**Deliverables:**
- Import mode in the tool creates a top-level "Peers" task in personal context.
- Reparents existing 149 root-level personal tasks under it.
- Imports 934 old Peers group tasks (776 root -> children of "Peers" task, 158 subtasks keep remapped parents).

**Acceptance criteria:**
- `peers db query "SELECT count(*) FROM Tasks_00mh0wlipkdbeaw8tasks0001 WHERE parentTaskId = '<peers-task-id>'" -c personal` shows ~925 direct children (149 existing + 776 imported root).
- Total personal task count is ~1,097 (163 existing + 934 imported).
- Subtask parent relationships are correct (spot-check a few).

**Result:** Completed.
- "Peers" parent task ID: `00mnkoyo7mizav6tseubjzr3a`
- Direct children of "Peers" task: **925** (149 reparented + 776 imported root)
- Total personal tasks: **1,098** (163 existing + 1 parent + 934 imported)
- Root tasks: **1** (only "Peers" parent — all others nested under it)
- Subtask hierarchy verified via spot-check

### Phase 3: Home group import ✅

**Goal:** Import old "Home" group tasks into the new Home group context.

**Pre-state:** Home group context (`00mhf0n1d5hz3baav76onpvsw`) had 2 existing tasks.

**Deliverables:**
- Tool routes old Home group (`b970a408268e44f0a65a7519c2e7cbc7`) tasks to new Home group (`00mhf0n1d5hz3baav76onpvsw`).
- Creates a "Home (Old Peers)" top-level parent task in the Home group context.
- Imports 2,346 tasks with correct status mapping and user IDs.

**Command:**
```bash
peers tools run import-old-tasks '{"filePath": "/Users/mark.archer/peers-app/peers-data_20260404.json", "dryRun": false, "importGroups": "b970a408268e44f0a65a7519c2e7cbc7"}' --json
```

**Note:** Must run from Personal context in the UI to avoid datalock contention with Home group's active sync. The tool internally writes to the correct Home group context regardless.

**Result:** Completed.
- "Home (Old Peers)" parent task created in Home group context
- Imported: 1,945 root + 401 subtasks = 2,346 tasks total
- Total Home group tasks after import: 2,348 (2 existing + 1 parent + 2,346 imported - 1 parent = 2,348)
- Blair's tasks correctly mapped to `createdByUserId = 00mf91lehygj911akkopt71rq`

### Phase 4: Remaining groups ✅

**Goal:** Import all other 30 old groups into personal context.

**Pre-state:** Personal context had 1,098 tasks after Phase 2.

**Deliverables:**
- Each old group gets a top-level parent task in personal context.
- All tasks imported with correct hierarchy, status, and user mapping.
- Used `"importGroups": "all-personal"` to import all non-Home groups in a single pass (one JSON parse, avoiding OOM from repeated 93MB reads).

**Command:**
```bash
peers tools run import-old-tasks '{"filePath": "/Users/mark.archer/peers-app/peers-data_20260404.json", "dryRun": false, "importGroups": "all-personal"}'
```

**Result:** Completed.
- 29 new groups imported (Peers and Personal skipped via idempotency — already imported)
- Key group import counts:
  - Que: 963, iFit: 2,741, CM: 328, AI: 294, Host: 225, Baby: 200, TV: 184, Cubes: 181, IHA: 151, JobTrak: 103, Axon: 78, Warframe: 70, UBO: 62, Packing: 58, Ideas: 47, Amnis: 46, Meals: 35, Gifts: 32, jRig: 29, VRSuit: 27, Games: 24, Wishlist: 15, Linx: 15, Gym Buddy: 7, Insights: 7, Bucket-List: 4, Songs: 2, Prepper: 2, Blair+Mark: 1
- Total personal tasks after Phase 4: **9,215**
- Total Home group tasks: **2,348**
- Grand total imported tasks: **~11,563** (includes ~31 parent group tasks + existing pre-import tasks)

**Lessons learned:**
- Running the tool once per group in a shell loop caused JavaScript heap OOM at 3.7GB — the 93MB JSON was parsed on every invocation, and garbage collection couldn't keep up. Fixed by adding the `all-personal` flag to process all groups in one pass.
- `ITool.inputSchema.fields` must have `optional: true` synced with Zod `.optional()` — the tool runner builds a separate Zod schema from the fields definition for input validation (via `fieldsToSchema()`).
- `syncPeersCoreBundle()` updates the DB but does NOT re-register tools in memory. A second app restart is required after rebuilding peers-core to pick up new tool code.

**Old group IDs imported (31 groups total, 2 skipped):**
```
7194ee666e4c4ab18f1f7466ec525a43  (Personal / Old Peers)
5a71b287face4a4dba9d32d30ad33083  (iFit)
f011728640764e1baf8b87dbda2ab3a0  (Que)
f426e615ae05458a9bd65de8dcea7eaf  (AI)
69157ee0a8df46b296fa4f33d2816ed0  (Host)
9a02fd686abf4c3ebeb95106a7eea7ce  (Cubes)
6f04e36f65c445b2b497fe9479114301  (CM)
e340131663114938aa3462fa00313128  (TV)
fb467e74b5f94605819d978658d81634  (IHA)
00l04c31qznhzefu14bu9w6vq          (JobTrak)
00mhm3ch6bp9njy1e68ziugtr          (Axon)
79d12251b33d4bb0a53cc71c6e999859  (Warframe)
e2894ed7c508445094e34c1a1a0a4cd2  (Baby)
dcebbcbacc674c28a921790af4838b5a  (UBO)
b0a76a23516e436887a6c8c6776e6a20  (Packing)
3bdee33b62f54336b7413327cd88f440  (Ideas)
fbb45ec2682840f5bfdfadebecccac1f  (Amnis)
2264d39f868f4c13be47a00bdda602da  (Meals)
bf45eb8e486348c184d136f20e86ce51  (Gifts)
72500a76054b418db3bc6ebf337b4bfd  (Silly Bananas)
4ca5642fe0d74e1995ebbcd0f68b040a  (jRig)
81080ff9c9544f37b546cc0ffb34e3a1  (VRSuit)
8148eabec0324cd09acc7d4f6d329d16  (Games)
96cdb1d28bf14ad99feea2f482d440dc  (Linx)
cd95604a232644c69fb5d0749409632c  (Wishlist)
9c9ba93245d849c593947212b6c2fc11  (Gym Buddy)
5217012311ba403c8b42e35b4cc61933  (Insights)
cd1b70366668428381ca797b8ad891a4  (Bucket-List)
dcae6c4d1cbb491bb2386badccc05b75  (Prepper)
820833f3228345c6b2a9b6d189588444  (Songs)
e4c96c1f2ee9447aad8316f32b4c9057  (Blair+Mark)
```

### Phase 5: Log entries ✅

**Goal:** Import 23,707 log entries linked to the imported tasks.

**Pre-requisite:** Rebuilt old→new task ID map and saved as `importOldPeersTaskIdMap` pvar in Home group context (11,287 matched, 80 unmatched from Axon group).

**Deliverables:**
- Tool imports LogEntry records with remapped `taskId`, converted `durationMinutes`, and correct `groupId` routing.
- Orphaned log entries (no matching task) are skipped with a count.

**Command:**
```bash
peers tools run import-old-tasks '{"importLogEntries": true, "filePath": "/Users/mark.archer/peers-app/peers-data_20260404.json"}' --json
```

**Result:** Completed.
- Imported: **23,144** log entries (97.6% of 23,707)
- Skipped (orphaned): **563** (referenced deleted tasks or the 80 unmatched Axon tasks)
- Skipped (no date): **0**
- Personal context: **18,143** (total in DB: 18,189 including ~46 pre-existing)
- Home context: **5,001** (total in DB: 5,002 including 1 pre-existing)
- Field mapping: `entryDT` → `startDT`, `hoursLogged * 60` → `durationMinutes`, `comments` → `note`, `user` → `createdByUserId` (remapped)

**Acceptance criteria verified:**
- `peers db query "SELECT count(*) FROM LogEntries_..." -c personal` → 18,189
- `peers db query "SELECT count(*) FROM LogEntries_..." -c 00mhf0n1d5hz3baav76onpvsw` → 5,002
- Spot-checked entries with `durationMinutes > 0`: correct taskId references, dates, and user IDs

---

## Blair's Import (Future)

Blair's import is separate from Mark's and will be done later. Her case is much simpler — she mostly uses Personal + Home.

### Summary

1. **Home group**: Skip entirely. Mark already imported Home group tasks into the shared context (`00mhf0n1d5hz3baav76onpvsw`), and they sync to Blair automatically.
2. **Personal group**: Import Blair's tasks from her old Personal group, filtered to only her tasks (`owner === Blair's old ID`).
3. **Other groups**: Blair likely has very few other groups. Check with a dry run first.

### Step-by-step runbook

#### 1. Code changes needed (one-time)

In [peers-core/src/tasks/tools/import-old-tasks.tool.ts](peers-core/src/tasks/tools/import-old-tasks.tool.ts):

- **Add `ownerFilter` parameter** (string, optional) to Zod schema + `ITool.inputSchema.fields`. When set, `performImport()` filters old tasks to only those where `owner === ownerFilter` before importing.
- **Fix `createdByUserId` on group parent tasks**: Replace hardcoded `MARK_NEW_ID` in `performImport()` with dynamic user ID (e.g. `userContext.userId` or `myUserId()` from peers-sdk).

Build peers-core, then two-restart deploy cycle (build -> restart #1 syncs to DB -> restart #2 loads new code).

#### 2. Dry run

```bash
peers tools run import-old-tasks '{"filePath": "/path/to/peers-data_20260404.json", "dryRun": true}'
```

Review the output to identify which groups Blair has tasks in. Expect mostly Personal + possibly a few small groups.

#### 3. Import personal tasks

```bash
peers tools run import-old-tasks '{
  "filePath": "/path/to/peers-data_20260404.json",
  "dryRun": false,
  "importGroups": "7194ee666e4c4ab18f1f7466ec525a43",
  "ownerFilter": "c395c21496a246768ddc0dd5770af19d"
}'
```

This imports only Blair's tasks from the old Personal group into her new personal context, creating a "Personal (Old Peers)" parent task.

#### 4. Flatten the parent task

```bash
peers tools run import-old-tasks '{"cleanupIds": "<parentTaskId from step 3>"}'
```

This unparents the imported tasks and deletes the "Personal (Old Peers)" wrapper, making them top-level.

#### 5. Import other groups (if any)

Repeat steps 3-4 for any additional groups identified in the dry run. Use `"all-personal"` with `ownerFilter` to batch them, or import individually.

### What NOT to do

- Do NOT import the Home group (`b970a408268e44f0a65a7519c2e7cbc7`) — already done by Mark and synced.
- Do NOT run without `ownerFilter` — without it, Mark's tasks from shared groups would also land in Blair's personal context.

### Blair's user IDs

| | Old ID | New ID |
|---|---|---|
| Blair | `c395c21496a246768ddc0dd5770af19d` | `00mf91lehygj911akkopt71rq` |

### ID map pvar (implemented)

The old→new task ID map is stored as a `group`-scoped pvar named `importOldPeersTaskIdMap` in the Home group context (`00mhf0n1d5hz3baav76onpvsw`). It syncs to Blair's device automatically.

- **API**: `PersistentVars(dataContext).getPersistentVarValue<Record<string, string>>('importOldPeersTaskIdMap')`
- **Value**: `Record<string, string>` — 11,287 entries mapping old 32-char hex task IDs to new 25-char alphanumeric task IDs.
- **Rebuild**: `peers tools run import-old-tasks '{"rebuildIdMap": true, "filePath": "..."}'`
- **Used by**: `importLogEntries` mode to remap LogEntry `subject` → `taskId`.
