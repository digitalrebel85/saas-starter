export async function incrementUsage(userId: string, count: number) {
    const date = new Date();
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    await db.transaction(async (tx) => {
      // Get current usage record
      const record = await tx.query.usageLimits.findFirst({
        where: (limits, { and, eq }) => and(
          eq(limits.userId, userId),
          eq(limits.month, month)
        )
      });
      
      if (record) {
        // Update existing record
        await tx.update(usageLimits)
          .set({ count: record.count + count })
          .where(eq(usageLimits.id, record.id));
      } else {
        // Create new record
        await tx.insert(usageLimits).values({
          id: nanoid(),
          userId,
          month,
          count
        });
      }
    });
  }