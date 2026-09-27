import { useProjectStore } from '@/store/projectStore';
import { PALETTE_CATEGORIES } from './palette';
import styles from './ComponentEditor.module.css';

export default function ComponentEditor() {
  const { activePageId, selectedComponentId, pages, updateComponentInPage, setSelectedComponent, pushCanvasHistory } = useProjectStore();

  const activePage = pages.find(p => p.id === activePageId);
  const selectedComponent = activePage?.components.find(c => c.id === selectedComponentId);

  if (!selectedComponent) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Properties</h2>
        </div>
        <div className={styles.emptyState}>
          Select a component on the canvas to edit its properties.
        </div>
      </div>
    );
  }

  const handleChange = (field: string, value: string | number) => {
    updateComponentInPage(activePageId, selectedComponent.id, { [field]: value });
  };

  const handleFunctionChange = (type: string) => {
    pushCanvasHistory();
    if (type === 'sketch') {
      updateComponentInPage(activePageId, selectedComponent.id, {
        type, name: 'Drawn shape', description: 'Freehand shape drawn by the user',
      });
      return;
    }
    const item = PALETTE_CATEGORIES.flatMap(c => c.items).find(i => i.type === type);
    if (!item) return;
    updateComponentInPage(activePageId, selectedComponent.id, {
      type: item.type, name: item.name, description: item.description,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Edit {selectedComponent.name}</h2>
        <button className={styles.closeBtn} onClick={() => setSelectedComponent(null)}>×</button>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Function</label>
        <select
          className={styles.input}
          value={selectedComponent.type}
          onChange={(e) => handleFunctionChange(e.target.value)}
        >
          {(selectedComponent.path || selectedComponent.type === 'sketch') && <option value="sketch">✏️ Unassigned drawing</option>}
          {PALETTE_CATEGORIES.map(cat => (
            <optgroup key={cat.label} label={cat.label}>
              {cat.items.map(item => (
                <option key={item.id} value={item.type}>{item.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selectedComponent.path && (
        <div className={styles.field}>
          <label className={styles.label}>Drawn outline</label>
          <button
            className={styles.input}
            onClick={() => {
              pushCanvasHistory();
              updateComponentInPage(activePageId, selectedComponent.id, {
                path: undefined, pathWidth: undefined, pathHeight: undefined, shapeKind: undefined,
              });
            }}
            title="Turn this shape into a plain rectangular component"
          >
            Remove outline (use a plain box)
          </button>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Custom Text / Title</label>
        <input 
          className={styles.input} 
          type="text"
          placeholder="e.g., Learn More, Welcome..."
          value={selectedComponent.customText || ''}
          onChange={(e) => handleChange('customText', e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Full Content (Markdown/HTML)</label>
        <textarea 
          className={styles.input} 
          rows={5}
          placeholder="Detailed content for this component..."
          value={selectedComponent.content || ''}
          onChange={(e) => handleChange('content', e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div className={styles.field}>
          <label className={styles.label}>Width (px)</label>
          <input 
            className={styles.input} 
            type="number"
            value={selectedComponent.width || 200}
            onChange={(e) => handleChange('width', parseInt(e.target.value) || 200)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Height (px)</label>
          <input 
            className={styles.input} 
            type="number"
            value={selectedComponent.height || 80}
            onChange={(e) => handleChange('height', parseInt(e.target.value) || 80)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div className={styles.field}>
          <label className={styles.label}>Position X</label>
          <input 
            className={styles.input} 
            type="number"
            value={selectedComponent.x || 0}
            onChange={(e) => handleChange('x', parseInt(e.target.value) || 0)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Position Y</label>
          <input 
            className={styles.input} 
            type="number"
            value={selectedComponent.y || 0}
            onChange={(e) => handleChange('y', parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{selectedComponent.path ? 'Color' : 'Custom Background Color'}</label>
        <input 
          type="color" 
          className={styles.input} 
          style={{ height: '40px', padding: '2px' }}
          value={selectedComponent.customColor || '#7C5CFC'}
          onChange={(e) => handleChange('customColor', e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Shape / Border Radius</label>
        <select 
          className={styles.input}
          value={selectedComponent.customShape || 'default'}
          onChange={(e) => handleChange('customShape', e.target.value)}
        >
          <option value="default">Default</option>
          <option value="square">Square (0px)</option>
          <option value="rounded">Rounded (8px)</option>
          <option value="pill">Pill (9999px)</option>
        </select>
      </div>

      <div className={styles.field} style={{ marginTop: 'auto' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Tip: These overrides will be passed to the code generation agent to style this specific component.
        </p>
      </div>
    </div>
  );
}
