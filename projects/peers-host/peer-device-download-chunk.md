---
custom_edit_url: >-
  https://github.com/peers-app/peers-host/edit/main/peer-device-download-chunk.md
---
# Peer Device File Chunk Download Specification

## Overview

This specification defines how the `PeerDevice` class should implement efficient distributed file chunk downloading for the peers network. The system leverages the existing peer-to-peer architecture to download 1MB file chunks from optimal peer devices.

## Core Requirements

### Primary Methods

#### `downloadFileChunk(chunkHash: string): Promise<Buffer>`
- Downloads a single file chunk identified by its SHA-256 hash
- Returns the raw chunk data as a Buffer
- Implements automatic retry with exponential backoff
- Verifies chunk integrity using SHA-256 hash validation
- Pools requests to avoid duplicate downloads of the same chunk
- Limits concurrent downloads to optimize network utilization

#### `getFileChunkInfo(chunkHash: string): Promise<IFileChunkInfo>`
- Retrieves metadata about chunk availability from a specific peer device
- Returns information about whether the peer has the chunk and its current download queue status
- Enables intelligent peer selection for optimal download performance
- Uses the standardized `IFileChunkInfo` type from peers-sdk

## Architecture Design

### Request Pooling & Deduplication

```typescript
interface ChunkDownloadPool {
  activeDownloads: Map<string, Promise<Buffer>>;
  downloadQueue: Map<string, ChunkDownloadRequest[]>;
  concurrentLimit: number; // Default: 10
}
```

**Benefits:**
- Multiple requests for the same chunk return the same Promise
- Prevents bandwidth waste from duplicate downloads
- Batches requests when concurrent limit is reached
- Provides back-pressure management for network resources

### Peer Selection Strategy

```typescript
// Using the actual IFileChunkInfo type from peers-sdk
interface ChunkAvailabilityInfo {
  chunkHash: string;
  availablePeers: Map<string, IFileChunkInfo & { 
    deviceId: string;
    estimatedLatency: number;
    errorRate: number;
    lastSeen: number;
  }>;
  lastUpdated: number;
  ttl: number; // Time-to-live in ms
}

// IFileChunkInfo is already defined in peers-sdk:
// type IFileChunkInfo = 
//   { hasChunk: false } | 
//   { hasChunk: true; downloadQueueSize: number; estimatedWaitMs: number }
```

**Selection Algorithm:**
1. Filter peers that have the chunk (`hasChunk: true`)
2. Exclude peers with high error rates (>0.5)
3. Sort by composite score: `(downloadQueueSize + estimatedWaitMs) * estimatedLatency * (1 + errorRate)`
4. Select the peer with the lowest score
5. Fallback to random selection if no optimal peer found

### Concurrent Download Management

**Limits:**
- Maximum 10 concurrent chunk downloads
- Maximum 3 downloads per peer device simultaneously
- Queue additional requests when limits exceeded
- Prioritize chunks for active file read streams

**Queue Management:**
- FIFO queue for general chunk requests
- Priority queue for urgent chunks (file read streams waiting)
- Automatic cleanup of stale requests (>30 seconds old)

## Implementation Details

### Separate ChunkDownloadManager Class

To avoid bloating the existing `PeerDevice` class, the chunk download functionality should be implemented in a dedicated `ChunkDownloadManager` class:

**File Structure:**
```
src/
  chunk-download-manager.ts  # Main implementation
  chunk-download.types.ts    # Type definitions  
  peer-device.ts            # Integration point
```

**Integration Approach:**
```typescript
// In peer-device.ts
import { ChunkDownloadManager } from './chunk-download-manager';

class PeerDevice implements IPeerDevice {
  private chunkDownloadManager: ChunkDownloadManager;

  constructor(/* existing params */) {
    // existing constructor logic...
    this.chunkDownloadManager = new ChunkDownloadManager(this);
  }

  // Delegate chunk download methods
  public async downloadFileChunk(chunkHash: string): Promise<Buffer | null> {
    return this.chunkDownloadManager.downloadChunk(chunkHash);
  }

  public async getFileChunkInfo(chunkHash: string): Promise<IFileChunkInfo> {
    return this.chunkDownloadManager.getChunkInfo(chunkHash);
  }
}

// In chunk-download-manager.ts
export class ChunkDownloadManager {
  private chunkDownloadPool: ChunkDownloadPool;
  private chunkInfoCache: Map<string, ChunkInfo>;
  private downloadQueues: Map<string, number>;

  constructor(private peerDevice: PeerDevice) {
    this.initializeManager();
  }

  public async downloadChunk(chunkHash: string): Promise<Buffer | null> {
    // Implementation here
  }

  public async getChunkInfo(chunkHash: string): Promise<IFileChunkInfo> {
    // Implementation here  
  }
}
```

