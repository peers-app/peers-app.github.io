# Project Stack

This diagram shows the architecture of the Peers project stack:

```mermaid
flowchart TB
    subgraph "Applications"
        D[peers-electron]
        E[peers-react-native]
    end
    
    subgraph "Libraries"
        B[peers-device]
        C[peers-ui]
    end
    
    subgraph "Foundation"
        A[peers-sdk]
    end
    
    D --> B
    D --> C
    D --> A
    E --> B
    E --> C
    E --> A
    B --> A
    C --> A
```

## Stack Layers

- **peers-sdk**: Foundation layer providing core functionality
- **peers-device**: Device management layer built on peers-sdk
- **peers-ui**: User interface components built on peers-sdk
- **peers-electron**: Desktop application built on peers-device, peers-ui, and peers-sdk
- **peers-react-native**: Mobile application built on peers-device, peers-ui, and peers-sdk