# Design: Move cli-assistant-runner into peers-core

## Background

The `cli-assistant-runner` tool was built in the [Yoke](~/peers-packages/yoke) package as part of its multi-agent orchestration feature. It is a generic subprocess runner that can spawn any CLI coding agent (`claude`, `cursor-agent`, `opencode`) as a child process, feed it a prompt built from thread history, and return the output as an assistant response.

It's proven and well-structured. The key insight is that it's **platform infrastructure**, not a Yoke-specific feature — it's the answer to "how does Peers talk to external CLI agents?" That question belongs in the platform, not in an optional package.

## What the Tool Does

`cli-assistant-runner` is an `isAssistantRunner: true` tool. It:

1. Reads the assistant's `assistantRunnerConfig` (command, model, workspace, timeout, restrictPath, extraArgs)
2. Builds a prompt from thread history + current message
3. Resolves the full shell PATH (handles Electron's stripped-down `PATH` from Finder/Dock launch)
4. Spawns the CLI command as a child process
5. Handles per-CLI output formats (opencode emits JSONL; claude/cursor emit plain text)
6. Returns the text output as the assistant response, or throws on timeout/error

Three assistants are pre-configured to use it: **Cursor Agent**, **Claude Code**, and **OpenCode**.

## Problem

Right now this lives inside the Yoke package. That means:

- Users don't get CLI agents by default — they have to discover and install Yoke
- Yoke's task-board UI is bundled with what is really general-purpose infrastructure
- Other packages can't use the tool without depending on Yoke
- It's harder to maintain and evolve as platform infrastructure evolves

## Proposal: Move to peers-core

**peers-core** is the right home. It's the built-in system package that ships with peers-electron and is always loaded. It already houses platform-level tools (`send-message`, `run-workflow`, etc.) and the default `shell-assistant`. The cli-assistant-runner is the same category of thing.

## Proposed File Layout

```
peers-core/src/
├── tools/
│   ├── index.ts                         (add cli-assistant-runner to exports)
│   ├── cli-assistant-runner.tool.ts     (moved from yoke, with minor cleanup)
│   ├── new-id.tool.ts
│   ├── send-message.tool.ts
│   └── ... (existing)
│
└── assistants/
    ├── index.ts                         (add three new assistants to exports)
    ├── shell-assistant.ts               (existing)
    ├── cursor-agent-assistant.ts        (new — moved from yoke)
    ├── claude-code-assistant.ts         (new — moved from yoke)
    └── opencode-assistant.ts           (new — moved from yoke)
```

The tool's `toolId` and the assistants' `assistantId`s should be defined in `peers-core/src/consts.ts`.

## What Changes

### peers-core/src/tools/cli-assistant-runner.tool.ts

Mostly a direct port. Minor changes:
- Remove the `cliAssistantRunnerToolId` import from yoke's consts; use one from peers-core consts
- Move `formatThreadHistory` here (it currently lives in the tool file, which is fine)
- Keep all the path resolution logic (`getFullPath`, `getRestrictedPath`, `resolveCommandAbsolutePath`) — this is Electron-specific and belongs in the platform
- Keep the CLI adapter pattern (`buildCursorArgs`, `buildClaudeArgs`, `buildOpenCodeArgs`) — extensible if more CLIs are added later

### peers-core/src/assistants/

Three assistant files, each exporting an `IAssistant`. Config uses `process.env` overrides for model:

```typescript
// cursor-agent-assistant.ts
export const cursorAgentAssistant: IAssistant = {
  assistantId: cursorAgentAssistantId,
  name: 'Cursor Agent',
  assistantRunnerToolId: cliAssistantRunnerToolId,
  assistantRunnerConfig: {
    command: 'cursor-agent',
    model: process.env.PEERS_CURSOR_MODEL || 'composer-1.5',
    extraArgs: ['--trust'],
    restrictPath: true,
  },
  toolInclusionStrategy: ToolInclusionStrategy.Fixed,
  toolsToInclude: '',
  createdAt: new Date('2026-02-21T00:00:00Z'),
};
```

Env var naming convention: `PEERS_CURSOR_MODEL`, `PEERS_CLAUDE_MODEL`, `PEERS_OPENCODE_MODEL` (prefer `PEERS_` prefix over `YOKE_` in the platform).

### Yoke Package (After Migration)

Yoke no longer needs to define the tool or the three base assistants. It can:

- Remove `cli-assistant-runner.tool.ts` and `assistants/index.ts`
- Remove the `cliAssistantRunnerToolInstance` from `package.ts`
- Remove `assistants: [cursorAssistant, claudeCodeAssistant, openCodeAssistant]` from `package.ts`
- Keep its task board UI, task data schema, and `agent-runner.ts` (its task-claiming + dispatch loop)

`agent-runner.ts` in Yoke currently hardcodes `cursor-agent` — that should be updated to use one of the built-in assistants via the Peers assistant API rather than spawning directly. But that's a separate Yoke task.

## Tool Registration

`IToolInstance`s in peers-core are registered via `peers-electron/src/server/peers-init.ts` → `loadSystemData()` → iterates `getSystemToolInstances()`. The cli-assistant-runner just needs to be added to the `tools/index.ts` export array.

Assistants from peers-core are loaded by `package-installer.ts` when peers-core is installed as a package into the user's dataContext. They land in the `Assistants` table and become selectable like any other assistant.

## Trade-offs

**For moving to peers-core:**
- Always available, discoverable by default
- Other packages (like Yoke) can reference the tool by ID without bundling it
- Path resolution logic is maintained alongside the platform it supports (Electron)
- Sets the stage for first-class multi-agent support

**Against / risks:**
- Adds subprocess spawning to the trusted core — but peers-core already runs in the Electron main process with full OS access; this doesn't expand the trust boundary
- Default assistants (Cursor, Claude, Claude Code) show up for all users even if they don't have the CLIs installed — could be confusing; mitigation: assistants fail gracefully with a clear error if the command isn't found
- Env var config is less discoverable than a UI — fine for now, worth a settings UI later

## Open Questions

1. **Should the built-in assistants be opt-in?** Could guard them behind a feature flag or only register them if the CLI is detected. Probably not worth the complexity — failing gracefully is sufficient.

2. **`restrictPath` default** — currently `true` for Cursor and Claude, `false` for OpenCode. Is that right? The restricted PATH prevents agents from reaching system tools, but may break some setups. Worth keeping as a per-assistant config option.

3. **Thread variable `cwd`** — the tool already reads `threadVars.cwd` to override workspace. This should be documented so Yoke (and other packages) can set it when launching an agent for a specific task.

4. **Streaming output** — currently the tool buffers all output and returns it at the end. Long-running agents would benefit from streaming progress back as message logs. Deferred to future work.

## Summary

| Question | Answer |
|---|---|
| Where does the tool go? | `peers-core/src/tools/cli-assistant-runner.tool.ts` |
| Where do the assistants go? | `peers-core/src/assistants/` (one file each) |
| What about peers-device? | Not the right layer — that's P2P sync, not AI tooling |
| Does Yoke keep a copy? | No — it drops the tool and assistants, keeps the task board |
| New env vars? | `PEERS_CURSOR_MODEL`, `PEERS_CLAUDE_MODEL`, `PEERS_OPENCODE_MODEL` |

Some things to consider
- agent-cli instances working directory starts in ~/peers-packages which makes sense because these agents are usually used for coding and that directory is the root directory for the peers-package projects code (i.e. where the code is written and they are built and loaded into peers from).  So we should make sure we have an AGENTS.md and a CLAUDE.md in that directory to ensure the CLI agents have a good jumping off point.  These md files should be bundled with Peers and written to that directory upon install.  If the user has edited them then we shouldn't overwrite them.  Use some special line at the top like `# updates enabled`.  If that line is the first line we should overwrite it on every install so we can push out updates.  We should also create a docs folder (~/peers-packages/docs) with lots of useful information and context that the agents can search through (almost all markdown files).
- the `opencode` cli agent should be installed along side peers and setup for the user (as much as possible) since that is free to use and open source.  So we need to either bundle `opencode` with electron or, ideally, have electron install it on first run.  This will ensure a highly capable agent is available right away that can help the user do things in peers and for peers, and just on the user's computer via the nice peers interface and runtime.  