---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/claude2.md'
---
look at claude.md and injection.md for context

Currently consumers of the peers-sdk use persistentVars like so:

```typescript
import { myUserId, Users } from "peers-sdk";

function getMyUserObject() {
  const user = Users().get(myUserId());
  return user;
}
```
Note that this makes it very easy to start using peers-sdk. 

By switching to DI I think we'd have to rewrite the code to something like this

```typescript
import { myUserId, Users } from "peers-sdk";

function getMyUserObject(di: DIContainer) {
  const UsersInstance = di.get(Users);
  const myUserIdInstance = di.get(myUserId);
  const user = UsersInstance().get(myUserIdInstance());
  return user;
}
```

 Note that this new form is significantly harder to use.  Also the names being imported from `peers-sdk` don't make much sense so we'd probably want to change those too.  That will be a significant rewrite effort.  But what I like the least is how much harder it is for users of the package to start using it.  Is there a way we can allow users to set the DIContainer once and still write the code the original way?  Similar to how the `setTableFactory` works but for the entire library?  
 
 Write your response to injection2.md.  Keep it simple and concise.  
