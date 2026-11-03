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
then push `trunk`. It starts as a shared branch with the repository's owner as its only
maintainer. Sharing creates an empty repository; your first push supplies its commits.
Your GitHub remote can stay in place alongside the Peers remote.

Another group member can clone it:

```bash
git clone peers://<groupId>/<repoId>
```

For a local development build, build and import `official-packages/git` using the normal
[package development workflow](../Packages/getting-started.md#importing-an-existing-package-directory).

## Shared branches

The repository's owner chooses which branches are shared and who maintains them. For example,
to let Alice and Bob both push `main`:

```bash
peers tools run setPolicy '{"repoId":"<repoId>","sharedRefs":[{"ref":"refs/heads/main","maintainers":["<aliceUserId>","<bobUserId>"],"threshold":1}]}' -c <groupId> --json
```

Use user ids, not display names. `getBranchState` lists the members' ids and branch prefixes.
`setPolicy` replaces the complete list of shared branches. Include the default branch every
time; it cannot be renamed this way. You can share up to 32 branches, each with up to 10
distinct maintainers who are current Writers or above. Shared names cannot overlap each
other or sit under a member's prefix.

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

### Offline forks

Two maintainers can push different commits while their devices are disconnected. With
threshold 1, once those updates meet, `main` moves back to their common ancestor and
`getBranchState` reports `forked`. Your checkout and each maintainer's prefixed tip keep the
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

Set `"threshold":2` in the policy above to require two maintainers' tips to contain a commit
before it lands. A push can succeed while `main` stays at its previous tip. `aheadOwners`
in `getBranchState` names maintainers whose tips contain work not yet on the shared branch.
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
`getBranchState`. Rename and push your branch from your
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
peers tools run adoptRepository '{"repoId":"<repoId>"}' -c <groupId> --json
```

This keeps the current Writers in each maintainer list, adds the adopter to any empty list,
and lowers thresholds where necessary. To choose a different policy, pass `sharedRefs` in
the same form as `setPolicy`. The governing adopter can then use `setPolicy` to change it.
An Admin cannot adopt while the owner is still a Writer. If the owner has lost every device,
demote or remove that identity from the group first.

`listRepositories` and `getBranchState` report `governedBy` (`owner`, `adoption`, or `frozen`),
`signerUserId`, and the governing `sharedRefs`. Only that signer can change the policy.
If Admins adopt independently while offline, check the governing signer after their devices
reconnect. An adopter who loses Admin access no longer governs; another current Admin's
adoption takes over if available, otherwise the owner's policy freezes again. If the owner
returns as a Writer, their policy governs again.

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

`getBranchState` shows current branches, branches awaiting commits (`pending-objects`), forks,
branches below their approval threshold, and name conflicts (`collision`). Shared branches
take precedence over maintainer tips, which take precedence over personal branches. It
also reports the last transfer's bytes, milliseconds, chunk size, source device (`holder`),
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

Default installation, a Git screen, and the Windows helper are still to come.
Windows desktop/headless hosts can run the package and replicate repositories. The PWA
cannot run this privileged package.
