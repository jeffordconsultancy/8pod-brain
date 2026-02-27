import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/crypto';

function mask(key: string): string {
  if (key.length < 12) return '****';
  return key.slice(0, 7) + '...' + key.slice(-4);
}

export async function GET(request: NextRequest) {
  const wid = request.nextUrl.searchParams.get('workspace');
  if (!wid) return NextResponse.json({ error: 'Missing workspace' }, { status: 400 });

  const ws = await db.workspace.findUnique({ where: { id: wid }, select: { anthropicApiKey: true, openaiApiKey: true } });
  return NextResponse.json({
    anthropic: { configured: !!(ws?.anthropicApiKey || process.env.ANTHROPIC_API_KEY), maskedKey: ws?.anthropicApiKey ? mask(decryptToken(ws.anthropicApiKey)) : null },
    openai: { configured: !!(ws?.openaiApiKey || process.env.OPENAI_API_KEY), maskedKey: ws?.openaiApiKey ? mask(decryptToken(ws.openaiApiKey)) : null },
  });
}

export async function PUT(request: NextRequest) {
  const wid = request.nextUrl.searchParams.get('workspace');
  if (!wid) return NextResponse.json({ error: 'Missing workspace' }, { status: 400 });

  const { anthropicApiKey, openaiApiKey } = await request.json();
  const data: Record<string, string | null> = {};
  if (anthropicApiKey !== undefined) data.anthropicApiKey = anthropicApiKey ? encryptToken(anthropicApiKey) : null;
  if (openaiApiKey !== undefined) data.openaiApiKey = openaiApiKey ? encryptToken(openaiApiKey) : null;

  await db.workspace.update({ where: { id: wid }, data });
  return NextResponse.json({ success: true });
}
