The goal of this is to make it easy for users to find each other, connect (share user information), and invite (share group information).

If the users are already in each other's contacts they should just be able to DM each other group share information (DM capabilities still needs to be built but will be on top of sendDeviceMessage).

So the challenge is really finding and swapping user information (userId, publicKey, publicBoxKey, optionally deviceIds) in a secure but decentralized way.  

Let's think about the two different ways this will be done.  
- First way is in-person and we almost certainly want to use QR codes.
  - how to secure them?
- Second way will be remotely.  Let's assume some kind of third-party communication channel for now to keep things easy (e.g. Email, SMS, etc.) but eventually it would be nice if they could do this entirely inside Peers.


Okay, so let's start with the QR code,  That QR code should contain the user information (userId, publicKey, publicBoxKey), optional list of deviceIds.  

Sent as an email or SMS it could just be a URL and optionally a QR code image as well.  

That get's one person's information to another person but then the other person has to send their own back to the first person.  That seems pretty clunky.  

I wish we could just have them swap device ids with a code and then handle everything in `sendDeviceMessage` and response but deviceIds aren't easy to type out....  It would be ideal if it could be a 4 or 5 character "share/connect" code that expired after 10 minutes.  The question is, how do we implement that securely and performantly (not have to broadcast/flood all devices).


## Connecting 

This is about two user's devices finding each other and securely exchanging information without a separate communication channel (i.e. no email, sms, etc. - just Peers)

### Idea 

Device A puts itself into a special state - I'm connecting/sharing, send codes like XYZ to me.  And sends that to all devices it's directly connected to (and maybe one additional hop).  Essentially mapping XYZ code to deviceId temporarily.  

Then device B sends a "Connect/Receive" message with that code to all of the devices it's connected to.  And, optionally, it secures it with a private code.  This can be used by device A to verify the "Connect/Receive" is coming from the right device but this will require some out-of-band communication.  

This effectively gives very short-lived aliases for deviceIds purely to make it easy for two users to connect.  Once they are connected, they can securely communication any other information they want like DMs, sharing groups, etc.   

#### Implementation Steps

- Add ability for one device to broadcast a short-lived deviceId alias.
  - Other devices (direct + one hop) will store that for a period of time (let's say keep it simple with 10 minutes)
  - for security reasons we should ensure these aliases are _not_ other deviceIds.  They should be relatively short and easy to communicate via voice or text.  
    - I'm thinking 6 chars (1 pair of 3, e.g.: ABC-ZYZ) from Crockford’s Base32 (the gold standard here): 0123456789ABCDEFGHJKMNPQRSTVWXYZ

- Build "Connect & Share" screen
  - User hit's "Connect & Share" (or whatever is the right language for this)
  - Device generates the 6 digit code
  - sends a special `deviceAlias = 'ABCXYZ'` message (other devices automatically expire that in 10 minutes)
  - Code is displayed to the user along who then communicates that to another user (either verbally, sms, email, etc)
  - second user navigates to the same screen and in a _different_ box enters the first user's code
    - this will generate _another_ 6 character code 
    - this will send a message via `sendDeviceMessage` to `deviceId: ABCXYZ` and intermediate devices will translate that to the right deviceId if they have the alias entry.  

  
## Group Invite

This is about one user inviting another user to a join a group.  If the user's are already connected, this shouldn't be a problem.

The tricky part comes in when one user wants to use something like email to send an invitation to another user who isn't already a connection in Peers.

It will probably be common for one user to want to invite many users at once to a group.  In the early days of Peers, growth / adoption will be much better if it's as easy as possible for one person to say, "Hey, let's user a Peers group for this", then go create the group, share an invite link via email (or some established communication channel), and the other people can just click on that link and go all they way from being not a Peers users to being setup and having joined the group with minimal effort.


# Fundamentals

this is effectively a rendezvous + shared secret
- we'll meet at this address
- this will be the shared secret we can use to identify each other

So two pieces of information need to be shared that are as human-friendly as possible but still provide acceptable security.
- A unique enough id for other devices to assist in connecting the two devices in question
- A shared secret that can be used to encrypt the message so the process can't be hijacked 

We might as well just keep going with our current approach, we just need more characters.  And maybe we can use less for the rendezvous code?  4?  Then 6 for the shared secret? What's the best UX while staying secure? Assume a timeout of 10 minutes but we only accept the first device. 

Let's use a total of 12 characters, 4 for the rendezvous code, 8 for the shared secret.  Just show it as a single string though: ABCD-EFGH-JKMN.  Users don't need to be concerned with the underlying details

So, we need
- screen with button to say "Connect to new User" -> initiate or answer -> initiate
- push button -> generate code -> broadcast device alias (first 4 chars <-> deviceId) -> display 12 char code on screen
- second user (same screen) -> "Connect to new user" -> initiate or answer -> answer
- push button -> enter code -> encrypts user info (userId, publicKey, publicBoxKey, deviceId) -> sends to rendezvous code
- first device receives message (hopefully, not guaranteed) -> decrypts user info -> send response (encrypted user info to deviceId (we have that now))
- second device receives response -> decrypts 
- both devices hash both users' information and show the first (or last) 4 digits on the screen so they can confirm that both have the same information
  

