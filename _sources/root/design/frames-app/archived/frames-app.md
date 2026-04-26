# 🧠 Frames System — High-Level Design

## Core Concepts

### 1. Blocks (Global, Neutral)
- Atomic reasoning units (propositions)
- Types:
  - Observation
  - Assumption
  - Value / Goal
  - Inference
  - Conclusion
- No inherent truth or stance
- Reusable across all frames

---

### 2. Block Graph (Semantic Layer)
- Nodes: Blocks
- Edges: Semantic relationships
  - supports
  - contradicts
  - implies
  - depends_on
  - refines
- Represents possible relationships between ideas
- Global and shared

---

### 3. Frames (Primary UX Layer)
- User-facing workspace
- A structured subset + interpretation of the block graph
- Defines:
  - which blocks are used
  - stance on each block
  - reasoning flow

---

### 4. Frame Stance
Each frame assigns meaning to blocks:

- status:
  - accepted
  - disputed
  - rejected
  - hypothetical
- role:
  - observation
  - assumption
  - value
  - inference
  - conclusion
- optional:
  - confidence
  - sources
  - notes

---

### 5. Frame Graph (Interpretive Layer)
- Nodes: references to Blocks or other Frames
- Edges: reasoning / structural relationships
  - derives
  - uses_as_evidence
  - challenges
  - compares
  - reframes
  - treats_as_assumption
- Represents how ideas are used in this context

---

## Key Distinction

- Block Edge = relationship exists (global meaning)
- Frame Edge = relationship is used (local reasoning)

> Block edges describe meaning  
> Frame edges express reasoning

---

### 6. Frames Can Include Frames (Recursive)
- Frames may reference:
  - Blocks
  - Other Frames
- Enables:
  - comparison
  - mediation
  - synthesis
- No fixed depth required

---

### 7. Meta-Frames (Special Case of Frames)
- Frames that operate on other frames
- Use cases:
  - compare arguments
  - identify agreements / disagreements
  - mediation / compromise
  - goal analysis

---

### 8. Goals & Values (First-Class)
- Goals are blocks
- Used to bridge is → ought
- Enable:
  - policy reasoning
  - tradeoff analysis
  - goal reframing

---

### 9. Two Reasoning Modes

#### Exploration Mode (Forward)
- Given assumptions → derive conclusions

#### Thesis Mode (Backward)
- Start with conclusion → find required premises

---

### 10. System Responsibilities
- Track dependencies between blocks
- Surface:
  - missing assumptions
  - value gaps (is → ought)
  - conflicting conclusions
- Enable:
  - "what follows?"
  - "what must be true?"

---

### 11. UX Principles
- Frames are the primary interface
- Block graph is mostly hidden
- Users:
  - create and edit within frames
  - reuse/search blocks when needed
- Graph views are secondary / exploratory

---

### 12. Edge Strategy

#### Block Edges
- Small canonical set
- Stable semantics
- Harder to customize

#### Frame Edges
- More flexible
- Can support user-defined labels
- May map to canonical edge families

---

## Core Mental Model

Blocks form a shared semantic graph  
Frames form interpretive graphs over blocks and other frames  
The system enables structured reasoning, comparison, and exploration of implications

---

## One-Line Summary

A system where neutral propositions are composed into contextual reasoning structures, enabling users to explore, compare, and refine arguments and worldviews.