import { Suspense } from 'react';
import SignupForm from './signup-form';

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <SignupForm />
    </Suspense>
  );
}
