'use client';

import { useDeferredValue, useState } from 'react';
import { api, ChallengeContent, ChallengeGrade, ChallengeKind, ChallengeResult, LearningActivity } from '@/lib/api';
import { LearnContext, errorMessage } from './types';
import styles from './Learn.module.css';

const KINDS: { kind: ChallengeKind; icon: string; title: string; points: number; project: string; standalone: string }[] = [
  {
    kind: 'complete', icon: '🧩', title: 'Complete the code', points: 20,
    project: 'A part of this page’s code is removed. Write it back.',
    standalone: 'A part of an example is removed. Write it back.',
  },
  {
    kind: 'modify', icon: '🛠️', title: 'Modify the page', points: 30,
    project: 'Make a concrete change to this page, like a hover effect or a sticky navbar.',
    standalone: 'Make a concrete change to an example page.',
  },
  {
    kind: 'scratch', icon: '🏗️', title: 'Build from scratch', points: 40,
    project: 'Rebuild a component of this page yourself, with no code given.',
    standalone: 'Build a small component yourself from a description.',
  },
];

export default function ChallengeView({ source, level, model, onProgress }: LearnContext) {
  const [challenge, setChallenge] = useState<LearningActivity<ChallengeContent, ChallengeResult> | null>(null);
  const [code, setCode] = useState('');
  const [topic, setTopic] = useState('');
  const [lastGrade, setLastGrade] = useState<ChallengeGrade | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Re-render the preview at low priority so typing stays responsive.
  const previewCode = useDeferredValue(code);

  const needsTopic = !source.page_id;

  const start = async (kind: ChallengeKind) => {
    setBusy(`Preparing your challenge…`);
    setError(null);
    try {
      const created = await api.createChallenge({ kind, ...source, ...(needsTopic && { topic: topic.trim() }), level, model });
      setChallenge(created);
      setCode(created.content.starter_code);
      setLastGrade(null);
      setHintsShown(0);
    } catch (err) {
      setError(errorMessage(err, 'Could not create the challenge'));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!challenge) return;
    setBusy('Checking your code…');
    setError(null);
    try {
      const { activity, grade } = await api.submitChallenge(challenge.id, { code, level, model });
      setChallenge(activity);
      setLastGrade(grade);
      onProgress();
    } catch (err) {
      setError(errorMessage(err, 'Could not grade your code'));
    } finally {
      setBusy(null);
    }
  };

  const reveal = async () => {
    if (!challenge) return;
    if (!confirm('Show the solution? You can still finish the challenge, but it will not earn points.')) return;
    try {
      setChallenge(await api.revealSolution(challenge.id));
    } catch (err) {
      setError(errorMessage(err, 'Could not show the solution'));
    }
  };

  // Tab inserts spaces instead of leaving the editor.
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    const next = code.slice(0, selectionStart) + '  ' + code.slice(selectionEnd);
    setCode(next);
    requestAnimationFrame(() => el.setSelectionRange(selectionStart + 2, selectionStart + 2));
  };

  if (!challenge) {
    return (
      <div className={styles.starter}>
        {needsTopic && (
          <input
            className="input"
            placeholder="Topic, e.g. a pricing card, CSS grid, a dropdown menu…"
            value={topic}
            onChange={e => setTopic(e.target.value)}
          />
        )}
        <div className={styles.kindGrid}>
          {KINDS.map(k => (
            <button
              key={k.kind}
              className={styles.kindCard}
              onClick={() => start(k.kind)}
              disabled={!!busy || (needsTopic && !topic.trim())}
            >
              <span className={styles.kindIcon}>{k.icon}</span>
              <span className={styles.kindTitle}>{k.title}</span>
              <span className={styles.kindDesc}>{needsTopic ? k.standalone : k.project}</span>
              <span className={styles.kindPoints}>+{k.points} pts</span>
            </button>
          ))}
        </div>
        {busy && <p className={styles.muted}>{busy}</p>}
        {error && <div className={styles.errorBox}>{error}</div>}
      </div>
    );
  }

  const { content } = challenge;
  const attempts = challenge.result?.attempts ?? [];
  const revealed = challenge.result?.solution_revealed;

  return (
    <div className={styles.challenge}>
      <div className={styles.brief}>
        <h3 className={styles.heading}>{content.title}</h3>
        <p>{content.instructions}</p>
        {content.criteria.length > 0 && (
          <ul className={styles.criteria}>
            {content.criteria.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        )}
        {content.hints.slice(0, hintsShown).map((hint, i) => (
          <p key={i} className={styles.hint}>💡 Hint {i + 1}: {hint}</p>
        ))}
        <div className={styles.inlineActions}>
          {hintsShown < content.hints.length && !challenge.completed && (
            <button className="btn btn-ghost btn-sm" onClick={() => setHintsShown(n => n + 1)}>💡 Show a hint</button>
          )}
          {content.kind === 'complete' && !revealed && !challenge.completed && attempts.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={reveal}>👀 Show solution</button>
          )}
        </div>
        {content.solution && (
          <div className={styles.codeExcerpt}>
            <div className={styles.codeExcerptHeader}>Solution</div>
            <pre><code>{content.solution}</code></pre>
          </div>
        )}
      </div>

      <div className={styles.workspace}>
        <div className={styles.editorPane}>
          <div className={styles.paneTitle}>Your code</div>
          <textarea
            className={styles.editor}
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            spellCheck={false}
            readOnly={challenge.completed}
          />
        </div>
        <div className={styles.previewPane}>
          <div className={styles.paneTitle}>Live preview</div>
          <iframe className={styles.preview} srcDoc={previewCode} sandbox="allow-scripts" title="Challenge preview" />
        </div>
      </div>

      {lastGrade && (
        <div className={lastGrade.passed ? styles.gradePassed : styles.gradeFailed}>
          <strong>{lastGrade.passed ? '🎉 Passed' : '❌ Not yet'} · score {lastGrade.score}/100</strong>
          <p>{lastGrade.feedback}</p>
          {lastGrade.hint && <p>💡 {lastGrade.hint}</p>}
        </div>
      )}
      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.actions}>
        {challenge.completed ? (
          <>
            <span className={styles.success}>
              ✅ Completed in {attempts.length} attempt{attempts.length === 1 ? '' : 's'} · +{challenge.points} pts
            </span>
            <button className="btn btn-secondary" onClick={() => setChallenge(null)}>New challenge</button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={submit} disabled={!!busy}>
              {busy ?? 'Check my code'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCode(content.starter_code)} disabled={!!busy}>
              Reset code
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setChallenge(null)} disabled={!!busy}>
              Pick another challenge
            </button>
          </>
        )}
      </div>
    </div>
  );
}
