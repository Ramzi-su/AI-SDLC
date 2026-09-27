'use client';

import { useState } from 'react';
import LessonView from './LessonView';
import TutorChat from './TutorChat';
import QuizView from './QuizView';
import ChallengeView from './ChallengeView';
import { LearnContext } from './types';
import styles from './Learn.module.css';

type Tab = 'lesson' | 'ask' | 'quiz' | 'challenge';

const TABS: { id: Tab; label: string }[] = [
  { id: 'lesson', label: '📖 Lesson' },
  { id: 'ask', label: '💬 Ask' },
  { id: 'quiz', label: '❓ Quiz' },
  { id: 'challenge', label: '🏆 Challenges' },
];

/** Lesson, tutor, quiz and challenges. The lesson tab only exists for a project page. */
export default function LearnPanel(props: LearnContext) {
  const { project_id, page_id } = props.source;
  const hasPage = !!(project_id && page_id);
  const tabs = hasPage ? TABS : TABS.filter(t => t.id !== 'lesson');
  const [tab, setTab] = useState<Tab>(tabs[0].id);

  return (
    <div className={styles.panel}>
      <div className={styles.tabs} role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Views stay mounted so switching tabs keeps chat history and work in progress. */}
      <div className={styles.tabBody}>
        {hasPage && (
          <div hidden={tab !== 'lesson'}>
            <LessonView {...props} projectId={project_id!} pageId={page_id!} />
          </div>
        )}
        <div hidden={tab !== 'ask'}><TutorChat {...props} /></div>
        <div hidden={tab !== 'quiz'}><QuizView {...props} /></div>
        <div hidden={tab !== 'challenge'}><ChallengeView {...props} /></div>
      </div>
    </div>
  );
}
