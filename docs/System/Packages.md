---
sidebar_position: 4
title: Packages
---

# Packages

Packages are the units Peers installs, runs, and administers. A package is installed
into a data context: your personal context or a group. Its `Packages` and
`PackageVersions` rows sync to every member device, and each device loads the selected
version on its own. When synced rows arrive, a device restarts a package only if the version
or bundle it should run changed; otherwise the running worker keeps serving calls, and a
promotion updates the reported tag and isolated contract maturity without restarting the
worker. Promoting to stable freezes those contract shapes, so later dev builds must use a
new contract version to change them.

You administer packages from the **Packages** screen, from `peers packages`, or from any
local client of the **System Packages** contract. All three use the same contract, so they
behave the same way and are checked against the same access levels. To build a package,
start with [Getting started](../Packages/getting-started.md).

## Quick reference

```bash
peers packages                              # list packages and their status on this device
peers packages get <packageId>              # versions, runtime state, last load error
peers packages import ./my-package          # import a built package folder
peers packages import https://github.com/org/pkg.git   # clone, build, import
peers packages create "My Package"          # scaffold from the template
peers packages reload <packageId>           # rebuild from the folder, reload here
peers packages reload --all                 # re-read every package folder on this device
peers packages activate <packageId> <packageVersionId>  # run a version on this device
peers packages activate <packageId>         # drop the device override; follow the group
peers packages activate <packageId> <packageVersionId> --group  # set the group's version
peers packages promote <packageVersionId> beta           # dev -> beta (or stable)
peers packages install <packageId> --from personal       # copy a package into a group
peers packages uninstall <packageId>        # remove it from the context
peers packages defaults                     # install the default packages
peers packages capabilities                 # what this host supports
```

Add `-c <groupId>` to work in a group. The default is your personal context. Add `--json`
for machine-readable output: `list` prints one JSON object per line, and every other
command prints one object. `get` returns the same shape as the `getPackage` tool below, and
`promote` prints the whole `promotePackageVersion` result, including `signed` and
`activated`. Version ids come from `get`. With `--json`, app-startup progress goes to stderr
so stdout stays parseable even when the desktop app needs to be started first.

Exit code `0` means the operation succeeded. `1` means it failed. That includes an enabled
package that failed to load after import, create, clone, install, activation, or reload,
including missing bundles and unsupported execution modes, and `reload --all` when any
package failed. Errors go to stderr. A deliberately disabled package may be imported or
cloned successfully without running it. A `promote` whose automatic activation fails to
load also exits `1`, but the promotion itself is kept and the error starts with
`Promoted ...`; do not retry it. Check `peers packages get`.

`reload --all` cannot be combined with a package id. Folder arguments, including folders
whose names end in `.git`, are resolved against the CLI's working directory; `~/` means your
home folder, and other `~user` paths are rejected. Cloning accepts HTTP(S) URLs and
`git@host:owner/repo` remotes; shell syntax and `.` or `..` path segments are rejected. An
existing folder wins over a remote with the same spelling. The Packages screen's search box
routes input the same way: a URL clones, a package id installs, anything else creates or
imports a local package.

Contract calls have no timeout, and `create` and `import <url>` run `npm install` and
`npm run build`. If you stop the CLI partway through, the outcome is unknown. Check
`peers packages get` before retrying.

## Requested and observed state

Each package summary has two parts.

**`requested`**: what this device *should* run.

- `groupActivePackageVersionId`: the group's version.
- `deviceActivePackageVersionId`: this device's override, when one is set.
- `effectivePackageVersionId`, `version`, and `versionTag`: what results from the two.
- `pinned`, `followRange`, and `followTags`: the version-follow policy.

**`runtime`**: what this device *is actually running*, observed by the package loader.

