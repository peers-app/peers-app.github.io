# Git Commit Guide for Agents

This document explains how to commit changes in the Peers monorepo.

## Repository Structure

This is a **monorepo** where top-level folders are separate git repositories (submodules):

```
peers-app/              # Root repository
├── peers-cli/          # Submodule
├── peers-core/         # Submodule
├── peers-device/       # Submodule
├── peers-electron/     # Submodule
├── peers-package-template/  # Submodule
├── peers-react-native/ # Submodule
├── peers-sdk/          # Submodule
├── peers-services/     # Submodule
├── peers-ui/           # Submodule
├── docs/               # Part of root repo
├── design/             # Part of root repo
└── ...
```

## Commit Order

When changes span multiple repositories, **commit submodules first**, then the root:

1. **Commit each affected submodule** (e.g., `peers-electron`, `peers-sdk`)
2. **Commit the root repo** (includes docs/, design/, and submodule references)

## Before you commit (Biome)

If you touched TypeScript or JavaScript in a repo that has **`biome.json`**, run **`npx biome check .`** in that repo’s root (or **`npm run lint:biome`** where the package defines it). Fix or justify violations before opening a PR or handing work back—some **`npm run lint`** scripts are still stubs that exit 0; Biome is the source of truth for those trees.

## Basic Workflow

### 1. Check what's changed

```bash
# Root repo status
cd /Users/mark.archer/peers-app
git status --short

# Check EACH submodule that shows as modified
cd peers-electron
git status --short
cd ../peers-device
git status --short
```

**Important:** Always check `git status` inside each submodule that appears modified in the root. The root only shows that a submodule has changes — it doesn't tell you what those changes are or whether they've been committed. Skipping this step is how submodule deletions or modifications get missed.

### 2. Commit submodule changes first

```bash
cd /Users/mark.archer/peers-app/peers-electron
git add <files>
git commit -m "type: description"
```

### 3. Commit root repo (includes submodule reference update)

```bash
cd /Users/mark.archer/peers-app
git add docs/context/file.md peers-electron
git commit -m "type: description"
```

## Permission Requirements

**Always use `required_permissions: ["all"]`** for git commits. This is needed because:
- The system uses 1Password SSH agent for signing
- Sandboxed commands cannot access the 1Password socket

```bash
# This will fail in sandbox:
git commit -m "message"  # Error: 1Password: Could not connect to socket

# Use "all" permissions instead
```

## Commit Message Format

Use conventional commit format:

```
type: short description

- Bullet point details
- Another detail
```

**Types:**
- `fix:` - Bug fixes
- `feat:` - New features
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Maintenance tasks

## Example: Multi-Repo Commit

When you've changed files in both `peers-electron` and `docs/`:

```bash
# 1. Commit peers-electron first
cd /Users/mark.archer/peers-app/peers-electron
git add src/client/ui-inspector.ts
git commit -m "fix: UI inspector filters hidden elements

- Added isElementHidden() helper
- Properly excludes content from inactive tabs"

# 2. Commit root repo (docs + submodule ref)
cd /Users/mark.archer/peers-app
git add docs/context/cli-context.md peers-electron
git commit -m "docs: Update CLI context documentation

- Added new section for feature X
- Updated peers-electron submodule"
```

## Checking Submodule Status

The root repo shows submodule changes with different indicators:

```bash
$ git status --short
 M docs/context/cli-context.md    # Modified file in root
 m peers-electron                  # Submodule has new commits (already committed inside)
 M peers-device                    # Submodule has uncommitted changes (needs committing inside first)
```

- Lowercase `m` — submodule has commits not yet referenced by the root (commit root to update ref)
- Uppercase `M` — submodule has uncommitted working tree changes (commit inside submodule first)

You can also see `-dirty` appended in `git diff` output when a submodule has uncommitted changes:
```
-Subproject commit abc123
+Subproject commit abc123-dirty   ← uncommitted changes inside submodule
```

## Tips for Agents

1. **Always check `git status`** in both root and affected submodules before committing

2. **Commit order matters**: Submodules first, then root

3. **Include submodule in root commit**: When you commit a submodule, also stage it in the root repo to update the reference

4. **Use descriptive commits**: Future agents will read these to understand changes

5. **One logical change per commit**: Don't mix unrelated changes

## Common Mistakes

❌ **Committing root before submodule**
```bash
# Wrong order - submodule reference will be stale
cd peers-app && git commit -m "update"
cd peers-electron && git commit -m "fix"
```

✅ **Correct order**
```bash
cd peers-electron && git commit -m "fix"
cd peers-app && git add peers-electron && git commit -m "update"
```

❌ **Forgetting to stage submodule in root**
```bash
cd peers-electron && git commit -m "fix"
cd peers-app && git add docs/ && git commit  # Missing: peers-electron
```

✅ **Include submodule reference**
```bash
cd peers-electron && git commit -m "fix"
cd peers-app && git add docs/ peers-electron && git commit
```

