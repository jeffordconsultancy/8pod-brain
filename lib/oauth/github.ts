export function getGitHubAuthUrl(_provider: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    scope: 'repo,read:user',
    redirect_uri: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/oauth/callback`,
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeGitHubCode(code: string) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`GitHub error: ${data.error}`);
  return { access_token: data.access_token, scope: data.scope };
}
