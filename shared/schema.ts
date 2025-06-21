import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums for task properties
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high']);
export const statusEnum = pgEnum('status', ['todo', 'in_progress', 'completed']);
export const channelTypeEnum = pgEnum('channel_type', ['public', 'private', 'direct']);
export const messageTypeEnum = pgEnum('message_type', ['text', 'file', 'system']);

// Users table 
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  avatar: text("avatar"),
  isAdmin: boolean("is_admin").default(false),
  isApproved: boolean("is_approved").default(true), // Default true for existing users, false for new OAuth users
  isBlocked: boolean("is_blocked").default(false), // Default false for all users
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false), // Track first-time onboarding
  departmentId: integer("department_id").references(() => departments.id),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  unitHeadId: integer("unit_head_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default('#6b7280'), // Default gray color
  departmentId: integer("department_id").references(() => departments.id), // Reference to departments table
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tasks table with relations to users and projects
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  priority: priorityEnum("priority").default('medium'),
  status: statusEnum("status").default('todo'),
  projectId: integer("project_id").references(() => projects.id),
  assigneeId: integer("assignee_id").references(() => users.id),
  categoryId: integer("category_id").references(() => categories.id),
  departmentId: integer("department_id").references(() => departments.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Project-User assignments table to track which users are assigned to which projects
export const projectAssignments = pgTable("project_assignments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").default("member"), // role in project: member, lead, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User-Department (Unit) assignments table for many-to-many relationship
export const userDepartments = pgTable("user_departments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  departmentId: integer("department_id").references(() => departments.id).notNull(),
  isPrimary: boolean("is_primary").default(false),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

// Task updates for tracking changes
export const taskUpdates = pgTable("task_updates", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(), // User who made the update
  updateType: text("update_type").notNull(), // Type of update (status change, assignee change, etc)
  previousValue: text("previous_value"), // Previous value (serialized if needed)
  newValue: text("new_value"), // New value (serialized if needed)
  comment: text("comment"), // Optional comment about the change
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Task collaborators table for inviting others to collaborate
export const taskCollaborators = pgTable("task_collaborators", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").default("viewer"), // collaborator role: viewer, editor, etc.
  invitedBy: integer("invited_by").references(() => users.id).notNull(), // Who invited this collaborator
  status: text("status").default("pending"), // Status: pending, accepted, declined
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reports table for report generation
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // Type of report: tasks_by_project, user_performance, etc.
  parameters: text("parameters"), // JSON string of report parameters
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastRunAt: timestamp("last_run_at"),
});

// SMTP configuration for email notifications
export const smtpConfig = pgTable("smtp_config", {
  id: serial("id").primaryKey(),
  host: text("host").notNull(),
  port: integer("port").notNull(), 
  username: text("username").notNull(),
  password: text("password").notNull(), 
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  enableTls: boolean("enable_tls").default(true).notNull(),
  active: boolean("active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

// Notifications table for user notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // Type of notification: task_assignment, task_mention, task_comment, project_assignment, etc.
  referenceId: integer("reference_id"), // ID of the referenced item (task, project, etc.)
  referenceType: text("reference_type"), // Type of referenced item (task, project, etc.)
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Application settings table for storing app-wide settings
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // Setting key (e.g., "logo", "company_name", etc.)
  value: text("value"), // Setting value
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

// Define relationships
export const usersRelations = relations(users, ({ many, one }) => ({
  tasks: many(tasks),
  projectAssignments: many(projectAssignments),
  taskUpdates: many(taskUpdates),
  taskCollaborations: many(taskCollaborators),
  reportsCreated: many(reports, { relationName: "reportCreator" }),
  notifications: many(notifications),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
  userDepartments: many(userDepartments),
  // Collaboration features relations
  channelMemberships: many(channelMembers),
  messages: many(messages),
  sentDirectMessages: many(directMessages, { relationName: 'sentMessages' }),
  receivedDirectMessages: many(directMessages, { relationName: 'receivedMessages' }),
  activities: many(userActivities),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  projectAssignments: many(projectAssignments),
}));

export const departmentsRelations = relations(departments, ({ many, one }) => ({
  categories: many(categories),
  users: many(users),
  userDepartments: many(userDepartments),
  unitHead: one(users, {
    fields: [departments.unitHeadId],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  tasks: many(tasks),
  department: one(departments, {
    fields: [categories.departmentId],
    references: [departments.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [tasks.categoryId],
    references: [categories.id],
  }),
  department: one(departments, {
    fields: [tasks.departmentId],
    references: [departments.id],
  }),
  updates: many(taskUpdates),
  collaborators: many(taskCollaborators),
}));

export const taskUpdatesRelations = relations(taskUpdates, ({ one }) => ({
  task: one(tasks, {
    fields: [taskUpdates.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskUpdates.userId],
    references: [users.id],
  }),
}));

export const taskCollaboratorsRelations = relations(taskCollaborators, ({ one }) => ({
  task: one(tasks, {
    fields: [taskCollaborators.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskCollaborators.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [taskCollaborators.invitedBy],
    references: [users.id],
  }),
}));

export const projectAssignmentsRelations = relations(projectAssignments, ({ one }) => ({
  project: one(projects, {
    fields: [projectAssignments.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectAssignments.userId],
    references: [users.id],
  }),
}));

export const userDepartmentsRelations = relations(userDepartments, ({ one }) => ({
  user: one(users, {
    fields: [userDepartments.userId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [userDepartments.departmentId],
    references: [departments.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  creator: one(users, { 
    fields: [reports.createdBy],
    references: [users.id],
    relationName: "reportCreator",
  }),
}));

// Define schemas for validation
export const userInsertSchema = createInsertSchema(users, {
  username: (schema) => schema.min(3, "Username must be at least 3 characters"),
  password: (schema) => schema.min(6, "Password must be at least 6 characters"),
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
});

export const projectInsertSchema = createInsertSchema(projects, {
  name: (schema) => schema.min(3, "Project name must be at least 3 characters"),
});

export const departmentInsertSchema = createInsertSchema(departments, {
  name: (schema) => schema.min(2, "Department name must be at least 2 characters"),
  unitHeadId: (schema) => schema.nullable().optional(),
});

export const categoryInsertSchema = createInsertSchema(categories, {
  name: (schema) => schema.min(2, "Category name must be at least 2 characters"),
});

export const taskInsertSchema = createInsertSchema(tasks, {
  title: (schema) => schema.min(3, "Task title must be at least 3 characters"),
  startDate: (schema) => z.preprocess(
    // Convert string date to Date object or null
    (val) => val === null || val === '' ? null : new Date(val as string),
    z.date().nullable().optional()
  ),
  dueDate: (schema) => z.preprocess(
    // Convert string date to Date object or null
    (val) => val === null || val === '' ? null : new Date(val as string),
    z.date().nullable().optional()
  )
});

// Update schema doesn't need the ID to be required in the body since it's passed in the URL
export const taskUpdateSchema = taskInsertSchema.partial();

// Define user schemas
export const userSelectSchema = createSelectSchema(users);
export type User = z.infer<typeof userSelectSchema>;
export type InsertUser = z.infer<typeof userInsertSchema>;

// Define project schemas
export const projectSelectSchema = createSelectSchema(projects);
export type Project = z.infer<typeof projectSelectSchema>;
export type InsertProject = z.infer<typeof projectInsertSchema>;

// Define department schemas
export const departmentSelectSchema = createSelectSchema(departments);
export type Department = z.infer<typeof departmentSelectSchema>;
export type InsertDepartment = z.infer<typeof departmentInsertSchema>;

// Define category schemas
export const categorySelectSchema = createSelectSchema(categories);
export type Category = z.infer<typeof categorySelectSchema>;
export type InsertCategory = z.infer<typeof categoryInsertSchema>;

// Define additional insert schemas for new tables
export const projectAssignmentInsertSchema = createInsertSchema(projectAssignments);
export const taskUpdateInsertSchema = createInsertSchema(taskUpdates, {
  // Ensure all required fields are validated
  updateType: (schema) => schema.min(1, "Update type is required"),
  comment: (schema) => schema.optional(),
});
export const taskCollaboratorInsertSchema = createInsertSchema(taskCollaborators);
export const reportInsertSchema = createInsertSchema(reports, {
  name: (schema) => schema.min(3, "Report name must be at least 3 characters"),
});

export const smtpConfigInsertSchema = createInsertSchema(smtpConfig, {
  host: (schema) => schema.min(1, "SMTP host is required"),
  port: (schema) => schema,
  username: (schema) => schema.min(1, "SMTP username is required"),
  password: (schema) => schema.min(1, "SMTP password is required"),
  fromEmail: (schema) => schema.email("Must be a valid email address"),
  fromName: (schema) => schema.min(1, "From name is required"),
});

// Define task schemas
export const taskSelectSchema = createSelectSchema(tasks);
export type Task = z.infer<typeof taskSelectSchema>;
export type InsertTask = z.infer<typeof taskInsertSchema>;
export type UpdateTask = z.infer<typeof taskUpdateSchema>;

// Define additional select schemas
export const projectAssignmentSelectSchema = createSelectSchema(projectAssignments);
export type ProjectAssignment = z.infer<typeof projectAssignmentSelectSchema>;
export type InsertProjectAssignment = z.infer<typeof projectAssignmentInsertSchema>;

export const userDepartmentInsertSchema = createInsertSchema(userDepartments);
export const userDepartmentSelectSchema = createSelectSchema(userDepartments);
export type UserDepartment = z.infer<typeof userDepartmentSelectSchema>;
export type InsertUserDepartment = z.infer<typeof userDepartmentInsertSchema>;

export const taskUpdateSelectSchema = createSelectSchema(taskUpdates);
export type TaskUpdate = z.infer<typeof taskUpdateSelectSchema>;
export type InsertTaskUpdate = z.infer<typeof taskUpdateInsertSchema>;

export const taskCollaboratorSelectSchema = createSelectSchema(taskCollaborators);
export type TaskCollaborator = z.infer<typeof taskCollaboratorSelectSchema>;
export type InsertTaskCollaborator = z.infer<typeof taskCollaboratorInsertSchema>;

export const reportSelectSchema = createSelectSchema(reports);
export type Report = z.infer<typeof reportSelectSchema>;
export type InsertReport = z.infer<typeof reportInsertSchema>;

export const smtpConfigSelectSchema = createSelectSchema(smtpConfig);
export type SmtpConfig = z.infer<typeof smtpConfigSelectSchema>;
export type InsertSmtpConfig = z.infer<typeof smtpConfigInsertSchema>;

// Define notification relations and schemas
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const notificationInsertSchema = createInsertSchema(notifications, {
  title: (schema) => schema.min(1, "Notification title is required"),
  message: (schema) => schema.min(1, "Notification message is required"),
});

export const notificationSelectSchema = createSelectSchema(notifications);
export type Notification = z.infer<typeof notificationSelectSchema>;
export type InsertNotification = z.infer<typeof notificationInsertSchema>;

// App settings schemas
export const appSettingInsertSchema = createInsertSchema(appSettings, {
  key: (schema) => schema.min(1, "Setting key is required"),
  value: (schema) => schema.optional(),
});

export const appSettingSelectSchema = createSelectSchema(appSettings);
export type AppSetting = z.infer<typeof appSettingSelectSchema>;
export type InsertAppSetting = z.infer<typeof appSettingInsertSchema>;

// Frontend specific schemas
export const taskFormSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(3, "Task title must be at least 3 characters"),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'completed']).default('todo'),
  projectId: z.number().optional().nullable(),
  assigneeId: z.number().optional().nullable(),
  categoryId: z.number().optional().nullable(),
  departmentId: z.number().optional().nullable(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

// Project assignment form schema
export const projectAssignmentFormSchema = z.object({
  id: z.number().optional(),
  projectId: z.number(),
  userId: z.number(),
  role: z.string().default("member"),
});

export type ProjectAssignmentFormValues = z.infer<typeof projectAssignmentFormSchema>;

// Task update form schema
export const taskUpdateFormSchema = z.object({
  taskId: z.number(),
  comment: z.string().optional(),
});

export type TaskUpdateFormValues = z.infer<typeof taskUpdateFormSchema>;

// Task comment form schema
export const taskCommentFormSchema = z.object({
  taskId: z.number(),
  comment: z.string().min(1, "Comment cannot be empty"),
  updateType: z.string().default("Comment"),
});

export type TaskCommentFormValues = z.infer<typeof taskCommentFormSchema>;

// Task collaborator form schema
export const taskCollaboratorFormSchema = z.object({
  taskId: z.number(),
  userId: z.number(),
  role: z.string().default("viewer"),
});

export type TaskCollaboratorFormValues = z.infer<typeof taskCollaboratorFormSchema>;

// Report form schema
export const reportFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(3, "Report name must be at least 3 characters"),
  description: z.string().optional(),
  type: z.string(),
  parameters: z.string().optional(), // Will be stringified JSON
  createdBy: z.number().optional(), // Will be set by the server based on authenticated user
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;

// SMTP configuration form schema
export const smtpConfigFormSchema = z.object({
  id: z.number().optional(),
  host: z.string().min(1, "SMTP host is required"),
  port: z.coerce.number().min(1, "SMTP port is required"),
  username: z.string().min(1, "SMTP username is required"),
  password: z.string().min(1, "SMTP password is required"),
  fromEmail: z.string().email("Must be a valid email address"),
  fromName: z.string().min(1, "From name is required"),
  enableTls: z.boolean().default(true),
  active: z.boolean().default(false),
});

export type SmtpConfigFormValues = z.infer<typeof smtpConfigFormSchema>;

// === SLACK-LIKE COLLABORATION TABLES ===

// Channels (for team communication)
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: channelTypeEnum("type").notNull().default('public'),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  isArchived: boolean("is_archived").default(false),
});

// Channel members (users in channels)
export const channelMembers = pgTable("channel_members", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => channels.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").default('member'), // 'owner', 'admin', 'member'
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastRead: timestamp("last_read"),
});

// Messages in channels
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => channels.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  parentId: integer("parent_id").references((): any => messages.id), // For message threads
  content: text("content").notNull(),
  type: messageTypeEnum("type").default('text'),
  attachments: text("attachments"), // JSON string of attachments
  fileUrl: text("file_url"), // URL to the uploaded file
  fileName: text("file_name"), // Original name of the uploaded file
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
  isEdited: boolean("is_edited").default(false),
  reactions: text("reactions"), // JSON string of reactions
  mentions: text("mentions"), // JSON string of user IDs mentioned
});

// Direct messages between users
export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  type: messageTypeEnum("type").default('text'),
  attachments: text("attachments"), // JSON string of attachments
  fileUrl: text("file_url"), // URL to the uploaded file
  fileName: text("file_name"), // Original name of the uploaded file
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isRead: boolean("is_read").default(false),
  isEdited: boolean("is_edited").default(false),
});

// User activity log
export const userActivities = pgTable("user_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // 'login', 'logout', 'message', 'create_task', etc.
  resourceType: text("resource_type"), // 'task', 'project', 'channel', etc.
  resourceId: integer("resource_id"), 
  details: text("details"), // JSON string of additional details
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  ipAddress: text("ip_address"),
});

// Define relationships
export const channelsRelations = relations(channels, ({ many, one }) => ({
  members: many(channelMembers),
  messages: many(messages),
  creator: one(users, { fields: [channels.createdBy], references: [users.id] }),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, { fields: [channelMembers.channelId], references: [channels.id] }),
  user: one(users, { fields: [channelMembers.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, { fields: [messages.channelId], references: [channels.id] }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
  parent: one(messages, { fields: [messages.parentId], references: [messages.id] }),
  replies: many(messages, { relationName: 'replies' }),
}));

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  sender: one(users, { fields: [directMessages.senderId], references: [users.id] }),
  receiver: one(users, { fields: [directMessages.receiverId], references: [users.id] }),
}));

export const userActivitiesRelations = relations(userActivities, ({ one }) => ({
  user: one(users, { fields: [userActivities.userId], references: [users.id] }),
}));

// Update user relations to include channels, messages, etc.
// Note: We'll update the existing usersRelations rather than create a new one
// The original usersRelations is defined elsewhere in the file

// Create schema definitions for our new tables
export const channelInsertSchema = createInsertSchema(channels, {
  name: (schema) => schema.min(2, "Channel name must be at least 2 characters"),
  description: (schema) => schema.optional(),
});
// Create schema definitions for channels
export const channelSelectSchema = createSelectSchema(channels);
export type Channel = z.infer<typeof channelSelectSchema>;
export type InsertChannel = z.infer<typeof channelInsertSchema>;

// Create schema definitions for channel members
export const channelMemberInsertSchema = createInsertSchema(channelMembers);
export const channelMemberSelectSchema = createSelectSchema(channelMembers);
export type ChannelMember = z.infer<typeof channelMemberSelectSchema>;
export type InsertChannelMember = z.infer<typeof channelMemberInsertSchema>;

// Create schema definitions for messages
export const messageInsertSchema = createInsertSchema(messages, {
  content: (schema) => schema.min(1, "Message cannot be empty"),
});
export const messageSelectSchema = createSelectSchema(messages);
export type Message = z.infer<typeof messageSelectSchema>;
export type InsertMessage = z.infer<typeof messageInsertSchema>;

// Create schema definitions for direct messages
export const directMessageInsertSchema = createInsertSchema(directMessages, {
  content: (schema) => schema.min(1, "Message cannot be empty"),
});
export const directMessageSelectSchema = createSelectSchema(directMessages);
export type DirectMessage = z.infer<typeof directMessageSelectSchema>;
export type InsertDirectMessage = z.infer<typeof directMessageInsertSchema>;

// Create schema definitions for user activities
export const userActivityInsertSchema = createInsertSchema(userActivities);
export const userActivitySelectSchema = createSelectSchema(userActivities);
export type UserActivity = z.infer<typeof userActivitySelectSchema>;
export type InsertUserActivity = z.infer<typeof userActivityInsertSchema>;

// Form schemas for frontend validation
export const messageFormSchema = z.object({
  content: z.string().min(1, "Message cannot be empty"),
  channelId: z.number(),
  parentId: z.number().optional(),
  type: z.enum(['text', 'file', 'system']).default('text'),
  attachments: z.string().optional(),
});
export type MessageFormValues = z.infer<typeof messageFormSchema>;

export const directMessageFormSchema = z.object({
  content: z.string().min(1, "Message cannot be empty"),
  receiverId: z.number(),
  type: z.enum(['text', 'file', 'system']).default('text'),
  attachments: z.string().optional(),
});
export type DirectMessageFormValues = z.infer<typeof directMessageFormSchema>;

export const channelFormSchema = z.object({
  name: z.string().min(2, "Channel name must be at least 2 characters"),
  description: z.string().optional(),
  type: z.enum(['public', 'private', 'direct']).default('public'),
});
export type ChannelFormValues = z.infer<typeof channelFormSchema>;
