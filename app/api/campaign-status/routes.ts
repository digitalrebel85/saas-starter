import { auth } from '@/auth';
import { db } from '@/db';
import { campaigns } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  // Validate webhook signature from n8n
  const n8nToken = req.headers.get('n8n-auth');
  if (n8nToken !== process.env.N8N_WEBHOOK_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Parse request body
  const { campaignId, status, leadsProcessed, error } = await req.json();
  
  try {
    // Update campaign status
    await db.update(campaigns)
      .set({ 
        status, 
        processedCount: leadsProcessed || 0,
        errorMessage: error || null,
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, campaignId));
    
    // Return success
    return Response.json({ success: true });
  } catch (error) {
    console.error('Status update error:', error);
    return Response.json({ error: 'Failed to update status' }, { status: 500 });
  }
}