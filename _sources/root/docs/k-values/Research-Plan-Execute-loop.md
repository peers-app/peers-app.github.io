The idea here is to have three distinct modes as somebody is interacting with their knowledge system, "Research", "Plan", "Execute". Note that an execution phase *requires* a plan and a plan *requires* a research phase. I think this makes a lot of sense and should be hard-coded into the design.

I'm envisioning that most people will start with a "goal" or "objective" which translates to a planning phase. That will then immediately move them to the research phase before they can start to develop the plan.

**Research**

This mode requires a subject (question, problem statement, etc.) but it can be pretty vague. I.e. how does Ethereum work?

The objective is to pull in as much related information from the rest of the system and external sources as possible, then efficiently pair it down to the most relevant and concise (and manageable) collection of knowledge.

Todo: this actually sounds like two or three distinct steps - get existing, search external, pair down.

Todo: this should probably include some step(s) to test understanding.  I.e. we think "this" should behave like "that" - what's a very easy and simple way to test that.  This is effectively encapsulating the scientific method.  

 

**Plan**

This mode requires a goal and it should be pretty specific. I.e. I want to embed knowledge hashes in the ethereum blockchain.

The end result is to have a complete, detailed plan (the steps to take) to accomplish the goal. Every plan should have a "research" section at its top. Once the research phase has been finished, the below loop should be done:

- List out the next step to accomplish the goal (based on the existing steps and the knowledge we have available)
- If we don't have enough knowledge to confidently state the next step -> Research Phase
- If this step should be broken into sub-steps -> planning phase
- continue until a last special step of "done" is listed out

The details of when a step requires research or sub-steps is a bit fuzzy. Ideally everything terminates in a tool-call or workflow. Special tools for user interactions and commands will be needed (feedback, approval, go-do-this-manual-step, etc.). So if a step doesn't result in a single tool-call or workflow, it needs to be broken down. :thumbsup

 

**Execute**

This is the the phase in which the plan is executed. But, ideally, instead of just mindlessly following the plan, this include some monitoring to re-enter planning (and therefore potentially research) to try to intelligently adjust to unexpected things as the execution progresses.

 

**Bonus Phase: Explore**

This is a special phase/mode for exploring existing knowledge and, hopefully, identifying new interesting knowledge or connections or ideas to pursue.

In reality Exploring is not really a "phase" like the other three but special tools (like the knowledge graph) should be made available to allow the user to easily see gaps in knowledge, dense clusters, "orphaned" knowledge (not connected to anything else) etc. The main goal of this should be to help to user continue to expand the boundaries of their knowledge and fill in details of existing areas that have been explored. The larger and denser a person's knowledge graph is, the better.
