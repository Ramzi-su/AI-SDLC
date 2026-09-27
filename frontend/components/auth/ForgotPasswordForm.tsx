'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import styles from './Auth.module.css';

const MIN_PASSWORD_LENGTH = 8;

/** Step 1: ask for a code by email. Step 2: enter the code and a new password. */
export default function ForgotPasswordForm() {
  const router = useRouter();
  const signIn = useAuthStore(state => state.signIn);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      const { message } = await api.forgotPassword(email);
      setNotice(`${message} It is valid for 15 minutes.`);
      setStep('code');
    });
  };

  const reset = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmation) {
      setError('The two passwords don’t match');
      return;
    }
    return run(async () => {
      signIn(await api.resetPassword({ email, code, password }));
      router.replace('/');
    });
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={step === 'email' ? sendCode : reset}>
        <Link href="/" className={styles.brand}>AI-SDLC</Link>
        <h1 className={styles.title}>Reset your password</h1>

        {step === 'email' ? (
          <>
            <p className={styles.subtitle}>Enter your account’s email and we’ll send you a 6-digit code.</p>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <label className={styles.field}>
              <span className="label">Email</span>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send me a code'}
            </button>
          </>
        ) : (
          <>
            {notice && <div className={styles.success} role="status">{notice}</div>}
            {error && <div className={styles.error} role="alert">{error}</div>}
            <label className={styles.field}>
              <span className="label">6-digit code</span>
              <input
                className={`input ${styles.codeInput}`}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                pattern="\d{6}"
                required
                autoFocus
              />
            </label>
            <label className={styles.field}>
              <span className="label">New password</span>
              <input
                className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required
              />
              <span className={styles.hint}>At least {MIN_PASSWORD_LENGTH} characters. You’ll be signed out on every other device.</span>
            </label>
            <label className={styles.field}>
              <span className="label">Repeat the new password</span>
              <input
                className="input" type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)}
                autoComplete="new-password" required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? 'Saving…' : 'Save new password'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => sendCode()} disabled={submitting}>
              Send a new code
            </button>
          </>
        )}

        <p className={styles.switch}><Link href="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}
