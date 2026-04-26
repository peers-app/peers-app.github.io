Blockchains (aka cryptocurrency) key concepts

1. Identity and authentication is done via Public-Private key pairs
2. Data is stored as a "chain" of Merkle Trees - each block contains the top-level hash of the previous block's Merkle Tree hash
3. Gossip protocols to keep nodes in sync
4. All information is known to all peers
5. Majority Rules - when there is disagreement, what the majority says is what's considered true

 

Comments

1. It is great that the user controls their identity but if you lose your private key, you're done - totally locked out of your account and can't recover.
2. This unique data structure is interesting but mostly just to facilitate efficient verification of the data without having to trust any individual nodes. I.e. this is how it's "trustless".
3. It's cool that this seems to scale reasonably well.  But I think something like Skype's concept of "super nodes" can make this more efficient.  Intelligently determine which nodes are best able to act as "hubs" prioritize sending information to them.  
4. This is simply bad for many applications - no privacy and doesn't scale well.  Additionally it creates a system that isn't resilient to widespread disruptions from things like wars and natural disasters. 
5. While this has been working well so far, it's terrible in theory.  Pure democracy leading to tyranny of the masses is a well-known problem.  It's even worse in this case since a bad actor with enough resources can gain access to 51% of the nodes and assert whatever they want.  So you have to worry about tyranny of the masses *and* tyranny of the rich. 

 

Key things Peers does different (problems it is trying to address)

- Separate a user's identity from their keys
    - Let the user specify multiple public places (as many as they'd like) where they publish their public key.  This lets them retain as much (or as little) control over their keys as they'd like and still allows them to recover their account in the event of key loss or even their keys being stolen.  If the logic to update a user's account requires that a majority of public locations are updated with the new key, then someone with stollen keys can't lock the owner out without also gaining access to the majority of their public key locations.  
- Don't try to remove trust from the system
    - Blockchains are famously referred to as "trustless".  What this actually means is that you trust the system, not individuals.  The issue with this is that, as stated above, it prevents privacy and provides an exceptionally large lever for would-be tyrants.  Peers takes the opposite approach in that it makes trust an explicit part of the system.  You decide which users you trust the most.  This allows users to self-organize into hierarchies of their choosing.  They can't control who trusts them but they can control who they trust - and they can adjust this whenever they'd like.  
- Centralized vs Decentralized
    - If there is any kind of large-scale disruption to the internet, blockchains will not work correctly because they rely on knowing all the data and the majority of the participants.  While blockchains are an improvement from a "central authority", they just move things to a "central system" (which is actually just another central authority). Peers takes issue with this new type of centralization.  Peers' goal is to build a system that works just as well with one computer, or a few computers networked locally, as it does with a global network.  Peers' goal is true decentralization in that it will continue to work even if the bombs drop and everything else goes off-line.  
- Blast radius of inherent vulnerabilities
    - With blockchains the inherent vulnerability is the 51% attack which can affect *all* users.  So it has a huge blast radius.  Peers does not have this vulnerability.  The inherent vulnerability of Peers is that if a majority of your trusted sources gets rapidly compromised then *your* group(s) can get taken over.  And, while this is practically easier (you just need to compromise a small number of accounts simultaneously), it's technically more secure than the 51% attack which can be done without having to compromise any accounts.  In a perfect world where everyone keeps their keys secure, Peers doesn't have a built-in vulnerability like the 51% attack.  Additionally, in Peers if some number of accounts get compromised that have nothing to do with you, it won't affect you, so the blast radius of the vulnerability is substantially smaller.  Again, if the 51% attack happened on a blockchain then you can be completely wiped out even if you did everything correctly.  

 

 

 

 

 


 
