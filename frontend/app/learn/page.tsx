'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, LearningActivity } from '@/lib/api';
import { useProjectStore } from '@/store/projectStore';
import LearnPanel from '@/components/learn/LearnPanel';
import PointsBadge from '@/components/learn/PointsBadge';
import { LEVELS } from '@/components/learn/types';
import RequireAuth from '@/components/auth/RequireAuth';
import UserMenu from '@/components/auth/UserMenu';
import styles from './learn.module.css';

const LEVEL_STORAGE_KEY = 'learn_level';
const KIND_ICONS = { lesson: '📖', quiz: '❓', challenge: '🏆' } as const;

const activityTitle = (a: LearningActivity<Record<string, unknown>>) =>
  (a.content.title as string | undefined) ||
  (a.content.topic ? `Quiz: ${a.content.topic}` : a.kind === 'quiz' ? 'Quiz' : 'Activity');

export default function LearnPage() {
  return (
    <RequireAuth>
      <LearnHub />
    </RequireAuth>
  );
}

function LearnHub() {
  const { selectedModel, bumpLearningProgress, learningProgressTick } = useProjectStore();
  const [level, setLevel] = useState<string>('Beginner');
  const [model, setModel] = useState(selectedModel || 'codellama:7b');
  const [models, setModels] = useState<string[]>([]);
  const [history, setHistory] = useState<LearningActivity<Record<string, unknown>>[]>([]);

  useEffect(() => {
    api.listModels()
      .then(res => setModels((res.models as unknown as { name: string }[]).map(m => m.name)))
      .catch(() => setModels([]));
    // Remembered per browser; not available during server rendering.
    try {
      const saved = localStorage.getItem(LEVEL_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setLevel(saved);
    } catch {
      // Storage can be unavailable (private mode); the default level is fine.
    }
  }, []);

  useEffect(() => {
    api.learningActivities({ standalone: true }).then(setHistory).catch(() => setHistory([]));
  }, [learningProgressTick]);

  const changeLevel = (value: string) => {
    setLevel(value);
    try {
      localStorage.setItem(LEVEL_STORAGE_KEY, value);
    } catch {
      // Not persisted; still applies for this visit.
    }
  };

  const modelOptions = models.includes(model) ? models : [model, ...models];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← Home</Link>
        <h1 className={styles.title}>🎓 Learn web development</h1>
        <PointsBadge />
        <UserMenu />
      </header>

      <p className={styles.intro}>
        Practice on your own, without a project: ask the tutor anything, take a quiz on any topic, or solve
        coding challenges with a live preview. Points you earn here and in your projects add up.
      </p>

      <div className={styles.settings}>
        <label>
          Your level
          <select className="input" value={level} onChange={e => changeLevel(e.target.value)}>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label>
          AI model
          <select className="input" value={model} onChange={e => setModel(e.target.value)}>
            {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      <LearnPanel source={{}} level={level} model={model} onProgress={bumpLearningProgress} />

      {history.length > 0 && (
        <section className={styles.history}>
          <h2>Your recent practice</h2>
          <ul>
            {history.slice(0, 15).map(a => (
              <li key={a.id}>
                <span>{KIND_ICONS[a.kind]} {activityTitle(a)}</span>
                <span className={a.completed ? styles.done : styles.pending}>
                  {a.completed ? `✅ +${a.points} pts` : 'In progress'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
