OpenAI is talking about releasing it's Agents framework soon.  Their big concern is apparently around leaking sensitive information.  For that to be a problem it implies that *other* people can interact with your agents.  

I think Peers does a good job separating out agents and tools.  And the concept of `Variables` (some of which can be secret) is a wonderfully elegant solution in my opinion (although I still need to do the work to add a permissions and approval structure and mask the values from logs and results but the structure is all there).  The agent could be completely malicious but just can't gain access to secret values, much less leak them.  (TODO don't allow direct access , queries or otherwise, to the `persistent-vars` table.  Also that table could be named better...)

Speaking of tools, I'm not sure how OpenAI is going to deal with tools that need local access.  Seems like they are going to try to build an entire cloud infrastructure for tools that are effectively API calls to other systems.  This will back up into the same issue we have now with cloud infrastructure where getting anything done requires 6 weeks of classes on how to stand up and operate all that cloud infrastructure (and getting it secured correctly is a constant challenge).  

Peers' approach feels so much more intuitive, natural, and easy.  Everything runs on *your* machines.  If you want to spin up a VM in the cloud and add that to your personal group of devices, totally fine.  But that's all at the device level and can easily be done after iterating on  ad-hoc work locally.

The next question is around how different users' and groups' agents will discover and communicate with each other.  Conceptually this should be no different than discovering and using traditional APIs.  Since Peers' concept of tools+variables already perfectly covers API wrappers, this is, again, elegantly solved.  For OpenAI, they are going to be getting hammered by basic things like DDOS attacks, as will all centralized infrastructure, leaving customers exposed to non-robust architectures where an active internet connection + routers + OpenAI data-centers all need to work perfectly for everyone to be operational.  This is going to add even more pressure on small businesses who can't easily absorb the cost of a technical team to standup and operate all of this cloud-based technology efficiently.   Thereby continuing to push the world to a state of a few supersized businesses and slowly (or maybe quickly) choke out the small businesses.  This is not the world we want to live in.  

 

Issues

- How do you do ad-hoc, local processing in OpenAI?
    - With OpenAI this might not be too hard but "publishing" that work could be *very* hard.
- How do individuals and businesses expose their Agents to be able to discover and interact with each other?
    - I.e. I need a plumber to fix my broken pipe -> my assistant finds a local plumber, if they have their own Assistant, communicate directly with it, otherwise try to use their website or call them.  
- Most/all users and businesses will become dangerously dependent on OpenAI's infrastructure.  

 

 

 

 

 


 