| `runtime.status` | Meaning |
|---|---|
| `running` | The selected version loaded and is serving. |
| `failed` | The last load failed. `runtime.running` still names the previous version when it kept serving. |
| `unavailable` | The selected version's bundle has not reached this device yet (usually still syncing). |
| `unsupported` | This host cannot run the package, for example an isolated package on a host without an isolated runtime. |
| `disabled` | The package is disabled for the group. |
| `unloaded` | The package was unloaded or uninstalled, or the only selected version is a dev version this device has not activated (`reason` says so). |
| `notLoaded` | A version is selected, but this device has not tried to load it. |
| `inactive` | No version is selected yet. |

The other runtime fields:

- `running`: the version that is serving. Gives `packageVersionId`, `version`,
  `versionTag`, `kind` (`isolated`, `contract`, or `legacy`), and `executionMode`. For
  isolated packages it also gives `provides` and `consumes`, and each `consumes` entry
  says whether a provider was found (`satisfied`).
- `lastError`: the most recent load failure. Gives `phase`, `message`, `version`, and
  `at`, and is cleared by the next successful load.
- `worker`: isolated worker health, `workerRunning` plus `lastWorkerError`. Isolated
  workers start on the first tool call, so a provider that throws while starting shows up
  only after a call has failed. An unexpected worker exit also updates health immediately,
  including an exit while idle. A tool call that times out is rejected and the worker keeps
  running; only if the worker then misses a liveness check (its event loop is stuck) is it
  stopped, with the timeout recorded as the worker error. A successful worker restart clears
  the worker error.

Runtime state is in memory. It describes the current process and starts again when Peers
restarts, which reloads every package anyway. The Packages screen shows the status as a
badge, and package details show the running version and the last error.

### Diagnosing a broken package

1. `peers packages get <packageId> --json`, then read `runtime.status`,
   `runtime.lastError`, and `runtime.worker.lastWorkerError`.
2. Fix the package and rebuild it (`npm run build`).
3. `peers packages reload <packageId>`. It exits `0` once the new version is running.

A failed reload leaves the previous version serving: the old worker keeps answering
calls until a replacement loads successfully.

## Operations

| Operation | What it does |
|---|---|
| Import | Registers an existing package folder, stores its path on this device, and installs its dev version. The folder must exist; import never scaffolds. Importing (or creating or cloning) on a device runs the folder's dev build on that device, even when another device already stored the same build. |
| Create | Scaffolds a new package from the template, or imports the folder if it already exists. A folder to scaffold may use only letters, digits, and `. _ - @ + ~ / \ :`, because the template step passes it to a shell. |
| Clone | Clones a git repository, builds it, and imports it. Repositories outside `github.com/peers-app` start disabled; enable one with `peers packages install <packageId>`. |
| Install | Re-enables a disabled package, or copies one into this context from another of your contexts, then loads it. On the Packages screen, enter the package id in the search box. Fails with the load error if the package does not run; it stays installed. Installing is an explicit choice on this device: when the selected version is dev, it becomes this device's own selection, and other devices still have to activate it themselves. |
| Activate | Selects a version for this device, or for the whole group with `scope: group`, then loads that exact version immediately. Explicit activation preserves the device's pin policy and clears any automatic compatibility fallback; later automatic resolution still uses the follow policy. Device scope with no version clears the override, so the device follows the group again. Fails with the load error if the selected version does not run; the selection is kept. A dev version can only be activated for this device; group scope refuses it, because dev builds never run on other devices until promoted. |
| Reload | Rebuilds the dev version from the package folder when the bundles changed, then reloads the package on this device even when nothing changed. Fails, with the load error, if the result does not run. The broken build is still saved as the dev version while the previous code keeps running here, so status shows `failed` with the old `running` version until a reload succeeds ([details](../Packages/package-lifecycle.md)). When the rebuilt dev version reuses a version number that is already beta or stable, the result carries a `warning` (printed to stderr by the CLI): bump `version` in `package.json` so dev is always the next version. |
| Reload all | Re-reads every enabled package folder on this device and reloads the packages whose bundles changed. The UI runs this on page load while **Reload packages on page refresh** is on. |
| Uninstall | Deletes the `Packages` row for the whole context, so every member device unloads the package. Unloads it on this device immediately. Version rows, bundle files, device preferences, and the signing key are kept, so a later import keeps the same identity. |
| Promote | Moves a stored version from `dev` to `beta` or `stable`, or from `beta` to `stable`; it never demotes. Re-tags the version, re-signs it with the package author key when this device has one (otherwise it is saved unsigned, with a warning, and a signature for the old tag is never kept), and appends `promoted:<tag>` to its history. Only the stored version's own fields are signed. When this device was running that version, the group is not pinned, and the group follows the new tag (default `stable`), the version is also activated: for the group, or only on this device when it overrides group settings. If that activation fails to load, the promotion is kept and the error says so. The Versions screen's **Promote** uses the same tool. Promotion refuses a build whose version number another build already holds as beta or stable; bump the version, rebuild, reload, and promote the new build. |
| Install defaults | Installs the default packages into the context. The UI and the `create-group` tool call it for every new group. |

