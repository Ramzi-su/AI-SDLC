import styles from './StepIndicator.module.css';

interface StepIndicatorProps {
  steps: string[];
  currentIndex: number;
  completedIndexes: number[];
}

export default function StepIndicator({ steps, currentIndex, completedIndexes }: StepIndicatorProps) {
  return (
    <div className={styles.container}>
      {steps.map((step, i) => {
        const isCompleted = completedIndexes.includes(i);
        const isCurrent = i === currentIndex;
        const isUpcoming = i > currentIndex;

        return (
          <div
            key={step}
            className={`${styles.step} ${isCompleted ? styles.completed : ''} ${isCurrent ? styles.current : ''} ${isUpcoming ? styles.upcoming : ''}`}
          >
            <div className={styles.indicator}>
              {isCompleted ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span className={styles.stepNum}>{i + 1}</span>
              )}
            </div>
            <span className={styles.stepLabel}>{step}</span>
            {i < steps.length - 1 && <div className={styles.connector} />}
          </div>
        );
      })}
    </div>
  );
}
