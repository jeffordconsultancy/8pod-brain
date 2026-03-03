'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface InviteInfo {
  workspaceName: string;
  inviterName: string;
  email?: string;
  role: string;
  expired: boolean;
  used: boolean;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { data: session, status } = useSession();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error); }))
      .then(data => setInvite(data))
      .catch(err => setError(err.message || 'Invalid invite link'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    if (!session?.user) return;
    setAccepting(true);
    setError('');

    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, userId: (session.user as any).id }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to accept invite');
        return;
      }

      // Redirect to brain — they need to re-login to switch workspace context
      router.push('/brain');
    } catch {
      setError('An error occurred');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading invite...</p>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (invite?.expired) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-yellow-400 text-lg mb-2">This invite has expired</p>
          <p className="text-gray-500 text-sm">Ask {invite.inviterName} to send a new invite.</p>
        </div>
      </div>
    );
  }

  if (invite?.used) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-lg mb-4">This invite has already been used</p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          8pod Brain
        </h1>
        <p className="text-gray-400 mb-6">You&apos;ve been invited to join a workspace</p>

        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
          <p className="text-blue-200 font-medium">{invite?.workspaceName}</p>
          <p className="text-blue-300 text-sm mt-1">
            Invited by {invite?.inviterName} as {invite?.role?.toLowerCase()}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {status === 'authenticated' ? (
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Signed in as <strong>{session?.user?.name || session?.user?.email}</strong>
            </p>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {accepting ? 'Joining...' : `Join ${invite?.workspaceName}`}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              href={`/signup?invite=${token}`}
              className="block w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition text-center"
            >
              Create Account & Join
            </Link>
            <Link
              href={`/login?invite=${token}`}
              className="block w-full py-3 bg-gray-800 text-gray-300 font-medium rounded-lg hover:bg-gray-700 transition text-center border border-gray-700"
            >
              Sign In & Join
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
