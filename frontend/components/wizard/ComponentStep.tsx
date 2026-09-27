'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useProjectStore, ComponentData } from '@/store/projectStore';
import ComponentEditor from './ComponentEditor';
import { PALETTE_CATEGORIES } from './palette';
import { CategoryIcon, ComponentIcon } from './componentIcons';
import type { LucideIcon } from 'lucide-react';
import { Circle, Eraser, Lock, LockOpen, Maximize, Minimize, MousePointer2, Palette, Pencil, Redo2, Square, Undo2 } from 'lucide-react';
import { Point, Sketch, strokeToSketch, dragToShape, toPath, hitsSketch } from '@/lib/sketch';
import styles from './ComponentStep.module.css';
import AgentWaiting from './AgentWaiting';

type Tool = 'select' | 'draw' | 'rectangle' | 'ellipse' | 'erase';

const SHAPE_NAMES: Record<Sketch['kind'], string> = {
  freehand: 'Drawn shape',
  rectangle: 'Drawn rectangle',
  ellipse: 'Drawn ellipse',
};

const DRAWING_TOOLS: { id: Tool; label: string; icon: LucideIcon; title: string }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2, title: 'Select, move and resize components' },
  { id: 'draw', label: 'Draw', icon: Pencil, title: 'Draw a freehand shape, then choose its function in the properties panel' },
  { id: 'rectangle', label: 'Rect', icon: Square, title: 'Drag to draw a rectangle (hold Shift for a square)' },
  { id: 'ellipse', label: 'Ellipse', icon: Circle, title: 'Drag to draw an ellipse (hold Shift for a circle)' },
  { id: 'erase', label: 'Erase', icon: Eraser, title: 'Erase drawn shapes by dragging over them' },
];

// Components are stored in fixed board units, not pixels, and drawn relative to the
// board's current size: a component that fills the board still fills it in fullscreen
// or in a resized window (pixel coordinates kept their size while the board grew).
const BOARD_WIDTH = 1000;
const BOARD_HEIGHT = 600;

interface ComponentStepProps {
  onRetry: () => void;
}

