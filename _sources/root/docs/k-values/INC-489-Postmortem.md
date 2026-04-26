**Leadup**

For lack of a better place to mention this I'll do it here. There are two architectural issues with `AIC -> fitness plan` that should be addressed to minimize blast radius of incidents like this in the future:

1. All of the fitness plans are generated on one day of the week, within a few hours of each other.  This means deployed code isn't really put through its paces until that one day (which could be after multiple deploys) and the blast radius of any problems is potentially all users unless it's caught early in those few hours.
2. Fitness plans are generated on off hours (Sunday morning) so when there is a problem, people are almost certainly going to be slower to respond and it will be much harder to pull in SMEs

 

**Fault**

Due to the code freeze for thanksgiving quite a few PRs were piled up into a single release for after the code freeze.  Included in this were changes to the code that generates user's fitness plans to take into account more user preferences, address some undesirable behavior and edge-cases, as well as notify the user when a reasonable match could not be found.  

Due to several different edge-cases in this new code, fitness plans were failing to generate at a much higher rate than expected which then resulted in Tailor messaging those users about the problem.

 

**Detection**

AIC has monitors for all upstream services.  The monitor it has for fitness-plan service triggered, notifying @adam (AIC on-call) who then opened an incident on behalf of the generate team (owners of fitness plan service).  The incident was opened at 7am MT.

 

**Root Causes**

1. **Why did the fitness plans fail to generate?**

    - Due to several different edge-cases in the new code that was deployed.

2. **Why were there edge-cases in the new code?**

    - The new code included changes to account for more user preferences and address undesirable behavior, which introduced complexity and unforeseen edge-cases.

3. **Why was the new code with edge-cases deployed?**

    - Multiple PRs were piled up into a single release after a code freeze for Thanksgiving, leading to insufficient testing of the combined changes.

4. **Why were multiple PRs piled up into a single release?**

    - The code freeze for Thanksgiving delayed the deployment of changes, causing a backlog of PRs.

5. **Why was there a code freeze for Thanksgiving?**

    - Code freezes are typically implemented during Holidays to prevent issues when staffing is low and customer traffic is high.

 

**Mitigation and resolution**

- 7:20 - User processing was stopped in AIC via a feature flag which immediately stopped requests to generate new fitness plans
- 7:38 - A rollback was initiated in Fitness Plan service
- 7:52 - Rollback was complete
- 7:55 - AIC user processing was turned back on
- 7:55 - Very large spike in errors in Fitness plan
    - Peaked at 7:00
    - Finished at 7:06
    - [Total duration of about 10 minutes](https://app.datadoghq.com/logs?query=env%3Aproduction%20service%3Afitness-plan%20-status%3Ainfo&agg_m=count&agg_m_source=base&agg_q=status%2Cservice&agg_q_source=base%2Cbase&agg_t=count&cols=host%2Cservice&fromUser=true&messageDisplay=inline&refresh_mode=paused&sort_m=%2C&sort_m_source=%2C&sort_t=%2C&storage=hot&stream_sort=desc&top_n=10%2C10&top_o=top%2Ctop&viz=pattern&x_missing=true%2Ctrue&from_ts=1734274587486&to_ts=1734275297647&live=false)
- We waited for several waves of user processing (particularly the one from the West Coast users) to ensure errors remained low
- 9:07 - Incident marked as resolved

 

**Lessons Learned**

- Doing batch processing on off-hours makes for harder incidents
- Clustering batch processing onto a single day of the week slows down detections of bugs and significantly increases the blast radius of them.
- 
- Look into locking mechanism and [related errors](https://ifit.slack.com/archives/C08569V8EPM/p1734275949045649?thread_ts=1734274933.982189&cid=C08569V8EPM)
    - Consider using SQS to debounce requests
- Fitness-plan monitors probably aren't sensitive enough since AIC was the one to detect the problem. 

 

 

 

 

 

 

 
