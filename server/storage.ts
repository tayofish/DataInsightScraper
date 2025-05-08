import { db } from "@db";
import { pool } from "@db";
import { 
  users, tasks, projects, categories, departments, projectAssignments, taskUpdates, taskCollaborators, reports, notifications, appSettings,
  type User, type Task, type Project, type Category, type Department, 
  type ProjectAssignment, type TaskUpdate, type TaskCollaborator, type Report, type Notification, type AppSetting,
  type InsertUser, type InsertTask, type InsertProject, type InsertCategory, type InsertDepartment,
  type InsertProjectAssignment, type InsertTaskUpdate, type InsertTaskCollaborator, type InsertReport, type InsertNotification,
  type InsertAppSetting, type UpdateTask
} from "@shared/schema";
import { eq, and, or, desc, asc, isNull, sql, inArray } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

// Setup PostgreSQL session store
const PostgresSessionStore = connectPg(session);
const sessionStore = new PostgresSessionStore({
  pool,
  createTableIfMissing: true,
  tableName: 'session'
});

// User-related operations
// Report generation function types
type ReportParameters = string | undefined;

export const storage = {
  // Session store for authentication
  sessionStore,
  
  // User operations
  getAllUsers: async (): Promise<User[]> => {
    return db.query.users.findMany();
  },

  getUserById: async (id: number): Promise<User | undefined> => {
    return db.query.users.findFirst({
      where: eq(users.id, id)
    });
  },
  
  getUser: async (id: number): Promise<User | undefined> => {
    return db.query.users.findFirst({
      where: eq(users.id, id)
    });
  },
  
  getUserByUsername: async (username: string): Promise<User | undefined> => {
    return db.query.users.findFirst({
      where: eq(users.username, username)
    });
  },
  
  createUser: async (userData: InsertUser): Promise<User> => {
    const [newUser] = await db.insert(users).values(userData).returning();
    return newUser;
  },
  
  updateUser: async (id: number, userData: Partial<InsertUser>): Promise<User | undefined> => {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  },
  
  deleteUser: async (id: number): Promise<boolean> => {
    await db.delete(users).where(eq(users.id, id));
    return true;
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
  
  // Department operations
  getAllDepartments: async (): Promise<Department[]> => {
    return db.query.departments.findMany();
  },

  getDepartmentById: async (id: number): Promise<Department | undefined> => {
    return db.query.departments.findFirst({
      where: eq(departments.id, id)
    });
  },

  createDepartment: async (departmentData: InsertDepartment): Promise<Department> => {
    const [newDepartment] = await db.insert(departments).values(departmentData).returning();
    return newDepartment;
  },

  updateDepartment: async (id: number, departmentData: Partial<InsertDepartment>): Promise<Department | undefined> => {
    const [updatedDepartment] = await db.update(departments)
      .set(departmentData)
      .where(eq(departments.id, id))
      .returning();
    return updatedDepartment;
  },

  deleteDepartment: async (id: number): Promise<boolean> => {
    await db.delete(departments).where(eq(departments.id, id));
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
    departmentId?: string,
    search?: string,
    isOverdue?: boolean
  }): Promise<(Task & { project?: Project | null, assignee?: User | null, category?: Category | null, department?: Department | null })[]> => {
    const conditions = [];

    if (filters?.status && filters.status !== 'all') {
      // Handle pipe-separated status values (converted from comma-separated in API)
      if (filters.status.includes('|')) {
        const statusValues = filters.status.split('|');
        const statusConditions = statusValues.map(status => eq(tasks.status, status as any));
        conditions.push(or(...statusConditions));
      } else {
        conditions.push(eq(tasks.status, filters.status as any));
      }
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
    
    // Handle departmentId parameter from client
    if (filters?.departmentId && filters.departmentId !== 'all') {
      const deptId = parseInt(filters.departmentId);
      if (!isNaN(deptId)) {
        conditions.push(eq(tasks.departmentId, deptId));
      }
    } 
    // Also keep the old 'department' parameter for backward compatibility
    else if (filters?.department && filters.department !== 'all') {
      const departmentId = parseInt(filters.department);
      if (!isNaN(departmentId)) {
        conditions.push(eq(tasks.departmentId, departmentId));
      }
    }
    
    // Handle overdue tasks filter
    if (filters?.isOverdue === true) {
      const now = new Date();
      conditions.push(
        and(
          // Due date is in the past
          sql`${tasks.dueDate} < ${now}`,
          // Task is not completed
          sql`${tasks.status} != 'completed'`
        )
      );
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
            category: true,
            department: true
          }
        })
      : await db.query.tasks.findMany({
          with: {
            project: true,
            assignee: true,
            category: true,
            department: true
          }
        });
        
    return result;
  },

  getTaskById: async (id: number): Promise<(Task & { project?: Project | null, assignee?: User | null, category?: Category | null, department?: Department | null }) | undefined> => {
    const result = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        project: true,
        assignee: true,
        category: true,
        department: true
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
  // Gets tasks for a non-admin user based on department and project assignments
  getAllTasksForUser: async (
    userId: number,
    departmentId: number | null,
    projectIds: number[],
    filters?: {
      status?: string,
      priority?: string,
      projectId?: number,
      assigneeId?: number,
      categoryId?: number,
      department?: string,
      departmentId?: string,
      search?: string,
      isOverdue?: boolean
    }
  ): Promise<(Task & { project?: Project | null, assignee?: User | null, category?: Category | null, department?: Department | null })[]> => {
    // Build the base filter conditions (status, priority, etc.)
    const filterConditions = [];
    
    // Add standard filters
    if (filters?.status && filters.status !== 'all') {
      // Handle pipe-separated status values (converted from comma-separated in API)
      if (filters.status.includes('|')) {
        const statusValues = filters.status.split('|');
        const statusConditions = statusValues.map(status => eq(tasks.status, status as any));
        filterConditions.push(or(...statusConditions));
      } else {
        filterConditions.push(eq(tasks.status, filters.status as any));
      }
    }

    if (filters?.priority && filters.priority !== 'all') {
      filterConditions.push(eq(tasks.priority, filters.priority as any));
    }

    if (filters?.projectId && filters.projectId !== -1) {
      filterConditions.push(eq(tasks.projectId, filters.projectId));
    }

    if (filters?.assigneeId) {
      if (filters.assigneeId === -1) {
        filterConditions.push(isNull(tasks.assigneeId));
      } else if (filters.assigneeId !== -2) {
        filterConditions.push(eq(tasks.assigneeId, filters.assigneeId));
      }
    }
    
    if (filters?.categoryId) {
      if (filters.categoryId === -1) {
        filterConditions.push(isNull(tasks.categoryId));
      } else if (filters.categoryId !== -2) {
        filterConditions.push(eq(tasks.categoryId, filters.categoryId));
      }
    }
    
    if (filters?.departmentId && filters.departmentId !== 'all') {
      const deptId = parseInt(filters.departmentId);
      if (!isNaN(deptId)) {
        filterConditions.push(eq(tasks.departmentId, deptId));
      }
    } 
    else if (filters?.department && filters.department !== 'all') {
      const departmentId = parseInt(filters.department);
      if (!isNaN(departmentId)) {
        filterConditions.push(eq(tasks.departmentId, departmentId));
      }
    }
    
    if (filters?.search) {
      filterConditions.push(
        or(
          sql`${tasks.title} ILIKE ${'%' + filters.search + '%'}`,
          sql`${tasks.description} ILIKE ${'%' + filters.search + '%'}`
        )
      );
    }
    
    // Handle overdue tasks filter
    if (filters?.isOverdue === true) {
      const now = new Date();
      filterConditions.push(
        and(
          // Due date is in the past
          sql`${tasks.dueDate} < ${now}`,
          // Task is not completed
          sql`${tasks.status} != 'completed'`
        )
      );
    }
    
    // Build access conditions separately
    // A user can see tasks that match ANY of these conditions:
    // 1. Task is in the user's department
    // 2. Task is from a project the user is assigned to
    // 3. Task is directly assigned to the user
    const accessConditions = [];
    
    // 1. Department condition - if user has a department
    if (departmentId) {
      accessConditions.push(eq(tasks.departmentId, departmentId));
    }
    
    // 2. Project assignments condition - if user has project assignments
    if (projectIds && projectIds.length > 0) {
      // Add each project ID as a condition
      projectIds.forEach(projectId => {
        accessConditions.push(eq(tasks.projectId, projectId));
      });
    }
    
    // 3. Tasks directly assigned to the user
    accessConditions.push(eq(tasks.assigneeId, userId));
    
    // Combine all conditions: 
    // (filterCondition1 AND filterCondition2 AND ...) AND (accessCondition1 OR accessCondition2 OR ...)
    const whereCondition = and(
      // If there are filter conditions, include them all with AND
      ...(filterConditions.length > 0 ? [and(...filterConditions)] : []),
      // Add the access conditions with OR - user must satisfy at least one access condition
      or(...accessConditions)
    );
    
    // Execute the query with all conditions
    const result = await db.query.tasks.findMany({
      where: whereCondition,
      with: {
        project: true,
        assignee: true,
        category: true,
        department: true
      }
    });
    
    return result;
  },

  // Global task statistics - for admin users
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
  },

  // User-specific task statistics - for regular users
  getUserTaskStatistics: async (
    userId: number,
    departmentId: number | null,
    projectIds: number[]
  ): Promise<{ 
    total: number, 
    completed: number, 
    pending: number, 
    overdue: number 
  }> => {
    // Get tasks accessible to this user (same logic as getAllTasksForUser but without filters)
    const accessConditions = [];
    
    // 1. Department condition - if user has a department
    if (departmentId) {
      accessConditions.push(eq(tasks.departmentId, departmentId));
    }
    
    // 2. Project assignments condition - if user has project assignments
    if (projectIds && projectIds.length > 0) {
      projectIds.forEach(projectId => {
        accessConditions.push(eq(tasks.projectId, projectId));
      });
    }
    
    // 3. Tasks directly assigned to the user
    accessConditions.push(eq(tasks.assigneeId, userId));
    
    // Get all tasks accessible to this user
    const userTasks = await db.query.tasks.findMany({
      where: or(...accessConditions)
    });
    
    const now = new Date();
    
    const total = userTasks.length;
    const completed = userTasks.filter(task => task.status === 'completed').length;
    const pending = userTasks.filter(task => task.status !== 'completed').length;
    const overdue = userTasks.filter(task => 
      task.status !== 'completed' && 
      task.dueDate && 
      new Date(task.dueDate) < now
    ).length;

    return { total, completed, pending, overdue };
  },

  // Project Assignment operations
  getProjectAssignments: async (projectId?: number, userId?: number): Promise<(ProjectAssignment & { project?: Project, user?: User })[]> => {
    let conditions = [];
    
    if (projectId !== undefined) {
      conditions.push(eq(projectAssignments.projectId, projectId));
    }
    
    if (userId !== undefined) {
      conditions.push(eq(projectAssignments.userId, userId));
    }
    
    const result = conditions.length > 0 
      ? await db.query.projectAssignments.findMany({
          where: and(...conditions),
          with: {
            project: true,
            user: true
          }
        })
      : await db.query.projectAssignments.findMany({
          with: {
            project: true,
            user: true
          }
        });
        
    return result;
  },
  
  getProjectAssignmentById: async (id: number): Promise<(ProjectAssignment & { project?: Project, user?: User }) | undefined> => {
    return db.query.projectAssignments.findFirst({
      where: eq(projectAssignments.id, id),
      with: {
        project: true,
        user: true
      }
    });
  },
  
  createProjectAssignment: async (assignmentData: InsertProjectAssignment): Promise<ProjectAssignment> => {
    const [newAssignment] = await db.insert(projectAssignments)
      .values(assignmentData)
      .returning();
    return newAssignment;
  },
  
  updateProjectAssignment: async (id: number, assignmentData: Partial<InsertProjectAssignment>): Promise<ProjectAssignment | undefined> => {
    const [updatedAssignment] = await db.update(projectAssignments)
      .set(assignmentData)
      .where(eq(projectAssignments.id, id))
      .returning();
    return updatedAssignment;
  },
  
  deleteProjectAssignment: async (id: number): Promise<boolean> => {
    await db.delete(projectAssignments).where(eq(projectAssignments.id, id));
    return true;
  },
  
  // Task Update operations
  getTaskUpdates: async (taskId: number): Promise<(TaskUpdate & { user?: User })[]> => {
    return db.query.taskUpdates.findMany({
      where: eq(taskUpdates.taskId, taskId),
      with: {
        user: true
      },
      orderBy: desc(taskUpdates.createdAt)
    });
  },
  
  // Get task updates of a specific type (e.g., Mention)
  getTaskUpdatesWithType: async (taskId: number, updateType: string): Promise<(TaskUpdate & { user?: User })[]> => {
    return db.query.taskUpdates.findMany({
      where: and(
        eq(taskUpdates.taskId, taskId),
        eq(taskUpdates.updateType, updateType)
      ),
      with: {
        user: true
      },
      orderBy: desc(taskUpdates.createdAt)
    });
  },
  
  getTaskUpdateById: async (id: number): Promise<(TaskUpdate & { user?: User }) | undefined> => {
    return db.query.taskUpdates.findFirst({
      where: eq(taskUpdates.id, id),
      with: {
        user: true
      }
    });
  },
  
  createTaskUpdate: async (updateData: InsertTaskUpdate): Promise<TaskUpdate> => {
    const [newUpdate] = await db.insert(taskUpdates)
      .values(updateData)
      .returning();
    return newUpdate;
  },
  
  // Task Collaborator operations
  getTaskCollaborators: async (taskId: number): Promise<(TaskCollaborator & { user?: User, inviter?: User })[]> => {
    return db.query.taskCollaborators.findMany({
      where: eq(taskCollaborators.taskId, taskId),
      with: {
        user: true,
        inviter: true
      }
    });
  },
  
  getTaskCollaboratorById: async (id: number): Promise<(TaskCollaborator & { user?: User, inviter?: User }) | undefined> => {
    return db.query.taskCollaborators.findFirst({
      where: eq(taskCollaborators.id, id),
      with: {
        user: true,
        inviter: true
      }
    });
  },
  
  createTaskCollaborator: async (collaboratorData: InsertTaskCollaborator): Promise<TaskCollaborator> => {
    const [newCollaborator] = await db.insert(taskCollaborators)
      .values(collaboratorData)
      .returning();
    return newCollaborator;
  },
  
  updateTaskCollaborator: async (id: number, collaboratorData: Partial<InsertTaskCollaborator>): Promise<TaskCollaborator | undefined> => {
    // Update the updatedAt timestamp
    const dataWithTimestamp = {
      ...collaboratorData,
      updatedAt: new Date()
    };
    
    const [updatedCollaborator] = await db.update(taskCollaborators)
      .set(dataWithTimestamp)
      .where(eq(taskCollaborators.id, id))
      .returning();
    return updatedCollaborator;
  },
  
  deleteTaskCollaborator: async (id: number): Promise<boolean> => {
    await db.delete(taskCollaborators).where(eq(taskCollaborators.id, id));
    return true;
  },
  
  // Report operations
  getAllReports: async (): Promise<(Report & { creator?: User })[]> => {
    return db.query.reports.findMany({
      with: {
        creator: true
      },
      orderBy: desc(reports.createdAt)
    });
  },
  
  getReportById: async (id: number): Promise<(Report & { creator?: User }) | undefined> => {
    return db.query.reports.findFirst({
      where: eq(reports.id, id),
      with: {
        creator: true
      }
    });
  },
  
  createReport: async (reportData: InsertReport): Promise<Report> => {
    const [newReport] = await db.insert(reports)
      .values(reportData)
      .returning();
    return newReport;
  },
  
  updateReport: async (id: number, reportData: Partial<InsertReport>): Promise<Report | undefined> => {
    const [updatedReport] = await db.update(reports)
      .set(reportData)
      .where(eq(reports.id, id))
      .returning();
    return updatedReport;
  },
  
  deleteReport: async (id: number): Promise<boolean> => {
    await db.delete(reports).where(eq(reports.id, id));
    return true;
  },
  
  // Report generation methods
  generateTasksByProjectReport: async (parameters?: string): Promise<any> => {
    // Parse parameters if provided
    const params = parameters ? JSON.parse(parameters) : {};
    
    // Get all tasks with their projects
    const taskList = await db.query.tasks.findMany({
      with: {
        project: true
      }
    });
    
    // Group tasks by project
    const tasksByProject: Record<string, { projectName: string, tasks: any[] }> = {};
    
    taskList.forEach(task => {
      const projectId = task.projectId?.toString() || 'unassigned';
      const projectName = task.project?.name || 'Unassigned';
      
      if (!tasksByProject[projectId]) {
        tasksByProject[projectId] = {
          projectName,
          tasks: []
        };
      }
      
      tasksByProject[projectId].tasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate
      });
    });
    
    // Convert to array format
    const result = Object.keys(tasksByProject).map(projectId => ({
      projectId: projectId === 'unassigned' ? null : parseInt(projectId),
      ...tasksByProject[projectId]
    }));
    
    return {
      generatedAt: new Date(),
      type: 'tasks_by_project',
      data: result
    };
  },
  
  generateUserPerformanceReport: async (parameters?: string): Promise<any> => {
    // Parse parameters if provided
    const params = parameters ? JSON.parse(parameters) : {};
    
    // Get all tasks with their assignees
    const taskList = await db.query.tasks.findMany({
      with: {
        assignee: true
      }
    });
    
    // Group tasks by user
    const tasksByUser: Record<string, { 
      userName: string, 
      totalTasks: number, 
      completedTasks: number, 
      tasks: any[],
      completionRate: number
    }> = {};
    
    taskList.forEach(task => {
      const userId = task.assigneeId?.toString() || 'unassigned';
      const userName = task.assignee?.name || 'Unassigned';
      
      if (!tasksByUser[userId]) {
        tasksByUser[userId] = {
          userName,
          totalTasks: 0,
          completedTasks: 0,
          tasks: [],
          completionRate: 0
        };
      }
      
      tasksByUser[userId].totalTasks++;
      if (task.status === 'completed') {
        tasksByUser[userId].completedTasks++;
      }
      
      tasksByUser[userId].tasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      });
    });
    
    // Calculate completion rate and sort tasks by date
    Object.keys(tasksByUser).forEach(userId => {
      const user = tasksByUser[userId];
      user.completionRate = user.totalTasks ? (user.completedTasks / user.totalTasks) * 100 : 0;
      user.tasks.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    });
    
    // Convert to array format
    const result = Object.keys(tasksByUser).map(userId => ({
      userId: userId === 'unassigned' ? null : parseInt(userId),
      ...tasksByUser[userId]
    }));
    
    // Sort by completion rate (highest first)
    result.sort((a, b) => b.completionRate - a.completionRate);
    
    return {
      generatedAt: new Date(),
      type: 'user_performance',
      data: result
    };
  },
  
  generateTaskStatusSummaryReport: async (parameters?: string): Promise<any> => {
    // Parse parameters if provided
    const params = parameters ? JSON.parse(parameters) : {};
    
    // Get all tasks
    const taskList = await db.query.tasks.findMany({
      with: {
        project: true,
        category: true
      }
    });
    
    // Current date
    const now = new Date();
    
    // Group tasks by status
    const summary = {
      total: taskList.length,
      todo: taskList.filter(t => t.status === 'todo').length,
      in_progress: taskList.filter(t => t.status === 'in_progress').length,
      completed: taskList.filter(t => t.status === 'completed').length,
      overdue: taskList.filter(t => 
        t.status !== 'completed' && 
        t.dueDate && 
        new Date(t.dueDate) < now
      ).length,
      byPriority: {
        low: taskList.filter(t => t.priority === 'low').length,
        medium: taskList.filter(t => t.priority === 'medium').length,
        high: taskList.filter(t => t.priority === 'high').length
      },
      byCategory: {} as Record<string, number>,
      byProject: {} as Record<string, number>,
      recentlyCompleted: taskList
        .filter(t => t.status === 'completed')
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
        .slice(0, 5)
        .map(t => ({
          id: t.id,
          title: t.title,
          completedAt: t.updatedAt || t.createdAt,
          project: t.project?.name || 'Unassigned',
          category: t.category?.name || 'Uncategorized'
        }))
    };
    
    // Calculate by category
    taskList.forEach(task => {
      const categoryName = task.category?.name || 'Uncategorized';
      summary.byCategory[categoryName] = (summary.byCategory[categoryName] || 0) + 1;
      
      const projectName = task.project?.name || 'Unassigned';
      summary.byProject[projectName] = (summary.byProject[projectName] || 0) + 1;
    });
    
    return {
      generatedAt: new Date(),
      type: 'task_status_summary',
      data: summary
    };
  },

  // Notification operations
  getUserNotifications: async (userId: number, options?: { 
    limit?: number, 
    offset?: number,
    isRead?: boolean,
    type?: string
  }): Promise<(Notification & { user?: User })[]> => {
    let conditions = [eq(notifications.userId, userId)];
    
    // Add isRead filter if specified
    if (options?.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, options.isRead));
    }
    
    // Add type filter if specified
    if (options?.type) {
      conditions.push(eq(notifications.type, options.type));
    }
    
    return db.query.notifications.findMany({
      where: and(...conditions),
      with: {
        user: true
      },
      orderBy: [desc(notifications.createdAt)],
      limit: options?.limit,
      offset: options?.offset
    });
  },
  
  getNotificationById: async (id: number): Promise<(Notification & { user?: User }) | undefined> => {
    return db.query.notifications.findFirst({
      where: eq(notifications.id, id),
      with: {
        user: true
      }
    });
  },
  
  createNotification: async (notificationData: InsertNotification): Promise<Notification> => {
    const [newNotification] = await db.insert(notifications)
      .values(notificationData)
      .returning();
    return newNotification;
  },
  
  markNotificationAsRead: async (id: number): Promise<Notification | undefined> => {
    const [updatedNotification] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  },
  
  markAllNotificationsAsRead: async (userId: number): Promise<number> => {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return result.rowCount || 0;
  },
  
  deleteNotification: async (id: number): Promise<boolean> => {
    await db.delete(notifications).where(eq(notifications.id, id));
    return true;
  },
  
  deleteAllNotifications: async (userId: number): Promise<number> => {
    const result = await db.delete(notifications)
      .where(eq(notifications.userId, userId));
    return result.rowCount || 0;
  },
  
  getUnreadNotificationCount: async (userId: number): Promise<number> => {
    const result = await db.select({ count: sql`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return Number(result[0].count) || 0;
  },

  // App Settings operations
  getAllAppSettings: async (): Promise<AppSetting[]> => {
    return db.query.appSettings.findMany();
  },

  getAppSettingByKey: async (key: string): Promise<AppSetting | undefined> => {
    return db.query.appSettings.findFirst({
      where: eq(appSettings.key, key)
    });
  },

  getAppSettingById: async (id: number): Promise<AppSetting | undefined> => {
    return db.query.appSettings.findFirst({
      where: eq(appSettings.id, id)
    });
  },

  createAppSetting: async (settingData: InsertAppSetting): Promise<AppSetting> => {
    const [newSetting] = await db.insert(appSettings)
      .values(settingData)
      .returning();
    return newSetting;
  },

  updateAppSetting: async (id: number, settingData: Partial<InsertAppSetting>): Promise<AppSetting | undefined> => {
    const [updatedSetting] = await db.update(appSettings)
      .set({
        ...settingData,
        updatedAt: new Date()
      })
      .where(eq(appSettings.id, id))
      .returning();
    return updatedSetting;
  },

  updateAppSettingByKey: async (key: string, value: string): Promise<AppSetting | undefined> => {
    // Find the setting first
    const setting = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, key)
    });

    if (setting) {
      // Update existing setting
      const [updatedSetting] = await db.update(appSettings)
        .set({
          value,
          updatedAt: new Date()
        })
        .where(eq(appSettings.id, setting.id))
        .returning();
      return updatedSetting;
    } else {
      // Create new setting
      const [newSetting] = await db.insert(appSettings)
        .values({
          key,
          value,
          description: `Auto-created setting for ${key}`
        })
        .returning();
      return newSetting;
    }
  },

  deleteAppSetting: async (id: number): Promise<boolean> => {
    await db.delete(appSettings).where(eq(appSettings.id, id));
    return true;
  }
};
