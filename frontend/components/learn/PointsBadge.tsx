'use client';

import { useEffect, useState } from 'react';
import { api, LearningProgress } from '@/lib/api';
import { useProjectStore } from '@/store/projectStore';
import styles from './Learn.module.css';

/** Learning points, refreshed whenever an activity bumps the store's progress tick. */
export default function PointsBadge({ projectId }: { projectId?: string }) {
  const tick = useProjectStore(state => state.learningProgressTick);
  const [progress, setProgress] = useState<LearningProgress | null>(null);

  useEffect(() => {
    api.learningProgress(projectId).then(setProgress).catch(() => setProgress(null));
  }, [projectId, tick]);

  if (!progress) return null;
  const points = projectId ? progress.project_points ?? 0 : progress.total_points;

  return (
    <span className={styles.points} title={`${progress.total_points} points in total`}>
      🎓 {points} pts{projectId ? ' in this project' : ''}
    </span>
  );
}
