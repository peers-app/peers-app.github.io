---
sidebar_position: 0
---

# CLI

The Peers CLI (`peers`) lets you interact with the Peers app entirely from the terminal. You can chat with assistants, query your database, run tools, tail logs, and control the UI — all without opening the app window.

The CLI communicates with the running Peers desktop app over a local WebSocket connection. If the app isn't running, the CLI starts it automatically.

## Installation

The CLI is installed automatically with the Peers desktop app. After installing Peers, the `peers` command is available in your terminal.

Verify it's working:

```bash
peers --version
```

## Quick start

```bash
# Chat with the built-in assistant
peers "What tasks do I have?"

# Start an interactive chat session
peers

# List all database tables
peers db tables

# List available tools
peers tools list

# Check app status
peers app status
```

## Commands

### Messaging

Send a message to the assistant and get a response:

```bash
peers "your message here"
```

For an interactive session with conversation history, start the REPL:

```bash
peers
```

REPL commands:
- `/clear` — start a new thread
- `/exit` or `/quit` — exit the REPL

**Options:**

| Flag | Description |
| --- | --- |
| `-v, --verbose` | Show detailed progress output |
| `-c, --context <id>` | Data context: a groupId, or `personal` (default) |

### `peers db` — Database

Query the local SQLite database directly. Read-only access (SELECT and PRAGMA only).

:::note
Database access must be enabled in the app: **Help → Enable CLI Database Access**
:::

```bash
# List all tables
peers db tables

# Query a table (first 20 rows)
peers db Users

# Query with a row limit
peers db Tasks -n 100

# Run a custom SQL query
peers db query "SELECT * FROM Users WHERE name LIKE '%mark%'"

# Inspect table structure
peers db query "PRAGMA table_info(Users)"

# Output as JSON for piping
peers db tables --json | jq
```

**Options:**

| Flag | Description |
| --- | --- |
| `-n, --limit <count>` | Maximum rows to return (default: 20) |
| `--json` | Output as JSON (one object per line) |
| `-c, --context <id>` | Data context: a groupId, or `personal` (default) |

### `peers tools` — Tools

List, inspect, and execute [tools](./Tools).

```bash
# List all tools
peers tools list

# Show tool details and schema
peers tools get "new-task"

# Run a tool with JSON input
peers tools run "new-task" '{"title": "Buy groceries", "status": "Queued"}'

# Run a tool in a group context
peers tools run "add-to-shopping-list" '{"item": "milk"}' -c <groupId>
```

Tool lookup supports exact ID, exact name, and fuzzy text search. If a fuzzy search matches multiple tools, you'll be prompted to use a more specific name or the tool ID.

**Options:**

| Flag | Description |
| --- | --- |
| `--json` | Output as JSON |
| `-c, --context <id>` | Data context: a groupId, or `personal` (default) |
| `-a, --assistant <id>` | Assistant ID to use as context for the tool run |
| `-n, --limit <count>` | Max tools to list (default: 100) |

### `peers logs` — Logs

Query and tail console logs from the app.

```bash
# Show last 50 logs
peers logs

# Follow logs in real-time (like tail -f)
peers logs -f

# Show only errors
peers logs -e

# Show warnings and errors
peers logs -l warn,error

# Logs from the last 5 minutes
peers logs --since 5

# Search log messages
peers logs -q "database" --full

# Filter by process
peers logs -p main

# Output as JSON for processing
peers logs --json | jq
```

**Options:**

| Flag | Description |
| --- | --- |
| `-f, --follow` | Follow mode — continuously show new logs |
| `-l, --level <levels>` | Filter by log level(s), comma-separated: `debug`, `info`, `log`, `warn`, `error` |
| `-e, --error` | Shorthand for `--level error` |
| `-w, --warn` | Shorthand for `--level warn,error` |
| `-p, --process <name>` | Filter by process name (main, renderer, worker) |
| `-s, --source <source>` | Filter by source file/module |
| `-q, --search <text>` | Search in log messages |
| `--since <minutes>` | Show logs from last N minutes |
| `-n, --limit <count>` | Maximum logs to show (default: 50) |
| `--full` | Show full context objects and stack traces |
| `--json` | Output as JSON (one object per line) |

### `peers app` — App control

Start, stop, and check the status of the Peers desktop app.

```bash
# Check if the app is running
peers app status

# Start the app
peers app start

# Restart the app
peers app restart

# Quit the app
peers app quit

# Start the development build
peers app start --dev

# Set a custom dev path
peers app config --dev-path ~/peers-app/peers-electron
```

**Options:**

| Flag | Description |
| --- | --- |
| `-d, --dev` | Use development version instead of production |
| `--dev-path <path>` | Set the path to the peers-electron dev directory |
| `--prod-path <path>` | Set the path to the production app |

### `peers ui` — UI control

Control and inspect the app's UI programmatically.

```bash
# Reload the UI
peers ui reload

# Hard reload (ignore cache)
peers ui reload --no-cache

# Inspect current UI state
peers ui inspect

# Get UI state as JSON
peers ui inspect --json

# List interactive elements
peers ui inspect --elements

# Get visible text
peers ui inspect --text

# Click an element by CSS selector
peers ui click "#submit-btn"

# Set an input value
peers ui set "#search" "hello world"

# Set value, clear first, and press Enter
peers ui set "#chat-input" "hello" --clear --enter

# Scroll down
peers ui scroll --direction down

# Scroll up by 500px
peers ui scroll --direction up --amount 500
```

## Data contexts

By default, the CLI operates on your personal data. To work with a group's data, pass the `-c` flag with a group ID:

```bash
peers -c <groupId> "What are our shared tasks?"
peers db Tasks -c <groupId>
peers tools run "add-to-shopping-list" '{"item": "milk"}' -c <groupId>
```

The context flag works with all subcommands.

## AI agent integration

The CLI makes Peers fully accessible to AI coding assistants and automation scripts. An AI agent can:

- Query data with `peers db query "..."` and get structured JSON with `--json`
- Run tools with `peers tools run` to create tasks, set timers, or trigger workflows
- Chat with the built-in assistant via `peers "..."`
- Inspect and interact with the UI via `peers ui`
- Tail logs for debugging with `peers logs -f`

## Architecture

The CLI connects to the running Peers desktop app via a local WebSocket (Socket.IO). On first launch, the app writes an auth token to `~/peers/cli/cli-auth.json` that the CLI uses to authenticate. All data operations go through the same RPC layer the app's renderer uses, so the CLI has the same capabilities as the UI.

Configuration is stored at `~/peers/cli-config.json`.

## Related topics

- **[System: Tools](./Tools)** — defining and using tools that the CLI can execute.
- **[System: Workflows](./Workflows)** — workflows triggered by CLI messages.
- **[System: Assistants](./Assistants)** — the assistants that respond to CLI messages.
- **[System: Tables](./Tables)** — the data model behind `peers db`.
