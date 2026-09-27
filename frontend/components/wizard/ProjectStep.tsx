'use client';

import { useProjectStore } from '@/store/projectStore';
import ModelPicker from '@/components/ModelPicker';
import styles from './ProjectStep.module.css';

interface ProjectStepProps {
  onSubmit: () => void;
}

const PROJECT_TYPES = [
  { value: 'landing_page', label: 'Landing Page', icon: '🚀', desc: 'Single-page marketing site' },
  { value: 'web_app', label: 'Web Application', icon: '💻', desc: 'Interactive web application' },
  { value: 'dashboard', label: 'Dashboard', icon: '📊', desc: 'Data visualization & admin panel' },
  { value: 'portfolio', label: 'Portfolio', icon: '🎨', desc: 'Personal or creative portfolio' },
  { value: 'ecommerce', label: 'E-Commerce', icon: '🛒', desc: 'Online store or marketplace' },
  { value: 'blog', label: 'Blog / CMS', icon: '📝', desc: 'Content management system' },
];

const FRONTEND_OPTIONS = [
  'Let AI Decide', 'HTML/CSS', 'Vanilla JS', 'React', 'Next.js', 'Vue', 'Nuxt', 
  'Angular', 'Svelte', 'SvelteKit', 'SolidJS', 'Astro', 'Flutter', 'React Native', 'jQuery'
];
const BACKEND_OPTIONS = [
  'Let AI Decide', 'Node.js (Express)', 'NestJS', 'FastAPI', 'Flask', 'Django', 
  'Spring Boot', 'PHP', 'Laravel', 'Symfony', 'Ruby on Rails', 'Go', 'Rust', 'ASP.NET', 'Deno'
];
const DB_OPTIONS = [
  'Let AI Decide', 'PostgreSQL', 'MySQL', 'MariaDB', 'MongoDB', 'Redis', 'SQLite', 
  'Cassandra', 'DynamoDB', 'Neo4j', 'Supabase', 'Firebase'
];
const ARCHITECTURE_OPTIONS = ['Let AI Decide', 'Monolithic', 'Microservices', 'Serverless', 'Jamstack'];
const COMPLEXITY_OPTIONS = ['Let AI Decide', 'Simple / MVP', 'Intermediate', 'Advanced / Enterprise'];
const CODING_LEVEL_OPTIONS = ['Let AI Decide', 'Beginner (Simple code)', 'Intermediate', 'Expert (Advanced patterns)'];
const AI_INTEGRATION_OPTIONS = ['Let AI Decide', 'None', 'RAG (Vector Search)', 'LLM API (OpenAI/Gemini)', 'AI Chatbot'];
const GENERATION_MODE_OPTIONS = ['Full Auto', 'Interactive (Step-by-step validation)'];

