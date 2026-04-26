- Glass ceiling of computing and automation with Excel
    - Excel (Spreadsheets) are the most used computing technology but they have severe limitations 

        1. Dataset size - Limit to the amount of data they can work with
        2. Bad UI technology - you can't write a user application on top of them
        3. No source control - can't easily track changes to code and share algorithms / programs
        4. Networking - complicated, external server infrastructure and external authentication mechanisms are required to share datasets between two computers
        5. Background processing - running on schedules, queue processing, and subscribing to external events are all non-obvious on how they can be done.
        6. Scaling - processing done in spreadsheets is inherently not scalable 

 

- Peer-to-peer communication
    - Discovery and Authentication
        - Two computers can't just easily find, connect, and authenticate with each other even when they are on a local network
        - This makes IoT type solutions always require an internet connection and a server.  This makes IoT solutions unnecessarily expensive and less robust and resilient 
            - Think cameras and other types of home automation.  
            - Slotting in things like JS8Call (GhostNet) etc. 

 

- Toy Apps / sharing code
    - It is very hard or expensive to build out all the things needed to write a toy app that can be easily shared with other people.  
    - One path is a web app - which in turn requires a web server and probably a db.  And they can't really do things outside of the webpage sandbox (like file processing for Luke)
    - Another path is a desktop app - These are less difficult to create but hard to package and distribute.  Most users aren't going to want to install an entire thick-client app for "toy app" and there are security concerns (still will be with Peers but hopefully can be alleviated)

 

- Integrating AI Assistants + tools with other types of computing and automation
    - Currently there is just a lot of copying of information back and forth between chat interfaces and other programs.  There is a ton of low-hanging fruit for automation with AI if they can be integrated with things like users' Notes, Tasks, Calendar, etc. 
        - These either need to be done in 1-off ways in new or existing apps or a new "shell" or "hub" app needs to be created to establish and host all of this connector code and data.

 

 

 

 

 


 
