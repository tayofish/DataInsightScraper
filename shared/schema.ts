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
  department: text("department"), // Department field for custom categorization  
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

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
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

export const taskUpdateSchema = taskInsertSchema.partial().required({ id: true });

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

// Define task schemas
export const taskSelectSchema = createSelectSchema(tasks);
export type Task = z.infer<typeof taskSelectSchema>;
export type InsertTask = z.infer<typeof taskInsertSchema>;
export type UpdateTask = z.infer<typeof taskUpdateSchema>;

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
