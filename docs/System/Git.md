---
sidebar_position: 5
title: Git
---

# Git

The official Git package shares repositories through Peers. Use ordinary `git clone`,
`fetch`, `push`, and `merge` with a `peers://` remote. Your working checkout stays yours;
Peers keeps a separate local copy for fetching and sharing with other devices.

## Set up

1. **Install Git** on each desktop or headless device that runs the package
   ([git-scm.com/downloads](https://git-scm.com/downloads); on Windows, Git for Windows).
   Peers doesn't install it. Without it, the package says "Git isn't installed on this device
   (or isn't on PATH)" and the Git screen shows the same warning. After installing Git, quit
   and reopen Peers so it finds Git.
2. **Install the Git package** in the group where you want to share, and select a released
   version so the other devices run it too ([Packages](./Packages.md)). It is not installed by
   default yet. It can also run in your personal context, to share between your own devices.
3. **Use the `peers` command.** The desktop app installs `peers` and the `git-remote-peers`
   helper in `~/.local/bin` on macOS, Linux and Windows; put that folder on `PATH` and open a
   new terminal. Keep Peers running: the helper doesn't start the app
   ([CLI](./CLI.md#git-remotes)).

To check a device, run:

```bash
peers git doctor -c <groupId>
```

It checks Git, the helper, the connection to Peers, the Git package in that group, and Git
where the package runs, and says how to fix each one that fails.

The **Git** screen (under Apps) lists the group's repositories with their URLs, each
repository's branches and their states, its maintainers, and what this device has copied.
Its **Share** button creates a repository. The package runs on desktop and headless devices,
so the screen says so on a phone.

## Share a repository

As a group Writer or above, run this in your working copy:

```bash
peers git share "My project" -c <groupId>
```

It creates the repository, adds a `peers` remote, and pushes the current branch, which
becomes the shared default branch (`--default-branch <name>` picks another; `--no-push`
skips the push; `--remote <name>` names the remote). Without a name it uses the folder's.
It prints the URL, `peers://<groupId>/<repoId>`; in your personal context the first id is
your user id. Your GitHub remote can stay in place alongside the Peers remote.
With no commits yet, it adds the remote and shows the command to push later. With detached
HEAD, check out a branch first, or use `--no-push` to create an empty remote.

To do the same by hand (or from the Git screen's **Share** button), create the repository,
then push:

```bash
git remote add peers peers://<groupId>/<repoId>
git push -u peers main
```

The default branch starts as a shared branch with the repository's owner as its only
maintainer. Sharing creates an empty repository; your first push supplies its commits.

Another group member can clone it by name or URL:

```bash
peers git clone "My project" -c <groupId>
git clone peers://<groupId>/<repoId>
```

`peers git list -c <groupId>` lists the group's repositories and their URLs.

### Share a package's source

Run `peers git share` in a package's folder (its `package.json` has `peers.packageId`), and
it also records the URL as that package's source, if the package has none yet, so the
package's details show it. Recording it in a group needs an Admin; otherwise the command says
it wasn't recorded and the repository is shared anyway. Members clone the source with
`git clone <url>`, then build and import it as usual
([Getting started](../Packages/getting-started.md#share-your-packages-source-through-peers)).

For a local development build of the Git package itself, build and import `official-packages/git`
using the normal
[package development workflow](../Packages/getting-started.md#importing-an-existing-package-directory).

## Shared branches

The repository's owner chooses which branches are shared and who maintains them. For example,
to let Alice and Bob both push `main` (run it in the working copy, or name the repository):

```bash
peers git policy --branch main --maintainers alice,bob
peers git policy "My project" -c <groupId>            # show the policy
peers git policy --branch release --maintainers bob   # share another branch
peers git policy --remove-branch release              # stop sharing it
```

Name maintainers by their branch prefix (as in `alice/feature`) or user id. Each change keeps
the other shared branches as they are. The default branch stays shared until you make another
branch the default (see [Change the default branch](#change-the-default-branch)). Agents
can call the package's `setPolicy` tool directly; it replaces the complete list of shared
branches, with user ids, and takes an optional `defaultBranch`. You can share up to 32 branches,
each with up to 10 distinct maintainers who are current Writers or above. Shared names cannot
overlap each other or sit under a member's prefix.

With threshold 1, any maintainer can advance the branch. When their tips lie on one line of
history, everyone sees the newest tip. Push normally:

```bash
git push peers main
```

Shared branches cannot be deleted or forced behind their current tip. A threshold-1 push
must also include the other maintainers' tips already available on this device. If a push
asks you to fetch and merge first, fetch, merge the named branch, and push again.

With several maintainers, everyone also sees each maintainer's latest tip as `alice/main`,
`bob/main`, and so on, including their own. These names let you review work that has not
landed on `main`, and recover it on another device. Push to `main` to update your tip;
the prefixed names are for fetching and merging.

### Change the default branch

The default branch is the one `git clone` checks out. The repository's owner can make another
shared branch the default; an Admin who adopted the repository can't. For example, to move a
repository from `master` to `main`, in the owner's working copy:

```bash
git branch -m master main
git push -u peers main
peers git policy --branch main --maintainers alice
peers git policy --default-branch main --remove-branch master
git push peers --delete master
git remote set-head peers -a
```

`peers git policy` marks the default branch with `(default)`. A branch that stops being
shared stays as each maintainer's personal branch until they delete it, as the
`git push peers --delete master` line does for yours. Other members' working copies keep
their local branch names; to follow along, they run:

```bash
git fetch --prune peers
git branch -m master main
git branch -u peers/main main
git remote set-head peers -a
```

### Offline forks

Two maintainers can push different commits while their devices are disconnected. With
threshold 1, once those updates meet, `main` moves back to their common ancestor and
`peers git status` (and the Git screen) reports it as forked. Your checkout and each maintainer's prefixed tip keep the
commits. If the histories have no common ancestor, the shared branch is unset until they
are joined.

For Bob to reconcile Alice's work with his own:

```bash
git fetch --prune peers
git merge peers/alice/main
git push peers main
```

Resolve any conflicts and commit the merge as usual. Once the merge reaches the other
devices, `main` advances again. Peers never creates a merge commit for you.

### Approval thresholds

Set a threshold of 2 (`peers git policy --branch main --threshold 2`) to require two
maintainers' tips to contain a commit before it lands. A push can succeed while `main` stays
at its previous tip. `peers git status` shows which maintainers' tips are ahead of the shared
branch (`aheadOwners` in the `getBranchState` tool).
To approve Alice's proposal, Bob can run:

```bash
git fetch peers
git merge --ff-only peers/alice/main
git push peers HEAD:main
```

If Bob has his own changes, use a normal merge instead. Two maintainers pushing the same
commit count as two approvals. The threshold must be between 1 and the number of maintainers.
If fewer than that many maintainers who are current Writers have published tips, the shared
branch is unset and reports `below-threshold`. Removing or demoting a maintainer can therefore move a shared
branch back or leave it unset; update the policy when changing the team.

Removing a non-default branch from `sharedRefs` makes its published tips personal branches
again. The default branch must stay shared.

## Personal branches

Each Writer can push their own branches:

```bash
git switch -c feature
git push -u peers feature
```

You see `feature` on all your devices. Other members see it under your name, for example
`bob/feature`. Shared branches keep their unprefixed names for everyone. To review
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
Every shared branch's namespace is also reserved: for a shared branch `release/main`, personal
branches cannot be named `release` or `release/main/...`.
Your own maintainer-tip names, such as `alice/main`, are reserved too when a shared branch
has several maintainers. If a later member's name or a policy change conflicts with an
existing personal branch, that branch is omitted from the fetched view and reported by
`peers git status` as a name conflict. Rename and push your branch from your
checkout. Readers can fetch but cannot publish. Branches from removed members or members who
become Readers disappear on a later `fetch --prune`.

Personal branches support normal force pushes and deletion. Fetch before pushing from a
second device when possible. Commits in your checkout remain available even if another device
later publishes a different tip for your branch.

## When the owner leaves

If the repository's owner leaves the group or becomes a Reader, the last policy freezes.
Other Writers' personal branches stay available, and shared branches keep working with
their remaining current maintainers and thresholds. A branch whose only maintainer was the
owner becomes unset. Each device keeps the history it already copied.

A current group Admin or above can adopt the repository once its owner is no longer a
Writer:

```bash
peers git adopt "My project" -c <groupId>
```

This keeps the current Writers in each maintainer list, adds the adopter to any empty list,
and lowers thresholds where necessary. The adopter can then change it with `peers git policy`.
(Agents can pass `sharedRefs` to the `adoptRepository` tool to choose the policy at once.)
An Admin cannot adopt while the owner is still a Writer. If the owner has lost every device,
demote or remove that identity from the group first.

`peers git status` shows who governs the policy (the owner, an adopter, or frozen). Only
that person can change it.
If Admins adopt independently while offline, check the governing signer after their devices
reconnect. An adopter who loses Admin access no longer governs; another current Admin's
adoption takes over if available, otherwise the owner's policy freezes again. If the owner
returns as a Writer, their policy governs again.

## Availability and status

A fetch uses this device's local copy and briefly tries to obtain missing commits from other
members' devices. Once copied, that history can be fetched while those devices are offline.
New history needs an online device that has it. Until it arrives, a fetch may show the
previous tip or omit a new branch. Peers must still be running locally for offline fetching.

The Git screen, or `peers git status` in a working copy (or with a repository's name and
`-c`), shows what this device has:

```bash
peers git status
peers git status "My project" -c <groupId> --json
```

It shows current branches, branches whose commits are still being copied (`pending-objects`),
forks, branches below their approval threshold, name conflicts (`collision`), a copy in
progress, and the last copy. Agents can call the package's tools directly:
`listRepositories`, `getBranchState`, `getStatus` (whether Git runs on this device), and
`replicateTick` (copy missing commits now). Shared branches
take precedence over maintainer tips, which take precedence over personal branches.
`getBranchState` also reports the last transfer's bytes, milliseconds, chunk size, source device (`holder`),
whether a chunk failed, and whether the transfer completed. `milliseconds` runs from asking
the source for the commits to having them here, so it includes Git's work at both ends;
`downloadMilliseconds` is the download alone. For a completed transfer, MiB/s is
`bytes / 1048576 / (milliseconds / 1000)`, or use `downloadMilliseconds` for the link's speed.

Before copying, a device asks for a direct connection to the source. When it can't get one,
the copy goes through other devices and is slower.

An interrupted copy leaves the published local branch view intact. A later attempt can copy
the missing history again. If a push reports **publication failed**, the commits remain in
your checkout. Fetch, merge any required tips, and push again. A refused shared-branch update
can be retried immediately. If a different failure leaves a push still publishing, wait up
to two minutes before retrying.
Do not treat that push as shared successfully.

## Current limits

This version supports SHA-1 repositories and branches under `refs/heads/`. Tags and SHA-256
repositories are not supported. A push accepts up to 128 branch updates and a pack of at most
1 GiB; branch ref names are limited to 1,024 UTF-8 bytes.

The Git package isn't installed by default yet. The PWA can't run this privileged package,
so a phone shows the Git screen without data.
