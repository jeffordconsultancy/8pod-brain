import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const wid = request.nextUrl.searchParams.get('workspace');
  if (!wid) return NextResponse.json({ error: 'Missing workspace' }, { status: 400 });

  const projects = await db.forecastProject.findMany({
    where: { workspaceId: wid },
    orderBy: { updatedAt: 'desc' },
    include: { insights: { select: { id: true, category: true, title: true } } },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, sponsorBrief } = await request.json();
    if (!workspaceId || !sponsorBrief) {
      return NextResponse.json({ error: 'Missing workspaceId or sponsorBrief' }, { status: 400 });
    }

    // Get workspace owner as creator
    const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    // Extract a name from the brief
    const briefLower = sponsorBrief.toLowerCase();
    const name = `Forecast ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    const project = await db.forecastProject.create({
      data: {
        workspaceId,
        name,
        status: 'prompt',
        sponsorBrief,
        createdById: workspace.ownerId,
      },
    });

    return NextResponse.json({ project });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to create project' }, { status: 500 });
  }
}
