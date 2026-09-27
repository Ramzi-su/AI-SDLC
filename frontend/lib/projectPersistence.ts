import type { ProjectRecord } from '@/lib/api';
import type { PageData, PageGeneration, ProjectStore, WizardStep } from '@/store/projectStore';

// Store fields saved to the project's wizard_state. Transient UI state (loading, errors,
// selection, undo history) is left out, and page generations live in project.generated.
export const PERSISTED_KEYS = [
  'projectName', 'projectDescription', 'projectType',
  'frontPref', 'backPref', 'dbPref', 'architecturePref', 'complexityPref',
  'codingLevelPref', 'aiIntegrationPref', 'generationModePref', 'learningMode',
  'currentStep', 'pendingConfirmation',
  'frameworkData', 'layoutData', 'styleData',
  'pages', 'activePageId',
  'modelType', 'selectedModel',
] as const satisfies readonly (keyof ProjectStore)[];

export type WizardState = Pick<ProjectStore, (typeof PERSISTED_KEYS)[number]>;

export function serializeWizardState(state: ProjectStore): WizardState {
  return Object.fromEntries(PERSISTED_KEYS.map(key => [key, state[key]])) as WizardState;
}

/** Store updates are immutable, so comparing references is enough to spot a change. */
export function wizardStateChanged(a: ProjectStore, b: ProjectStore): boolean {
  return PERSISTED_KEYS.some(key => a[key] !== b[key]);
}

const STEP_BY_STATUS: Record<string, WizardStep> = {
  draft: 'framework',
  framework_confirmed: 'components',
  components_confirmed: 'style',
  style_confirmed: 'generate',
  generated: 'generate',
};

/**
 * Rebuilds the store from a saved project. Uses wizard_state when present; projects saved
 * before it existed are reconstructed from their confirmed steps.
 */
export function projectToStoreState(project: ProjectRecord): Partial<ProjectStore> {
  const layout = project.layout as { pages?: PageData[] } | null;
  const generated = project.generated as { pages?: Record<string, PageGeneration> } | null;
  const pages = layout?.pages?.length ? layout.pages : undefined;

  const fromConfirmedSteps: Partial<ProjectStore> = {
    projectName: project.name,
    projectDescription: project.description,
    projectType: project.project_type,
    currentStep: STEP_BY_STATUS[project.status] ?? 'framework',
    frameworkData: project.framework as ProjectStore['frameworkData'],
    layoutData: project.layout as ProjectStore['layoutData'],
    styleData: project.style as ProjectStore['styleData'],
    ...(pages && { pages, activePageId: pages[0].id }),
  };

  // Empty saved values must not hide data the backend has for confirmed steps.
  const saved = Object.fromEntries(
    Object.entries(project.wizard_state ?? {}).filter(([, value]) => value !== null && value !== undefined)
  ) as Partial<WizardState>;

  return {
    ...fromConfirmedSteps,
    ...saved,
    projectId: project.id,
    pageGenerations: generated?.pages && typeof generated.pages === 'object' ? generated.pages : {},
  };
}
