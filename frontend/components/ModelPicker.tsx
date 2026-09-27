'use client';

import { useEffect, useState } from 'react';
import { api, ModelCatalog } from '@/lib/api';
import styles from './ModelPicker.module.css';

// Several pickers can be on screen; share one request (the server also caches cloud lists).
let catalogRequest: Promise<ModelCatalog> | null = null;
function loadCatalog(): Promise<ModelCatalog> {
  catalogRequest ??= api.modelCatalog().catch(err => {
    catalogRequest = null;
    throw err;
  });
  return catalogRequest;
}

interface ModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  id?: string;
}

/** One dropdown for every model of every provider, grouped by provider. */
export default function ModelPicker({ value, onChange, id }: ModelPickerProps) {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then(result => {
        if (cancelled) return;
        setCatalog(result);
        // No usable selection yet: pick the server's default, or the first model available.
        const usable = result.providers.filter(p => p.available).flatMap(p => p.models.map(m => m.id));
        if (!usable.includes(value) && usable.length > 0) {
          onChange(usable.includes(result.default_model) ? result.default_model : usable[0]);
        }
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load models'); });
    return () => { cancelled = true; };
    // Only when the picker appears; `value` changes are the user's own choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className={styles.error}>Could not load models: {error}</p>;
  if (!catalog) {
    return (
      <select className="input" id={id} disabled>
        <option>Loading models…</option>
      </select>
    );
  }

  const known = catalog.providers.some(p => p.models.some(m => m.id === value));
  const nothingUsable = !catalog.providers.some(p => p.available && p.models.length > 0);

  return (
    <div className={styles.picker}>
      <select className="input" id={id} value={value} onChange={e => onChange(e.target.value)}>
        {/* A model saved earlier that is no longer offered stays visible rather than silently changing. */}
        {value && !known && <option value={value}>{value} (not currently available)</option>}
        {catalog.providers.map(provider => {
          if (provider.available && provider.models.length > 0) {
            return (
              <optgroup key={provider.id} label={provider.label}>
                {provider.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            );
          }
          const reason = provider.error ?? (provider.id === 'ollama' ? 'No models installed yet (see Settings)' : 'No models');
          return (
            <optgroup key={provider.id} label={`${provider.label} (unavailable)`}>
              <option disabled value="">{reason}</option>
            </optgroup>
          );
        })}
      </select>
      {nothingUsable && (
        <p className={styles.error}>
          No model is available. Pull an Ollama model in Settings, or configure vLLM, OpenAI or Gemini in <code>.env</code>.
        </p>
      )}
    </div>
  );
}
