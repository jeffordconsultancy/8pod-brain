import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const wid = request.nextUrl.searchParams.get('workspace');
  if (!wid) return NextResponse.json({ error: 'Missing workspace' }, { status: 400 });

  const project = await db.forecastProject.findFirst({
    where: { id: params.projectId, workspaceId: wid },
    include: { insights: true },
  });

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  return NextResponse.json({ project });
}

export async function PUT(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const body = await request.json();
    const { workspaceId, ...updateData } = body;

    const project = await db.forecastProject.update({
      where: { id: params.projectId },
      data: updateData,
    });

    return NextResponse.json({ project });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update project' }, { status: 500 });
  }
}
