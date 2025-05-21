// app/api/campaigns/create/route.ts
import { auth } from '@/auth';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { checkUsageLimit, incrementUsage } from '@/lib/usage';
import { nanoid } from 'nanoid';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Parse request body
  const { name, template, leads, settings } = await req.json();
  
  // Check usage limits
  const usage = await checkUsageLimit(session.user.id);
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
      userId: session.user.id,
      name,
      status: 'pending',
      settings: JSON.stringify(settings)
    });
    
    // Get user subscription
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, session.user.id)
    });
    
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
        subscription: user?.subscriptionTier || 'free'
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to trigger automation');
    }
    
    // Increment usage
    await incrementUsage(session.user.id, leads.length);
    
    // Return success
    return Response.json({ 
      success: true,
      campaignId,
      usage: await checkUsageLimit(session.user.id)
    });
  } catch (error) {
    console.error('Campaign creation error:', error);
    return Response.json({ 
      error: 'Failed to create campaign' 
    }, { status: 500 });
  }
}