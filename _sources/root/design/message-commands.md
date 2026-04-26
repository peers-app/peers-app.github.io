
Messages are a central part of Peers.  

Currently users can tag other users or trigger assistants with `@{name}` and they can link/mention other things with `<{name-tab-to-autocomplete}`.  I think the next key piece of functionality is running direct commands.  I think it makes sense to use the slash command for that `/{command}`.  

Some commands we'll want
- `/clear` don't load messages above this - should just return something like `agents will not see messages above this`
- `/run {tool or workflow name}` - this should create an execute a tool or workflow without requiring an assistant to process it first
- `/cd {path}` - changes the `cwd` of the current message thread
    - `/pwd` and any other path related commands
- `/! {any shell command}` - run a shell command in this thread's current working directory

I also want packages to be able to register new commands, e.g.:
- `/task {task description}` - create new task
I think package commands should be at least 4 character to keep packages from trying to squat on short commands.

I also want users to be able to register their own commands which will almost always be aliases for either a tool call or a shell command: 
- `/t {task description}` - alias for `/task ...`
- `/pwd` - print working direction (alias for `/! pwd`)
- `/m {message}` - alias for `/run sendMessage {message}`

Let's flesh out this design doc on how to do this