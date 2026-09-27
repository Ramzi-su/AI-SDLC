'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import { projectToStoreState } from '@/lib/projectPersistence';
import ProjectWizard from '@/components/wizard/ProjectWizard';
import RequireAuth from '@/components/auth/RequireAuth';
import styles from './page.module.css';

export default function OpenProjectPage() {
  return (
    <RequireAuth>
      <OpenProject />
    </RequireAuth>
  );
}

function OpenProject() {
  const { id } = useParams<{ id: string }>();
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The project just created in this tab is already in the store (the URL was swapped in place).
  const alreadyOpen = useProjectStore(state => state.projectId === id);

  useEffect(() => {
    if (useProjectStore.getState().projectId === id) return;
    let cancelled = false;
    api.getProject(id)
      .then(project => {
        if (cancelled) return;
        useProjectStore.getState().hydrate(projectToStoreState(project));
        setLoadedId(id);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load project');
      });
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <div className={styles.status}>
        <p>Could not open this project: {error}</p>
        <Link href="/" className="btn btn-secondary">Back to projects</Link>
      </div>
    );
  }

  if (!alreadyOpen && loadedId !== id) {
    return (
      <div className={styles.status}>
        <div className={styles.spinner} />
        <p>Loading project…</p>
      </div>
    );
  }

  return <ProjectWizard />;
}
