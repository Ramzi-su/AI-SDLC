import { create } from 'zustand';

export interface FrameworkData {
  frontend_framework: string;
  backend_language: string;
  database: string;
  architecture_style: string;
  rag_implementation: boolean;
  vector_database: string;
  key_features: string[];
  rationale: string;
  pros: string[];
  cons: string[];
  complexity: string;
}

export interface ComponentData {
  id: string;
  name: string;
  type: string;
  description: string;
  variants?: string[];
  selected_variant?: string;
  order?: number;
  customText?: string;
  customColor?: string;
  customShape?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  content?: string;
  // Freehand outline drawn on the canvas, in a pathWidth x pathHeight box (scaled to width x height).
  path?: string;
  pathWidth?: number;
  pathHeight?: number;
  shapeKind?: 'freehand' | 'rectangle' | 'ellipse';
}

export interface PageData {
  id: string;
  name: string;
  locked: boolean;
  components: ComponentData[];
}

export interface LayoutData {
  page_name: string;
  components: ComponentData[];
}

export interface ColorToken {
  name: string;
  value: string;
  usage: string;
}

export interface TypographyToken {
  name: string;
  font_family: string;
  weight: string;
  size: string;
  usage: string;
}

export interface StyleData {
  palette_name: string;
  colors: ColorToken[];
  typography: TypographyToken[];
  border_radius: string;
  spacing_unit: string;
  mood: string;
}

export interface GeneratedFile {
  filename: string;
  content: string;
  language: string;
  preview_html?: string;
}

export interface GenerationData {
  files: GeneratedFile[];
  instructions: string;
  preview_html: string;
}

export interface PageGeneration {
  page_id: string;
  page_name: string;
  status: 'draft' | 'approved';
  attempt: number;
  files: GeneratedFile[];
  preview_html: string;
  explanation: string;
  fallback: boolean;
  feedback_history: string[];
}

export type WizardStep = 'project' | 'framework' | 'components' | 'style' | 'generate';

export interface ProjectStore {
  // Project
  projectId: string | null;
  projectName: string;
  projectDescription: string;
  projectType: string;
  frontPref: string;
  backPref: string;
  dbPref: string;
  architecturePref: string;
  complexityPref: string;
  codingLevelPref: string;
  aiIntegrationPref: string;
  generationModePref: string;
  // When on, each approved page opens a Learn panel before the next page is generated.
  learningMode: boolean;

  // Wizard state
  currentStep: WizardStep;
  isLoading: boolean;
  error: string | null;

  // Agent results
  frameworkData: FrameworkData | null;
  layoutData: LayoutData | null; // Acts as the Palette
  styleData: StyleData | null;
  generationData: GenerationData | null;
  pageGenerations: Record<string, PageGeneration>;

  // Site Builder State
  pages: PageData[];
  activePageId: string;
  selectedComponentId: string | null;
  // Snapshots of `pages` taken before each canvas edit, newest last.
  canvasHistory: PageData[][];
  // Snapshots undone by undoCanvas, newest last; cleared by any new edit.
  canvasFuture: PageData[][];

  // Bumped after any learning activity so points displays refetch (not persisted).
  learningProgressTick: number;

  // Confirmation state
  pendingConfirmation: WizardStep | null;

  // Selected model
  selectedModel: string;

  // Actions
  setProjectInfo: (name: string, description: string, type: string, frontPref: string, backPref: string, dbPref: string, architecturePref: string, complexityPref: string, codingLevelPref: string, aiIntegrationPref: string, generationModePref: string) => void;
  togglePageLock: (pageId: string) => void;
  setLearningMode: (on: boolean) => void;
  bumpLearningProgress: () => void;
  setProjectId: (id: string) => void;
  setCurrentStep: (step: WizardStep) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFrameworkData: (data: FrameworkData) => void;
  setLayoutData: (data: LayoutData) => void;
  setStyleData: (data: StyleData) => void;
  setGenerationData: (data: GenerationData) => void;
  setPageGeneration: (generation: PageGeneration) => void;
  setPendingConfirmation: (step: WizardStep | null) => void;
  setSelectedModel: (model: string) => void;
  updateColor: (index: number, value: string) => void;
  
  // Site Builder Actions
  addPage: (name: string) => void;
  setActivePage: (id: string) => void;
  setSelectedComponent: (id: string | null) => void;
  addComponentToPage: (pageId: string, component: ComponentData) => void;
  removeComponentFromPage: (pageId: string, componentId: string) => void;
  updateComponentInPage: (pageId: string, componentId: string, updates: Partial<ComponentData>) => void;
  moveComponentInPage: (pageId: string, fromIndex: number, toIndex: number) => void;
  pushCanvasHistory: () => void;
  undoCanvas: () => void;
  redoCanvas: () => void;

  reset: () => void;
  // Replaces the whole store with a saved project (fields not given fall back to defaults).
  hydrate: (state: Partial<ProjectStore>) => void;
}

