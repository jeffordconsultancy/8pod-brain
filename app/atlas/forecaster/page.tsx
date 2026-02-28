'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ForecasterIndex() {
  const router = useRouter();
  useEffect(() => { router.replace('/atlas'); }, [router]);
  return null;
}
