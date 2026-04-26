
We now have a fledgling CLI for peers-electron (or any peers instance that is running the frontend websocket server).

It's installed and can be accessed with the `peers` command.

I want to make sure it is functional enough for agents running outside the peers app to work on the peers app.  
Key things that are needed
- [x] view logs (this is mostly done but verify it works as you need it to)
- [x] start, restart, and quit the app (restart/quit work via RPC; start has spawn issues)
- [x] direct db queries (via `peers db` command, requires menu permission)
- [x] reload the UI (via `peers ui reload`)
- [x] inspect the UI (via `peers ui inspect`)
- [x] take action in the UI
    - [x] scroll (via `peers ui scroll`)
    - [x] click buttons (via `peers ui click`)
    - [x] enter text into inputs (via `peers ui type`)