---
custom_edit_url: 'https://github.com/peers-app/peers-electron/edit/main/diagram.md'
---
```mermai
graph LR
  A[Square] --> B((Circle))
  A --> C(Round Rect)
  B --> D{Rhombus}
  C --> D
```


```mermaid
graph LR
  
  Message --> Assistant --> Tool --> WorkflowRun --> WorkflowLog

  Event --> WorkflowRun
  
```

### Message Flow
```mermaid
graph LR
  

  Message --> 
  Assistants --each-->
  Instruction --> 
  AssistantRunnerTool --> 
  LLM -->
  Tools --each-->
  Logs -->
  Result -->
  Message
  
```


### Workflow Run Flow
```mermaid
graph LR

  WorkflowRun --> 
  Instructions --each-->
  Message 

```

### Logging in Workflow Run Processor
```mermaid
graph TB

  WorkflowRun --> 
  NextInstruction -->
  IsToolCall{Is Tool Call?}

  IsToolCall --> |No| SelectAssistant --> 
    LogAssistantSelected -->
    UnshiftAssistantRunnerToolCallInstruction --> 
      NextInstruction

  IsToolCall --> |Yes| CallTool --> 
  IsError{Is Error?}
    IsError --> |Yes| SetWorkflowRunErrorState
    IsError --> |No| PushToolCallResultToWorkflowRun -->
      NextInstruction  
  
  
```

### Logging in Tool Call 
This is done automaticaly as part of the tool wrapper

```mermaid
graph TB

  WrappedToolCall -->
  LogToolIdAndArgs -->
  ExecuteToolCall -->
  IsError{Result isError?}
  IsError --> |Yes| UpdateLogWithResultError
  IsError --> |No| UpdateLogWithResult -->
    IsObject{Is Object?}
    IsObject --> |Yes| PushToolCallResultObject
    IsObject --> |No| PushToolCallResultString

  UpdateLogWithStringResult -->
  ReturnStringResult

```
