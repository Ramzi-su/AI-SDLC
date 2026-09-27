'use client';

import { useProjectStore, FrameworkData } from '@/store/projectStore';
import styles from './FrameworkStep.module.css';
import AgentWaiting from './AgentWaiting';

interface FrameworkStepProps {
  onRegenerate: (feedback?: string) => void;
}

const TECH_ICONS: Record<string, string> = {
  react: '⚛️', nextjs: '▲', vue: '💚', nuxt: '💎', svelte: '🔥', vanilla: '🍦',
  fastapi: '⚡', nodejs: '🟢', nestjs: '🐈', 'spring boot': '🍃', go: '🐹', django: '🎸',
  postgresql: '🐘', mysql: '🐬', mongodb: '🍃', redis: '🔴', sqlite: '🪶',
  pgvector: '🐘', milvus: '🌌', qdrant: '🎯', pinecone: '🌲', none: '🚫',
};

const TECH_COLORS: Record<string, string> = {
  react: '#61DAFB', nextjs: '#FFFFFF', vue: '#42B883', nuxt: '#00DC82', svelte: '#FF3E00', vanilla: '#F7DF1E',
  fastapi: '#009688', nodejs: '#339933', nestjs: '#E0234E', 'spring boot': '#6DB33F', go: '#00ADD8', django: '#092E20',
  postgresql: '#336791', mysql: '#4479A1', mongodb: '#47A248', redis: '#DC382D', sqlite: '#003B57',
  pgvector: '#336791', milvus: '#0ea5e9', qdrant: '#ec4899', pinecone: '#10b981', none: '#64748b',
};

export default function FrameworkStep({ onRegenerate }: FrameworkStepProps) {
  const { frameworkData, isLoading } = useProjectStore();

  if (!frameworkData && !isLoading) {
    return (
      <AgentWaiting agentName="Framework Agent" className={styles.empty} onRetry={() => onRegenerate()} />
    );
  }

  if (!frameworkData) return null;

  const fw = frameworkData as FrameworkData;
  
  const getTechInfo = (tech: string) => {
    const key = tech?.toLowerCase() || '';
    return {
      name: tech || 'Unknown',
      icon: TECH_ICONS[key] || '📦',
      color: TECH_COLORS[key] || '#7C5CFC'
    };
  };

  const front = getTechInfo(fw.frontend_framework);
  const back = getTechInfo(fw.backend_language);
  const db = getTechInfo(fw.database);
  
  const prosList = Array.isArray(fw.pros) ? fw.pros : [];
  const consList = Array.isArray(fw.cons) ? fw.cons : [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>⚙️</span>
          Framework Recommendation
        </h1>
        <p className={styles.subtitle}>
          The Framework Agent analyzed your project and recommends:
        </p>
      </div>

      <div className={styles.recommendation} style={{ '--fw-color': front.color } as React.CSSProperties}>
        <div style={{ display: 'grid', gridTemplateColumns: fw.rag_implementation ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
          <div className={styles.fwHeader}>
            <span className={styles.fwIcon}>{front.icon}</span>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Frontend</div>
              <h2 className={styles.fwName}>{front.name.toUpperCase()}</h2>
            </div>
          </div>
          <div className={styles.fwHeader}>
            <span className={styles.fwIcon}>{back.icon}</span>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Backend</div>
              <h2 className={styles.fwName}>{back.name.toUpperCase()}</h2>
            </div>
          </div>
          <div className={styles.fwHeader}>
            <span className={styles.fwIcon}>{db.icon}</span>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Database</div>
              <h2 className={styles.fwName}>{db.name.toUpperCase()}</h2>
            </div>
          </div>
          {fw.rag_implementation && fw.vector_database && fw.vector_database !== 'none' && (
            <div className={styles.fwHeader}>
              <span className={styles.fwIcon}>{getTechInfo(fw.vector_database).icon}</span>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Vector DB</div>
                <h2 className={styles.fwName}>{getTechInfo(fw.vector_database).name.toUpperCase()}</h2>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <span className={`badge badge-primary`}>Architecture: {fw.architecture_style?.toUpperCase()}</span>
          <span className={`badge badge-primary`}>Complexity: {fw.complexity}</span>
          {fw.rag_implementation && <span className={`badge`} style={{background: 'var(--color-secondary)', color: 'white'}}>RAG Enabled</span>}
        </div>
        
        {fw.key_features && fw.key_features.length > 0 && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Key Features Identified:</strong>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
              {fw.key_features.map((feature, idx) => (
                <span key={idx} className="badge badge-outline" style={{ fontSize: '0.75rem' }}>{feature}</span>
              ))}
            </div>
          </div>
        )}
        <p className={styles.rationale}>{fw.rationale}</p>

        <div className={styles.prosConsGrid}>
          <div className={styles.prosSection}>
            <h4 className={styles.sectionTitle}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7L6 10L11 4" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Advantages
            </h4>
            <ul className={styles.list}>
              {prosList.map((pro, i) => (
                <li key={i} className={styles.proItem}>{pro}</li>
              ))}
            </ul>
          </div>
          <div className={styles.consSection}>
            <h4 className={styles.sectionTitle}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4 4L10 10M10 4L4 10" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Considerations
            </h4>
            <ul className={styles.list}>
              {consList.map((con, i) => (
                <li key={i} className={styles.conItem}>{con}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const feedback = prompt('What would you prefer? (e.g., "I prefer Vue" or "Something simpler")');
            if (feedback) onRegenerate(feedback);
          }}
          id="regenerate-framework-btn"
        >
          🔄 Regenerate with feedback
        </button>
      </div>
    </div>
  );
}
