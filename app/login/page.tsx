import { Suspense } from 'react';
import LoginPage from './LoginForm';

export default function LoginRoute() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--bg-primary)' }} />}>
      <LoginPage />
    </Suspense>
  );
}
