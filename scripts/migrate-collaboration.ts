import { db } from "../db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Creating collaboration tables...");

  try {
    // Create channel_type enum if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_type') THEN
          CREATE TYPE channel_type AS ENUM ('public', 'private', 'direct');
        END IF;
      END
      $$;
    `);

    // Create message_type enum if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
          CREATE TYPE message_type AS ENUM ('text', 'file', 'system');
        END IF;
      END
      $$;
    `);

    // Create channels table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type channel_type NOT NULL DEFAULT 'public',
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP,
        is_archived BOOLEAN DEFAULT FALSE
      );
    `);

    // Create channel_members table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS channel_members (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_read TIMESTAMP,
        UNIQUE(channel_id, user_id)
      );
    `);

    // Create messages table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type message_type DEFAULT 'text',
        attachments TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP,
        is_edited BOOLEAN DEFAULT FALSE,
        reactions TEXT,
        mentions TEXT
      );
    `);

    // Create direct_messages table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type message_type DEFAULT 'text',
        attachments TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        is_read BOOLEAN DEFAULT FALSE,
        is_edited BOOLEAN DEFAULT FALSE
      );
    `);

    // Create user_activities table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id INTEGER,
        details TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        ip_address TEXT
      );
    `);

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();