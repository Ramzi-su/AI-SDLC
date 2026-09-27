import { create } from 'zustand';
import { api, ApiError, setEmailNotVerifiedHandler, setUnauthorizedHandler, User } from '@/lib/api';
import { useProjectStore } from '@/store/projectStore';

type AuthStatus = 'unknown' | 'loading' | 'authenticated' | 'anonymous' | 'error';

interface AuthStore {
  user: User | null;
  status: AuthStatus;
  /** Checks the session cookie with the API (once; later calls reuse the result). */
  load: () => Promise<void>;
  /** After a server/network error: check again. */
  retry: () => Promise<void>;
  signIn: (user: User) => void;
  /** Refreshes the signed-in user's details (e.g. after verifying the email). */
  updateUser: (user: User) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  status: 'unknown',

  load: async () => {
    if (get().status !== 'unknown') return;
    set({ status: 'loading' });
    try {
      set({ user: await api.me(), status: 'authenticated' });
    } catch (err) {
      // 401 means signed out; anything else (API down, network) must not be mistaken for it.
      set({ user: null, status: err instanceof ApiError && err.status === 401 ? 'anonymous' : 'error' });
    }
  },

  retry: async () => {
    set({ status: 'unknown' });
    await get().load();
  },

  signIn: (user) => {
    // Never show one user's project to the next person who signs in on this browser.
    useProjectStore.getState().reset();
    set({ user, status: 'authenticated' });
  },

  updateUser: (user) => {
    if (get().user?.id === user.id) set({ user });
  },

  signOut: async () => {
    try {
      await api.logout();
    } finally {
      useProjectStore.getState().reset();
      set({ user: null, status: 'anonymous' });
    }
  },
}));

setUnauthorizedHandler(() => {
  if (useAuthStore.getState().status === 'authenticated') {
    useAuthStore.setState({ user: null, status: 'anonymous' });
  }
});

setEmailNotVerifiedHandler(() => {
  const { user } = useAuthStore.getState();
  if (user?.email_verified) useAuthStore.setState({ user: { ...user, email_verified: false } });
});