const INITIAL_STATE = {
  projectId: null,
  projectName: '',
  projectDescription: '',
  projectType: 'web_app',
  frontPref: 'Let AI Decide',
  backPref: 'Let AI Decide',
  dbPref: 'Let AI Decide',
  architecturePref: 'Let AI Decide',
  complexityPref: 'Let AI Decide',
  codingLevelPref: 'Let AI Decide',
  aiIntegrationPref: 'Let AI Decide',
  generationModePref: 'Full Auto',
  learningMode: false,
  learningProgressTick: 0,
  currentStep: 'project' as WizardStep,
  isLoading: false,
  error: null,
  frameworkData: null,
  layoutData: null,
  styleData: null,
  generationData: null,
  pageGenerations: {},
  pendingConfirmation: null,
  selectedModel: 'codellama:7b',
  pages: [{ id: 'home', name: 'Home', locked: false, components: [] }],
  activePageId: 'home',
  selectedComponentId: null,
  canvasHistory: [] as PageData[][],
  canvasFuture: [] as PageData[][],
};

const MAX_CANVAS_HISTORY = 50;

// Swaps in a pages snapshot, keeping the active page and selection only if they still exist in it.
function restorePages(state: ProjectStore, pages: PageData[]) {
  const activePage = pages.find(p => p.id === state.activePageId) ?? pages[0];
  return {
    pages,
    activePageId: activePage.id,
    selectedComponentId: activePage.components.some(c => c.id === state.selectedComponentId)
      ? state.selectedComponentId
      : null,
  };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...INITIAL_STATE,

  setProjectInfo: (name, description, type, frontPref, backPref, dbPref, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref) =>
    set({ projectName: name, projectDescription: description, projectType: type, frontPref, backPref, dbPref, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref }),

  setProjectId: (id) => set({ projectId: id }),
  setLearningMode: (on) => set({ learningMode: on }),
  bumpLearningProgress: () => set(state => ({ learningProgressTick: state.learningProgressTick + 1 })),
  setCurrentStep: (step) => set({ currentStep: step }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setFrameworkData: (data) => set({ frameworkData: data }),
  setLayoutData: (data) => set({ layoutData: data }),
  setStyleData: (data) => set({ styleData: data }),
  setGenerationData: (data) => set({ generationData: data }),
  setPageGeneration: (generation) => set(state => ({
    pageGenerations: { ...state.pageGenerations, [generation.page_id]: generation }
  })),
  setPendingConfirmation: (step) => set({ pendingConfirmation: step }),
  setSelectedModel: (model) => set({ selectedModel: model }),

  updateColor: (index, value) => {
    const styleData = get().styleData;
    if (!styleData) return;
    const newColors = [...styleData.colors];
    newColors[index] = { ...newColors[index], value };
    set({ styleData: { ...styleData, colors: newColors } });
  },

  togglePageLock: (pageId) => set(state => ({
    pages: state.pages.map(p => p.id === pageId ? { ...p, locked: !p.locked } : p)
  })),

  addPage: (name) => {
    const newId = name.toLowerCase().replace(/\s+/g, '-');
    set(state => ({
      pages: [...state.pages, { id: newId, name, locked: false, components: [] }],
      activePageId: newId
    }));
  },

  setActivePage: (id) => set({ activePageId: id, selectedComponentId: null }),
  setSelectedComponent: (id) => set({ selectedComponentId: id }),

  addComponentToPage: (pageId, component) => {
    set(state => ({
      pages: state.pages.map(p => {
        if (p.id === pageId) {
          return { ...p, components: [...p.components, { ...component, id: `${component.id}-${Date.now()}` }] };
        }
        return p;
      })
    }));
  },

  removeComponentFromPage: (pageId, componentId) => {
    set(state => ({
      pages: state.pages.map(p => {
        if (p.id === pageId) {
          return { ...p, components: p.components.filter(c => c.id !== componentId) };
        }
        return p;
      }),
      selectedComponentId: state.selectedComponentId === componentId ? null : state.selectedComponentId
    }));
  },

  updateComponentInPage: (pageId, componentId, updates) => {
    set(state => ({
      pages: state.pages.map(p => {
        if (p.id === pageId) {
          return {
            ...p,
            components: p.components.map(c => c.id === componentId ? { ...c, ...updates } : c)
          };
        }
        return p;
      })
    }));
  },

  moveComponentInPage: (pageId, fromIndex, toIndex) => {
    set(state => ({
      pages: state.pages.map(p => {
        if (p.id === pageId) {
          const newComponents = [...p.components];
          const [moved] = newComponents.splice(fromIndex, 1);
          newComponents.splice(toIndex, 0, moved);
          return { ...p, components: newComponents };
        }
        return p;
      })
    }));
  },

  // Page updates are immutable, so a snapshot is just a reference to the current array.
  pushCanvasHistory: () => set(state => ({
    canvasHistory: [...state.canvasHistory, state.pages].slice(-MAX_CANVAS_HISTORY),
    canvasFuture: [],
  })),

  undoCanvas: () => set(state => {
    const previous = state.canvasHistory.at(-1);
    if (!previous) return {};
    return {
      ...restorePages(state, previous),
      canvasHistory: state.canvasHistory.slice(0, -1),
      canvasFuture: [...state.canvasFuture, state.pages],
    };
  }),

  redoCanvas: () => set(state => {
    const next = state.canvasFuture.at(-1);
    if (!next) return {};
    return {
      ...restorePages(state, next),
      canvasHistory: [...state.canvasHistory, state.pages].slice(-MAX_CANVAS_HISTORY),
      canvasFuture: state.canvasFuture.slice(0, -1),
    };
  }),

  reset: () => set(INITIAL_STATE),
  hydrate: (state) => set({ ...INITIAL_STATE, ...state }),
}));
