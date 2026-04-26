### Scratchpad

Implementation 
- [x] Ability to add notes
- [ ] Ability to paste raw markdown
- [ ] Need to be able to mark up paragraphs (or just parts of notes) with metadata
- [ ] turn task list items into distinct, top-level tasks
- implement logical argument system
  - [ ] classify and critique
- implement PKS
  - [ ] asdf

---

### Key Components for Argument Breakdown System:


1. **Premise Classification**
- Explicit premises 
  - Clearly stated and directly presented within the argument
- Implicit premises 
  - Not directly stated but is assumed or inferred by the audience to complete the argument. Implicit premises often rely on shared knowledge or common understanding to be recognized.

2. **Inference & Conclusion Classification**
- Deductive 
  - Derived from deductive reasoning, where if the premises are true, the conclusion must be true.
  - Guarantees the truth of the conclusion if the premises are true
- Inductive 
  - Generalizes from specific instances
  - Based on inductive reasoning, where the conclusion is likely but not guaranteed, derived from specific observations.
- Abductive 
  - Involves finding the most plausible explanation for a set of observations, often used in hypothesis generation.
  - Starts with an observation or set of observations and seeks the simplest and most likely explanation
- Analogical 
  - Drawn from analogical reasoning, where similarities between two situations lead to a conclusion about one based on the other.
- Probabilistic 
  - Involves conclusions that are expressed in terms of probability, often used in statistical reasoning.


3. **Evidence Categorization**
- Facts
- Statistics
- Examples (empirical or anecdotal)
- Clearly define what constitutes empirical versus anecdotal evidence to avoid ambiguity.

4. **Fallacy Detection**
- Ad Hominem
  - Attacking the person instead of the argument.
- Straw Man
  - Misrepresenting an argument to make it easier to attack.
- Appeal to Ignorance
  - Claiming something is true because it hasn't been proven false.
- False Dilemma
  - Presenting two options as the only possibilities.
- Slippery Slope
  - Arguing that a small step will lead to a chain of events resulting in a significant impact.
- Circular Reasoning
  - The conclusion is included in the premise.
- Hasty Generalization
  - Making a broad claim based on limited evidence.
- Red Herring
  - Introducing irrelevant information to distract from the main issue.
- Appeal to Authority
  - Believing a claim is true because an authority figure endorses it.
- Post Hoc
  - Assuming that because one event followed another, it was caused by it.

### Notes:

- Ensure the system can identify and handle contradictions within the premises or between the premises and the conclusion effectively.


1. **Contextual Analysis:**
- Incorporate a module to understand the context in which the argument is made. Context can influence the interpretation of premises and conclusions.
- The context of the argument can result in wildly different outcomes

2. **User Feedback Loop:**
- Implement a feedback mechanism where users can validate or dispute the system's interpretation of the argument. This can help in refining the accuracy of the system over time.

3. **Semantic Analysis:**
- Use natural language processing to detect nuances in language that might affect the interpretation of premises and conclusions.

4. **Source Credibility:**
- Evaluate the credibility of sources cited in the argument. This can be crucial in assessing the reliability of the evidence presented.

5. **Argument Strength Assessment:**
- Develop a metric to assess the strength of the argument based on the robustness of the logical structure and the quality of evidence.

6. **Multi-perspective Analysis:**
- Allow for the analysis of arguments from multiple perspectives to understand how different viewpoints might interpret the same set of facts differently.

---


**Note / Doc (Entry)**
- This will be any entry from the user
- Everything starts here
- User's can "assert" that it is a "argument part"
  - 

**Data**
- This is a critically different in that it is meant to be entered in a tabular format with statistical analysis applied
  - gun data like deaths, incidents of self defense, etc. can be used to assert wildly different conclusions
- Instead of being raw markdown it's tabular data
- I _think_ everything else can just be markdown?

Parts
- Premises / Assumptions / Givens
  - supporting data

Data



--- 

### Questions as starting point
- the idea here is to move away from the "logical arguments" structure and into the "I have a question that I want answered"
- potential forms:
  - Question + accepted + alternate answers
  - Jeopardy - I have an answer, what's the question
  - ...
- This would still have entry types
  - observations / notes
    - "this is how I do this"
    - "this happened on this day"
  - conclusions from data
    - A / B test results

The big pull for this is that it seems the most useful with real-world application.  At the same time, how many QA sites already exist (Stack overflow, Quora, Google in a way, etc.).  

So I think I'm getting tangled up trying to marry a note-taking system to a logical argument system to a personal knowledge system (PKS).  

Notes should absolutely be part of the system but the real goal here is to "help users perceive truth from untruth".  So the logical argument part should be front and center.  Also the PKS aspect of this seems like a direct extension of the logical argument system and appropriate to include.  Finally, remember I think this is a problem uniquely suited to LLMs which can act as a kind of compiler and greatly streamline and automate the process of formalizing one's thoughts on a give subject.  

So the features are
- Raw entries
- logical arguments
  - categorize paragraphs into
    - Premise
    - Inference
  - Automatically highlight
    - Inference type used
    - Critical Assumptions 
    - Fallacies 
- personal knowledge system
  - links
  - search
  - "workspace" which pulls on notes and LLM calls out unifying thread
    - this is basically a "hub note" I think

In some sense this is a PKS with the logical arguments kind of imposed on top. That actually sounds pretty good.  **So start with the notes (raw entries)**

The UI for going from "raw entry" to classified argument parts is very key. Ideas:
- Jupyter Notebook format
  - raw entries have paragraphs.  Each paragraph is an atomic "raw entry".  
  - The system adds metadata to the paragraph (Premise, Inference type, etc) as well as the "Notebook / Document"
  - A sidebar can contain related content from other parts of the system
    - This will often be auto-populated by the LLM using vector search
    - It or a related sidebar can be populated by the user with atomic notes that the user wants to try to incorporate or just wants available as a reference.  

- Workspace format
  - A space with cards that can be dragged around and rearranged into hierarchies, progressions, etc.  
  - This would be more of a graphical UI
  - Cards can represent different things
    - Another workspace / document (show a summary or title or key conclusion)
    - An atomic entry (raw input)
    - ...
  - This feels pretty complicated to implement...

- 

  

---

### Raw Entries

I think I'd rather start with raw entries and allow them to be structured as logical arguments or questions and answers or whatever.  The base is the raw entry though.  This is the most natural and flexible.

Structure
- Raw entry has a title (required) and body (not required)

Now how do we add structure on top of that for logical arguments, types (premise, assumption, conclusion, question or answer, etc.)



