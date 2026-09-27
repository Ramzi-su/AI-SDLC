'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import { serializeWizardState, wizardStateChanged } from '@/lib/projectPersistence';
import StepIndicator from '@/components/wizard/StepIndicator';
import ProjectStep from '@/components/wizard/ProjectStep';
import FrameworkStep from '@/components/wizard/FrameworkStep';
import ComponentStep from '@/components/wizard/ComponentStep';
import StyleStep from '@/components/wizard/StyleStep';
import PageBuildStep from '@/components/wizard/PageBuildStep';
import ConfirmationGate from '@/components/wizard/ConfirmationGate';
import styles from './ProjectWizard.module.css';

const STEPS = ['project', 'framework', 'components', 'style', 'generate'] as const;
const STEP_LABELS = ['Project', 'Framework', 'Components', 'Style', 'Build Pages'];

const AUTOSAVE_DELAY_MS = 800;

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Unsaved changes…',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Save failed, will retry on next change',
};

export default function ProjectWizard() {
  const store = useProjectStore();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Autosave the wizard state to the project in Postgres shortly after every change.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;

    const save = async () => {
      const state = useProjectStore.getState();
      if (!state.projectId) return;
      dirty = false;
      setSaveStatus('saving');
      try {
        await api.saveWizardState(state.projectId, serializeWizardState(state));
        if (!dirty) setSaveStatus('saved');
      } catch {
        dirty = true;
        setSaveStatus('error');
      }
    };

    const unsubscribe = useProjectStore.subscribe((state, prev) => {
      if (!state.projectId) return;
      if (state.projectId === prev.projectId && !wizardStateChanged(state, prev)) return;
      dirty = true;
      setSaveStatus('pending');
      clearTimeout(timer);
      timer = setTimeout(save, AUTOSAVE_DELAY_MS);
    });

    // Don't lose the last edits when the tab closes or the user navigates away mid-debounce.
    const flush = () => {
      const state = useProjectStore.getState();
      if (dirty && state.projectId) {
        dirty = false;
        api.saveWizardStateOnExit(state.projectId, serializeWizardState(state));
      }
    };
    window.addEventListener('pagehide', flush);

    return () => {
      unsubscribe();
      clearTimeout(timer);
      flush();
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  const currentIndex = STEPS.indexOf(store.currentStep);

  const handleRunAgent = async (step: 'framework' | 'components' | 'style' | 'generate', feedback?: string, overrideProjectId?: string) => {
    const currentProjectId = overrideProjectId || useProjectStore.getState().projectId;
    if (!currentProjectId) return;
    store.setLoading(true);
    store.setError(null);

    try {
      const result = await api.runAgent({
        project_id: currentProjectId,
        step,
        model: store.selectedModel,
        user_feedback: feedback,
      }) as Record<string, unknown>;

      const data = result.data as Record<string, unknown>;

      switch (step) {
        case 'framework':
          store.setFrameworkData(data as never);
          break;
        case 'components':
          store.setLayoutData(data as never);
          break;
        case 'style':
          store.setStyleData(data as never);
          break;
        case 'generate':
          store.setGenerationData(data as never);
          break;
      }

      store.setPendingConfirmation(step);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Agent execution failed');
    } finally {
      store.setLoading(false);
    }
  };

  // A reopened project can land on a step whose agent never finished (e.g. the tab was closed
  // mid-run); start it again so the step isn't stuck empty.
  useEffect(() => {
    const { currentStep, frameworkData, layoutData, styleData, isLoading } = useProjectStore.getState();
    if (isLoading) return;
    if (
      (currentStep === 'framework' && !frameworkData) ||
      (currentStep === 'components' && !layoutData) ||
      (currentStep === 'style' && !styleData)
    ) {
      handleRunAgent(currentStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  const handleConfirm = async (step: 'framework' | 'components' | 'style' | 'generate') => {
    if (!store.projectId) return;

    try {
      let data: Record<string, unknown> = {};
      switch (step) {
        case 'framework':
          data = store.frameworkData as never;
          break;
        case 'components':
          data = { 
            pages: store.pages, 
            components: store.pages.flatMap(p => p.components) 
          } as never;
          break;
        case 'style':
          data = store.styleData as never;
          break;
        case 'generate':
          data = store.generationData as never;
          break;
      }

      await api.confirmStep(store.projectId, {
        step,
        approved: true,
        modifications: data,
      });

      store.setPendingConfirmation(null);

      const nextIndex = STEPS.indexOf(step) + 1;
      if (nextIndex < STEPS.length) {
        const nextStep = STEPS[nextIndex];
        store.setCurrentStep(nextStep);
        if (nextStep !== 'project' && nextStep !== 'generate') {
          await handleRunAgent(nextStep);
        }
      }
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Confirmation failed');
    }
  };

  const handleReject = () => {
    store.setPendingConfirmation(null);
  };

  // Back to the previous step. Its result is kept; its confirmation is shown again,
  // otherwise an already-confirmed step would have no way to move forward.
  const handlePrevious = () => {
    if (currentIndex <= 0) return;
    const prev = STEPS[currentIndex - 1];
    const hasResult =
      (prev === 'framework' && store.frameworkData) ||
      (prev === 'components' && store.layoutData) ||
      (prev === 'style' && store.styleData);
    store.setError(null);
    store.setPendingConfirmation(hasResult ? prev : null);
    store.setCurrentStep(prev);
  };

  const handleGeneratePage = async (pageId: string, feedback?: string) => {
    if (!store.projectId) return;
    store.setLoading(true);
    store.setError(null);

    try {
      const generation = await api.generatePage({
        project_id: store.projectId,
        page_id: pageId,
        model: store.selectedModel,
        user_feedback: feedback,
      });
      store.setPageGeneration(generation);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Page generation failed');
    } finally {
      store.setLoading(false);
    }
  };

  const handleApprovePage = async (pageId: string) => {
    if (!store.projectId) return;
    store.setError(null);

    try {
      const result = await api.approvePage({ project_id: store.projectId, page_id: pageId });
      store.setPageGeneration(result.generation);
      // In learning mode the learner studies the approved page first and continues manually.
      if (result.next_page_id && !useProjectStore.getState().learningMode) {
        await handleGeneratePage(result.next_page_id);
      }
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Page approval failed');
    }
  };

  const handleCreateProject = async () => {
    store.setLoading(true);
    store.setError(null);

    try {
      const prefText = `\n\n[Tech Preferences: Frontend: ${store.frontPref}, Backend: ${store.backPref}, DB: ${store.dbPref}, Architecture: ${store.architecturePref}, Complexity: ${store.complexityPref}, Audience Coding Level: ${store.codingLevelPref}, AI Integration: ${store.aiIntegrationPref}, Generation Mode: ${store.generationModePref}]`;
      const finalDescription = store.projectDescription + prefText;

      const details = { name: store.projectName, description: finalDescription, project_type: store.projectType };
      // Back on step 1 after the project exists: update it instead of creating a duplicate
      const existingId = useProjectStore.getState().projectId;
      const project = (existingId
        ? await api.updateProject(existingId, details)
        : await api.createProject(details)) as Record<string, unknown>;
      store.setPendingConfirmation(null);

      store.setProjectId(project.id as string);
      store.setCurrentStep('framework');
      // Give the project a permanent URL (without remounting) so a refresh reopens it.
      window.history.replaceState(null, '', `/project/${project.id}`);

      await handleRunAgent('framework', undefined, project.id as string);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      store.setLoading(false);
    }
  };

  return (
    <div className={styles.wizardPage}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </Link>
          <h2 className={styles.sidebarTitle}>New Project</h2>
        </div>

        <StepIndicator
          steps={STEP_LABELS}
          currentIndex={currentIndex}
          completedIndexes={STEPS.slice(0, currentIndex).map((_, i) => i)}
        />

        {store.projectId && (
          <div className={styles.projectMeta}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Project ID</span>
              <span className={styles.metaValue}>{store.projectId}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Model</span>
              <span className={styles.metaValue}>{store.selectedModel}</span>
            </div>
            {saveStatus !== 'idle' && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Saved</span>
                <span className={`${styles.metaValue} ${saveStatus === 'error' ? styles.saveError : ''}`}>
                  {SAVE_STATUS_LABELS[saveStatus]}
                </span>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        {store.error && (
          <div className={styles.errorBanner}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {store.error}
            <button className={styles.errorDismiss} onClick={() => store.setError(null)}>×</button>
          </div>
        )}

        {currentIndex > 0 && (
          <button
            className={`btn btn-ghost btn-sm ${styles.previousStep}`}
            onClick={handlePrevious}
            disabled={store.isLoading}
            title={store.isLoading ? 'Wait for the agent to finish' : undefined}
          >
            ← Previous step
          </button>
        )}

        <div className={styles.stepContent}>
          {store.currentStep === 'project' && (
            <ProjectStep onSubmit={handleCreateProject} />
          )}

          {store.currentStep === 'framework' && (
            <>
              <FrameworkStep onRegenerate={(feedback) => handleRunAgent('framework', feedback)} />
              {store.pendingConfirmation === 'framework' && store.frameworkData && (
                <ConfirmationGate
                  title="Confirm Tech Stack"
                  description={`The agent recommends ${store.frameworkData.frontend_framework}, ${store.frameworkData.backend_language}, and ${store.frameworkData.database}. Do you approve this stack?`}
                  onConfirm={() => handleConfirm('framework')}
                  onReject={handleReject}
                  onRegenerate={(feedback) => handleRunAgent('framework', feedback)}
                />
              )}
            </>
          )}

          {store.currentStep === 'components' && (
            <>
              <ComponentStep onRetry={() => handleRunAgent('components')} />
              {store.pendingConfirmation === 'components' && store.layoutData && (
                <ConfirmationGate
                  title="Confirm Site Builder"
                  description={`You have built ${store.pages.length} page(s). Click confirm when your site architecture is ready.`}
                  onConfirm={() => handleConfirm('components')}
                  onReject={handleReject}
                  onRegenerate={(feedback) => handleRunAgent('components', feedback)}
                />
              )}
            </>
          )}

          {store.currentStep === 'style' && (
            <>
              <StyleStep onRegenerate={(feedback) => handleRunAgent('style', feedback)} />
              {store.pendingConfirmation === 'style' && store.styleData && (
                <ConfirmationGate
                  title="Confirm Design System"
                  description={`Palette "${store.styleData.palette_name}" generated. Review colors and typography.`}
                  onConfirm={() => handleConfirm('style')}
                  onReject={handleReject}
                  onRegenerate={(feedback) => handleRunAgent('style', feedback)}
                />
              )}
            </>
          )}

          {store.currentStep === 'generate' && (
            <PageBuildStep onGenerate={handleGeneratePage} onApprove={handleApprovePage} />
          )}
        </div>

        {store.isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>Agent is working...</p>
          </div>
        )}
      </main>
    </div>
  );
}
