'use client';

import { useEffect, useState } from 'react';
import { api, LearningActivity, LessonContent } from '@/lib/api';
import { LearnContext, errorMessage } from './types';
import styles from './Learn.module.css';

interface LessonViewProps extends LearnContext {
  projectId: string;
  pageId: string;
}

export default function LessonView({ projectId, pageId, level, model, onProgress }: LessonViewProps) {
  const [lesson, setLesson] = useState<LearningActivity<LessonContent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lessons are stored per page, so reopening the panel shows the same lesson instantly.
  useEffect(() => {
    let cancelled = false;
    api.createLesson({ project_id: projectId, page_id: pageId, level, model })
      .then(result => { if (!cancelled) setLesson(result); })
      .catch(err => { if (!cancelled) setError(errorMessage(err, 'Could not load the lesson')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, pageId, level, model]);

  const regenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      setLesson(await api.createLesson({ project_id: projectId, page_id: pageId, level, model, regenerate: true }));
    } catch (err) {
      setError(errorMessage(err, 'Could not regenerate the lesson'));
    } finally {
      setLoading(false);
    }
  };

  const markLearned = async () => {
    if (!lesson) return;
    try {
      setLesson(await api.completeLesson(lesson.id));
      onProgress();
    } catch (err) {
      setError(errorMessage(err, 'Could not save your progress'));
    }
  };

  if (loading) return <p className={styles.muted}>✍️ The teacher is preparing your lesson…</p>;
  if (error) {
    return (
      <div className={styles.errorBox}>
        {error}
        <button className="btn btn-ghost btn-sm" onClick={regenerate}>Try again</button>
      </div>
    );
  }
  if (!lesson) return null;

  const { content } = lesson;
  return (
    <div className={styles.lesson}>
      <h3 className={styles.heading}>{content.title}</h3>
      {content.summary && <p>{content.summary}</p>}

      <ol className={styles.sections}>
        {content.sections.map((section, i) => (
          <li key={i} className={styles.section}>
            <h4>{section.title}</h4>
            <p>{section.explanation}</p>
            {section.code && (
              <div className={styles.codeExcerpt}>
                <div className={styles.codeExcerptHeader}>
                  {section.file} · lines {section.start_line}–{section.end_line}
                </div>
                <pre><code>{section.code}</code></pre>
              </div>
            )}
          </li>
        ))}
      </ol>

      {content.key_concepts.length > 0 && (
        <div className={styles.concepts}>
          <h4>Key concepts</h4>
          <dl>
            {content.key_concepts.map(concept => (
              <div key={concept.name}>
                <dt>{concept.name}</dt>
                <dd>{concept.explanation}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className={styles.actions}>
        {lesson.completed ? (
          <span className={styles.success}>✅ Learned (+{lesson.points} pts)</span>
        ) : (
          <button className="btn btn-success" onClick={markLearned}>✅ I understood this (+10 pts)</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={regenerate}>🔄 Explain it differently</button>
      </div>
    </div>
  );
}
