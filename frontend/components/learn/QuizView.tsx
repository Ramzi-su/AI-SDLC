'use client';

import { useState } from 'react';
import { api, LearningActivity, QuizContent, QuizResult } from '@/lib/api';
import { LearnContext, errorMessage } from './types';
import styles from './Learn.module.css';

export default function QuizView({ source, level, model, onProgress }: LearnContext) {
  const [quiz, setQuiz] = useState<LearningActivity<QuizContent, QuizResult> | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsTopic = !source.page_id;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createQuiz({ ...source, ...(needsTopic && { topic: topic.trim() }), level, model });
      setQuiz(created);
      setAnswers(created.content.questions.map(() => null));
    } catch (err) {
      setError(errorMessage(err, 'Could not create the quiz'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!quiz) return;
    setBusy(true);
    setError(null);
    try {
      setQuiz(await api.submitQuiz(quiz.id, answers));
      onProgress();
    } catch (err) {
      setError(errorMessage(err, 'Could not submit the quiz'));
    } finally {
      setBusy(false);
    }
  };

  if (!quiz) {
    return (
      <div className={styles.starter}>
        <p>
          {needsTopic
            ? 'Get a 5-question quiz on any web-development topic.'
            : 'Test your understanding of this page with a 5-question quiz.'}{' '}
          Each correct answer is worth 5 points.
        </p>
        {needsTopic && (
          <input
            className="input"
            placeholder="Topic, e.g. CSS flexbox, JavaScript events, forms…"
            value={topic}
            onChange={e => setTopic(e.target.value)}
          />
        )}
        {error && <div className={styles.errorBox}>{error}</div>}
        <button className="btn btn-primary" onClick={start} disabled={busy || (needsTopic && !topic.trim())}>
          {busy ? 'Writing questions…' : 'Start quiz'}
        </button>
      </div>
    );
  }

  const result = quiz.completed ? quiz.result : null;
  const submittedAnswers = result?.answers ?? answers;

  return (
    <div className={styles.quiz}>
      {quiz.content.questions.map((q, qi) => (
        <fieldset key={qi} className={styles.question}>
          <legend>{qi + 1}. {q.question}</legend>
          {q.options.map((option, oi) => {
            const chosen = submittedAnswers[qi] === oi;
            const isAnswer = q.answer_index === oi;
            const cls = result ? (isAnswer ? styles.optionCorrect : chosen ? styles.optionWrong : '') : '';
            return (
              <label key={oi} className={`${styles.option} ${cls}`}>
                <input
                  type="radio"
                  name={`${quiz.id}-${qi}`}
                  checked={chosen}
                  disabled={!!result}
                  onChange={() => setAnswers(prev => prev.map((a, i) => (i === qi ? oi : a)))}
                />
                {option}
              </label>
            );
          })}
          {result && q.explanation && <p className={styles.explanation}>💡 {q.explanation}</p>}
        </fieldset>
      ))}

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.actions}>
        {result ? (
          <>
            <span className={styles.success}>
              {result.score}/{result.total} correct · +{quiz.points} pts
            </span>
            <button className="btn btn-secondary" onClick={() => setQuiz(null)}>New quiz</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={submit} disabled={busy || answers.some(a => a === null)}>
            {busy ? 'Checking…' : 'Submit answers'}
          </button>
        )}
      </div>
    </div>
  );
}