### Remote Device Interface Extensions

The `IPeerDevice` interface in peers-sdk now includes the required chunk methods:

```typescript
interface IPeerDevice {
  // Existing methods...
  listChanges(filter?: DataFilter<IChange>, opts?: IDataQueryParams<IChange>): Promise<IChange[]>;
  getNetworkInfo(): Promise<INetworkInfo>;
  notifyOfChanges(deviceId: string, timestampLastApplied: number): Promise<void>;
  
  // New chunk-related methods (already defined in peers-sdk)
  downloadFileChunk(chunkHash: string): Promise<Buffer | null>;
  getFileChunkInfo(chunkHash: string): Promise<IFileChunkInfo>;
}
```

### Error Handling & Resilience

**Retry Strategy:**
- Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1.6s
- Maximum 5 retry attempts per peer
- Switch to different peer after 3 failed attempts
- Circuit breaker pattern for consistently failing peers

**Integrity Verification:**
- Verify SHA-256 hash of downloaded chunks
- Reject and retry chunks that fail verification
- Track and report peers serving corrupt data

**Network Resilience:**
- Handle connection timeouts gracefully
- Implement request cancellation for aborted operations
- Maintain download progress for resumable operations

### Performance Optimizations

**Caching Strategy:**
- Cache `ChunkInfo` for 60 seconds to reduce network queries
- LRU eviction when cache exceeds 1000 entries
- Proactive cache warming for chunks likely to be requested

**Connection Reuse:**
- Leverage existing peer connections for chunk downloads
- Multiplex multiple chunk requests over single connection
- Implement HTTP/2-style request pipelining where possible

**Bandwidth Management:**
- Respect existing connection latency and error rate metrics
- Throttle downloads on high-latency connections
- Prioritize chunk downloads for interactive operations

## Network Protocol

### Chunk Availability Query

```typescript
// Request: getFileChunkInfo
{
  method: 'getFileChunkInfo',
  params: {
    chunkHash: string
  }
}

// Response using IFileChunkInfo type
{
  result: IFileChunkInfo // { hasChunk: false } | { hasChunk: true; downloadQueueSize: number; estimatedWaitMs: number }
}
```

### Chunk Download Request

```typescript
// Request: downloadFileChunk  
{
  method: 'downloadFileChunk',
  params: {
    chunkHash: string;
    priority?: 'high' | 'normal' | 'low';
  }
}

// Response
{
  result: Buffer | null; // Raw chunk data or null if not available
}
```

## Integration with File System

The chunk download system integrates with the existing file system via the `FileOps` interface:

```typescript
// In file-ops implementation
const fileOps: FileOps = {
  downloadFileChunk: (chunkHash: string) => peerDevice.downloadFileChunk(chunkHash),
  // ... other methods
};

setFileOps(fileOps);
```

This allows the existing `FileReadStream` to transparently download chunks from peers when they're not available locally.

## Monitoring & Observability

**Metrics to Track:**
- Chunks downloaded per peer
- Average download latency per peer  
- Chunk download success/failure rates
- Pool queue depth over time
- Cache hit/miss ratios
- Bandwidth utilization per peer

**Logging:**
- Debug logs for chunk requests and peer selection
- Warn logs for failed downloads and retries
- Error logs for chunks that can't be downloaded from any peer
- Performance logs for unusually slow downloads

## Configuration

**Tunable Parameters:**
- `MAX_CONCURRENT_DOWNLOADS`: Default 10
- `MAX_DOWNLOADS_PER_PEER`: Default 3  
- `CHUNK_INFO_CACHE_TTL`: Default 60 seconds
- `DOWNLOAD_TIMEOUT`: Default 30 seconds
- `MAX_RETRY_ATTEMPTS`: Default 5
- `RETRY_BACKOFF_BASE`: Default 100ms

## Future Enhancements

**Priority-Based Downloads:**
- High priority for chunks blocking file read operations
- Normal priority for prefetch operations
- Low priority for background sync operations

**Predictive Prefetching:**
- Monitor file access patterns
- Preload likely-needed chunks in background
- Integrate with file system read-ahead logic

**Peer Reputation System:**
- Track long-term peer reliability
- Prefer peers with history of successful downloads
- Implement peer scoring based on multiple factors

**Bandwidth Optimization:**
- Compress chunks during transport (if beneficial)
- Implement chunk bundling for small chunks
- Support partial chunk downloads for seeking operations
