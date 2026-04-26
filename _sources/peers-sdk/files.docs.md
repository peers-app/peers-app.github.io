# Chunked File Storage System

A content-addressable, peer-to-peer file storage system with automatic deduplication, streaming support, and resume capability.

## Quick Start

```typescript
import { Files, FileWriteStream, FileReadStream } from './files';

// Get file table instance
const fileTable = Files();

// Save a file
const fileData = Buffer.from('Hello, world!');
const savedFile = await fileTable.saveFile({
  fileId: 'unique-id',
  name: 'hello.txt',
  fileSize: fileData.length,
  mimeType: 'text/plain'
}, fileData);

// Retrieve a file
const retrievedData = await fileTable.getFile('unique-id');

// Stream large files
const writeStream = await fileTable.createWriteStream({
  fileId: 'large-file-id',
  name: 'large-file.bin',
  fileSize: 0, // Will be calculated
  mimeType: 'application/octet-stream'
});

await writeStream.write(chunk1);
await writeStream.write(chunk2);
const finalFile = await writeStream.finalize();

// Read streams for seeking and partial reads
const readStream = await fileTable.openReadStream('large-file-id');
await readStream.seek(1000);
const data = await readStream.read(512);
```

## Core Features

- **Content-Addressable Storage**: Files are stored as SHA-256 hashed chunks
- **Automatic Deduplication**: Identical chunks are stored only once
- **Memory Efficient**: Constant ~1MB RAM usage regardless of file size
- **Streaming Support**: Read/write large files without loading entirely into memory
- **Resume Capability**: Failed transfers can be resumed from any chunk
- **Scalable Architecture**: Uses recursive Merkle trees for files with >1000 chunks

## API Reference

### FileTable

The main interface for file operations.

#### `saveFile(metadata: IFileInput, data: Buffer): Promise<IFile>`
Saves a complete file to storage. Automatically chunks the data and handles deduplication.

#### `getFile(fileId: string): Promise<Buffer | null>`
Retrieves a complete file from storage. Returns null if file doesn't exist.

#### `deleteFile(fileId: string): Promise<void>`
Removes file metadata from database. Chunks are preserved for potential sharing with other files.

#### `createWriteStream(metadata: IFileInput): Promise<FileWriteStream>`
Creates a streaming interface for writing large files chunk by chunk.

#### `openReadStream(fileId: string): Promise<FileReadStream | null>`
Creates a streaming interface for reading files with seek support.

### FileWriteStream

Streaming write interface for large files.

#### `write(chunk: Buffer): Promise<void>`
Writes a chunk of data to the stream. Data is buffered and automatically processed into file chunks.

#### `finalize(): Promise<IFile>`
Completes the write operation and saves file metadata. Must be called to persist the file.

#### `abort(): Promise<void>`
Cancels the write operation and cleans up resources.

#### Progress Methods
- `getBytesWritten(): number` - Total bytes written so far
- `getChunkCount(): number` - Number of chunks created
- `isFinalized(): boolean` - Whether the stream has been finalized
- `isAborted(): boolean` - Whether the stream has been aborted

### FileReadStream

Streaming read interface with seeking capabilities.

#### `read(size?: number): Promise<Buffer | null>`
Reads up to `size` bytes from current position. If size is omitted, reads remainder of file.

#### `readAll(): Promise<Buffer>`
Reads entire file into memory. Use with caution for large files.

#### `seek(position: number): Promise<void>`
Sets the read position within the file. Supports random access across chunk boundaries.

#### Status Methods
- `getPosition(): number` - Current read position
- `getBytesRemaining(): number` - Bytes remaining from current position
- `isEOF(): boolean` - Whether at end of file
- `getMetadata(): IFile` - File metadata

## Storage Architecture

### Chunking Strategy
- Files are split into 1MB chunks (configurable via `FILE_CHUNK_SIZE`)
- Each chunk is hashed with SHA-256 and stored by hash
- Chunks are shared across files for deduplication

