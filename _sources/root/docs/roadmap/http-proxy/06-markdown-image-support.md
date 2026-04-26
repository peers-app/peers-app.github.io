# Markdown Editor Image Support

## Overview

Extend the Lexical markdown editor with support for embedded images, including upload to the peers file system and rendering within the editor.

## ImageNode

**File:** `peers-ui/src/components/markdown-editor/image-node.tsx`

A DecoratorNode that renders images within the editor.

```typescript
interface ImagePayload {
  src: string;
  altText?: string;
  width?: number;
  height?: number;
  fileId?: string;  // If using peers file system
}

type SerializedImageNode = Spread<{
  src: string;
  altText?: string;
  width?: number;
  height?: number;
  fileId?: string;
}, SerializedLexicalNode>;

class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText?: string;
  __width?: number;
  __height?: number;
  __fileId?: string;

  static getType(): string { return 'image'; }
  static clone(node: ImageNode): ImageNode;
  static importJSON(serializedNode: SerializedImageNode): ImageNode;
  static importDOM(): DOMConversionMap | null;
  
  exportJSON(): SerializedImageNode;
  exportDOM(): DOMExportOutput;
  createDOM(config: EditorConfig): HTMLElement;
  updateDOM(): false;
  
  decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element;
}

function $createImageNode(payload: ImagePayload): ImageNode;
function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode;
```

## ImageComponent

React component rendered by the ImageNode:

```tsx
function ImageComponent({ src, altText, width, height, fileId, nodeKey }) {
  const [imageSrc, setImageSrc] = useState(src);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load from peers file system if fileId provided
  useEffect(() => {
    if (fileId) {
      rpcServerCalls.getFileContentsBase64(fileId)
        .then(base64 => setImageSrc(`data:image/...;base64,${base64}`))
        .catch(err => setError('Failed to load image'));
    }
  }, [fileId]);

  return (
    <span className="image-node-wrapper">
      <img src={imageSrc} alt={altText} style={{...}} />
      {altText && <span className="image-caption">{altText}</span>}
    </span>
  );
}
```

## Image Plugin

**File:** `peers-ui/src/components/markdown-editor/image-plugin.tsx`

Plugin that handles the INSERT_IMAGE_COMMAND:

```typescript
export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> = createCommand('INSERT_IMAGE_COMMAND');

export function ImagePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<ImagePayload>(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const imageNode = $createImageNode(payload);
        $insertNodes([imageNode]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return null;
}
```

## Image Upload Button

Toolbar button for uploading images:

```tsx
export function ImageUploadButton() {
  const [editor] = useLexicalComposerContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate: image type, max 10MB
    
    // Read as base64
    const base64 = await readFileAsBase64(file);
    
    // Save to peers file system
    const savedFile = await rpcServerCalls.saveFile({
      name: file.name,
      mimeType: file.type,
      data: base64,
      encoding: 'base64',
      fileId: newid(),
    });
    
    // Insert image node
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
      src: `peers-file://${savedFile.fileId}`,
      altText: file.name,
      fileId: savedFile.fileId,
    });
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFileSelect} />
      <button className="toolbar-item" onClick={() => inputRef.current?.click()}>
        <i className="bi bi-image"></i>
      </button>
    </>
  );
}
```

## Editor Integration

**Modify:** `peers-ui/src/components/markdown-editor/editor.tsx`

1. Add ImageNode to nodes array when `enableImages` prop is true:

```typescript
const editorConfigWithImages = {
  ...editorConfig,
  nodes: [...baseNodes, ImageNode],
};
```

2. Add `enableImages` prop:

```typescript
interface IMarkdownEditorProps {
  // ... existing props
  enableImages?: boolean;
}
```

3. Conditionally render plugins:

```tsx
<LexicalComposer initialConfig={enableImages ? editorConfigWithImages : editorConfig}>
  {/* ... */}
  {enableImages && <ImagePlugin />}
  {/* ... */}
</LexicalComposer>
```

## Toolbar Integration

**Modify:** `peers-ui/src/components/markdown-editor/toolbar.tsx`

Add children prop for additional toolbar items:

```typescript
interface IToolbarProps {
  topRightControls?: IToolbarControl[];
  children?: React.ReactNode;
}

// In render:
{props.children && (
  <>
    <Divider />
    {props.children}
  </>
)}
```

Usage in editor:
```tsx
<ToolbarPlugin>
  {enableImages && <ImageUploadButton />}
</ToolbarPlugin>
```

## Files to Create/Modify

**New:**
- `peers-ui/src/components/markdown-editor/image-node.tsx`
- `peers-ui/src/components/markdown-editor/image-plugin.tsx`

**Modify:**
- `peers-ui/src/components/markdown-editor/editor.tsx` - Add enableImages prop, include ImageNode
- `peers-ui/src/components/markdown-editor/toolbar.tsx` - Add children prop

## Effort Estimate

2-3 days

