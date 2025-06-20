import { hashPassword } from '../server/auth.js';
import { db } from '../db/index.js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function updateTestUserPassword() {
  try {
    console.log('Hashing password...');
    const hashedPassword = await hashPassword('test123');
    console.log('Password hashed successfully');
    
    console.log('Updating test user password...');
    const result = await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.username, 'test.newuser'))
      .returning();
    
    console.log('Test user password updated:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error updating password:', error);
    process.exit(1);
  }
}

updateTestUserPassword();