'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, User } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import styles from './Auth.module.css';

/** Shown instead of the app until the signed-in user confirms their email address. */
export default function VerifyEmailGate({ user }: { user: User }) {
  const router = useRouter();
  const { updateUser, signOut } = useAuthStore();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<'resend' | 'check' | null>(null);

  const check = async (manual: boolean) => {
    if (manual) setBusy('check');
    try {
      const fresh = await api.me();
      updateUser(fresh);
      if (manual && !fresh.email_verified) setMessage('Not confirmed yet. Open the link in the email we sent you.');
    } catch {
      if (manual) setMessage('Could not check right now. Please try again.');
    } finally {
      if (manual) setBusy(null);
    }
  };

  // The link is usually opened in another tab; re-check when the user comes back to this one.
  useEffect(() => {
    const onFocus = () => { check(false); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- check only uses stable store actions
  }, []);

  const resend = async () => {
    setBusy('resend');
    setMessage(null);
    try {
      const { status } = await api.resendVerification();
      if (status === 'already_verified') await check(false);
      else setMessage(`A new link is on its way to ${user.email}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not send the email');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>AI-SDLC</div>
        <h1 className={styles.title}>📧 Confirm your email</h1>
        <p className={styles.subtitle}>
          We sent a confirmation link to <strong>{user.email}</strong>. Open it to start using the app.
          Can’t find it? Check your spam folder.
        </p>

        {message && <div className={styles.success} role="status">{message}</div>}

        <button className="btn btn-primary" onClick={() => check(true)} disabled={!!busy}>
          {busy === 'check' ? 'Checking…' : 'I’ve confirmed it'}
        </button>
        <button className="btn btn-secondary" onClick={resend} disabled={!!busy}>
          {busy === 'resend' ? 'Sending…' : 'Send a new link'}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await signOut();
            router.push('/login');
          }}
        >
          Wrong email? Sign out
        </button>
      </div>
    </div>
  );
}
