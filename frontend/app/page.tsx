'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProjectList from '@/components/ProjectList';
import UserMenu from '@/components/auth/UserMenu';
import styles from './page.module.css';

export default function Home() {
  const router = useRouter();

  return (
    <div className={styles.landing}>
      {/* Decorative orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="3" fill="#7C5CFC" opacity="0.9"/>
              <rect x="16" y="2" width="10" height="10" rx="3" fill="#3ECFFF" opacity="0.7"/>
              <rect x="2" y="16" width="10" height="10" rx="3" fill="#FF6B9D" opacity="0.7"/>
              <rect x="16" y="16" width="10" height="10" rx="3" fill="#7C5CFC" opacity="0.5"/>
            </svg>
          </div>
          <span className={styles.logoText}>AI-SDLC</span>
        </div>
        <nav className={styles.nav}>
          <Link href="/learn" className={styles.navLink}>🎓 Learn</Link>
          <a href="/settings" className={styles.navLink}>Settings & Models</a>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className={styles.navLink}>GitHub</a>
          <UserMenu />
        </nav>
      </header>

      {/* Hero */}
      <main className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={`${styles.heroBadge} animate-fadeInDown`}>
            <span className={styles.heroBadgeDot} />
            Multi-Agent Architecture
          </div>

          <h1 className={`${styles.heroTitle} animate-fadeInUp delay-1`}>
            Build apps with
            <span className={styles.heroGradient}> AI agents</span>
            <br />that understand your vision
          </h1>

          <p className={`${styles.heroSubtitle} animate-fadeInUp delay-2`}>
            From framework selection to final code — our multi-agent system guides you
            through every step with intelligent recommendations and real-time previews.
            You stay in control with confirmation at every stage.
          </p>

          <div className={`${styles.heroActions} animate-fadeInUp delay-3`}>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => router.push('/project/new')}
              id="start-project-btn"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Start New Project
            </button>
            <button className="btn btn-secondary btn-lg" id="learn-more-btn">
              How it works
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        <ProjectList />

        {/* Agent cards */}
        <div className={`${styles.agentCards} animate-fadeInUp delay-4`} id="features">
          {[
            { icon: '🧠', name: 'Orchestrator', desc: 'Coordinates all agents and manages the development pipeline', color: '#7C5CFC' },
            { icon: '⚙️', name: 'Framework Agent', desc: 'Recommends the ideal framework based on your project needs', color: '#3ECFFF' },
            { icon: '🧩', name: 'Component Agent', desc: 'Suggests page layout and UI components with variants', color: '#FF6B9D' },
            { icon: '🎨', name: 'Style Agent', desc: 'Generates cohesive color palettes and design tokens', color: '#FFB84D' },
            { icon: '🔧', name: 'Generator Agent', desc: 'Produces production-ready code for your approved design', color: '#00E68A' },
          ].map((agent, i) => (
            <div
              key={agent.name}
              className={styles.agentCard}
              style={{ animationDelay: `${0.5 + i * 0.1}s`, borderTopColor: agent.color } as React.CSSProperties}
            >
              <div className={styles.agentIcon}>{agent.icon}</div>
              <h3 className={styles.agentName}>{agent.name}</h3>
              <p className={styles.agentDesc}>{agent.desc}</p>
            </div>
          ))}
        </div>

        {/* Process steps */}
        <div className={`${styles.processSection} animate-fadeInUp delay-5`}>
          <h2 className={styles.processTitle}>How It Works</h2>
          <div className={styles.processSteps}>
            {[
              { step: '01', title: 'Describe Your Project', desc: 'Tell us what you want to build — the agents will analyze your requirements' },
              { step: '02', title: 'Choose Framework', desc: 'AI recommends the best framework. You confirm or adjust.' },
              { step: '03', title: 'Compose Components', desc: 'Select and arrange page components. You approve the layout.' },
              { step: '04', title: 'Pick Your Colors', desc: 'Get a custom design system. Tweak any color to your taste.' },
              { step: '05', title: 'Generate & Download', desc: 'Production-ready code is generated. Review, approve, and download.' },
            ].map((item) => (
              <div key={item.step} className={styles.processStep}>
                <div className={styles.stepNumber}>{item.step}</div>
                <div>
                  <h4 className={styles.stepTitle}>{item.title}</h4>
                  <p className={styles.stepDesc}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>AI-SDLC — Multi-Agent Development Assistant</p>
      </footer>
    </div>
  );
}
