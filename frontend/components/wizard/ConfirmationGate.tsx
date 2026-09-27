'use client';

import { useState } from 'react';
import styles from './ConfirmationGate.module.css';

interface ConfirmationGateProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onReject: () => void;
  onRegenerate: (feedback: string) => void;
}

export default function ConfirmationGate({
  title,
  description,
  onConfirm,
  onReject,
  onRegenerate,
}: ConfirmationGateProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleRegenerate = () => {
    if (feedback.trim()) {
      onRegenerate(feedback.trim());
      setFeedback('');
      setShowFeedback(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.gate}>
        <div className={styles.gateIcon}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="var(--color-primary)" strokeWidth="2"/>
            <path d="M12 16L15 19L20 13" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h3 className={styles.gateTitle}>{title}</h3>
        <p className={styles.gateDesc}>{description}</p>

        {!showFeedback ? (
          <div className={styles.gateActions}>
            <button
              className="btn btn-success"
              onClick={onConfirm}
              id="confirm-step-btn"
            >
              ✅ Approve & Continue
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowFeedback(true)}
              id="modify-step-btn"
            >
              ✏️ Request Changes
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onReject}
              id="reject-step-btn"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <div className={styles.feedbackSection}>
            <textarea
              className="input textarea"
              placeholder="Describe what you'd like to change..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              autoFocus
              id="feedback-input"
            />
            <div className={styles.feedbackActions}>
              <button
                className="btn btn-primary"
                onClick={handleRegenerate}
                disabled={!feedback.trim()}
                id="submit-feedback-btn"
              >
                🔄 Regenerate
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowFeedback(false); setFeedback(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
