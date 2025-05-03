import { db } from "@db";
import { 
  users, tasks, projects, categories,
  type User, type Task, type Project, type Category,
  type InsertUser, type InsertTask, type InsertProject, type InsertCategory,
  type UpdateTask 
} from "@shared/schema";
import { eq, and, or, desc, asc, isNull, sql } from "drizzle-orm";

// User-related operations
export const storage = {
  // User operations
  getAllUsers: async (): Promise<User[]> => {
    return db.query.users.findMany();
  },

  getUserById: async (id: number): Promise<User | undefined> => {
    return db.query.users.findFirst({
      where: eq(users.id, id)
    });
  },

  // Project operations
  getAllProjects: async (): Promise<Project[]> => {
    return db.query.projects.findMany();
  },

  getProjectById: async (id: number): Promise<Project | undefined> => {
    return db.query.projects.findFirst({
      where: eq(projects.id, id)
    });
  },

  createProject: async (projectData: InsertProject): Promise<Project> => {
    const [newProject] = await db.insert(projects).values(projectData).returning();
    return newProject;
  },

  updateProject: async (id: number, projectData: Partial<InsertProject>): Promise<Project | undefined> => {
    const [updatedProject] = await db.update(projects)
      .set(projectData)
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  },

  deleteProject: async (id: number): Promise<boolean> => {
    await db.delete(projects).where(eq(projects.id, id));
    return true;
  },

  // Category operations
  getAllCategories: async (): Promise<Category[]> => {
    return db.query.categories.findMany();
  },

  getCategoryById: async (id: number): Promise<Category | undefined> => {
    return db.query.categories.findFirst({
      where: eq(categories.id, id)
    });
  },

  createCategory: async (categoryData: InsertCategory): Promise<Category> => {
    const [newCategory] = await db.insert(categories).values(categoryData).returning();
    return newCategory;
  },

  updateCategory: async (id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> => {
    const [updatedCategory] = await db.update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  },

  deleteCategory: async (id: number): Promise<boolean> => {
    await db.delete(categories).where(eq(categories.id, id));
    return true;
  },

  // Task operations
  getAllTasks: async (filters?: {
    status?: string,
    priority?: string,
    projectId?: number,
    assigneeId?: number,
    categoryId?: number,
    department?: string,
    search?: string
  }): Promise<(Task & { project?: Project | null, assignee?: User | null, category?: Category | null })[]> => {
    const conditions = [];

    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(tasks.status, filters.status as any));
    }

    if (filters?.priority && filters.priority !== 'all') {
      conditions.push(eq(tasks.priority, filters.priority as any));
    }

    if (filters?.projectId && filters.projectId !== -1) {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }

    if (filters?.assigneeId) {
      if (filters.assigneeId === -1) {
        // Unassigned tasks
        conditions.push(isNull(tasks.assigneeId));
      } else if (filters.assigneeId !== -2) { // -2 means all tasks
        // Tasks assigned to specific user
        conditions.push(eq(tasks.assigneeId, filters.assigneeId));
      }
    }
    
    if (filters?.categoryId) {
      if (filters.categoryId === -1) {
        // Tasks with no category
        conditions.push(isNull(tasks.categoryId));
      } else if (filters.categoryId !== -2) { // -2 means all categories
        // Tasks with specific category
        conditions.push(eq(tasks.categoryId, filters.categoryId));
      }
    }
    
    if (filters?.department && filters.department !== 'all') {
      // When filtering by department, we need to join with the categories table
      const departmentFilter = sql`
        EXISTS (
          SELECT 1 FROM ${categories}
          WHERE ${categories.id} = ${tasks.categoryId}
          AND ${categories.department} = ${filters.department}
        )
      `;
      conditions.push(departmentFilter);
    }
    
    if (filters?.search) {
      conditions.push(
        or(
          sql`${tasks.title} ILIKE ${'%' + filters.search + '%'}`,
          sql`${tasks.description} ILIKE ${'%' + filters.search + '%'}`
        )
      );
    }

    const result = conditions.length > 0 
      ? await db.query.tasks.findMany({
          where: and(...conditions),
          with: {
            project: true,
            assignee: true,
            category: true
          }
        })
      : await db.query.tasks.findMany({
          with: {
            project: true,
            assignee: true,
            category: true
          }
        });
        
    return result;
  },

  getTaskById: async (id: number): Promise<(Task & { project?: Project | null, assignee?: User | null, category?: Category | null }) | undefined> => {
    const result = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        project: true,
        assignee: true,
        category: true
      }
    });
    
    // Converting the result to the expected type
    return result;
  },

  createTask: async (taskData: InsertTask): Promise<Task> => {
    const [newTask] = await db.insert(tasks).values(taskData).returning();
    return newTask;
  },

  updateTask: async (id: number, taskData: Partial<UpdateTask>): Promise<Task | undefined> => {
    // Add updatedAt timestamp
    const dataWithTimestamp = { 
      ...taskData, 
      updatedAt: new Date() 
    };
    
    const [updatedTask] = await db.update(tasks)
      .set(dataWithTimestamp)
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask;
  },

  deleteTask: async (id: number): Promise<boolean> => {
    await db.delete(tasks).where(eq(tasks.id, id));
    return true;
  },

  // Dashboard statistics
  getTaskStatistics: async (): Promise<{ 
    total: number, 
    completed: number, 
    pending: number, 
    overdue: number 
  }> => {
    const allTasks = await db.query.tasks.findMany();
    const now = new Date();
    
    const total = allTasks.length;
    const completed = allTasks.filter(task => task.status === 'completed').length;
    const pending = allTasks.filter(task => task.status !== 'completed').length;
    const overdue = allTasks.filter(task => 
      task.status !== 'completed' && 
      task.dueDate && 
      new Date(task.dueDate) < now
    ).length;

    return { total, completed, pending, overdue };
  }
};
