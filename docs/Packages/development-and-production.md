---
sidebar_position: 3
title: Development and production groups
---

# Development and production groups

**Note** this is total AI slop and needs to be updated. It was just capturing the idea of
using a different group to do package development work in and when you promote that package
to "stable" the production/customer group will automatically pick it up.  It seems like
a really nice pattern.  To make it even better we need a way to do something like a db
restore from one group to another so it's easy to reset the dev environment to match prod.


Use a development group for an application's changing code and test data, and a separate
production group for customer work. Install the **same package identity** in both groups.
Each group has its own business records, membership, package settings, and version selection.
The source repository remains on the developer's filesystem; a group stores its package
versions and bundle files.

Signed releases can propagate from development to production automatically. This requires
explicit release configuration and an Admin device that can access both groups. A group
split alone does not configure deployment or protect a developer's production view from
local folder reloads. The setup and current limits below matter.

## Set up the two environments

1. Create a development group, such as **My App Dev**, and record both group IDs. Give it
   the membership appropriate for its test data. A production snapshot becomes accessible
   to the development group's members.
2. Install the existing package in development. Preserve its package ID, contract IDs,
   and publisher identity. Creating a second package with a similar name creates a different
   application, not another environment for the same one.
3. Build locally and reload **only the development group**, always specifying its context.
   Verify the reported running version after each reload.
4. Bootstrap production from an accepted, signed release. In Package Info, explicitly set
   **Following** to `stable` and **Auto-update range** to the intended range. Confirm the
   publisher public key through a trusted installation source. Save settings as an Admin.
5. Production devices should follow the production group's release and have no lingering
   dev selection. Clear a device override only after the group has a valid release selected.
   A device pin intentionally prevents automatic updates.

For example, after substituting the actual IDs:

```bash
peers packages install <packageId> --from <productionGroupId> -c <developmentGroupId>
npm run build
peers packages reload <packageId> -c <developmentGroupId>
peers packages get <packageId> -c <developmentGroupId> --json
```

Install copies package metadata and its selected version. It does **not** copy business
tables, customer attachments, or application variables. Installing an already-present
package re-enables it; it is not a command for replacing its selected version from another
group.

For an isolated package, use a host that supports isolated execution. Check the supported
desktop/runtime versions before making browser or mobile access part of customer acceptance.

## How a stable release reaches production

After testing and acceptance, promote the exact build in the development group. Promotion
can trigger production deployment; treat this as the release step, not a harmless label.
Check the promotion result's `signed` and `activated` fields and any warning.

Automatic cross-group propagation requires all of the following:

- The release has a valid publisher signature and is tagged beta or stable. Dev builds
  are excluded.
- The destination already has this package enabled, with Admin-approved package settings
  and the matching trusted publisher key.
- An online Peers host has both contexts available and its current user is an Admin in
  the destination. That host copies and approves the release for that destination;
  the development group's approval alone does not authorize production.
- Required bundle metadata and bytes are available. A source group is not a public release
  feed for unrelated customers. A signed release URL is an alternative distribution path.

Propagation copies package versions and bundle files. It does not copy application data.
Production selects a release when it is newer, matches its followed tags and version range,
and is not pinned. Beta releases can be copied into a stable-only group without becoming
active. Devices then resolve the approved group state according to their own preferences.
Check **both** the production group's selected version and each pilot device's running
version; successful promotion does not prove delivery or activation everywhere.

The release loop is:

1. Refresh development data through a reviewed snapshot process, then implement and test.
2. Test migration against the production schema and representative data, including offline
   operation and reports. Use beta for shared testing when appropriate.
3. Freeze the contract and release the accepted version as described in
   [Package lifecycle](./package-lifecycle).
4. Verify propagation, publisher approval, production selection, and actual execution on
   customer devices. Keep a recovery plan for the data as well as the package.
5. Increment the package version before further development. A package rollback does not
   undo data changes or schema migrations.

## Current setup caveats

These details were checked against the implementation on 2026-10-30. Rehearse the complete
release path on the host version you will deploy.

- **Save an explicit update policy.** The cross-group activation path treats a missing
  `versionFollowRange` as pinned, while other version-resolution paths can report `latest`.
  Do not rely on an unset field. Select the range and `stable` explicitly in Package Info.
- **Bootstrap from a release.** Copying a starter dev package between groups preserves its
  `packageVersionId`. Propagation skips replacing an existing version with that ID; promoting
  the source copy does not reliably update the destination's older dev copy. The same issue
  matters when a copied beta is later promoted under the same ID. Verify the destination's
  tag and contents rather than assuming re-tagging was propagated. The normal automatic
  path is a new, signed release version that the destination does not already contain.
- **Avoid production folder reloads.** Local source lookup can find a package folder through
  another group. Reloading a folder installs/selects its dev build on that device, including
  when invoked from the production context. **Reload packages on page refresh** can do the
  same for the active group. While developing on a host that also accesses production,
  disable that setting and use context-specific reloads; keep customer devices on releases
  without local source folders. Production should not begin as an explicitly selected dev
  version.

These are limits of the current deployment path, not reasons to merge production and test
data. They should be addressed or accounted for before calling this a one-click production
release process.

## Refreshing development data

A general production-to-development snapshot utility is still needed. Package installation
and release propagation do not provide one. A useful contract for that utility should:

- Take explicit source group, destination group, and package IDs; reject identical groups;
  check source read access and destination administration separately.
- Preview an allowlisted set of business tables, required application variables, related
  files, record counts, schema versions, and validation failures. Preserve record IDs where
  valid so relationships and repeat imports remain stable.
- Capture a consistent source boundary, or detect changes and require a retry. Finish
  source synchronization first. Paginate every table and verify attachment bytes by hash.
- Copy into a fresh rehearsal group by default. Replacing an existing development dataset
  needs a destination backup and an explicit replacement preview so prior experiments and
  deletion markers cannot silently mix with the new snapshot.
- Record provenance and progress, support interruption/retry, validate relationships, and
  reconcile totals and file hashes before marking the refresh complete. Allow masking
  sensitive fields and keep external notifications or integrations disabled for test data.

Do not clone identities, signing keys, membership/approval records, device preferences,
package release policy, or the entire `PersistentVariables` table. Re-create authority in
the destination and copy only the application state it actually needs. Data refresh runs
from production to development; releasing code never copies test edits back to production.

Until that utility exists, use a package-owned, validated export/import process. For an app
being ported from another framework, the initial legacy migration is a separate operation
from later Peers production-to-development refreshes.

## Related

- [System Packages](../System/Packages) — commands, permissions, and runtime status
- [Package lifecycle](./package-lifecycle) — promotion, follow settings, and contract freezing
- [Groups](../System/Groups) — membership and authority
- [Tables](../System/Tables) — data and synchronization behavior
