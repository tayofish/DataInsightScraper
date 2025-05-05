import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums for task properties
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high']);
export const statusEnum = pgEnum('status', ['todo', 'in_progress', 'completed']);

// Users table 
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  isAdmin: boolean("is_admin").default(false),
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
  dueDate: timestamp("due_date"),
  priority: priorityEnum("priority").default('medium'),
  status: statusEnum("status").default('todo'),
  projectId: integer("project_id").references(() => projects.id),
  assigneeId: integer("assignee_id").references(() => users.id),
  categoryId: integer("category_id").references(() => categories.id),
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

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  projectAssignments: many(projectAssignments),
  taskUpdates: many(taskUpdates),
  taskCollaborations: many(taskCollaborators),
  reportsCreated: many(reports, { relationName: "reportCreator" }),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  projectAssignments: many(projectAssignments),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  categories: many(categories),
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
});

export const categoryInsertSchema = createInsertSchema(categories, {
  name: (schema) => schema.min(2, "Category name must be at least 2 characters"),
});

export const taskInsertSchema = createInsertSchema(tasks, {
  title: (schema) => schema.min(3, "Task title must be at least 3 characters"),
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
export const taskUpdateInsertSchema = createInsertSchema(taskUpdates);
export const taskCollaboratorInsertSchema = createInsertSchema(taskCollaborators);
export const reportInsertSchema = createInsertSchema(reports, {
  name: (schema) => schema.min(3, "Report name must be at least 3 characters"),
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

export const taskUpdateSelectSchema = createSelectSchema(taskUpdates);
export type TaskUpdate = z.infer<typeof taskUpdateSelectSchema>;
export type InsertTaskUpdate = z.infer<typeof taskUpdateInsertSchema>;

export const taskCollaboratorSelectSchema = createSelectSchema(taskCollaborators);
export type TaskCollaborator = z.infer<typeof taskCollaboratorSelectSchema>;
export type InsertTaskCollaborator = z.infer<typeof taskCollaboratorInsertSchema>;

export const reportSelectSchema = createSelectSchema(reports);
export type Report = z.infer<typeof reportSelectSchema>;
export type InsertReport = z.infer<typeof reportInsertSchema>;

// Frontend specific schemas
export const taskFormSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(3, "Task title must be at least 3 characters"),
  description: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'completed']).default('todo'),
  projectId: z.number().optional().nullable(),
  assigneeId: z.number().optional().nullable(),
  categoryId: z.number().optional().nullable(),
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
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;