## Who can release a version

In a group, every member's device runs the version the group selects, so only an Admin can
choose it:

- A Writer can add a package without selecting a group version and store dev builds. A dev
  build runs only on a device that activates it while it is tagged dev; automatic updates
  never switch from a release to dev, even when following all tags.
- Promoting a version to beta or stable, and selecting it for the group, needs an Admin. So does
  changing a package's update settings (follow range, followed tags, update URL, publisher key,
  repository, disabled).
- An approval applies to the group where it was signed. Copying a release into another group
  requires approval there, even when the same person administers both groups.
- An Admin's device installs updates from a package's update URL, or copies in a release from
  another of your groups, only for a package an Admin added or last saved. If a Writer added
  the package, an Admin saves its settings once to turn automatic updates on.
  Copying releases between contexts also requires a publisher key already trusted in the
  destination. A missing publisher key is not filled from another group's package settings;
  install from the publisher's release source to establish it.
- An unauthorized release or group selection appears in **Sync recovery** as
  *Parked, not authorized*. The device keeps running the version it had.
- peers-core releases signed by the Peers publisher are accepted from any member, since every
  device installs the bundled release.

Removing a package or version does not let an older approval replace a newer decision that
this device already received. Reinstalling requires a fresh signature from someone allowed
to approve that package or version.

If an existing dev selection stops loading after an update, activate that dev build again on
that device. If a release fails verification, reinstall an approved release or ask an Admin
for a new release. If the group's selection lacks an Admin's approval, ask an Admin to select
an approved version again. You can also activate an approved release just for this device.

## Administering your other devices

Add `--device <deviceId>` to any `peers packages` command to run it on another of your
devices instead of this one. Your local host forwards the call over the existing
connection, and the target device runs it with its own folders, signing keys, and runtime,
so `get` and `list` show that device's running versions and errors, and `activate` without
`--group` selects a version for that device. Find device ids with `peers devices`.

```bash
peers packages list --device <deviceId>
peers packages activate <packageId> <packageVersionId> --device <deviceId> -c <groupId>
peers packages reload <packageId> --device <deviceId>
```

- The target device must trust the caller as **Self** (see [Trust](./Trust.md)): another
  device of your own account, or an account you have explicitly granted Self trust. Anyone
  else, including group Admins, is refused: "Device … does not trust this account as Self".
  An older device that does not accept remote package administration says so.
- Folder arguments (`import`, `create --location`) must be absolute or `~/` paths on the
  target device; this shell's working directory means nothing there.
- Tools only: the live `runtimeStates` observable does not cross devices, so poll `get`.
- Without `-c`, the command runs in the target device's own personal context, where a
  Self-trusted caller has full access. Another account's device (a shared hub that trusts
  you as Self) is reached this way over a direct connection, for example on the same
  network; otherwise the call fails with a routing or unavailable-context error. With `-c <groupId>`, the
  call travels through that group and access is checked against your role in it on the
  target device.

