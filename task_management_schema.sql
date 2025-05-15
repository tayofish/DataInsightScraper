-- Task Management Application PostgreSQL Schema
-- This schema matches the application's Drizzle ORM schema definitions

-- Create enum types
CREATE TYPE "priority" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "status" AS ENUM ('todo', 'in_progress', 'completed');
CREATE TYPE "channel_type" AS ENUM ('public', 'private', 'direct');
CREATE TYPE "message_type" AS ENUM ('text', 'file', 'system');

-- Departments
CREATE TABLE "departments" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "avatar" TEXT,
  "is_admin" BOOLEAN DEFAULT false,
  "department_id" INTEGER REFERENCES "departments"("id")
);

-- Projects
CREATE TABLE "projects" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Categories
CREATE TABLE "categories" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#6b7280',
  "department_id" INTEGER REFERENCES "departments"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE "tasks" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "start_date" TIMESTAMP,
  "due_date" TIMESTAMP,
  "priority" priority DEFAULT 'medium',
  "status" status DEFAULT 'todo',
  "project_id" INTEGER REFERENCES "projects"("id"),
  "assignee_id" INTEGER REFERENCES "users"("id"),
  "category_id" INTEGER REFERENCES "categories"("id"),
  "department_id" INTEGER REFERENCES "departments"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Project Assignments
CREATE TABLE "project_assignments" (
  "id" SERIAL PRIMARY KEY,
  "project_id" INTEGER NOT NULL REFERENCES "projects"("id"),
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "role" TEXT DEFAULT 'member',
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Task Updates
CREATE TABLE "task_updates" (
  "id" SERIAL PRIMARY KEY,
  "task_id" INTEGER NOT NULL REFERENCES "tasks"("id"),
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "update_type" TEXT NOT NULL,
  "previous_value" TEXT,
  "new_value" TEXT,
  "comment" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Task Collaborators
CREATE TABLE "task_collaborators" (
  "id" SERIAL PRIMARY KEY,
  "task_id" INTEGER NOT NULL REFERENCES "tasks"("id"),
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "role" TEXT DEFAULT 'viewer',
  "invited_by" INTEGER NOT NULL REFERENCES "users"("id"),
  "status" TEXT DEFAULT 'pending',
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Reports
CREATE TABLE "reports" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL,
  "parameters" TEXT,
  "created_by" INTEGER NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "last_run_at" TIMESTAMP
);

-- SMTP Configuration
CREATE TABLE "smtp_config" (
  "id" SERIAL PRIMARY KEY,
  "host" TEXT NOT NULL,
  "port" INTEGER NOT NULL,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "from_email" TEXT NOT NULL,
  "from_name" TEXT NOT NULL,
  "enable_tls" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP
);

-- Notifications
CREATE TABLE "notifications" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reference_id" INTEGER,
  "reference_type" TEXT,
  "is_read" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- App Settings
CREATE TABLE "app_settings" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP
);

-- Channels (team communication)
CREATE TABLE "channels" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" channel_type NOT NULL DEFAULT 'public',
  "created_by" INTEGER NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP,
  "is_archived" BOOLEAN DEFAULT false
);

-- Channel Members
CREATE TABLE "channel_members" (
  "id" SERIAL PRIMARY KEY,
  "channel_id" INTEGER NOT NULL REFERENCES "channels"("id"),
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "role" TEXT DEFAULT 'member',
  "joined_at" TIMESTAMP NOT NULL DEFAULT now(),
  "last_read" TIMESTAMP
);

-- Messages
CREATE TABLE "messages" (
  "id" SERIAL PRIMARY KEY,
  "channel_id" INTEGER NOT NULL REFERENCES "channels"("id"),
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "parent_id" INTEGER REFERENCES "messages"("id"),
  "content" TEXT NOT NULL,
  "type" message_type DEFAULT 'text',
  "attachments" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP,
  "is_edited" BOOLEAN DEFAULT false,
  "reactions" TEXT,
  "mentions" TEXT
);

-- Direct Messages
CREATE TABLE "direct_messages" (
  "id" SERIAL PRIMARY KEY,
  "sender_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "receiver_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "content" TEXT NOT NULL,
  "type" message_type DEFAULT 'text',
  "attachments" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "is_read" BOOLEAN DEFAULT false,
  "is_edited" BOOLEAN DEFAULT false
);

-- User Activities
CREATE TABLE "user_activities" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "action" TEXT NOT NULL,
  "resource_type" TEXT,
  "resource_id" INTEGER,
  "details" TEXT,
  "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
  "ip_address" TEXT
);

-- Indexes (to optimize common queries)
CREATE INDEX "tasks_project_id_idx" ON "tasks" ("project_id");
CREATE INDEX "tasks_assignee_id_idx" ON "tasks" ("assignee_id");
CREATE INDEX "tasks_category_id_idx" ON "tasks" ("category_id");
CREATE INDEX "tasks_department_id_idx" ON "tasks" ("department_id");
CREATE INDEX "tasks_status_idx" ON "tasks" ("status");
CREATE INDEX "tasks_priority_idx" ON "tasks" ("priority");
CREATE INDEX "task_updates_task_id_idx" ON "task_updates" ("task_id");
CREATE INDEX "task_collaborators_task_id_idx" ON "task_collaborators" ("task_id");
CREATE INDEX "project_assignments_project_id_idx" ON "project_assignments" ("project_id");
CREATE INDEX "project_assignments_user_id_idx" ON "project_assignments" ("user_id");
CREATE INDEX "notifications_user_id_idx" ON "notifications" ("user_id");
CREATE INDEX "notifications_is_read_idx" ON "notifications" ("is_read");
CREATE INDEX "messages_channel_id_idx" ON "messages" ("channel_id");
CREATE INDEX "direct_messages_sender_id_idx" ON "direct_messages" ("sender_id");
CREATE INDEX "direct_messages_receiver_id_idx" ON "direct_messages" ("receiver_id");
CREATE INDEX "user_activities_user_id_idx" ON "user_activities" ("user_id");
CREATE INDEX "user_activities_timestamp_idx" ON "user_activities" ("timestamp");