export default function ComponentStep({ onRetry }: ComponentStepProps) {
  const { 
    layoutData, isLoading, 
    pages, activePageId, selectedComponentId,
    addPage, setActivePage, setSelectedComponent, togglePageLock,
    addComponentToPage, removeComponentFromPage, updateComponentInPage,
    canvasHistory, canvasFuture, pushCanvasHistory, undoCanvas, redoCanvas
  } = useProjectStore();

  const [draggedPaletteItem, setDraggedPaletteItem] = useState<ComponentData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ width: BOARD_WIDTH, height: BOARD_HEIGHT });
  // Pixels per board unit on each axis
  const scaleX = boardSize.width / BOARD_WIDTH || 1;
  const scaleY = boardSize.height / BOARD_HEIGHT || 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setBoardSize({ width, height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Leaving fullscreen with Esc doesn't go through toggleFullscreen: follow the browser's state
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const [tool, setTool] = useState<Tool>('select');
  // The shape being drawn, shown before it is committed (x/y are its canvas offset).
  const [preview, setPreview] = useState<Pick<Sketch, 'x' | 'y' | 'path'> | null>(null);

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes, unless the user is typing in a field.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      if (isUndo) undoCanvas();
      else redoCanvas();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoCanvas, redoCanvas]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return PALETTE_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return PALETTE_CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      ),
    })).filter(cat => cat.items.length > 0);
  }, [searchQuery]);

  const toggleCategory = (label: string) => {
    setCollapsedCategories(prev => ({ ...prev, [label]: !prev[label] }));
  };

  if (!layoutData && !isLoading) {
    return (
      <AgentWaiting agentName="Component Agent" className={styles.empty} onRetry={onRetry} />
    );
  }

  if (!layoutData) return null;

  const activePage = pages.find(p => p.id === activePageId) || pages[0];

  const handlePaletteDragStart = (e: React.DragEvent, component: ComponentData) => {
    setDraggedPaletteItem(component);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Board coordinates (units, not pixels) of a pointer event, accounting for canvas scroll.
  const toCanvasPoint = (e: React.PointerEvent | React.DragEvent | PointerEvent, canvas: HTMLElement): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left + canvas.scrollLeft) / scaleX,
      y: (e.clientY - rect.top + canvas.scrollTop) / scaleY,
    };
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (activePage.locked) {
      alert("This page is locked. Unlock it to make changes.");
      return;
    }

    const { x, y } = toCanvasPoint(e, e.currentTarget as HTMLElement);

    if (draggedPaletteItem) {
      pushCanvasHistory();
      addComponentToPage(activePageId, { ...draggedPaletteItem, id: `comp_${Date.now()}`, x, y, width: 200, height: 80 });
      setDraggedPaletteItem(null);
    }
  };

  const handleMovePointerDown = (e: React.PointerEvent, comp: ComponentData) => {
    if (activePage.locked) return;
    
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'button' || target.closest('button') || target.classList.contains(styles.resizeHandle)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    setSelectedComponent(comp.id);

    const currentTarget = e.currentTarget as HTMLElement;
    currentTarget.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startCompX = comp.x || 0;
    const startCompY = comp.y || 0;
    let moved = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!moved) {
        pushCanvasHistory();
        moved = true;
      }
      let newX = startCompX + (moveEvent.clientX - startX) / scaleX;
      let newY = startCompY + (moveEvent.clientY - startY) / scaleY;
      
      if (isNaN(newX)) newX = startCompX;
      if (isNaN(newY)) newY = startCompY;

      updateComponentInPage(activePageId, comp.id, { 
        x: newX, 
        y: newY 
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      currentTarget.releasePointerCapture(upEvent.pointerId);
      currentTarget.removeEventListener('pointermove', onPointerMove);
      currentTarget.removeEventListener('pointerup', onPointerUp);
      currentTarget.removeEventListener('pointercancel', onPointerUp);
    };

    currentTarget.addEventListener('pointermove', onPointerMove);
    currentTarget.addEventListener('pointerup', onPointerUp);
    currentTarget.addEventListener('pointercancel', onPointerUp);
  };

  const handleResizePointerDown = (e: React.PointerEvent, comp: ComponentData) => {
    if (activePage.locked) return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = comp.width || 200;
    const startHeight = comp.height || 80;
    let resized = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!resized) {
        pushCanvasHistory();
        resized = true;
      }
      let newWidth = startWidth + (moveEvent.clientX - startX) / scaleX;
      let newHeight = startHeight + (moveEvent.clientY - startY) / scaleY;

      if (isNaN(newWidth)) newWidth = startWidth;
      if (isNaN(newHeight)) newHeight = startHeight;

      updateComponentInPage(activePageId, comp.id, { 
        width: Math.max(50, newWidth), 
        height: Math.max(30, newHeight) 
      });
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerUp);
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerUp);
  };

  // Freehand, rectangle and ellipse all share one gesture: press, drag, release to commit.
  const handleDrawPointerDown = (e: React.PointerEvent) => {
    if (tool !== 'draw' && tool !== 'rectangle' && tool !== 'ellipse') return;
    if (activePage.locked || e.button !== 0) return;
    e.preventDefault();

    const canvas = e.currentTarget as HTMLElement;
    canvas.setPointerCapture(e.pointerId);
    const start = toCanvasPoint(e, canvas);
    const points: Point[] = [start];

    const buildSketch = (end: Point, shiftKey: boolean): Sketch | null =>
      tool === 'draw' ? strokeToSketch(points) : dragToShape(tool, start, end, shiftKey);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const point = toCanvasPoint(moveEvent, canvas);
      if (tool === 'draw') {
        points.push(point);
        setPreview({ x: 0, y: 0, path: toPath(points, false) });
      } else {
        const shape = buildSketch(point, moveEvent.shiftKey);
        setPreview(shape && { x: shape.x, y: shape.y, path: shape.path });
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      canvas.releasePointerCapture(upEvent.pointerId);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      setPreview(null);
      if (upEvent.type === 'pointercancel') return;

      const sketch = buildSketch(toCanvasPoint(upEvent, canvas), upEvent.shiftKey);
      if (!sketch) return;
      pushCanvasHistory();
      addComponentToPage(activePageId, {
        id: `sketch_${Date.now()}`,
        name: SHAPE_NAMES[sketch.kind],
        type: 'sketch',
        description: `${SHAPE_NAMES[sketch.kind]} by the user`,
        x: sketch.x,
        y: sketch.y,
        width: sketch.width,
        height: sketch.height,
        path: sketch.path,
        pathWidth: sketch.width,
        pathHeight: sketch.height,
        shapeKind: sketch.kind,
      });
      // addComponentToPage suffixes the id, so select the component it just appended.
      const added = useProjectStore.getState().pages.find(p => p.id === activePageId)?.components.at(-1);
      if (added) setSelectedComponent(added.id);
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
  };

  const ERASER_RADIUS = 8;

  // The eraser removes any drawn shape the pointer passes over (palette components are left alone).
  const handleErasePointerDown = (e: React.PointerEvent) => {
    if (tool !== 'erase' || activePage.locked || e.button !== 0) return;
    e.preventDefault();

    const canvas = e.currentTarget as HTMLElement;
    canvas.setPointerCapture(e.pointerId);
    let erasedAny = false;

    const eraseAt = (point: Point) => {
      const page = useProjectStore.getState().pages.find(p => p.id === activePageId);
      const hits = page?.components.filter(c => hitsSketch(c, point, ERASER_RADIUS)) ?? [];
      if (hits.length === 0) return;
      // One undo step for the whole eraser gesture.
      if (!erasedAny) {
        pushCanvasHistory();
        erasedAny = true;
      }
      hits.forEach(c => removeComponentFromPage(activePageId, c.id));
    };

    eraseAt(toCanvasPoint(e, canvas));

    const onPointerMove = (moveEvent: PointerEvent) => eraseAt(toCanvasPoint(moveEvent, canvas));
    const onPointerUp = (upEvent: PointerEvent) => {
      canvas.releasePointerCapture(upEvent.pointerId);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
  };

  const handleAddPage = () => {
    const name = prompt('Enter page name (e.g., About, Dashboard):');
    if (name && name.trim()) {
      addPage(name.trim());
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div ref={containerRef} className={styles.container} style={isFullscreen ? { height: '100vh', border: 'none', borderRadius: 0 } : {}}>
      {/* 1. Palette (Left Panel) */}
      <aside className={styles.palette}>
        <div className={styles.paletteHeader}>
          <h2 className={styles.paletteTitle}>
            <span className={styles.titleIcon}><Palette size={16} aria-hidden /></span>
            Palette
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Drag components to the canvas
          </p>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.paletteList}>
          {filteredCategories.map((cat) => (
            <div key={cat.label} className={styles.categoryBlock}>
              <button
                className={styles.categoryHeader}
                onClick={() => toggleCategory(cat.label)}
              >
                <span className={styles.categoryIcon}><CategoryIcon label={cat.label} /></span>
                <span className={styles.categoryLabel}>{cat.label}</span>
                <span className={styles.categoryCount}>{cat.items.length}</span>
                <span className={`${styles.categoryChevron} ${collapsedCategories[cat.label] ? styles.chevronCollapsed : ''}`}>
                  ▾
                </span>
              </button>
              {!collapsedCategories[cat.label] && (
                <div className={styles.categoryItems}>
                  {cat.items.map((comp) => (
                    <div
                      key={comp.id}
                      className={styles.paletteItem}
                      draggable
                      onDragStart={(e) => handlePaletteDragStart(e, comp)}
                      title={comp.description}
                    >
                      <span className={styles.paletteItemIcon}><ComponentIcon type={comp.type} /></span>
                      <span className={styles.paletteItemName}>{comp.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* 2. Canvas (Center Panel) */}
      <main className={styles.workspace}>
        <div className={styles.tabsBar}>
          {pages.map(page => (
            <button
              key={page.id}
              className={`${styles.tab} ${activePageId === page.id ? styles.activeTab : ''}`}
              onClick={() => setActivePage(page.id)}
            >
              {page.name}
            </button>
          ))}
          <button className={styles.addPageBtn} onClick={handleAddPage} title="Add new page">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          
          <div className={styles.toolGroup} style={{ marginLeft: 'auto' }}>
            {DRAWING_TOOLS.map(t => (
              <button
                key={t.id}
                className={`${styles.toolBtn} ${tool === t.id ? styles.toolBtnActive : ''}`}
                onClick={() => setTool(t.id)}
                disabled={t.id !== 'select' && activePage.locked}
                title={t.title}
              >
                <t.icon size={14} aria-hidden /> {t.label}
              </button>
            ))}
          </div>

          <button
            className={styles.lockBtn}
            onClick={undoCanvas}
            disabled={canvasHistory.length === 0}
            title="Undo last canvas change (Ctrl+Z)"
          >
            <Undo2 size={14} aria-hidden /> Undo
          </button>
          <button
            className={styles.lockBtn}
            onClick={redoCanvas}
            disabled={canvasFuture.length === 0}
            title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
          >
            <Redo2 size={14} aria-hidden /> Redo
          </button>

          <button 
            className={styles.lockBtn} 
            onClick={toggleFullscreen} 
            title="Toggle Fullscreen"
          >
            {isFullscreen
              ? <><Minimize size={14} aria-hidden /> Exit Fullscreen</>
              : <><Maximize size={14} aria-hidden /> Fullscreen</>}
          </button>
          
          <button 
            className={styles.lockBtn} 
            onClick={() => togglePageLock(activePageId)} 
            title={activePage.locked ? "Unlock Page" : "Lock Page"}
            style={{ color: activePage.locked ? 'var(--color-error)' : 'var(--color-text-muted)' }}
          >
            {activePage.locked
              ? <><Lock size={14} aria-hidden /> Locked</>
              : <><LockOpen size={14} aria-hidden /> Unlocked</>}
          </button>
        </div>

        <div
          ref={canvasRef}
          className={`${styles.canvas} ${!activePage.locked && (tool === 'draw' || tool === 'rectangle' || tool === 'ellipse') ? styles.canvasDrawing : ''} ${!activePage.locked && tool === 'erase' ? styles.canvasErasing : ''}`}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onPointerDown={tool === 'erase' ? handleErasePointerDown : handleDrawPointerDown}
        >
          {preview && (
            <svg className={styles.strokePreview} viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} preserveAspectRatio="none">
              <path d={preview.path} transform={`translate(${preview.x} ${preview.y})`} vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          {activePage.components.length === 0 ? (
            <div className={styles.canvasEmpty}>
              <p>Drag components here, or pick Draw and sketch a shape</p>
            </div>
          ) : (
            activePage.components.map(comp => (
              <div
                key={comp.id}
                className={`${styles.canvasItem} ${comp.path ? styles.sketchItem : ''} ${selectedComponentId === comp.id ? styles.selectedCanvasItem : ''}`}
                style={{ 
                  position: 'absolute', 
                  left: `${(comp.x || 0) * scaleX}px`,
                  top: `${(comp.y || 0) * scaleY}px`,
                  width: comp.width ? `${comp.width * scaleX}px` : 'auto',
                  height: comp.height ? `${comp.height * scaleY}px` : 'auto',
                  backgroundColor: comp.path ? 'transparent' : comp.customColor || 'var(--color-bg-secondary)',
                  cursor: activePage.locked ? 'default' : 'move',
                  // While drawing or erasing, the gesture may start on top of existing components.
                  pointerEvents: tool !== 'select' ? 'none' : undefined,
                }}
                onPointerDown={(e) => handleMovePointerDown(e, comp)}
              >
                {comp.path && (
                  <svg
                    className={styles.sketchShape}
                    viewBox={`0 0 ${comp.pathWidth || comp.width || 1} ${comp.pathHeight || comp.height || 1}`}
                    preserveAspectRatio="none"
                    style={{ color: comp.customColor || 'var(--color-primary)' }}
                  >
                    <path
                      d={comp.path}
                      className={comp.path.endsWith('Z') ? styles.sketchClosed : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}
                <div className={styles.canvasItemContent}>
                  <span className={styles.canvasItemIcon}><ComponentIcon type={comp.type} size={18} /></span>
                  <div className={styles.canvasItemDetails}>
                    <span className={styles.canvasItemName}>{comp.customText || comp.name}</span>
                    <span className={styles.canvasItemType}>{comp.type}</span>
                  </div>
                </div>
                <div className={styles.canvasItemActions}>
                  <button 
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={(e) => { e.stopPropagation(); pushCanvasHistory(); removeComponentFromPage(activePageId, comp.id); }}
                    title="Remove"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                
                {/* Resize Handle */}
                {!activePage.locked && (
                  <div 
                    className={styles.resizeHandle}
                    onPointerDown={(e) => handleResizePointerDown(e, comp)}
                    title="Drag to resize"
                  />
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* 3. Editor (Right Panel) */}
      <ComponentEditor />
    </div>
  );
}
