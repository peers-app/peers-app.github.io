Every group (including the user's personal group, userId == groupId) should have a default package.  This will reduce a lot of up-front decisions and setup when a user wants to add functionality.  Just use the default package.  It can be split out later if desired.  

# thoughts

There isn't anything wrong with this conceptually but it should probably just be left as a convention.  There's no reason to setup _any_ package until we need to.  We can leave instructions / documentation to indication this and if the user asks for a new tool, etc. the Assistant can just use the default package if it seems reasonable.  And at that point can also create the default package if there isn't one.