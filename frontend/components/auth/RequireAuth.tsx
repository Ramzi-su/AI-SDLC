'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import VerifyEmailGate from './VerifyEmailGate';
import styles from './Auth.module.css';

/** Renders its children only for a signed-in user with a confirmed email; otherwise sends them
 * to sign in (and back), or asks them to confirm their email first. */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, user, load, retry } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  if (status === 'authenticated' && user) {
    // The API refuses everything until the email is confirmed, so don't render the app yet.
    return user.email_verified ? <>{children}</> : <VerifyEmailGate user={user} />;
  }

  if (status === 'error') {
    return (
      <div className={styles.center}>
        <p>Can’t reach the server. Is the backend running?</p>
        <button className="btn btn-secondary" onClick={retry}>Try again</button>
      </div>
    );
  }

  return (
    <div className={styles.center}>
      <div className={styles.spinner} />
    </div>
  );
}
