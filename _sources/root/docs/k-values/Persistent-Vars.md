**Uses**

1. User-specific variable

    - e.g. `userId`, `deviceId`, 
    - Store in personal db
    - Doesn't have to be reloaded when active group changes

2. Group-specific variable

    - e.g. `OPEN_AI_API_TOKEN`, `serverAddresses`, 
    - Store in group db
    - has to either be locked to a specific data context
    - or has to be reloaded when active group changes

3. Group specific variable that is "per user"

    - store in user db
        - For privacy and to prevent group db bloat (particularly for users with read-only access and large groups)
    - name = `${name}_${groupId}` 
        - Potentially open to collisions but mostly only if done intentionally 
        - We could require users to just do this themselves but it could be easy to mess if up the don't configure it correctly to be locked to the groupId

 

- It seems best to have global functions for these three types of persistent variables
    - `userVar` - locked to userDataContext
    - `groupVar` - locked groupDataContext and can follow active group, same value for all users in the group
    - `groupUserVar` - locked to userDataContext and can follow active group, individual to each user in the group
    - *all* of these will save to user's personal DB
    - This is all in addition to "device specific" (whether or not it will sync to the user's other devices)
        - for `groupPersistentVar` if it is device specific it's a `groupUserPersistentVar` as a side-effect :thinking hmmm
        - So can we just have `deviceVar` ?