## System Packages contract

**System Packages** (`packagesContractId`, version 1) is a system contract.

- **Local, plus your own devices.** Reachable over the UI and CLI host transport. Another
  device may call it only if this device trusts that caller as Self (see
  [Administering your other devices](#administering-your-other-devices)); every other remote
  caller is refused, group Admins included. This is the ordinary rule for contract tools
  without a `remoteAccessLevel`, the same one System App Updates uses.
- **Not for packages.** It refuses calls that come from package code, and a device refuses
  to forward a package's call to it on another device (see
  [Trust](./Trust.md#code-you-run-does-not-get-your-self)).
- **Not for workflows or Assistants.** It is not callable from either.

Every call is bound to one data context, and the access level is checked against your
role in that context. In your personal context you are Self, so every tool is allowed.

| Tool | Access level | Notes |
|---|---|---|
| `getCapabilities` | Reader (20) | `{ fileSystem, linkRemote, installDefaults, isolatedRuntime }` |
| `listPackages` | Reader (20) | Summaries, sorted by name. |
| `getPackage` | Reader (20) | Summary plus `versions` (newest first) and `localPath`. Throws when the package is not installed. |
| `importPackage` | Admin (60) | `{ path, name? }`. `path` must be absolute or start with `~`. |
| `createPackage` | Admin (60) | `{ name, location? }`. Returns `created` and an optional `warning`. |
| `clonePackage` | Admin (60) | `{ url }` |
| `installPackage` | Admin (60) | `{ packageId, fromDataContextId? }` |
| `activatePackageVersion` | Reader (20) | `{ packageId, packageVersionId?, scope? }`. Group scope also needs Admin, enforced when the `Packages` row is signed. |
| `reloadPackage` | Writer (40) | `{ packageId }`. Writers may update dev versions. |
| `reloadAllPackages` | Writer (40) | Returns `{ skipped?, results: [{ packageId, name, ok, changed?, error? }] }`. |
| `linkRemoteRepo` | Admin (60) | Desktop only. Creates a private GitHub repository with `gh`. |
| `uninstallPackage` | Admin (60) | `{ packageId }` returns `{ packageId, removed }`. |
| `promotePackageVersion` | Admin (60) | `{ packageVersionId, versionTag }` returns `{ packageId, packageVersionId, version, versionTag, signed, activated, warning?, package }`. See Promote above. |
| `installDefaultPackages` | Admin (60) | `{ installed }` |

The tools that add or change a package return
`{ packageId, created?, warning?, package }`, where `package` is the same as `getPackage`.
Legacy versions with a missing or empty release tag are treated as `dev` for promotion
and activation scope, matching the Versions screen: they can only be activated on this
device until promoted.
The `runtimeStates` observable streams this device's runtime state for the context's
packages, keyed by package id, including worker startup and failure changes. Mutating tools
are serialized within each context, including bulk reloads and uninstalls.

### Host support

Every host provides every tool. A host that cannot perform one throws
`System Packages <tool> is not supported on this host (<reason>)`. `getCapabilities`
reports support up front.

| Host | `fileSystem` | `linkRemote` | `installDefaults` | `isolatedRuntime` |
|---|---|---|---|---|
| Desktop (Electron) | yes | yes | yes | yes |
| Headless | yes | no | yes | yes |
| PWA | no | no | yes | no |

On the PWA, import, create, clone, and reload from disk are unavailable. Reading,
activating, and uninstalling still work. A CLI talking to an older host without System
Packages reports that the host does not support package administration.

## Related

- [Getting started](../Packages/getting-started.md): create, import, and build a package.
- [Package lifecycle](../Packages/package-lifecycle.md): versions, channels, promotion, and permissions.
- [CLI](CLI.md): every `peers` command.
- [Tools](Tools.md): access levels and how contract tools are called.
