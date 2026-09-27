'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import styles from './Auth.module.css';

export default function UserMenu() {
  const { user, status, load, signOut } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    load();
  }, [load]);

  if (status === 'authenticated' && user) {
    return (
      <span className={styles.userMenu}>
        <span className={styles.userName} title={user.email}>👤 {user.name}</span>
        <button
          className={styles.signOut}
          onClick={async () => {
            await signOut();
            router.push('/');
          }}
        >
          Sign out
        </button>
      </span>
    );
  }

  if (status === 'anonymous') {
    return <Link href="/login" className={styles.signIn}>Sign in</Link>;
  }

  return null;
}
