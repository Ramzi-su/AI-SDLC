'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import LearnPanel from '@/components/learn/LearnPanel';
import PointsBadge from '@/components/learn/PointsBadge';
import { learnerLevel } from '@/components/learn/types';
import codeStyles from './CodeViewer.module.css';
import styles from './PageBuildStep.module.css';

interface PageBuildStepProps {
  onGenerate: (pageId: string, feedback?: string) => void;
  onApprove: (pageId: string) => void;
}

export default function PageBuildStep({ onGenerate, onApprove }: PageBuildStepProps) {
  const {
    pages, pageGenerations, isLoading, projectId, selectedModel, codingLevelPref,
    learningMode, setLearningMode, bumpLearningProgress,
  } = useProjectStore();
  const [viewedPageId, setViewedPageId] = useState<string | null>(null);
  // The page whose Learn panel is open (opened automatically after approval in learning mode).
  const [learnPageId, setLearnPageId] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [feedback, setFeedback] = useState('');

  // The user works through pages in order: the first page not yet approved is the one being built.
  const currentPage = pages.find(p => pageGenerations[p.id]?.status !== 'approved');
  const allApproved = !currentPage;
  const approvedCount = pages.filter(p => pageGenerations[p.id]?.status === 'approved').length;

  const shownPage = pages.find(p => p.id === viewedPageId) || currentPage || pages[pages.length - 1];
  const generation = shownPage ? pageGenerations[shownPage.id] : undefined;
  const isCurrent = shownPage?.id === currentPage?.id;

  const selectPage = (pageId: string) => {
    const reachable = pageId === currentPage?.id || pageGenerations[pageId]?.status === 'approved';
    if (!reachable) return;
    setViewedPageId(pageId === currentPage?.id ? null : pageId);
    setLearnPageId(null);
    setActiveFile(0);
  };

  const handleRedo = () => {
    if (!shownPage) return;
    onGenerate(shownPage.id, feedback.trim() || undefined);
    setFeedback('');
    setActiveFile(0);
  };

  const handleApprove = () => {
    if (!shownPage) return;
    onApprove(shownPage.id);
    // In learning mode, stay on the approved page and study it before building the next one.
    setViewedPageId(learningMode ? shownPage.id : null);
    setLearnPageId(learningMode ? shownPage.id : null);
    setActiveFile(0);
    setShowCode(false);
  };

  const handleContinue = () => {
    setLearnPageId(null);
    setViewedPageId(null);
    if (currentPage && !pageGenerations[currentPage.id]) onGenerate(currentPage.id);
  };

  const handleDownloadAll = () => {
    pages.forEach(page => {
      pageGenerations[page.id]?.files.forEach(file => {
        const blob = new Blob([file.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename.replace(/\//g, '_');
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  };

  const statusOf = (pageId: string) => {
    const g = pageGenerations[pageId];
    if (g?.status === 'approved') return { icon: '✅', label: 'Approved', cls: styles.statusApproved };
    if (pageId === currentPage?.id) {
      return g
        ? { icon: '👀', label: `Review (attempt ${g.attempt})`, cls: styles.statusReview }
        : { icon: '▶️', label: 'Next to build', cls: styles.statusCurrent };
    }
    return { icon: '⏳', label: 'Waiting', cls: styles.statusWaiting };
  };

  const currentFile = generation?.files[activeFile];
  const learning = !!shownPage && learnPageId === shownPage.id && !!projectId;
  // Wait for the approval to be saved, or "continue" would target the page just approved.
  const approvalSaved = !!learnPageId && pageGenerations[learnPageId]?.status === 'approved';

  return (
    <div className={styles.layout}>
      <aside className={styles.pageList}>
        <label className={styles.learningToggle} title="After each approved page, learn how it is built before moving on">
          <input type="checkbox" checked={learningMode} onChange={e => setLearningMode(e.target.checked)} />
          🎓 Learning mode
        </label>
        {projectId && <PointsBadge projectId={projectId} />}
        <h3 className={styles.pageListTitle}>Pages {approvedCount}/{pages.length}</h3>
        {pages.map((page, i) => {
          const status = statusOf(page.id);
          return (
            <button
              key={page.id}
              className={`${styles.pageItem} ${shownPage?.id === page.id ? styles.pageItemActive : ''} ${status.cls}`}
              onClick={() => selectPage(page.id)}
            >
              <span className={styles.pageIndex}>{i + 1}</span>
              <span className={styles.pageInfo}>
                <span className={styles.pageName}>{page.name}</span>
                <span className={styles.pageStatus}>{status.icon} {status.label}</span>
              </span>
            </button>
          );
        })}
      </aside>

      <section className={styles.main}>
        <div className={codeStyles.header}>
          <h1 className={codeStyles.title}>
            <span className={codeStyles.titleIcon}>🏗️</span>
            {allApproved && !viewedPageId ? 'All pages approved' : `Page: ${shownPage?.name}`}
          </h1>
          <p className={codeStyles.subtitle}>
            {allApproved && !viewedPageId
              ? 'Every page has been generated and validated. Download your code below.'
              : isCurrent
                ? 'Generate this page, review the result, then approve it or ask for a redo.'
                : 'This page is approved (read-only).'}
          </p>
        </div>

        {allApproved && !viewedPageId && (
          <div className={codeStyles.readyCard}>
            <div className={codeStyles.readyIcon}>🎉</div>
            <h3>Your site is ready</h3>
            <p>Click a page on the left to review it again.</p>
            <button className="btn btn-success" onClick={handleDownloadAll} id="download-all-pages-btn">
              ⬇️ Download all files
            </button>
          </div>
        )}

        {isCurrent && !generation && !isLoading && (
          <div className={codeStyles.readyCard}>
            <div className={codeStyles.readyIcon}>🚀</div>
            <h3>Build “{shownPage?.name}”</h3>
            <p>
              The AI will turn your drawing of this page into real code
              {approvedCount > 0 ? ', staying consistent with the pages you already approved' : ''}.
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => shownPage && onGenerate(shownPage.id)}
              id="generate-page-btn"
            >
              Generate page
            </button>
          </div>
        )}

        {learning && shownPage && (
          <>
            <div className={styles.learnBar}>
              <span>🎓 Learn how <strong>{shownPage.name}</strong> is built, then continue.</span>
              <button className="btn btn-primary" onClick={handleContinue} disabled={!approvalSaved || isLoading}>
                {currentPage ? `Continue to “${currentPage.name}” →` : 'Finish →'}
              </button>
            </div>
            <LearnPanel
              key={shownPage.id}
              source={{ project_id: projectId!, page_id: shownPage.id }}
              level={learnerLevel(codingLevelPref)}
              model={selectedModel}
              onProgress={bumpLearningProgress}
            />
          </>
        )}

        {generation?.status === 'approved' && !learning && viewedPageId && (
          <button className="btn btn-secondary" onClick={() => setLearnPageId(shownPage!.id)}>
            🎓 Learn about this page
          </button>
        )}

        {generation && !(allApproved && !viewedPageId) && (
          <>
            {generation.fallback && (
              <div className={styles.warning}>
                ⚠️ The AI response could not be understood, so this is a basic template. Try Redo, or pick a stronger model.
              </div>
            )}

            <div className={codeStyles.previewFrame}>
              <iframe
                srcDoc={generation.preview_html}
                className={`${codeStyles.iframe} ${styles.previewIframe}`}
                sandbox="allow-scripts"
                title={`Preview of ${generation.page_name}`}
              />
            </div>

            {generation.explanation && (
              <div className={codeStyles.instructions}>
                <h4>💡 How this page is built</h4>
                <p>{generation.explanation}</p>
              </div>
            )}

            <button className="btn btn-ghost btn-sm" onClick={() => setShowCode(v => !v)}>
              {showCode ? 'Hide code' : `Show code (${generation.files.length} files)`}
            </button>

            {showCode && (
              <>
                <div className={codeStyles.fileTabs}>
                  {generation.files.map((file, i) => (
                    <button
                      key={file.filename}
                      className={`${codeStyles.fileTab} ${i === activeFile ? codeStyles.fileTabActive : ''}`}
                      onClick={() => setActiveFile(i)}
                    >
                      {file.filename}
                    </button>
                  ))}
                </div>
                {currentFile && (
                  <div className={codeStyles.codeViewer}>
                    <div className={codeStyles.codeHeader}>
                      <span className={codeStyles.codeFilename}>{currentFile.filename}</span>
                      <span className="badge badge-primary">{currentFile.language}</span>
                    </div>
                    <pre className={codeStyles.codeBlock}>
                      <code>{currentFile.content}</code>
                    </pre>
                  </div>
                )}
              </>
            )}

            {isCurrent && (
              <div className={styles.decision}>
                <button className="btn btn-success" onClick={handleApprove} disabled={isLoading} id="approve-page-btn">
                  ✅ Approve{pages.length > approvedCount + 1 ? ' & go to next page' : ' & finish'}
                </button>
                <div className={styles.redo}>
                  <textarea
                    className="input textarea"
                    placeholder="Not happy? Describe what to change (optional), then click Redo."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={2}
                    id="page-feedback-input"
                  />
                  <button className="btn btn-secondary" onClick={handleRedo} disabled={isLoading} id="redo-page-btn">
                    🔄 Redo page
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
