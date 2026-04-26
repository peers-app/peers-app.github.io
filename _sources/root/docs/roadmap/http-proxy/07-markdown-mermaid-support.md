# Markdown Editor Mermaid Support

## Overview

Extend the Lexical markdown editor with support for Mermaid diagrams, including inline rendering and an edit/preview toggle.

## MermaidNode

**File:** `peers-ui/src/components/markdown-editor/mermaid-node.tsx`

A DecoratorNode that renders Mermaid diagrams:

```typescript
type SerializedMermaidNode = Spread<{
  code: string;
}, SerializedLexicalNode>;

class MermaidNode extends DecoratorNode<JSX.Element> {
  __code: string;

  static getType(): string { return 'mermaid'; }
  static clone(node: MermaidNode): MermaidNode;
  static importJSON(serializedNode: SerializedMermaidNode): MermaidNode;
  static importDOM(): DOMConversionMap | null;
  
  exportJSON(): SerializedMermaidNode;
  exportDOM(): DOMExportOutput;
  createDOM(config: EditorConfig): HTMLElement;
  updateDOM(): false;
  
  getCode(): string;
  setCode(code: string): void;
  
  decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element;
}

function $createMermaidNode(code: string): MermaidNode;
function $isMermaidNode(node: LexicalNode | null | undefined): node is MermaidNode;
```

## MermaidComponent

React component with edit/preview toggle:

```tsx
function MermaidComponent({ code, nodeKey, isSelected }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editCode, setEditCode] = useState(code);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Render diagram using mermaid library
  const renderDiagram = useCallback(async (diagramCode) => {
    await loadMermaid(); // Lazy load from CDN
    const { svg } = await mermaid.render(`mermaid-${nodeKey}`, diagramCode);
    setSvg(svg);
  }, [nodeKey]);

  useEffect(() => {
    renderDiagram(code);
  }, [code]);

  if (isEditing) {
    return (
      <div className="mermaid-editor-wrapper">
        <div className="d-flex justify-content-between">
          <span className="badge">Mermaid Diagram</span>
          <div>
            <button onClick={handleCancel}>Cancel</button>
            <button onClick={handleSave}>Save</button>
          </div>
        </div>
        <textarea value={editCode} onChange={e => setEditCode(e.target.value)} />
      </div>
    );
  }

  return (
    <div className="mermaid-preview-wrapper" onClick={() => setIsEditing(true)}>
      <div className="d-flex justify-content-between">
        <span className="badge">Mermaid Diagram</span>
        <button onClick={() => setIsEditing(true)}>Edit</button>
      </div>
      {loading && <div>Loading diagram...</div>}
      {error && <div className="alert-danger">{error}</div>}
      {svg && <div dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  );
}
```

## Mermaid Library Loading

Lazy load mermaid from CDN:

```typescript
let mermaidLoaded = false;
let mermaidLoadPromise: Promise<void> | null = null;

async function loadMermaid(): Promise<void> {
  if (mermaidLoaded) return;
  if (mermaidLoadPromise) return mermaidLoadPromise;

  mermaidLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = () => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'default',
        securityLevel: 'strict',
      });
      mermaidLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return mermaidLoadPromise;
}
```

## Mermaid Plugin

**File:** `peers-ui/src/components/markdown-editor/mermaid-plugin.tsx`

```typescript
export const INSERT_MERMAID_COMMAND: LexicalCommand<string> = createCommand('INSERT_MERMAID_COMMAND');

export function MermaidPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<string>(
      INSERT_MERMAID_COMMAND,
      (code) => {
        const mermaidNode = $createMermaidNode(code);
        $insertNodes([mermaidNode]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );
  }, [editor]);

  return null;
}
```

## Mermaid Insert Button

Toolbar button with template dropdown:

```tsx
const MERMAID_TEMPLATES = {
  flowchart: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Result 1]
    B -->|No| D[Result 2]`,
  sequence: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello!
    B-->>A: Hi!`,
  classDiagram: `classDiagram
    class Animal {
      +String name
      +makeSound()
    }
    Animal <|-- Dog`,
  stateDiagram: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing
    Processing --> [*]`,
  erDiagram: `erDiagram
    USER ||--o{ POST : creates
    POST ||--o{ COMMENT : has`,
  gantt: `gantt
    title Project Timeline
    section Phase 1
    Task 1 :a1, 2024-01-01, 30d`,
  pie: `pie showData
    title Market Share
    "Chrome" : 65
    "Safari" : 19`,
};

export function MermaidInsertButton() {
  const [editor] = useLexicalComposerContext();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleInsert = (templateKey) => {
    editor.dispatchCommand(INSERT_MERMAID_COMMAND, MERMAID_TEMPLATES[templateKey]);
    setShowDropdown(false);
  };

  return (
    <div className="position-relative">
      <button className="toolbar-item" onClick={() => setShowDropdown(!showDropdown)}>
        <i className="bi bi-diagram-3"></i>
      </button>
      {showDropdown && (
        <div className="dropdown-menu">
          <button onClick={() => handleInsert('flowchart')}>Flowchart</button>
          <button onClick={() => handleInsert('sequence')}>Sequence Diagram</button>
          <button onClick={() => handleInsert('classDiagram')}>Class Diagram</button>
          {/* ... more templates */}
        </div>
      )}
    </div>
  );
}
```

## Editor Integration

**Modify:** `peers-ui/src/components/markdown-editor/editor.tsx`

1. Add `enableMermaid` prop
2. Create config variants:

```typescript
const editorConfigWithMermaid = {
  ...editorConfig,
  nodes: [...baseNodes, MermaidNode],
};

const editorConfigWithAll = {
  ...editorConfig,
  nodes: [...baseNodes, ImageNode, MermaidNode],
};
```

3. Select config based on props:

```typescript
let config = editorConfig;
if (enableImages && enableMermaid) config = editorConfigWithAll;
else if (enableImages) config = editorConfigWithImages;
else if (enableMermaid) config = editorConfigWithMermaid;
```

4. Render plugins and toolbar items:

```tsx
<ToolbarPlugin>
  {enableImages && <ImageUploadButton />}
  {enableMermaid && <MermaidInsertButton />}
</ToolbarPlugin>
{/* ... */}
{enableMermaid && <MermaidPlugin />}
```

## Files to Create/Modify

**New:**
- `peers-ui/src/components/markdown-editor/mermaid-node.tsx`
- `peers-ui/src/components/markdown-editor/mermaid-plugin.tsx`

**Modify:**
- `peers-ui/src/components/markdown-editor/editor.tsx` - Add enableMermaid prop, include MermaidNode

## Effort Estimate

2-3 days

