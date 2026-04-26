The new design is every package produces it's UIs as react components that are bundled in a specific way and added to the "client" / "browser thread" runtime by calling a special function.  Has to make use of the global `React` object to work correctly 

I don't love the hackyness (I couldn't use some kind of existing dynamic component system) but all in all it feels relatively simple and completely.  

I like that it lazy loads package UIs.  It doesn't lazy load the UI registrations or the routes but those are pretty small json objects so even at thousands of registrations it should be very lightweight.  The UIs themselves can be hugely complicated (large bundles, intensive processing, etc.) and won't be loaded until the user asks for them.  This is really nice.  Several dozen very large video games can be registered as UIs and will have almost zero effect on performance if the user never navigates to them. 

 

Below is before **- UPDATE 12/16**  

 

- Custom UIs are going to be html and JS that will be loaded into a webview
    - This might actually be awesome since LLMs should be *very* good at working with HTML and CSS.
    - We can have a special-purpose "React" component that basically just hides the HTML and JS boiler plate needed to instantiate the react component.
        - The overhead though... have to load *all of React* each time
            - At the same time, this again could be an advantage since I'm not tempted to do anything fancy.  All your HTML, CSS, and JS dependencies have to be bundled together for your component.  *Very* heavy but also very straightforward.  
        - Hopefully it will be performant enough in this naive state that it'll work okay.  If not I'll have a pretty big problem on my hands.  
            - **UPDATE 12/16** - haha yeah it wasn't performant and didn't integrate nice (sizing was weird) so I had to tackle that "big problem".  
- This should work for both Electron and reactNative apps
    - In react native the need to load from physical files on the device.  Not a big deal but it means we have to do preprocessing to ensure those files exist and are up-to-date and are unique (ids take care of uniqueness) 
- css has to be re-loaded for each webview  since they are isolated from the parent webview completely 
    - If this becomes a performance problem we can look into approaches where we have "compiled views" where one "webview" is a bundle of a collection of components loaded into a single webview (less secure but more performant)

 

**How do we know when and what to load?**

- We need a mapping (router) that says what UI should be loaded for a given thing
    - Possible different things
        - route (uri)
        - data (content type)
        - ?
- UIs will be able to be loaded recursively 
    - i.e. list of different typed items maps to generic list UI
        - Each item then maps to their own list-item UI
        - but each item is potentially in its own webview
            - so each webview needs its own UI router
- Do we want users to be able to override the default router logic?
    - Not really.  Ideally the default router is simple enough and expressive enough that it should work well for almost every situation.  
    - By maintaining the same UI Routing logic across the entire experience things will feel predictable and intuitive instead of "what is it doing that?!"
    - I think they will be able to do this if they want anyway so if some app needs an escape hatch I think it's already there.  

 

Algorithm

- router."show this thing"(`uri | data`)
    - match = routes.matchFirst(`uri | data`)
    - if (match) return match.render(`uri | data`)
        - check in-memory components
        - otherwise load via webview
    - // check default routes
    - // show error

 

**Questions**

- How do links inside a webview work?
    - worst case scenario is we can modify a `pVar` that all webviews are subscribed to
- We want our `match` to be a function for maximum expressiveness but that means it needs to be defined in code....
    - If we are going to execute code why not just instantiate the React component itself and avoid the whole webview runaround...
    - Alright... so match function isn't code, so regex? 
    - We're already loading tools....
        - but at least that's explicit and there is a lot we can do to sandbox it
    - 

 

 

 