export default function ProjectStep({ onSubmit }: ProjectStepProps) {
  const { projectName, projectDescription, projectType, frontPref, backPref, dbPref, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref, selectedModel, setProjectInfo, setSelectedModel, isLoading, learningMode, setLearningMode } = useProjectStore();

  const isValid = projectName.trim().length > 0 && projectDescription.trim().length >= 10;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>📝</span>
          Describe Your Project
        </h1>
        <p className={styles.subtitle}>
          Tell our agents about your project. The more detail you provide, the better the recommendations.
        </p>
      </div>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className="label" htmlFor="project-name">Project Name</label>
          <input
            id="project-name"
            className="input"
            type="text"
            placeholder="e.g., My Awesome App"
            value={projectName}
            onChange={(e) => setProjectInfo(e.target.value, projectDescription, projectType, frontPref, backPref, dbPref, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref)}
            maxLength={100}
          />
        </div>

        <div className={styles.field}>
          <label className="label" htmlFor="project-desc">Project Description</label>
          <textarea
            id="project-desc"
            className="input textarea"
            placeholder="Describe what your application should do, who it's for, and any specific features you need..."
            value={projectDescription}
            onChange={(e) => setProjectInfo(projectName, e.target.value, projectType, frontPref, backPref, dbPref, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref)}
            rows={5}
            maxLength={2000}
          />
          <span className={styles.charCount}>{projectDescription.length}/2000</span>
        </div>

        <div className={styles.field}>
          <label className="label">Project Type</label>
          <div className={styles.typeGrid}>
            {PROJECT_TYPES.map((type) => (
              <button
                key={type.value}
                className={`${styles.typeCard} ${projectType === type.value ? styles.typeCardSelected : ''}`}
                onClick={() => setProjectInfo(projectName, projectDescription, type.value, frontPref, backPref, dbPref, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref)}
                id={`type-${type.value}`}
              >
                <span className={styles.typeIcon}>{type.icon}</span>
                <span className={styles.typeLabel}>{type.label}</span>
                <span className={styles.typeDesc}>{type.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className="label" htmlFor="ai-model">AI Model</label>
          <ModelPicker id="ai-model" value={selectedModel} onChange={setSelectedModel} />
        </div>

        <div className={styles.field}>
          <label className="label">Tech Stack Preferences</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
            <div>
              <label className="label" style={{ fontSize: '0.7rem' }}>Frontend</label>
              <select 
                className="input" 
                value={frontPref} 
                onChange={(e) => setProjectInfo(projectName, projectDescription, projectType, e.target.value, backPref, dbPref, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref)}
              >
                {FRONTEND_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.7rem' }}>Backend</label>
              <select 
                className="input" 
                value={backPref} 
                onChange={(e) => setProjectInfo(projectName, projectDescription, projectType, frontPref, e.target.value, dbPref, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref)}
              >
                {BACKEND_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.7rem' }}>Database</label>
              <select 
                className="input" 
                value={dbPref} 
                onChange={(e) => setProjectInfo(projectName, projectDescription, projectType, frontPref, backPref, e.target.value, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref)}
              >
                {DB_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
          
          <label className="label" style={{ marginTop: 'var(--space-md)' }}>Advanced Preferences</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)' }}>
            <div>
              <label className="label" style={{ fontSize: '0.7rem' }}>Architecture</label>
              <select 
                className="input" 
                value={architecturePref} 
                onChange={(e) => setProjectInfo(projectName, projectDescription, projectType, frontPref, backPref, dbPref, e.target.value, complexityPref, codingLevelPref, aiIntegrationPref, generationModePref)}
              >
                {ARCHITECTURE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.7rem' }}>Project Complexity</label>
              <select 
                className="input" 
                value={complexityPref} 
                onChange={(e) => setProjectInfo(projectName, projectDescription, projectType, frontPref, backPref, dbPref, architecturePref, e.target.value, codingLevelPref, aiIntegrationPref, generationModePref)}
              >
                {COMPLEXITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.7rem' }}>Your Coding Level</label>
              <select 
                className="input" 
                value={codingLevelPref} 
                onChange={(e) => setProjectInfo(projectName, projectDescription, projectType, frontPref, backPref, dbPref, architecturePref, complexityPref, e.target.value, aiIntegrationPref, generationModePref)}
              >
                {CODING_LEVEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.7rem' }}>AI Integration</label>
              <select 
                className="input" 
                value={aiIntegrationPref} 
                onChange={(e) => setProjectInfo(projectName, projectDescription, projectType, frontPref, backPref, dbPref, architecturePref, complexityPref, codingLevelPref, e.target.value, generationModePref)}
              >
                {AI_INTEGRATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.7rem' }}>Generation Mode</label>
              <select 
                className="input" 
                value={generationModePref} 
                onChange={(e) => setProjectInfo(projectName, projectDescription, projectType, frontPref, backPref, dbPref, architecturePref, complexityPref, codingLevelPref, aiIntegrationPref, e.target.value)}
              >
                {GENERATION_MODE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
        </div>

        <label className={styles.learningOption}>
          <input type="checkbox" checked={learningMode} onChange={e => setLearningMode(e.target.checked)} />
          <span>
            <strong>🎓 Learning mode</strong>
            <span className={styles.learningHint}>
              After each page is built, learn how its code works with a lesson, questions, a quiz and challenges
              before moving on. Leave it off to just build. You can change this later.
            </span>
          </span>
        </label>

        <button
          className="btn btn-primary btn-lg"
          onClick={onSubmit}
          disabled={!isValid || isLoading}
          id="create-project-btn"
          style={{ width: '100%', marginTop: 'var(--space-lg)' }}
        >
          {isLoading ? 'Creating...' : 'Create Project & Start'}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M7 4L12 9L7 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
