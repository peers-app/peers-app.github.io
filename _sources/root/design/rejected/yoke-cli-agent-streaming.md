# Yoke CLI Agent Progress Streaming

**Status:** Proposed
**File:** `yoke/src/tools/cli-assistant-runner.tool.ts`

## Problem

When a user sends a message to a CLI agent (Claude Code, cursor-agent), the workflow can run for several minutes with no feedback. The agent is running, but the user sees nothing until the final response appears.

## Solution

Stream progress updates into workflow log entries during execution so the user sees live feedback as the agent works.

Two strategies are used, selected per-command:

- **Option B (primary):** Claude's `--output-format stream-json` emits newline-delimited JSON events as they are generated. Parse them and call `context.logger()` on each meaningful event.
- **Option A (fallback):** A `setInterval` flush for all other commands (e.g. `cursor-agent`) that periodically logs newly buffered stdout.

Both paths funnel into a single `onProgress?: (text: string) => void` callback on `spawnCliAgent`, keeping the interface clean.

---

## Changes

### 1. `buildCliArgs` — Claude gets `stream-json`

```typescript
// Before
args.push(printFlag, '--output-format', 'text');

// After
const outputFormat = command === 'claude' ? 'stream-json' : 'text';
args.push(printFlag, '--output-format', outputFormat);
```

The `--output-format stream-json` flag makes Claude emit newline-delimited JSON. Each line is one event. The final text response is still available from the stream; we no longer need to capture all of stdout as the final answer — we reconstruct it from `result` events instead.

### 2. `spawnCliAgent` — add `onProgress` + dual-path handler

Add `onProgress` to the options type:

```typescript
export function spawnCliAgent(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    restrictPath?: boolean;
    onProgress?: (text: string) => void;
    progressIntervalMs?: number;
  } = {},
): Promise<SpawnResult>
```

Inside the function, detect which mode we're in and wire up accordingly:

```typescript
const isStreamJson = args.includes('stream-json');
let lineBuffer = '';
let lastFlushedLen = 0;
let progressTimer: ReturnType<typeof setInterval> | undefined;

// Option B: parse stream-json lines
child.stdout?.on('data', (data: Buffer) => {
  const raw = data.toString();
  stdout += raw;

  if (isStreamJson) {
    lineBuffer += raw;
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        const text = extractProgressText(event);
        if (text) options.onProgress?.(text);
      } catch { /* ignore malformed lines */ }
    }
  }
});

// Option A: interval flush for non-stream-json commands
if (!isStreamJson && options.onProgress) {
  const intervalMs = options.progressIntervalMs ?? 10_000;
  progressTimer = setInterval(() => {
    if (stdout.length > lastFlushedLen) {
      options.onProgress!(stdout.slice(lastFlushedLen).slice(-1000));
      lastFlushedLen = stdout.length;
    }
  }, intervalMs);
}
```

Clear `progressTimer` in both `close` and `error` handlers.

#### `extractProgressText` helper

Extracts human-readable text from a Claude stream-json event. The events we care about:

| Event type | Content type | What to log |
|---|---|---|
| `assistant` | `thinking` | The thinking text (truncated to ~500 chars) |
| `assistant` | `text` | The text delta |
| `system` | — | `subtype` field (e.g. `"init"`) |
| `result` | — | Ignored (used to reconstruct stdout, see below) |

```typescript
function extractProgressText(event: unknown): string | null {
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Record<string, unknown>;

  if (e.type === 'assistant') {
    const msg = e.message as Record<string, unknown> | undefined;
    const content = Array.isArray(msg?.content) ? msg!.content : [];
    const parts: string[] = [];
    for (const block of content) {
      const b = block as Record<string, unknown>;
      if (b.type === 'thinking' && typeof b.thinking === 'string') {
        parts.push(b.thinking.slice(0, 500));
      } else if (b.type === 'text' && typeof b.text === 'string') {
        parts.push(b.text);
      }
    }
    return parts.length ? parts.join('\n') : null;
  }

  if (e.type === 'system' && typeof e.subtype === 'string') {
    return `[${e.subtype}]`;
  }

  return null;
}
```

#### Reconstructing final stdout from `stream-json`

With `stream-json`, stdout is no longer plain text — it's a stream of JSON events. We need to reconstruct the final answer from `result` events:

```typescript
// in the close handler, after the process exits:
if (isStreamJson) {
  // Parse all lines accumulated in stdout to find the result
  const finalText = extractFinalResult(stdout);
  resolve({ stdout: finalText, stderr, exitCode: code, timedOut });
} else {
  resolve({ stdout, stderr, exitCode: code, timedOut });
}

function extractFinalResult(raw: string): string {
  for (const line of raw.split('\n').reverse()) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      if (event.type === 'result' && typeof event.result === 'string') {
        return event.result;
      }
    } catch { /* skip */ }
  }
  return raw; // fallback: return raw if no result event found
}
```

### 3. `cliAssistantRunnerFn` — pass `context.logger` as `onProgress`

```typescript
const result = await spawnCliAgent(config.command, args, {
  cwd,
  timeout: config.timeout ?? DEFAULT_TIMEOUT,
  restrictPath: config.restrictPath ?? false,
  onProgress: (text) => {
    context.logger({ logText: 'Agent progress', result: text.slice(-1000) });
  },
});
```

No other changes to the function. The final `return result.stdout.trim()` continues to work because `spawnCliAgent` now returns the reconstructed plain-text result for Claude (or the raw stdout for other agents).

---

## What the user sees

- **Claude:** Log entries appear as Claude thinks and writes — roughly one entry per assistant turn (thinking block + text block). These show up in the collapsed "logs" view in the workflow.
- **cursor-agent / others:** A log entry appears every 10 seconds containing the last 1000 chars of new output.

---

## What stays the same

- `SpawnResult` shape is unchanged — callers get `stdout` as a plain string as before.
- `buildCliArgs` contract is unchanged.
- `cliAssistantRunnerFn` return value is unchanged.
- Tests that mock `spawnCliAgent` continue to work; `onProgress` is optional.
- Error and timeout handling is unchanged.

---

## Affected files

| File | Change |
|---|---|
| `yoke/src/tools/cli-assistant-runner.tool.ts` | All of the above |

No other files need changes.

---

## Open questions

1. **Log verbosity:** Thinking blocks can be very long. The `slice(-1000)` in `onProgress` and the `slice(0, 500)` in `extractProgressText` are both tunable. Should there be a config option to disable thinking-token logging?
2. **`stream-json` stability:** This relies on Claude CLI's `--output-format stream-json` flag. If the format changes upstream we need to update `extractProgressText` and `extractFinalResult`. Worth a comment in the code pointing to the Claude CLI docs.
3. **cursor-agent interval:** 10 seconds is a guess. If cursor-agent output is bursty (long pauses then big chunks) this might produce noisy log entries. Could be made configurable via `CliRunnerConfig.progressIntervalMs`.
