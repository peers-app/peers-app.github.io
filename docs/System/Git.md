---
sidebar_position: 5
title: Git
---

# Git

The official Git package shares repositories through Peers. Use ordinary `git clone`,
`fetch`, `push`, and `merge` with a `peers://` remote. Your working checkout stays yours;
Peers keeps a separate local copy for fetching and sharing with other devices.

Install Git on every desktop or headless host that runs the package. Install the Git package
in the group where you want to share, and select a released version so the other devices run
it too ([Packages](./Packages.md)). It is not installed by default yet. The package can also
run in your personal context to share between your own devices.

The `git-remote-peers` helper currently supports macOS and Linux. The desktop app installs it
beside `peers` in `~/.local/bin`; put that directory on `PATH`. Keep the Peers host running.
The helper does not start the app. See [CLI](./CLI.md#git-remotes).

## Share a repository

As a group Writer or above, create a repository with the Git package's `shareRepository` tool:

```bash
peers tools run shareRepository '{"name":"My project"}' -c <groupId> --json
```

The result contains `repoId` and a URL like `peers://<groupId>/<repoId>`. Both ids have 25
letters or digits. In your personal context, the first id is your user id.

In your existing checkout:

```bash
git remote add peers peers://<groupId>/<repoId>
git push -u peers main
```

The default branch is `main`. To use another, pass `"defaultBranch":"trunk"` when sharing,
then push `trunk`. Only the repository's owner can push its default branch. Sharing creates
an empty repository; your first push supplies its commits. Your GitHub remote can stay in
place alongside the Peers remote.

Another group member can clone it:

```bash
git clone peers://<groupId>/<repoId>
```

For a local development build, build and import `official-packages/git` using the normal
[package development workflow](../Packages/getting-started.md#importing-an-existing-package-directory).

## Personal branches

Each Writer can push their own branches:

```bash
git switch -c feature
git push -u peers feature
```

You see `feature` on all your devices. Other members see it under your name, for example
`bob/feature`. The repository owner's default branch remains `main` for everyone. To review
Bob's work, fetch and merge it normally:

```bash
git fetch peers
git merge peers/bob/feature
```

Prefixes use the member's lowercase name, with characters outside `a-z`, `0-9`, and `-`
replaced by `-`, trimmed to 32 characters. An empty result becomes `member`. Duplicate or
reserved prefixes get an id suffix; Peers extends the suffix if necessary to keep names
distinct. Renaming a member moves their displayed branches, so use `git fetch --prune`.

Another member's prefix is reserved: you cannot push `bob` or `bob/...` as your own branch.
Case variants such as `BOB/...` are reserved too. Names that differ only in letter case cannot
both appear in a fetched view; a push that would create such a conflict is refused.
Unicode spellings that normalize to the same name refer to one
personal branch across your devices.
The default branch's namespace is also reserved: for a default of `release/main`, personal
branches cannot be named `release` or `release/main/...`.
If a later member's name conflicts with an existing personal branch, that branch is omitted
from the fetched view and reported by `getBranchState`. Rename and push your branch from your
checkout. Readers can fetch but cannot publish. Branches from removed members or members who
become Readers disappear on a later `fetch --prune`.
If the repository's owner leaves the group or becomes a Reader, all of its branches leave
the fetched view and pushes are refused. Each device keeps the history it already copied;
letting an Admin adopt such a repository is still to come.

Personal branches support normal force pushes and deletion. Fetch before pushing from a
second device when possible. Commits in your checkout remain available even if another device
later publishes a different tip for your branch.

## Availability and status

A fetch uses this device's local copy and briefly tries to obtain missing commits from other
members' devices. Once copied, that history can be fetched while those devices are offline.
New history needs an online device that has it. Until it arrives, a fetch may show the
previous tip or omit a new branch. Peers must still be running locally for offline fetching.

These tools show what is available:

```bash
peers tools run listRepositories '{}' -c <groupId> --json
peers tools run getBranchState '{"repoId":"<repoId>"}' -c <groupId> --json
peers tools run replicateTick '{}' -c <groupId> --json
```

`getBranchState` shows current branches, branches awaiting commits, and name conflicts. It
also reports the last transfer's bytes, milliseconds, chunk size, source device (`holder`),
whether a chunk failed, and whether the transfer completed. For a completed transfer,
MiB/s is `bytes / 1048576 / (milliseconds / 1000)`.

An interrupted copy leaves the published local branch view intact. A later attempt can copy
the missing history again. If a push reports **publication failed**, the commits remain in
your checkout. Wait two minutes, then fetch and push again.
Do not treat that push as shared successfully.

## Current limits

This version supports SHA-1 repositories and branches under `refs/heads/`. Tags and SHA-256
repositories are not supported. A push accepts up to 128 branch updates and a pack of at most
1 GiB; branch ref names are limited to 1,024 UTF-8 bytes.

Several maintainers on a shared branch, fork reconciliation, approval thresholds, orphaned
repository adoption, default installation, a Git screen, and the Windows helper are still to
come. Windows desktop/headless hosts can run the package and replicate repositories. The PWA
cannot run this privileged package.
