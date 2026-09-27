'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, User } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import styles from './Auth.module.css';

// A link can only be used once, so share one request per token (React may run effects twice).
const verifications = new Map<string, Promise<User>>();

export default function VerifyEmail() {
  const token = useSearchParams().get('token') ?? '';
  const updateUser = useAuthStore(state => state.updateUser);
  const [state, setState] = useState<{ status: 'pending' | 'done' | 'failed'; message?: string }>({ status: 'pending' });

  useEffect(() => {
    if (!token) return;
    if (!verifications.has(token)) verifications.set(token, api.verifyEmail(token));
    let cancelled = false;
    verifications.get(token)!
      .then(user => {
        if (cancelled) return;
        updateUser(user);
        setState({ status: 'done' });
      })
      .catch(err => {
        if (!cancelled) setState({ status: 'failed', message: err instanceof Error ? err.message : 'Verification failed' });
      });
    return () => { cancelled = true; };
  }, [token, updateUser]);

  const status = token ? state.status : 'failed';
  const message = token ? state.message : 'This link is missing its token.';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link href="/" className={styles.brand}>AI-SDLC</Link>
        {status === 'pending' && <h1 className={styles.title}>Confirming your email…</h1>}
        {status === 'done' && (
          <>
            <h1 className={styles.title}>Email confirmed ✅</h1>
            <p className={styles.subtitle}>Thanks! Your account is all set.</p>
            <Link href="/" className="btn btn-primary">Continue</Link>
          </>
        )}
        {status === 'failed' && (
          <>
            <h1 className={styles.title}>Couldn’t confirm your email</h1>
            <div className={styles.error}>{message}</div>
            <p className={styles.subtitle}>Sign in and use “Resend email” in the banner to get a new link.</p>
            <Link href="/login" className="btn btn-secondary">Sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
