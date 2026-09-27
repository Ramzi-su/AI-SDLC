'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import styles from './Auth.module.css';

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', github: 'GitHub' };
const MIN_PASSWORD_LENGTH = 8;

/** Only follow redirects inside this app. */
const safeNext = (next: string | null) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { status, load, signIn } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Errors from a failed Google/GitHub sign-in arrive in the URL.
  const [error, setError] = useState<string | null>(params.get('error'));

  useEffect(() => {
    load();
    api.authProviders().then(res => setProviders(res.providers)).catch(() => setProviders([]));
  }, [load]);

  // Already signed in (e.g. back button to /login): go straight on.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = mode === 'login'
        ? await api.login({ email, password })
        : await api.register({ email, password, name });
      signIn(user);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const isRegister = mode === 'register';
  const otherHref = `${isRegister ? '/login' : '/register'}${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={submit}>
        <Link href="/" className={styles.brand}>AI-SDLC</Link>
        <h1 className={styles.title}>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className={styles.subtitle}>
          {isRegister ? 'Your projects and learning points are saved to your account.' : 'Sign in to continue building and learning.'}
        </p>

        {error && <div className={styles.error} role="alert">{error}</div>}

        {providers.length > 0 && (
          <>
            <div className={styles.providers}>
              {providers.map(p => (
                <a key={p} className="btn btn-secondary" href={api.oauthStartUrl(p, next)}>
                  Continue with {PROVIDER_LABELS[p] ?? p}
                </a>
              ))}
            </div>
            <div className={styles.divider}><span>or with email</span></div>
          </>
        )}

        {isRegister && (
          <label className={styles.field}>
            <span className="label">Name</span>
            <input className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label className={styles.field}>
          <span className="label">Email</span>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className={styles.field}>
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
            required
          />
          {isRegister && <span className={styles.hint}>At least {MIN_PASSWORD_LENGTH} characters.</span>}
        </label>
        {!isRegister && <Link href="/forgot-password" className={styles.forgot}>Forgot your password?</Link>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>

        <p className={styles.switch}>
          {isRegister ? 'Already have an account?' : 'New here?'}{' '}
          <Link href={otherHref}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </form>
    </div>
  );
}
