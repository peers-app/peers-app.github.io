---
custom_edit_url: 'https://github.com/peers-app/peers-sdk/edit/main/docs/injection5.md'
---
# EventRegistry as Starting Point - Analysis

## Your Proposed Approach
Start with just the EventRegistry implementation:
1. Create EventRegistry class to encapsulate event emitter state
2. Instantiate it in TableFactory 
3. Update Table constructor to accept optional EventRegistry
4. Skip the full DI container for now

## My Assessment: **This is a smart approach**

### Why This Works Well

**1. Immediate Value**
- Solves the cross-package event isolation problem right away
- Much simpler to implement and test than full DI
- Low risk since it's mostly additive changes

**2. Natural Progression** 
- EventRegistry becomes a concrete example of the shared state problem
- When you hit the next similar issue, the DI pattern will feel more necessary
- You'll have real experience with what needs to be shared

**3. Minimal Disruption**
- Table constructor gets one optional parameter
- TableFactory gets one new property
- Zero breaking changes to existing code
- Events.ts stays untouched

### Potential Concerns

**1. Global State Still Exists**
- TableFactory still has global `_tableFactory` singleton
- Multiple peers-sdk instances will still fight over this
- EventRegistry helps but doesn't solve the root cause

**2. Partial Solution**
- PersistentVars still have the same multi-instance problem
- Other shared state issues will require similar ad-hoc solutions
- Might end up with many registries instead of one coherent system

## My Honest Take on Ambient DI Strategy

**Pros:**
- Maintains excellent developer ergonomics
- Zero breaking changes
- Gradual adoption path
- Works with existing global patterns

**Cons:**
- Still relies on global state (just better organized)
- Multiple solution approaches instead of one coherent system
- Each new shared state problem requires custom registry solution

## Recommendation

**Start with EventRegistry approach** - it's pragmatic and low-risk. You'll quickly see if the cross-package sharing problem is solved and can evaluate whether the full DI investment is worth it.

If EventRegistry works well and you encounter 2-3 more similar issues, that's when I'd revisit the full ambient DI approach. But starting simple and concrete is often better than over-engineering upfront.
