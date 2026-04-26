Let's say you have connections to several peers and you're curious about how those peers are all connected to each other.  You can send a "trace-ping" to one peer with an array of objects that includes the peer's device id and timestamp it was put there.  This represents the hops.  Initially it just has yours.  The one peer pushes their id and timestamp onto the array and then forwards the "ping" to all of it's connections.  There will be a TTL of course that can be both time and number of hops.

Gather up all of the responses from all your different peers.  You can determine a few things

- Are there any peers who you are the sole link between that peer and the one you initially pinged.  
    - You know this if you didn't receive a copy of your ping through them.  
    - If this is the case then you want to maintain that connection for the sake of a robust network.  This essentially makes you a hub for that peer to the other peers.
- You can determine the "density" of connections among your different peers. 
    - If some peers show up on many of the traces and very early in the hops then you can consider those peers as hubs.
- If there are many peers connected *only* through a single hub.
    - This indicates a weak point in the network and another peer should be elected as a backup hub.  

This should allow us to quickly determine who are hubs and prioritize connections to them as well as maintain a healthy number of hubs.  If there are too many hubs, consolidate some.  If there are too few hubs, create some new ones. 

 

Ideally there should probably be three hubs for every peer.  

1. Main hub (whoever is most performant)
2. Secondary hub (whoever is second most performant)
3. Remote hub (most performant on different network than main hub and secondary hub)

This should help ensure peer networks stay as performant as possible but also as distributed as possible.  

 

Problems

- Some peers could intentionally not forward the ping thereby giving you incomplete information
    - This could be counteracted by peers including information about their direct connections.  So discrepancies could be detected. 
