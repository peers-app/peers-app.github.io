We want users and external automation to be able to integrate with Peers via a CLI

To do this we should should leverage the new "Router" concept

# Use cases

## tools

### query tools

```sh
# get all tools related to tasks
peers tools -filter "tasks"
```

```sh
# get details on a specific tool
peers tool toolId|toolName
```

## workflows

Same as tools 

## run

```sh
# run a workflow or tool
peers run workflowId|workflowName|toolId|toolName| [?payload]
```

If the provided id maps to two or more workflows and tools (any combination) a 400 level error is returned.

If it maps to a tool the tool is executed as an anonymous workflow that just calls that tool (similar to how message processor works).  The call should wait for the workflow to finish executing and then out put the result

payload is optional but if the workflow or tool requires a payload and one isn't provided or isn't valid for the tool args schema a 400 level error will be returned


## user input

```sh
peers "add milk to the shopping list"
```

This should work identical a user input - create a new threads with this as the top message and process via message processor 

