# Rejection Reason

This was overly complicating the actual goal of adding the ability to define workflows that are available as external calls (RPC, CLI, etc.).  It was rejected in favor of the "receiver" concept.

This means we currently aren't trying to support HTTP calls out of the box.  This is good since we don't actually have a need for that at present, it can be built as an addon/package, and if we tried to support it, it could end up overlying influencing how this was implemented.  This is strictly a mechanism to expose specific workflows to external systems.


# Proposal

I want to add a new top-level concept to peers of a "Router".  But I want to think carefully about how this will work and how it will fit in with peers.  I think it's likely that this will replace the concept of top-level events (i.e. peer-events, peer-event-types, and peer-event-handlers).  Those haven't really turned out to be useful as peer-to-peer concepts.  There is too much confusion and complexity around which peers handle and event, when, why, etc.  And where and why they used is questionable.  If there is a need for a distributed pub-sub type mechanisms that can be built on top of our existing primitives but, now that Peers is almost fully functional it's apparent that it isn't solving a first-class problem/need.

A router on the other hand is clearly needed for things like implementing a CLI, remote calls via sendDeviceMessage, local and remote web clients, and other kinds of APIs that users might want to implement.

Also the concept of routers are well understood, should be easy to implement and reason about, and we've already demonstrated its feasibility and usefulness with the UI router (ui-router, ui-loader, etc.).

To fully replace the current peer-events concept we'll also need to implement a Scheduler.  But that can be done separately and can be extended or completely replaced by users if they want, which, by itself, demonstrates that a Router is the more elegant design.  Adding a scheduler to call routes (or just workflows directly) on a specified interval should be very easy to add later now that we're not trying to shoe-horn it into events. 

Let's get started thinking about how we'll implement a data-driven router.  Reference cli.md doc in addition to this but don't let it influence you too much.  A CLI interface is just another thing this will enable.  Also maybe our current rpc-types can be replace with this (probably not but keep it in mind) as well as the IPC calls we have in Electron and React-native.  Also keep in mind how we're doing UI routing for choosing the right component to handle a specific route.  The key thing there is that we are keeping components loosely coupled to a specific route.  I.e. we don't say "this component maps to this route", instead we say, "first find all components that _can_ handle this route, then narrow them down until we have just one".  So this is more of a pattern matching concept.  I think we'll also want to support "middleware" so handlers have the option of processing the route+payload but instead of returning back to the caller can indicate that it should be passed to additional handlers.  At the same time we want this to be performant.  I think we should start of by having all route handlers be workflows to keep things simple but we may want some handlers to be direct tool calls for performance and special cases. 

Coming back to events: Currently, in code, we can register event listeners to table writes (CUD - Create, Update, Delete) and this has proven to be an _incredibly_ useful, flexible, and scalable concept. But it requires having to add or update code and also have a direct reference to the Table object. How can we allow users to configure some action based on a CUD event without having to add or modify code? Also, I think we want to add blocking pre-write handlers for special validation and mutations. 


So we've identified three things to build
1. Router - this is the new top-level, first-class concept we need to build into Peers.
2. Scheduler - this should just call a workflow on some CRON schedule.  
3. DataEventHandler - not to be confused with the existing Peer Events concepts, this should allow users to register pre and post hooks that can be run when a table write (and maybe a table read) occurs.  I think these should/need to be direct tool calls.  This concept of "Do this when data is about to change (or has changed)" has proven to be incredibly useful and a key concept in Peers so it should be made a top-level, data-driven feature if possible, and will probably give us the functionality and patterns we were originally hoping for with the peer-event concepts

Don't worry about the second two for now.  Just worry about the Router.  I just wanted to mention the other two so you have the full vision of where we're going.  

Another thing we should keep in mind is how a Router functions in a group with multiple peers.  What does it do when there is just two or 3 and what does it do when there are hundreds.  Can we use the Router to enable a "Cluster" of peers to spread load around?  Can routes be configured to be handled by specific peer devices?  Can that be both hard-coded and dynamic?  Can that enable sharding of the data?  What happens when another peer or a client calls a route that should be handled by a different device? 

Again, don't worry too much about that to start off with but keep it in mind.  

As a sanity check, I implemented the current peers-events system because I've found SNS+SQS to be so incredibly useful in building traditional cloud software.  I thought the peer-events system was mirroring that but I think that was a bad pattern to be going for since it requires centralization (someone has to "own" the event and someone has to "own" the queue(s)), so it's antithetical to Peers and a complete mismatch of systems.  But think about this carefully and tell me if I'm losing key functionality because I don't want to address how to adapt this to Peers.  Start by answering this.  


# Additional Notes

We're going to need an authentication mechanism which means we're going to have to know who the caller is.  But we can't always rely on a prior handshake to have verified user/device so we'll need to accept either a deviceId (which we will assume has been verified) or a token (which should map back to a device or user).  I would prefer this logic to be ouside this to keep things simple but I think `findMatchingRoute` will need that information to narrow down the handlers.  E.g. we might have a route map to one handler for privlaged users and another handler for normal users and no route for unknown users.

Finally, I see you left off HTTP verbs like GET, POST, PUT, etc.  I think this is correct but we need to think about how this will work in the context of http.  Will all calls be a POST?  And we also need to think about how we would differentiate between `GET /task/id` and `PUT /task/id`.  Without verbs we have to have two different routes.  Maybe that's okay but this makes me want to step back and think about what we're trying to do.

Really this is all supposed to boil down to remote calls for workflows.  Maybe a router concept is over complicating this?  

What we're really trying to build is a way for users to configure which workflows can be called remotely and by which users.  Let's switch from "Routers" to "Receivers".  A Receiver is a configuration for a workflow that can be called remotely with optional authentication and authorization logic. 