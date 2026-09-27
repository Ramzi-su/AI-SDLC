'use client';

import { useProjectStore } from '@/store/projectStore';
import styles from './StyleStep.module.css';

interface StyleStepProps {
  onRegenerate: (feedback?: string) => void;
}

export default function StyleStep({ onRegenerate }: StyleStepProps) {
  const { styleData, updateColor, isLoading } = useProjectStore();

  if (!styleData && !isLoading) {
    return (
      <div className={styles.empty}>
        <p>Waiting for Style Agent...</p>
      </div>
    );
  }

  if (!styleData) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>🎨</span>
          Design System
        </h1>
        <p className={styles.subtitle}>
          Palette: <strong>{styleData.palette_name}</strong> — {styleData.mood}
        </p>
      </div>

      {/* Color palette */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Color Palette</h2>
        <div className={styles.colorGrid}>
          {styleData.colors.map((color, i) => (
            <div key={color.name} className={styles.colorCard}>
              <div className={styles.colorPreview}>
                <input
                  type="color"
                  value={color.value}
                  onChange={(e) => updateColor(i, e.target.value)}
                  className={styles.colorInput}
                  id={`color-${i}`}
                />
                <div
                  className={styles.colorSwatch}
                  style={{ background: color.value }}
                />
              </div>
              <div className={styles.colorInfo}>
                <span className={styles.colorName}>{color.name.replace('--', '')}</span>
                <span className={styles.colorValue}>{color.value}</span>
                <span className={styles.colorUsage}>{color.usage}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Typography</h2>
        <div className={styles.fontList}>
          {styleData.typography.map((font) => (
            <div key={font.name} className={styles.fontCard}>
              <div className={styles.fontPreview} style={{ fontFamily: `'${font.font_family}', sans-serif`, fontWeight: parseInt(font.weight), fontSize: font.size }}>
                Aa Bb Cc
              </div>
              <div className={styles.fontInfo}>
                <span className={styles.fontFamily}>{font.font_family}</span>
                <span className={styles.fontMeta}>Weight: {font.weight} · Size: {font.size}</span>
                <span className={styles.fontUsage}>{font.usage}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Spacing & Radius */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tokens</h2>
        <div className={styles.tokenGrid}>
          <div className={styles.tokenCard}>
            <span className={styles.tokenLabel}>Border Radius</span>
            <span className={styles.tokenValue}>{styleData.border_radius}</span>
            <div className={styles.radiusPreview} style={{ borderRadius: styleData.border_radius }} />
          </div>
          <div className={styles.tokenCard}>
            <span className={styles.tokenLabel}>Spacing Unit</span>
            <span className={styles.tokenValue}>{styleData.spacing_unit}</span>
            <div className={styles.spacingPreview}>
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className={styles.spacingBlock} style={{ width: `${n * parseInt(styleData.spacing_unit)}px` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Live Preview</h2>
        <div
          className={styles.livePreview}
          style={{
            '--preview-bg': styleData.colors.find(c => c.name.includes('bg'))?.value || '#0B0B14',
            '--preview-surface': styleData.colors.find(c => c.name.includes('surface'))?.value || '#14142B',
            '--preview-primary': styleData.colors.find(c => c.name.includes('primary'))?.value || '#7C5CFC',
            '--preview-text': styleData.colors.find(c => c.name.includes('text') && !c.name.includes('muted') && !c.name.includes('secondary'))?.value || '#EEEEF5',
            '--preview-muted': styleData.colors.find(c => c.name.includes('muted'))?.value || '#7B7BA0',
            '--preview-border': styleData.colors.find(c => c.name.includes('border'))?.value || '#252547',
            '--preview-radius': styleData.border_radius,
          } as React.CSSProperties}
        >
          <div className={styles.previewNav}>
            <span className={styles.previewLogo}>●  MyApp</span>
            <div className={styles.previewLinks}>
              <span>Home</span>
              <span>About</span>
              <span>Contact</span>
            </div>
          </div>
          <div className={styles.previewHero}>
            <h3>Welcome to Your App</h3>
            <p>This is a preview of your design system in action.</p>
            <button className={styles.previewBtn}>Get Started</button>
          </div>
          <div className={styles.previewCards}>
            {['Feature One', 'Feature Two', 'Feature Three'].map((f) => (
              <div key={f} className={styles.previewCard}>
                <h4>{f}</h4>
                <p>A brief description here.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.actions}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const feedback = prompt('Describe the style changes you want (e.g., "More vibrant colors" or "Professional blue theme")');
            if (feedback) onRegenerate(feedback);
          }}
          id="regenerate-style-btn"
        >
          🔄 Regenerate with feedback
        </button>
      </div>
    </div>
  );
}
