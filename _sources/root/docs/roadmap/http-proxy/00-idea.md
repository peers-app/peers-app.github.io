I want to implement a few new feature in peers services to allow http requests to be proxied through peers-services to one of the currently connected devices.  

First thing is to decide on the url format.  I'd like it to be https://{groupId}.peers.app/{path} but I think we need to do something special with the SSL cert for that and it can add complexity?  So let's hold off on that for now and go with https://peers.app/{groupId}/path

Second thing is, user and group ids are ugly so we'd like users to be able to register human-friendly names.  This should be a simple map of {friendly-name} -> {groupId}

Third thing is we'll need a peers system app to allow users to manage their friendly name mapping.  We may need to add additonal logic to have users first register their userId/groupId with their public key so peers-services knows they are they are admins-or-above of the user or group.

fourth thing is we'll need to allow users to manage how a connected device responds to http requests.  The default responses should be 
1. Invalid name (i.e. the friendly name or groupId/userId) isn't valid (not registered)
2. The name was valid but there aren't any connected devices
3. The name was valid and a connected device was found but it rejected the request.  

The fifth thing we'll want to implement is a blog app (map this a new peers system app for now) where the editing is done in markdown.  We already have a good markdown editor based on lexical but we might want to extend it or make a new one that allows us to embed images (which should use sdk Files) and mermaid diagrams.  

This is a really big feature list so think very hard.  Superthink, ULTRATHINK.  