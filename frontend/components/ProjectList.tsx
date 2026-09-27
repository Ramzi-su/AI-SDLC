'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ProjectSummary } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import styles from './ProjectList.module.css';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Choosing framework',
  framework_confirmed: 'Building layout',
  components_confirmed: 'Picking style',
  style_confirmed: 'Building pages',
  generated: 'Complete',
};

// Project descriptions carry the tech preferences appended at creation; show only the user's text.
const userDescription = (description: string) => description.split('\n\n[Tech Preferences')[0];

export default function ProjectList() {
  const { status, user } = useAuthStore();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Projects are private: load them for whoever is signed in (again after switching accounts).
  const verified = !!user?.email_verified;

  useEffect(() => {
    if (status !== 'authenticated' || !verified) return;
    api.listProjects()
      .then(setProjects)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load projects'));
  }, [status, user?.id, verified]);

  const handleDelete = async (project: ProjectSummary) => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteProject(project.id);
      setProjects(prev => prev?.filter(p => p.id !== project.id) ?? null);
    } catch (err) {
      alert(`Failed to delete project: ${err instanceof Error ? err.message : err}`);
    }
  };

  if (error) {
    return <p className={styles.error}>Could not load your projects ({error}). Is the backend running?</p>;
  }

  if (status === 'anonymous') {
    return (
      <p className={styles.signedOut}>
        <Link href="/login">Sign in</Link> to see your projects and learning progress.
      </p>
    );
  }

  if (status === 'authenticated' && !verified) {
    return (
      <p className={styles.signedOut}>
        📧 Confirm your email address to start building. <Link href="/project/new">Resend the link</Link>
      </p>
    );
  }

  if (status !== 'authenticated' || !projects || projects.length === 0) return null;

  return (
    <section className={styles.section} id="projects">
      <h2 className={styles.title}>Your projects</h2>
      <ul className={styles.list}>
        {projects.map(project => (
          <li key={project.id} className={styles.item}>
            <Link href={`/project/${project.id}`} className={styles.link}>
              <span className={styles.name}>{project.name}</span>
              <span className={styles.description}>{userDescription(project.description)}</span>
              <span className={styles.meta}>
                <span className={`${styles.status} ${project.status === 'generated' ? styles.statusDone : ''}`}>
                  {STATUS_LABELS[project.status] ?? project.status}
                </span>
                · updated {new Date(project.updated_at).toLocaleString()}
              </span>
            </Link>
            <button
              className={styles.delete}
              onClick={() => handleDelete(project)}
              title="Delete project"
              aria-label={`Delete ${project.name}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
