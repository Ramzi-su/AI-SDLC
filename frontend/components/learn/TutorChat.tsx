'use client';

import { useState } from 'react';
import { api, ChatMessage } from '@/lib/api';
import { LearnContext, errorMessage } from './types';
import styles from './Learn.module.css';

export default function TutorChat({ source, level, model }: LearnContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const text = question.trim();
    if (!text || thinking) return;
    const history = messages;
    setMessages([...history, { role: 'user', content: text }]);
    setQuestion('');
    setThinking(true);
    setError(null);
    try {
      const { answer } = await api.askTutor({ question: text, history, ...source, level, model });
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      setError(errorMessage(err, 'The tutor could not answer'));
      setQuestion(text);
      setMessages(history);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className={styles.chat}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.muted}>
            {source.page_id
              ? 'Ask anything about this page’s code, e.g. “Why is the navbar a flex container?”'
              : 'Ask anything about HTML, CSS, JavaScript or web development.'}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? styles.userMessage : styles.tutorMessage}>
            {m.content}
          </div>
        ))}
        {thinking && <div className={styles.tutorMessage}>🤔 Thinking…</div>}
      </div>
      {error && <div className={styles.errorBox}>{error}</div>}
      <div className={styles.chatInput}>
        <textarea
          className="input textarea"
          rows={2}
          placeholder="Type your question… (Enter to send, Shift+Enter for a new line)"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn btn-primary" onClick={send} disabled={!question.trim() || thinking}>Ask</button>
      </div>
    </div>
  );
}
