# Channels and Groups

## Default Channel

Every group has an implicit "default channel" — its `channelId` is simply the group's `groupId`. No explicit `Channel` record needs to be created for this to work.

The `channelId` field on messages is flexible and accepts:

- A **channelId** (from the Channels table, for explicitly created channels)
- A **groupId** (the default channel for that group)
- A **userId** (for the user's personal channel)

### Personal Group

Each user has a personal group whose `groupId` is their `userId`. The default channel for a user's personal group is therefore also their `userId`.

| Context | groupId | Default channelId |
|---|---|---|
| User's personal group | `userId` | `userId` |
| Shared group | `groupId` | `groupId` |
| Explicit channel | `groupId` | `channelId` (from Channels table) |

### Code Examples

`channel-view.tsx` falls back to the active group ID when no channel is specified:

```typescript
let channelId = props.channelId || currentlyActiveGroupId();
```

`sendMessage()` in `peers-sdk/src/data/messages.ts` resolves the channel by checking in order: message (thread), channel record, user record — and accepts any of these as a valid `channelId`:

```typescript
const channel = await Channels().get(channelOrThreadIdOrWorkflowRunId);
if (!channel) {
  const user = await Users().get(channelOrThreadIdOrWorkflowRunId);
  if (!user) {
    throw new Error(`Channel ${channelOrThreadIdOrWorkflowRunId} not found. A channel must be a valid channelId or userId or groupId.`);
  }
}
```

`workflow-runs.ts` similarly falls back to `group.groupId` as the channel when no explicit channel is found:

```typescript
const group = await Groups().get(args.parentMessageIdOrChannelIdOrGroupId);
if (!group) {
  throw new Error(`Message, channel, or group ${...} not found`);
}
channelId = group.groupId;
```

### Summary

When sending messages to a group's default channel, use the `groupId` as the `channelId`. No channel creation step is needed. Explicit `Channel` records are only required when a group needs multiple named channels.