### Merkle Tree Indexing
Files with more than 1000 chunks use recursive indexing:
- Chunk hashes are stored in separate JSON index files
- Index files can themselves be chunked if they exceed the threshold
- This creates a tree structure that scales to infinite file sizes

### Memory Usage
The system maintains chunk hashes in memory during operations:
- Small files (<1000 chunks): ~32KB memory per 1GB file
- Large files: Index files are loaded on-demand
- Maximum memory usage for a 1TB file: ~44MB

### Database Schema
```typescript
interface IFile {
  fileId: string;           // Unique identifier
  name: string;             // Display name
  fileSize: number;         // Total file size in bytes
  fileHash: string;         // SHA-256 of chunk hashes JSON
  mimeType?: string;        // Optional MIME type
  chunkHashes?: string[];   // Direct chunk hashes (small files)
  indexFileId?: string;     // Reference to index file (large files)
  isIndexFile?: boolean;    // Marks internal index files
}
```

## Design Considerations for Contributors

### Performance
- Always use streaming APIs for files >10MB
- The system processes chunks in 1MB increments to balance memory usage and I/O efficiency
- Chunk deduplication happens automatically - identical chunks are never stored twice

### Error Handling
- Missing chunks throw specific errors that can be caught for retry logic
- Corrupted data is detected through SHA-256 verification
- Always call `finalize()` on write streams or data will be lost
- Use `abort()` to clean up failed write operations

### Concurrency
- Multiple streams can operate concurrently on different files
- Chunk storage is atomic - partial writes cannot corrupt the system
- Database operations use the ORM layer for transaction safety

### Testing
- Use `setFileOps()` to inject mock file operations for testing
- Use `setChunkIndexThreshold()` to test Merkle tree behavior with smaller files
- Remember to call `resetFileOps()` in test cleanup

### Future Extensibility
- The chunk hash format can be upgraded (currently SHA-256)
- Compression can be added at the chunk level
- Encryption can be implemented by wrapping the `FileOps` interface
- Garbage collection can be added to clean up unreferenced chunks

### Common Pitfalls
1. **Not calling finalize()**: Write streams must be finalized or data is lost
2. **Memory usage with large files**: Use streaming APIs, not `saveFile()`/`getFile()` for large files
3. **Circular dependencies**: Use `import type` for TypeScript type imports between files
4. **Chunk threshold assumptions**: Don't hardcode the 1000 chunk threshold - it's configurable

### Peer-to-Peer Considerations
- Chunks are identified by content hash, making them location-independent
- Missing chunks can be requested from any peer that has them
- The resume capability allows interrupted transfers to continue from the last successful chunk
- File metadata can be synchronized separately from chunk data

## Examples

### Large File Upload with Progress
```typescript
async function uploadLargeFile(fileData: Buffer, onProgress: (bytes: number) => void) {
  const writeStream = await fileTable.createWriteStream({
    fileId: newid(),
    name: 'upload.bin',
    fileSize: 0
  });
  
  const chunkSize = 64 * 1024; // 64KB chunks for progress updates
  for (let i = 0; i < fileData.length; i += chunkSize) {
    const chunk = fileData.subarray(i, i + chunkSize);
    await writeStream.write(chunk);
    onProgress(writeStream.getBytesWritten());
  }
  
  return await writeStream.finalize();
}
```

### Partial File Reading
```typescript
async function readFileRange(fileId: string, start: number, length: number): Promise<Buffer> {
  const readStream = await fileTable.openReadStream(fileId);
  if (!readStream) throw new Error('File not found');
  
  await readStream.seek(start);
  const data = await readStream.read(length);
  return data || Buffer.alloc(0);
}
```

### File Verification
```typescript
async function verifyFileIntegrity(fileId: string): Promise<boolean> {
  try {
    const file = await fileTable.get(fileId);
    if (!file) return false;
    
    const readStream = await fileTable.openReadStream(fileId);
    if (!readStream) return false;
    
    const data = await readStream.readAll();
    return data.length === file.fileSize;
  } catch {
    return false;
  }
}
```

This system provides a robust foundation for peer-to-peer file sharing with the performance and scalability needed for large file transfers.