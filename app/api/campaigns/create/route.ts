import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/drizzle';
import { campaigns, users } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

type Usage = {
  used: number;
  remaining: number;
  limit: number;
};

async function checkUsageLimit(userId: string): Promise<Usage> {
  // TODO: Implement actual usage check
  return { used: 0, remaining: 1000, limit: 1000 };
}

async function incrementUsage(userId: string, count: number): Promise<void> {
  // TODO: Implement actual usage increment
  console.log(`Incrementing usage for user ${userId} by ${count}`);
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_APP_URL?: string;
      N8N_WEBHOOK_SECRET?: string;
    }
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  
  // Parse request body
  const { name, template, leads, settings } = await req.json();
  
  // Check usage limits
  const userId = String(session.user.id);
  const usage = await checkUsageLimit(userId);
  if (usage.remaining < leads.length) {
    return Response.json({ 
      error: 'Usage limit exceeded',
      usage 
    }, { status: 403 });
  }
  
  try {
    // Create campaign in database
    const campaignId = nanoid();
    await db.insert(campaigns).values({
      id: campaignId,
      userId: userId,
      name,
      status: 'pending',
      settings: JSON.stringify(settings),
      scheduledAt: null,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      totalCount: Array.isArray(leads) ? leads.length : 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Get user's team subscription info
    const userWithTeam = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, Number(session.user.id)),
      with: {
        teamMembers: {
          with: {
            team: true
          }
        }
      }
    });

    // Get the first team's subscription status or default to 'free'
    const subscriptionTier = userWithTeam?.teamMembers[0]?.team.planName || 'free';
    
    // Set callback URL for n8n to notify your app
    const callbackUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com';
    
    // Trigger n8n workflow via webhook
    const response = await fetch('https://your-n8n-instance.com/webhook/campaign-processor', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'n8n-auth': process.env.N8N_WEBHOOK_SECRET || 'your-secret-token'
      },
      body: JSON.stringify({
        userId: session.user.id,
        campaignId,
        name,
        template,
        leads,
        settings: {
          ...settings,
          callbackUrl
        },
        subscription: subscriptionTier
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to trigger automation');
    }
    
    // Increment usage
    const leadsCount = Array.isArray(leads) ? leads.length : 0;
    await incrementUsage(userId, leadsCount);
    
    // Return success
    return Response.json({ 
      success: true,
      campaignId,
      usage: await checkUsageLimit(userId)
    });
  } catch (error) {
    console.error('Campaign creation error:', error);
    return Response.json({ 
      error: 'Failed to create campaign' 
    }, { status: 500 });
  }
}