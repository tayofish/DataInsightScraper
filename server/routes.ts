import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  taskInsertSchema, taskUpdateSchema, projectInsertSchema, categoryInsertSchema, departmentInsertSchema,
  projectAssignmentInsertSchema, taskUpdateInsertSchema, taskCollaboratorInsertSchema, reportInsertSchema
} from "@shared/schema";
import { z } from "zod";
import { setupAuth } from "./auth";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes and middleware
  setupAuth(app);
  
  // Set up file upload directory
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Configure multer storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Create a unique filename with original extension
      const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });
  
  // Configure multer upload with 10MB file size limit
  const upload = multer({ 
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB in bytes
    }
  });
  
  // Create a storage model for task files
  // We'll need to track files in the database
  // This is a simple in-memory storage for the demo
  // In a real application, you would use a database table
  const taskFiles: {
    [taskId: string]: {
      id: number;
      name: string;
      filename: string;
      size: number;
      uploadedAt: string;
    }[]
  } = {};
  
  // Application API routes
  // prefix all routes with /api

  // === USER ROUTES ===
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      return res.status(200).json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Get user by ID
  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // Update user profile
  app.patch("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if the authenticated user is updating their own profile
      if (!req.isAuthenticated() || req.user?.id !== id) {
        return res.status(403).json({ message: "Not authorized to update this user" });
      }
      
      // Only allow updating name, username, and avatar - not password
      const userData = {
        name: req.body.name,
        username: req.body.username,
        avatar: req.body.avatar
      };
      
      const updatedUser = await storage.updateUser(id, userData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  // Change password
  app.post("/api/users/:id/change-password", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if the authenticated user is changing their own password
      if (!req.isAuthenticated() || req.user?.id !== id) {
        return res.status(403).json({ message: "Not authorized to change this user's password" });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Get the user with their current password hash
      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Import the password comparison function from auth.ts
      const { comparePasswords, hashPassword } = await import('./auth');
      
      // Verify current password
      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the password
      const updatedUser = await storage.updateUser(id, { password: hashedPassword });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      return res.status(500).json({ message: "Failed to change password" });
    }
  });
  
  // === ADMIN ROUTES ===
  // Admin middleware to check if user is an admin
  const isAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // For now, we're considering user with ID 4 (admin) as the admin user
    // In a production system, you'd have a proper role system
    if (req.user.id !== 4) {
      return res.status(403).json({ message: "Admin privileges required" });
    }
    
    next();
  };
  
  // Admin: Get all users (with sensitive info)
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      return res.status(200).json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Admin: Create user
  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const { username, password, name, avatar, isAdmin } = req.body;
      
      // Validate required fields
      if (!username || !password || !name) {
        return res.status(400).json({ message: "Username, password, and name are required" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash the password
      const { hashPassword } = await import('./auth');
      const hashedPassword = await hashPassword(password);
      
      // Create the user
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        avatar: avatar || null
      });
      
      return res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  // Admin: Update user
  app.patch("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const { username, password, name, avatar, isAdmin } = req.body;
      let userData: any = {};
      
      // Only include fields that were provided
      if (username !== undefined) userData.username = username;
      if (name !== undefined) userData.name = name;
      if (avatar !== undefined) userData.avatar = avatar;
      
      // If password was provided, hash it
      if (password) {
        const { hashPassword } = await import('./auth');
        userData.password = await hashPassword(password);
      }
      
      // Update the user
      const updatedUser = await storage.updateUser(id, userData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      return res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  // Admin: Delete user
  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Don't allow deleting the admin user
      if (id === 4) {
        return res.status(400).json({ message: "Cannot delete the admin user" });
      }
      
      // Check if user exists
      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete the user
      await storage.deleteUser(id);
      
      return res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // === PROJECT ROUTES ===
  // Get all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      return res.status(200).json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      return res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Get project by ID
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const project = await storage.getProjectById(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      return res.status(200).json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      return res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Create project
  app.post("/api/projects", async (req, res) => {
    try {
      const projectData = projectInsertSchema.parse(req.body);
      const newProject = await storage.createProject(projectData);
      return res.status(201).json(newProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error creating project:", error);
      return res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Update project
  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const projectData = projectInsertSchema.partial().parse(req.body);
      const updatedProject = await storage.updateProject(id, projectData);
      
      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      return res.status(200).json(updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error updating project:", error);
      return res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      await storage.deleteProject(id);
      return res.status(200).json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Error deleting project:", error);
      return res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // === CATEGORY ROUTES ===
  // Get all categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      return res.status(200).json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      return res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Create category
  app.post("/api/categories", async (req, res) => {
    try {
      const categoryData = categoryInsertSchema.parse(req.body);
      const newCategory = await storage.createCategory(categoryData);
      return res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error creating category:", error);
      return res.status(500).json({ message: "Failed to create category" });
    }
  });
  
  // Update category
  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const categoryData = categoryInsertSchema.partial().parse(req.body);
      const updatedCategory = await storage.updateCategory(id, categoryData);
      
      if (!updatedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      return res.status(200).json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error updating category:", error);
      return res.status(500).json({ message: "Failed to update category" });
    }
  });
  
  // Delete category
  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      await storage.deleteCategory(id);
      return res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      return res.status(500).json({ message: "Failed to delete category" });
    }
  });
  
  // === DEPARTMENT ROUTES ===
  // Get all departments
  app.get("/api/departments", async (req, res) => {
    try {
      const departments = await storage.getAllDepartments();
      return res.status(200).json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      return res.status(500).json({ message: "Failed to fetch departments" });
    }
  });
  
  // Get department by ID
  app.get("/api/departments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }

      const department = await storage.getDepartmentById(id);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }

      return res.status(200).json(department);
    } catch (error) {
      console.error("Error fetching department:", error);
      return res.status(500).json({ message: "Failed to fetch department" });
    }
  });
  
  // Create department
  app.post("/api/departments", async (req, res) => {
    try {
      const departmentData = departmentInsertSchema.parse(req.body);
      const newDepartment = await storage.createDepartment(departmentData);
      return res.status(201).json(newDepartment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid department data", errors: error.errors });
      }
      console.error("Error creating department:", error);
      return res.status(500).json({ message: "Failed to create department" });
    }
  });
  
  // Update department
  app.patch("/api/departments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }

      const departmentData = departmentInsertSchema.partial().parse(req.body);
      const updatedDepartment = await storage.updateDepartment(id, departmentData);
      
      if (!updatedDepartment) {
        return res.status(404).json({ message: "Department not found" });
      }

      return res.status(200).json(updatedDepartment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid department data", errors: error.errors });
      }
      console.error("Error updating department:", error);
      return res.status(500).json({ message: "Failed to update department" });
    }
  });
  
  // Delete department
  app.delete("/api/departments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid department ID" });
      }

      await storage.deleteDepartment(id);
      return res.status(200).json({ message: "Department deleted successfully" });
    } catch (error) {
      console.error("Error deleting department:", error);
      return res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // === TASK ROUTES ===
  // Get all tasks with optional filters
  app.get("/api/tasks", async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        priority: req.query.priority as string | undefined,
        projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
        assigneeId: req.query.assigneeId ? parseInt(req.query.assigneeId as string) : undefined,
        categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
        department: req.query.department as string | undefined,
        search: req.query.search as string | undefined
      };

      const tasks = await storage.getAllTasks(filters);
      return res.status(200).json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get task statistics for dashboard
  app.get("/api/tasks/statistics", async (req, res) => {
    try {
      const statistics = await storage.getTaskStatistics();
      return res.status(200).json(statistics);
    } catch (error) {
      console.error("Error fetching task statistics:", error);
      return res.status(500).json({ message: "Failed to fetch task statistics" });
    }
  });

  // Get task by ID
  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const task = await storage.getTaskById(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      return res.status(200).json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      return res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Create task
  app.post("/api/tasks", async (req, res) => {
    try {
      // Process request data to handle nulls consistently
      const requestData = {
        ...req.body,
        // Convert empty strings to null
        description: req.body.description === '' ? null : req.body.description,
        // dueDate is now handled by the schema's preprocessing
      };
      
      // Proper validation with date preprocessing is done in the schema
      const taskData = taskInsertSchema.parse(requestData);
      const newTask = await storage.createTask(taskData);
      return res.status(201).json(newTask);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Invalid task data", errors: error.errors });
      }
      console.error("Error creating task:", error);
      return res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Update task
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      // Get current task data to track changes
      const currentTask = await storage.getTaskById(id);
      if (!currentTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Process request data to handle nulls consistently
      const requestData = {
        ...req.body,
        // Convert empty strings to null
        description: req.body.description === '' ? null : req.body.description,
        // dueDate is handled by schema preprocessing
      };
      
      const taskData = taskUpdateSchema.omit({ id: true }).partial().parse(requestData);
      const updatedTask = await storage.updateTask(id, taskData);
      
      if (!updatedTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Only log updates if user is authenticated
      if (req.isAuthenticated()) {
        const userId = req.user.id;
        
        // Log changes for tracked fields using type-safe approach
        // Import the UpdateTask type from the schema
        type TrackedFieldType = 'status' | 'priority' | 'assigneeId' | 'title' | 'description' | 'dueDate' | 'categoryId';
        interface TrackedField {
          field: TrackedFieldType;
          label: string;
        }
        
        const trackedFields: TrackedField[] = [
          { field: 'status', label: 'Status' },
          { field: 'priority', label: 'Priority' },
          { field: 'assigneeId', label: 'Assignee' },
          { field: 'title', label: 'Title' },
          { field: 'description', label: 'Description' },
          { field: 'dueDate', label: 'Due Date' },
          { field: 'categoryId', label: 'Category' }
        ];

        for (const { field, label } of trackedFields) {
          // Type-safe check if the field exists and has changed
          if (field in taskData && taskData[field] !== currentTask[field as keyof typeof currentTask]) {
            const previousValue = currentTask[field as keyof typeof currentTask];
            const newValue = taskData[field];
            
            // Create task update record
            await storage.createTaskUpdate({
              taskId: id,
              userId: userId,
              updateType: `${label} Changed`,
              previousValue: previousValue !== null ? String(previousValue) : "",
              newValue: newValue !== null && newValue !== undefined ? String(newValue) : "",
              comment: `${label} updated`
            });
          }
        }

        // Handle mentions in description or comments
        if (taskData.description && taskData.description !== currentTask.description) {
          const mentions = extractMentions(taskData.description);
          if (mentions.length > 0) {
            // Process mentions (e.g. notify mentioned users)
            for (const username of mentions) {
              // Record mention update
              await storage.createTaskUpdate({
                taskId: id,
                userId: userId,
                updateType: 'Mention',
                previousValue: "",
                newValue: username,
                comment: `@${username} mentioned in task description`
              });
            }
          }
        }
      }

      return res.status(200).json(updatedTask);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid task data", errors: error.errors });
      }
      console.error("Error updating task:", error);
      return res.status(500).json({ message: "Failed to update task" });
    }
  });
  
  // Helper function to extract @mentions from text
  function extractMentions(text: string): string[] {
    if (!text) return [];
    const mentionPattern = /@([a-zA-Z0-9_]+)/g;
    const matches = text.match(mentionPattern) || [];
    return matches.map(mention => mention.substring(1)); // Remove the @ symbol
  }

  // Delete task
  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      await storage.deleteTask(id);
      return res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      return res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // === PROJECT ASSIGNMENT ROUTES ===
  // Get project assignments (can filter by projectId or userId)
  app.get("/api/project-assignments", async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      
      const assignments = await storage.getProjectAssignments(projectId, userId);
      return res.status(200).json(assignments);
    } catch (error) {
      console.error("Error fetching project assignments:", error);
      return res.status(500).json({ message: "Failed to fetch project assignments" });
    }
  });

  // Create project assignment
  app.post("/api/project-assignments", async (req, res) => {
    try {
      const assignmentData = projectAssignmentInsertSchema.parse(req.body);
      
      // Check if the assignment already exists
      const existingAssignments = await storage.getProjectAssignments(assignmentData.projectId, assignmentData.userId);
      if (existingAssignments.length > 0) {
        return res.status(400).json({ message: "User is already assigned to this project" });
      }
      
      const newAssignment = await storage.createProjectAssignment(assignmentData);
      return res.status(201).json(newAssignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assignment data", errors: error.errors });
      }
      console.error("Error creating project assignment:", error);
      return res.status(500).json({ message: "Failed to create project assignment" });
    }
  });

  // Delete project assignment
  app.delete("/api/project-assignments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid assignment ID" });
      }

      await storage.deleteProjectAssignment(id);
      return res.status(200).json({ message: "Project assignment removed successfully" });
    } catch (error) {
      console.error("Error removing project assignment:", error);
      return res.status(500).json({ message: "Failed to remove project assignment" });
    }
  });

  // === TASK UPDATE ROUTES ===
  // Get task updates for a specific task
  app.get("/api/tasks/:taskId/updates", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const updates = await storage.getTaskUpdates(taskId);
      return res.status(200).json(updates);
    } catch (error) {
      console.error("Error fetching task updates:", error);
      return res.status(500).json({ message: "Failed to fetch task updates" });
    }
  });
  
  // Get mentions from task updates for a specific task
  app.get("/api/tasks/:taskId/mentions", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }
      
      // Only get updates with type 'Mention'
      const updates = await storage.getTaskUpdatesWithType(taskId, 'Mention');
      return res.status(200).json(updates);
    } catch (error) {
      console.error("Error fetching task mentions:", error);
      return res.status(500).json({ message: "Failed to fetch task mentions" });
    }
  });

  // Create task update
  app.post("/api/tasks/:taskId/updates", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      // Check if task exists
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // For comments, create a simplified update object
      if (req.body.updateType === 'Comment') {
        const commentData = {
          taskId,
          userId: req.user.id,
          updateType: 'Comment',
          previousValue: '',
          newValue: '',
          comment: req.body.comment
        };
        
        const parsedData = taskUpdateInsertSchema.parse(commentData);
        const newUpdate = await storage.createTaskUpdate(parsedData);
        return res.status(201).json(newUpdate);
      } else {
        // For other update types
        const updateData = {
          ...taskUpdateInsertSchema.parse(req.body),
          taskId,
          userId: req.user.id
        };

        const newUpdate = await storage.createTaskUpdate(updateData);
        return res.status(201).json(newUpdate);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      console.error("Error creating task update:", error);
      return res.status(500).json({ message: "Failed to create task update" });
    }
  });

  // === TASK COLLABORATOR ROUTES ===
  // Get collaborators for a task
  app.get("/api/tasks/:taskId/collaborators", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const collaborators = await storage.getTaskCollaborators(taskId);
      return res.status(200).json(collaborators);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      return res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });

  // Invite collaborator to a task
  app.post("/api/tasks/:taskId/collaborators", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      // Check if task exists
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Check if user can invite collaborators (assignee or creator)
      if (task.assigneeId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to invite collaborators to this task" });
      }

      const { userId, role } = req.body;
      
      // Validate required fields
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Check if collaborator already exists
      const existingCollaborators = await storage.getTaskCollaborators(taskId);
      if (existingCollaborators.some(c => c.userId === userId)) {
        return res.status(400).json({ message: "User is already a collaborator on this task" });
      }

      const collaboratorData = {
        ...taskCollaboratorInsertSchema.parse({
          taskId,
          userId,
          role: role || "viewer"
        }),
        invitedBy: req.user.id
      };

      const newCollaborator = await storage.createTaskCollaborator(collaboratorData);
      return res.status(201).json(newCollaborator);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid collaborator data", errors: error.errors });
      }
      console.error("Error creating collaborator:", error);
      return res.status(500).json({ message: "Failed to create collaborator" });
    }
  });

  // Update collaborator status (accept/decline)
  app.patch("/api/task-collaborators/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid collaborator ID" });
      }

      // Check if invitation exists
      const collaborator = await storage.getTaskCollaboratorById(id);
      if (!collaborator) {
        return res.status(404).json({ message: "Collaboration invitation not found" });
      }

      // Check if user can update this invitation (must be the invitee)
      if (collaborator.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this invitation" });
      }

      const { status } = req.body;
      if (!status || !["accepted", "declined"].includes(status)) {
        return res.status(400).json({ message: "Valid status (accepted/declined) is required" });
      }

      const updatedCollaborator = await storage.updateTaskCollaborator(id, { status });
      return res.status(200).json(updatedCollaborator);
    } catch (error) {
      console.error("Error updating collaborator:", error);
      return res.status(500).json({ message: "Failed to update collaborator" });
    }
  });

  // Remove collaborator
  app.delete("/api/task-collaborators/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid collaborator ID" });
      }

      // Check if collaborator exists
      const collaborator = await storage.getTaskCollaboratorById(id);
      if (!collaborator) {
        return res.status(404).json({ message: "Collaborator not found" });
      }

      // Check if user can remove this collaborator (must be either the task assignee, the inviter, or the collaborator themselves)
      const task = await storage.getTaskById(collaborator.taskId);
      if (collaborator.userId !== req.user.id && 
          collaborator.invitedBy !== req.user.id && 
          task?.assigneeId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to remove this collaborator" });
      }

      await storage.deleteTaskCollaborator(id);
      return res.status(200).json({ message: "Collaborator removed successfully" });
    } catch (error) {
      console.error("Error removing collaborator:", error);
      return res.status(500).json({ message: "Failed to remove collaborator" });
    }
  });

  // === REPORT ROUTES ===
  // Get all reports
  app.get("/api/reports", async (req, res) => {
    try {
      const reports = await storage.getAllReports();
      return res.status(200).json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      return res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Get report by ID
  app.get("/api/reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }

      const report = await storage.getReportById(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      return res.status(200).json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      return res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // Create report
  app.post("/api/reports", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const reportData = {
        ...reportInsertSchema.parse(req.body),
        createdBy: req.user.id
      };

      const newReport = await storage.createReport(reportData);
      return res.status(201).json(newReport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid report data", errors: error.errors });
      }
      console.error("Error creating report:", error);
      return res.status(500).json({ message: "Failed to create report" });
    }
  });

  // Update report
  app.patch("/api/reports/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }

      // Check if report exists
      const report = await storage.getReportById(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Check if user can update this report (must be the creator)
      if (report.createdBy !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this report" });
      }

      const reportData = reportInsertSchema.partial().parse(req.body);
      const updatedReport = await storage.updateReport(id, reportData);
      
      if (!updatedReport) {
        return res.status(404).json({ message: "Report not found" });
      }

      return res.status(200).json(updatedReport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid report data", errors: error.errors });
      }
      console.error("Error updating report:", error);
      return res.status(500).json({ message: "Failed to update report" });
    }
  });

  // Delete report
  app.delete("/api/reports/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }

      // Check if report exists
      const report = await storage.getReportById(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Check if user can delete this report (must be the creator)
      if (report.createdBy !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this report" });
      }

      await storage.deleteReport(id);
      return res.status(200).json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting report:", error);
      return res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Generate report results
  app.post("/api/reports/:id/generate", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }

      // Check if report exists
      const report = await storage.getReportById(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Generate report results based on report type
      let results;
      // Convert null parameters to undefined for type safety
      const safeParameters = report.parameters || undefined;
      
      switch (report.type) {
        case "tasks_by_project":
          results = await storage.generateTasksByProjectReport(safeParameters);
          break;
        case "user_performance":
          results = await storage.generateUserPerformanceReport(safeParameters);
          break;
        case "task_status_summary":
          results = await storage.generateTaskStatusSummaryReport(safeParameters);
          break;
        default:
          return res.status(400).json({ message: "Unsupported report type" });
      }

      // Update the last run timestamp
      await storage.updateReport(id, { lastRunAt: new Date() });

      return res.status(200).json(results);
    } catch (error) {
      console.error("Error generating report:", error);
      return res.status(500).json({ message: "Failed to generate report" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
