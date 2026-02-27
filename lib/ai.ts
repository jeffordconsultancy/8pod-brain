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

  if (!anthropicKey) throw new Error('No Anthropic API key. Go to Settings to add your key.');
  if (!openaiKey) throw new Error('No OpenAI API key. Go to Settings to add your key.');

  return {
    claude: new Anthropic({ apiKey: anthropicKey }),
    openai: new OpenAI({ apiKey: openaiKey }),
  };
}
