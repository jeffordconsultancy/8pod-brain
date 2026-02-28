import { NextRequest, NextResponse } from 'next/server';
import { getAIClients } from '@/lib/ai';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { prompt, workspaceId, phase } = await request.json();
    if (!prompt || !workspaceId) {
      return NextResponse.json({ error: 'Missing prompt or workspaceId' }, { status: 400 });
    }

    const start = Date.now();
    const { claude, openai, preferredProvider } = await getAIClients(workspaceId);

    let systemPrompt = '';
    if (phase === 'blueprint') {
      systemPrompt = `You are the 8pod Forecaster Blueprint Engine. Given a natural language description of a rights/sponsorship package scenario, generate a structured Rights Package Blueprint as JSON with these fields:
{
  "title": "A clear title for this rights package",
  "rightsHolder": "The entity that owns the rights (e.g., sports team, league, artist)",
  "sponsor": "The brand/sponsor entity",
  "market": "Target market/geography",
  "objectives": ["List of key objectives"],
  "audienceSegments": ["Target audience segments"],
  "rights": ["Specific rights included in the package"],
  "constraints": ["Regulatory/competitive constraints"],
  "valuationRange": { "low": number, "high": number, "currency": "GBP" },
  "timeline": "Expected timeline/duration",
  "keyMetrics": ["KPIs to track success"]
}
Return ONLY valid JSON.`;
    } else if (phase === 'insights') {
      systemPrompt = `You are the 8pod Forecaster Insights Engine. Given a confirmed Rights Package Blueprint (as JSON), generate tailored strategic insights as JSON:
{
  "headline": "One powerful insight headline",
  "insights": [
    {
      "category": "Fan Engagement|Brand ROI|Market Opportunity|Competitive Advantage|Digital Reach",
      "title": "Short insight title",
      "finding": "The key finding (2-3 sentences)",
      "metric": "A specific quantified metric or projection",
      "confidence": 0.0-1.0,
      "dataPoints": ["Supporting data points"]
    }
  ],
  "recommendation": "Top-level strategic recommendation (2-3 sentences)",
  "projectedROI": { "multiplier": number, "timeframe": "string" }
}
Generate 5-7 compelling insights. Return ONLY valid JSON.`;
    } else if (phase === 'deepdive') {
      systemPrompt = `You are the 8pod Algorithm (AL) Deep Dive Engine. Given an insight object from the Forecaster, provide the full algorithmic depth as JSON:
{
  "methodology": "How the insight was derived (2-3 sentences)",
  "canonicalFunnel": {
    "stages": [
      { "name": "Stage name", "conversion": "X%", "volume": "number", "description": "What happens here" }
    ]
  },
  "audienceSegmentation": [
    { "segment": "Name", "size": "number", "affinity": 0.0-1.0, "channels": ["preferred channels"] }
  ],
  "constraints": [
    { "type": "Regulatory|Competitive|Temporal|Geographic", "description": "Constraint detail", "impact": "high|medium|low" }
  ],
  "benchmarks": [
    { "comparator": "What we are comparing to", "metric": "The metric", "value": "The value", "source": "Data source" }
  ],
  "algorithmicConfidence": 0.0-1.0,
  "dataSources": ["List of data sources used"]
}
Return ONLY valid JSON.`;
    } else {
      systemPrompt = `You are the 8pod OS command processor. Process the user's natural language command and return a helpful response about 8pod's sports intelligence and rights management capabilities.`;
    }

    let response: string;

    if (preferredProvider === 'anthropic' && claude) {
      const msg = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      response = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    } else if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      });
      response = completion.choices[0]?.message?.content || '{}';
    } else {
      return NextResponse.json({ error: 'No AI provider available.' }, { status: 400 });
    }

    const elapsed = Date.now() - start;

    await db.agentQuery.create({
      data: {
        workspaceId,
        queryText: `[Forecaster:${phase || 'command'}] ${prompt.slice(0, 200)}`,
        routedTo: `forecaster-${phase || 'command'}`,
        responseText: response,
        responseTimeMs: elapsed,
      },
    });

    return NextResponse.json({ response, responseTimeMs: elapsed, provider: preferredProvider });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Forecaster request failed' }, { status: 500 });
  }
}
