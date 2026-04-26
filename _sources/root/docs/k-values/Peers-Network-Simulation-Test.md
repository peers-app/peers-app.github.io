I want to write a test suite that will test that the logic underpinning how Peers discover, connect, and communicate with each other is secure, performant, and robust.

The idea is to make a `Device` class that uses as much of the actual code as possible to simulate discovery of other devices and connecting and communicating to them.

`Update 10/23/24`

We now have the `Device` and `Connection` classes.  The connection class is the key one which wraps a "socket-like" interface.  There are already unit tests which prove we can simulate network connections locally.

Things we want to simulate / test

- Groups of devices self organizing
    - Imagine some decent percentage of the world uses Peers.  We absolutely don't want to create a situation where a large percentage of *those* devices/users are wanting an active connection to our servers.  
    - We want to create a situation where devices self-organize into their own networks and bridges between those networks.  
        - The Peers server should be use as a fall-back to establish a connection to "your" network, and also as a last resort to verify new users and devices.  
