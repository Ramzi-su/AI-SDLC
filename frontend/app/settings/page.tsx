'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import RequireAuth from '@/components/auth/RequireAuth';
import styles from './settings.module.css';

interface LocalModel {
  name: string;
  size: number;
  modified_at: string;
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const router = useRouter();
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  
  const [pullModelName, setPullModelName] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState({ status: '', completed: 0, total: 0 });

  const [geminiKey, setGeminiKey] = useState('');
  const [openAIKey, setOpenAIKey] = useState('');

  // State is only set in promise callbacks, so this is safe to call from an effect.
  const fetchModels = () =>
    api.listModels()
      // The ollama API returns an object with a 'models' array
      .then(res => setLocalModels((res.models as unknown as LocalModel[]) || []))
      .catch(err => console.error('Failed to fetch models:', err))
      .finally(() => setIsLoadingModels(false));

  const refreshModels = () => {
    setIsLoadingModels(true);
    fetchModels();
  };

  useEffect(() => {
    fetchModels();
    
    // Load keys from local storage after mount (not available during server rendering)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGeminiKey(localStorage.getItem('gemini_api_key') || '');
    setOpenAIKey(localStorage.getItem('openai_api_key') || '');
  }, []);

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) return;
    
    try {
      await api.deleteModel(modelName);
      refreshModels();
    } catch (err) {
      alert(`Failed to delete model: ${err}`);
    }
  };

  const handlePullModel = async () => {
    if (!pullModelName.trim()) return;
    
    setIsPulling(true);
    setPullProgress({ status: 'Starting download...', completed: 0, total: 0 });
    
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      // This streaming request bypasses the API client, so make sure the access token is fresh first.
      await api.me();
      const response = await fetch(`${API_BASE}/api/models/pull`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model_name: pullModelName.trim() })
      });

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.error) {
              throw new Error(data.error);
            }
            setPullProgress(prev => ({
              status: data.status || prev.status,
              completed: data.completed || prev.completed,
              total: data.total || prev.total
            }));
          } catch {
            // Ignore parse errors from partial chunks
          }
        }
      }
      
      setPullProgress({ status: 'Success! Model downloaded.', completed: 1, total: 1 });
      setPullModelName('');
      refreshModels();
    } catch (err) {
      setPullProgress({ status: `Error: ${err}`, completed: 0, total: 1 });
    } finally {
      setIsPulling(false);
    }
  };

  const saveCloudKeys = () => {
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('openai_api_key', openAIKey);
    alert('Cloud API keys saved successfully to your browser storage.');
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const percentage = pullProgress.total > 0 
    ? Math.round((pullProgress.completed / pullProgress.total) * 100) 
    : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button 
          className="btn btn-ghost" 
          onClick={() => router.push('/')} 
          style={{ marginBottom: 'var(--space-md)', paddingLeft: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 10H5M5 10L10 5M5 10L10 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Home
        </button>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>⚙️</span>
          Settings & Control Center
        </h1>
        <p className={styles.subtitle}>
          Manage your local AI models and configure cloud providers for hybrid intelligence.
        </p>
      </div>

      <div className={styles.grid}>
        {/* Local Models Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🦙</span>
            <h2 className={styles.sectionTitle}>Local Ollama Models</h2>
          </div>
          
          <div className={styles.modelList}>
            {isLoadingModels ? (
              <div className={styles.emptyState}>Loading models...</div>
            ) : localModels.length === 0 ? (
              <div className={styles.emptyState}>No local models installed.</div>
            ) : (
              localModels.map((m) => (
                <div key={m.name} className={styles.modelItem}>
                  <div className={styles.modelInfo}>
                    <span className={styles.modelName}>{m.name}</span>
                    <span className={styles.modelSize}>{formatSize(m.size)}</span>
                  </div>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteModel(m.name)}
                    disabled={isPulling}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>

          <div className={styles.pullSection}>
            <label className="label">Download New Model</label>
            <div className={styles.pullInputGroup}>
              <input 
                type="text" 
                className="input" 
                placeholder="e.g., codellama:7b, qwen2:0.5b" 
                value={pullModelName}
                onChange={(e) => setPullModelName(e.target.value)}
                disabled={isPulling}
              />
              <button 
                className="btn btn-primary"
                onClick={handlePullModel}
                disabled={isPulling || !pullModelName.trim()}
              >
                {isPulling ? 'Downloading...' : 'Pull'}
              </button>
            </div>

            {isPulling && (
              <div className={styles.progressContainer}>
                <div className={styles.progressInfo}>
                  <span className={styles.progressStatus}>{pullProgress.status}</span>
                  {pullProgress.total > 0 && (
                    <span className={styles.progressPercentage}>{percentage}%</span>
                  )}
                </div>
                <div className={styles.progressBarTrack}>
                  <div 
                    className={styles.progressBarFill} 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )}
            {!isPulling && pullProgress.status.includes('Success') && (
              <div className={styles.progressContainer} style={{ borderColor: 'var(--color-success)' }}>
                <span style={{ color: 'var(--color-success)', fontSize: '0.875rem' }}>
                  {pullProgress.status}
                </span>
              </div>
            )}
            {!isPulling && pullProgress.status.includes('Error') && (
              <div className={styles.progressContainer} style={{ borderColor: 'var(--color-error)' }}>
                <span style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>
                  {pullProgress.status}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Cloud Models Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>☁️</span>
            <h2 className={styles.sectionTitle}>Cloud Providers</h2>
          </div>
          
          <div className={styles.apiForm}>
            <p className={styles.hint}>
              API keys are stored securely in your browser&apos;s local storage and are never sent to our servers except when directly querying the cloud provider.
            </p>
            
            <div className={styles.field}>
              <label className="label">Google Gemini API Key</label>
              <input 
                type="password" 
                className="input" 
                placeholder="AIzaSy..." 
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>
            
            <div className={styles.field}>
              <label className="label">OpenAI API Key</label>
              <input 
                type="password" 
                className="input" 
                placeholder="sk-..." 
                value={openAIKey}
                onChange={(e) => setOpenAIKey(e.target.value)}
              />
            </div>

            <button 
              className="btn btn-secondary"
              onClick={saveCloudKeys}
              style={{ marginTop: 'var(--space-sm)' }}
            >
              Save Cloud Keys
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
