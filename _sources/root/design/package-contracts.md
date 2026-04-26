
It is inevitable that packages are going to want to reference tables and tools in other packages.  To prevent users from ending up in a "package version hell" scenario we should make the concept of "Contracts" explicit for peers packages.  And this should probably be the top-level driver of packages so package developers are forced into defining them (instead of some downstream package wanting a contract, not finding one, and then just directly referencing the table or tool they want, thereby ending up back in package version hell)

This is basically an API.  So all packages are like their own microservice, just inside the peers runtime.  So Peers becomes a system of microservices.  We know this scales wonderfully because of very large companies like AWS.

Packages should be completely redesigned to just export contracts.  

When the peers runtime is installing a package it's installing the contract.  
- If there is an existing contract then an updated version of that contract should not allow breaking changes
    - removing fields is never allowed
    - return types with additional fields are allowed
    - adding optional arguments _is_ allowed    
    - etc. etc.

The key thing is to treat a contract like an API.  You can make changes to an existing API but nothing that will break clients.  If you need a breaking change you don't change the existing contract you make a new contract.  Peers will enforce this.  
- we need to be very intentional about when a contract is updated so users aren't looked into new fields that they added as part of a test
    - when a package is in dev version it's never installing or updating contracts... 
        - hmm this might be hard or create a bad dev experience, maybe just experiment

This should help solve the table versioning issue

Man this feels like it could be months of work... blah


