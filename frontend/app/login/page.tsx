import { Suspense } from 'react';
import AuthForm from '@/components/auth/AuthForm';

export default function LoginPage() {
  // AuthForm reads ?next= and ?error=, which needs a Suspense boundary for prerendering.
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
