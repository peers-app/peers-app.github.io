# Peers CLI

Command line interface for interacting with the Peers application.

> **For AI Agents:** This CLI is designed to be used by both humans and AI agents. Agents working on the Peers codebase can find additional context, troubleshooting tips, and practical guidance in [`docs/context/cli-context.md`](context/cli-context.md).

## Installation

The CLI must be installed from within the Peers app:

1. Open the Peers app
2. Go to **Help → Install CLI Command** (or **Peers → Install CLI Command** on macOS)
3. Follow the prompts - the installer will:
   - Create the `peers` command in `~/.local/bin/`
   - Attempt to add `~/.local/bin` to your PATH automatically
   - Provide manual instructions if automatic PATH update fails

> **Note:** The CLI files are synced to `~/peers/cli/` automatically whenever the app starts, but the `peers` command wrapper must be installed manually from the menu.

To verify installation:
```bash
which peers
# Should output: /Users/<username>/.local/bin/peers
```

## Usage

```bash
peers [options] [command]
```

### Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help message |
| `--version` | Show version number |
| `-v, --verbose` | Show detailed progress output |
| `-d, --dev` | Use development version of the app |

## Commands

### Chat / REPL Mode

Send messages to the Peers assistant:

```bash
# Single message mode
peers "What time is it?"
peers "Add milk to the shopping list"

# Interactive REPL mode
peers

# Verbose mode (shows workflow details)
peers -v "Debug this request"
```

REPL commands:
- `/clear` - Start a new thread
- `/exit` or `/quit` - Exit the REPL

### App Control

Control the Peers application lifecycle:

```bash
peers app [action] [options]
```

#### Actions

| Action | Description |
|--------|-------------|
| `status` | Check if the app is running (default) |
| `start` | Start the Peers app |
| `restart` | Restart the Peers app |
| `quit` | Quit the Peers app |
| `config` | Show or set configuration |

#### Options

| Option | Description |
|--------|-------------|
| `-d, --dev` | Use development version instead of production |
| `--dev-path <path>` | Set the path to peers-electron dev directory |
| `--prod-path <path>` | Set the path to production app |

#### Examples

```bash
# Check if app is running
peers app status

# Start the production app
peers app start

# Start the development version
peers app start --dev

# Restart the app
peers app restart

# Quit the app
peers app quit

# Set dev path for faster subsequent starts
peers app --dev-path ~/peers-app/peers-electron

# Show current configuration
peers app config
```

### Logs

Query and tail console logs from the Peers app:

```bash
peers logs [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `-l, --level <levels>` | Filter by log level(s), comma-separated. Valid: debug, info, log, warn, error |
| `-e, --error` | Shorthand for `--level error` |
| `-w, --warn` | Shorthand for `--level warn,error` |
| `-p, --process <name>` | Filter by process name (main, renderer, worker) |
| `-s, --source <source>` | Filter by source file/module |
| `-q, --search <text>` | Search in log messages |
| `--since <minutes>` | Show logs from last N minutes |
| `-n, --limit <count>` | Maximum logs to show (default: 50) |
| `-f, --follow` | Follow mode - continuously show new logs |
| `--full` | Show full context and stack traces |
| `--json` | Output as JSON (one object per line) |

#### Examples

```bash
# Show last 50 logs
peers logs

# Show only errors
peers logs -e

# Show warnings and errors
peers logs -l warn,error

# Show logs from main process
peers logs -p main

# Show logs from last 5 minutes
peers logs --since 5

# Follow/tail logs in real-time
peers logs -f

# Search for "database" with full details
peers logs -q "database" --full

# Output as JSON for processing
peers logs --json | jq
```

### Database

Query the local SQLite database directly:

```bash
peers db [action] [options]
```

> **Security:** Database access must be enabled first via **Help → Enable CLI Database Access** in the Peers app. Only read-only queries (SELECT, PRAGMA) are allowed.

#### Actions

| Action | Description |
|--------|-------------|
| `tables` | List all database tables |
| `<table>` | Query a table (shows first 20 rows) |
| `query "SQL"` | Execute a custom SQL query |

#### Options

| Option | Description |
|--------|-------------|
| `-n, --limit <count>` | Maximum rows to return (default: 20) |
| `--json` | Output as JSON (one object per line) |

#### Examples

```bash
# List all tables
peers db tables

# Show first 20 rows from Users table
peers db Users

# Show first 100 rows
peers db Users -n 100

# Execute custom query
peers db query "SELECT * FROM Users WHERE name LIKE '%Mark%'"

# Get table schema
peers db query "PRAGMA table_info(Users)"

# Output as JSON for processing
peers db tables --json | jq
peers db Users --json | jq '.name'
```

### UI Control

Control and inspect the Peers UI:

```bash
peers ui [action] [options]
```

#### Actions

| Action | Description |
|--------|-------------|
| `reload` | Reload the UI (like browser refresh) |
| `inspect` | Inspect the current UI state |

#### Options

| Option | Description |
|--------|-------------|
| `--no-cache` | Ignore cached resources when reloading |
| `--json` | Output UI state as JSON (for inspect) |
| `--elements` | Show only interactive elements (for inspect) |
| `--text` | Show only visible text (for inspect) |
| `--rects` | Include element bounding rectangles (for inspect) |

#### Examples

```bash
# Reload the UI
peers ui reload

# Hard reload (ignore cache)
peers ui reload --no-cache

# Inspect UI state
peers ui inspect

# Get UI state as JSON (useful for agents)
peers ui inspect --json

# Get just the interactive elements
peers ui inspect --elements

# Get just the visible text
peers ui inspect --text

# Click an element
peers ui click "#submit-btn"
peers ui click "button.primary"

# Set input value
peers ui set "#search" "hello world"
peers ui set "#chat" "hi" --enter       # Set and press Enter
peers ui set "#name" "John" --clear     # Clear first, then set

# Scroll the page
peers ui scroll --direction down
peers ui scroll --direction up --amount 500
```

## Configuration

The CLI stores configuration in `~/peers/cli-config.json`:

```json
{
  "prodAppPath": "/Applications/Peers.app",
  "devAppPath": "/Users/username/peers-app/peers-electron"
}
```

### Auth File

The CLI connects to the running Peers app via WebSocket. Connection details are stored in `~/peers/cli/cli-auth.json` (automatically created when the app starts):

```json
{
  "port": 9337,
  "token": "...",
  "dbAccessEnabled": false
}
```

The `dbAccessEnabled` field indicates whether CLI database access is enabled (controlled via the app menu).

## Development Mode

Use the `--dev` flag to work with the development version of the app:

```bash
# Start dev app
peers app start --dev

# Run commands against dev app
peers --dev logs -f
peers --dev "test message"
```

Before using dev mode, set the dev path:
```bash
peers app --dev-path /path/to/peers-app/peers-electron
```

## Troubleshooting

### "Auth file not found"

The Peers app is not running. Start it first:
```bash
# Production
open /Applications/Peers.app

# Development
cd peers-electron && npm run build && npm start
```

### "Connection timeout"

The app is starting but not ready yet. Wait a few seconds and try again.

### CLI not found

Ensure `~/.local/bin` is in your PATH:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

Add this line to your `~/.zshrc` or `~/.bashrc` for persistence.

### "Database access is not enabled"

Enable database access from the Peers app menu:
- **Help → Enable CLI Database Access** (Windows/Linux)
- **Peers → Enable CLI Database Access** (macOS)

This permission is saved and persists across app restarts.

