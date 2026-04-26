**Current Focus**

- Redo top level UI
    - Really need a top level tab system 
        - also probably the ability to open new windows
    - First "Tab" is special and is the "Apps" view
    - Also *really* need a "navigation history" thing
- Tasks
- Mobile App

 

**Queue**

- Add "currentContextData" to thread object which will be set to whatever is in `mainContent` at time of submitting message
    - It can just be another variable like `currentPath` 
- Mentions in general probably should have a popover instead of being a direct link
    - Solves some accidental click-away issues
    - Allows a useful summary UI so users don't have to navigate to a full details page all the time
- Workflows are acting weird
    - feel like they need a compile step


**Areas of Work**

- Servers
    -  
- Groups
    -  
- Mobile App
    - 


**Tasks**

- [ ] Turn tasks in notes into top-level tasks (and track their progress)

**MVP - Actual (and ordered)**

- [x] Workflows.
- [x] Notifications & Agentic Re-entry
    - [x] Events
- [x] Tools
- [x] Secrets
- [x] Login and sync data
- [x] Groups
- [ ] Channels
- [x] run workflows and ad-hoc commands from the command line
    - [x] this is probably really important if workflows end up being the core feature of peers
- [ ] AI Generated UI
    - [ ] see notes on this - if this can be done relatively easily and works well, it could be the basis for most of the rest of the app

**Plugins**

- [ ] Tasks - UI and agent tools
- [ ] Reasoning and Logical Arguments
