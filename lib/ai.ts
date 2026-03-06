import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { db } from './db';
import { decryptToken } from './crypto';

export async function getAIClients(workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { anthropicApiKey: true, openaiApiKey: true },
  });

  const anthropicKey = workspace?.anthropicApiKey
    ? decryptToken(workspace.anthropicApiKey)
    : process.env.ANTHROPIC_API_KEY;

  const openaiKey = workspace?.openaiApiKey
    ? decryptToken(workspace.openaiApiKey)
    : process.env.OPENAI_API_KEY;

  return {
    claude: anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null,
    openai: openaiKey ? new OpenAI({ apiKey: openaiKey }) : null,
    preferredProvider: anthropicKey ? 'anthropic' : openaiKey ? 'openai' : 'none',
    hasAI: !!(anthropicKey || openaiKey),
  };
}
