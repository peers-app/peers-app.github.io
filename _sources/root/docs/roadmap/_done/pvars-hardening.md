
There is an issue with pvars (persistent variables) where two instances of a variable can end up in a infinite update loop if two updates to are set fast enough.  

pvar1 updates value -> writes to db -> notifies of updates -> pvar2 gets event, updates value 
pvar2 updates value -> writes to db -> notifies of updates -> pvar1 gets event, updates value

It's pretty rare since I almost never see it but I know it happens and I want to fix it.  Since it's very rare it's hard to recreate.  Ideally we could write a test to recreate it and then prove our fix(es) worked.

I think there are two things we should do to start with
1. ✅ **DONE** Return the same pvar instance when two different calls are made to create the same pvar in the same process.
   - Implemented singleton pattern with WeakMap cache keyed by UserContext
   - Cache key includes scope, name, and dataContext (for group-scoped vars)
   - Test isolation preserved (each UserContext has its own cache)
   
2. Have the pvar track the value write time and if the db event it gets has an older value, ignore it (last write wins).
