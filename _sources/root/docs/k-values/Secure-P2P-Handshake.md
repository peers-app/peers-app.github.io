- The core mechanism will be for both parties to prove they are who they say they are by signing some random token that the other party sends them.  
- The only pitfall is if a third party is acting as a man-in-the-middle and forwarding the requests back and forth, thereby becoming authenticated without having the actual keys.

Ideas to prevent man-in-the-middle (MITM)

- Use an asymmetric signing scheme
    - The MIM will be a client to the server and a server to the client
    - It won't be able to provide the server... (no MITM, it'll just forward the proof from the server)
- Use the connection id
    - socket.io has the same connection id for the client and server
    - can the MIM force a particular connection id for both parties? 
        - for socket.io the server determines the connection id so a MITM can accept the server connection id and then force that for its connection to the client
- Using server address and client ip address
    - Both the client and the server should know their addresses.  By including both addresses in the signed data they can ensure a MITM can't use signed data created for one connection to impersonate the user on another connection
- Send secret session ids boxed with each other's keys
    - I choose a completely random session id, box that up with the other parties key, and then only they can open it and see it. 
    - They then choose a completely random session id, box that up with my key and then only I can open it.  
    - sooo... how do you detect a MITM? The goal is to treat the connection as secure so we can just talk normally.  

**Update 12/20**

- To date - the only way I can see for it to be safe to not encrypt (box and sign) all data transferred is if the client signals that it's using a secure connection (https).  
- Another idea is to use a "callback" mechanism that would work as MFA
    - Still half baked but could work.  Might be another service offered by peer-server
    - I'd really like it if the traffic could be unencrypted at the local-network level
        - That might be able to be done with two connections
            - connection1 = peer1 is client and peer2 is server
            - connection2 = peer2 is client and peer1 is server
            - using connections as one-way traffic could prevent a MITM because both peers are connecting directly to each-other's IP addresses.  
            - A traffic sniffer could still see stuff though...
                - ugh! just encrypt everything until it gets slow
                    - I think we already know it'll get slow....
                    - Sending larger chunks might go a long way to mitigating the overhead
