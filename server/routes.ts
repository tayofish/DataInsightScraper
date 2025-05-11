import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "@db";
import { 
  taskInsertSchema, taskUpdateSchema, projectInsertSchema, categoryInsertSchema, departmentInsertSchema,
  projectAssignmentInsertSchema, taskUpdateInsertSchema, taskCollaboratorInsertSchema, reportInsertSchema,
  smtpConfigFormSchema, smtpConfig, tasks, departments, categories, projects, InsertTask, 
  InsertCategory, InsertDepartment, InsertProject, projectAssignments, InsertProjectAssignment,
  users, appSettings
} from "@shared/schema";
import { z } from "zod";
import { setupAuth } from "./auth";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import * as emailService from "./services/email-service";
import nodemailer from "nodemailer";
import { eq, and, or, desc, asc, sql, isNull, isNotNull } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes and middleware
  setupAuth(app);
  
  // Backup and restore endpoints
  app.get("/api/backup/database", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    try {
      // Get all tables data
      const users = await storage.getAllUsers();
      const projects = await storage.getAllProjects();
      const departments = await storage.getAllDepartments();
      const categories = await storage.getAllCategories();
      const tasks = await storage.getAllTasks();
      const projectAssignments = await storage.getProjectAssignments();
      const taskUpdates = await storage.getAllTaskUpdates();
      const taskCollaborators = await storage.getAllTaskCollaborators();
      const reports = await storage.getAllReports();
      const notifications = await storage.getAllNotifications();
      const smtpConfigs = await db.select().from(smtpConfig);
      const appSettings = await storage.getAllAppSettings();
      
      // Create backup object
      const backup = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          type: "database"
        },
        data: {
          users,
          projects,
          departments,
          categories,
          tasks,
          projectAssignments,
          taskUpdates,
          taskCollaborators,
          reports,
          notifications,
          smtpConfigs,
          appSettings
        }
      };
      
      // Set response headers for download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=database_backup_${new Date().toISOString().replace(/:/g, '-')}.json`);
      
      return res.json(backup);
    } catch (error) {
      console.error("Error creating database backup:", error);
      return res.status(500).json({ error: "Failed to create database backup" });
    }
  });
  
  app.get("/api/backup/settings", async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }
    
    try {
      // Get only settings-related tables
      const smtpConfigs = await db.select().from(smtpConfig);
      const appSettings = await storage.getAllAppSettings();
      
      // Create backup object
      const backup = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          type: "settings"
        },
        data: {
          smtpConfigs,
          appSettings
        }
      };
      
      // Set response headers for download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=settings_backup_${new Date().toISOString().replace(/:/g, '-')}.json`);
      
      return res.json(backup);
    } catch (error) {
      console.error("Error creating settings backup:", error);
      return res.status(500).json({ error: "Failed to create settings backup" });
    }
  });
  
  // Configure multer for JSON file uploads
  const jsonUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      // Only accept JSON files
      if (file.mimetype !== 'application/json') {
        return cb(new Error('Only JSON files are allowed'));
      }
      cb(null, true);
    },
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });
  
  app.post("/api/restore/database", jsonUpload.single('file'), async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No backup file provided" });
      }
      
      // Parse the JSON file
      const backupData = JSON.parse(req.file.buffer.toString());
      
      // Validate backup structure
      if (!backupData.metadata || backupData.metadata.type !== 'database' || !backupData.data) {
        return res.status(400).json({ error: "Invalid backup file format" });
      }
      
      // This is potentially destructive, so we'll log what we're doing
      console.log("Restoring database from backup...");
      
      try {
        // Restore users
        if (backupData.data.users && backupData.data.users.length > 0) {
          // In a real application, we would use transactions here
          console.log(`Restoring ${backupData.data.users.length} users...`);
          
          // For safety, we won't delete existing users, just add new ones
          for (const user of backupData.data.users) {
            const existingUser = await storage.getUserByUsername(user.username);
            if (!existingUser) {
              // Create new user without password (for security)
              await storage.createUser({
                username: user.username,
                password: user.password, // Assuming this is already hashed
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                isAdmin: user.isAdmin,
                departmentId: user.departmentId
              });
            }
          }
        }
        
        // Restore departments
        if (backupData.data.departments && backupData.data.departments.length > 0) {
          console.log(`Restoring ${backupData.data.departments.length} departments...`);
          for (const department of backupData.data.departments) {
            // Skip if department name doesn't exist in the data
            if (!department.name) continue;
            
            // Check if department already exists by name
            const existingDepartments = await db.select().from(departments).where(eq(departments.name, department.name));
            
            if (existingDepartments.length === 0) {
              await storage.createDepartment({
                name: department.name,
                description: department.description
              });
            }
          }
        }
        
        // Restore categories
        if (backupData.data.categories && backupData.data.categories.length > 0) {
          console.log(`Restoring ${backupData.data.categories.length} categories...`);
          for (const category of backupData.data.categories) {
            // Skip if category name doesn't exist in the data
            if (!category.name) continue;
            
            // Check if category already exists by name
            const existingCategories = await db.select().from(categories).where(eq(categories.name, category.name));
            
            if (existingCategories.length === 0) {
              // Create with the fields that are actually in our schema
              const categoryData: InsertCategory = {
                name: category.name,
                departmentId: category.departmentId
              };
              // Add color if it exists
              if (category.color) {
                categoryData.color = category.color;
              }
              await storage.createCategory(categoryData);
            }
          }
        }
        
        // Restore projects
        if (backupData.data.projects && backupData.data.projects.length > 0) {
          console.log(`Restoring ${backupData.data.projects.length} projects...`);
          for (const project of backupData.data.projects) {
            // Skip if project name doesn't exist in the data
            if (!project.name) continue;
            
            // Check if project already exists by name
            const existingProjects = await db.select().from(projects).where(eq(projects.name, project.name));
            
            if (existingProjects.length === 0) {
              // Create a project with the fields in our schema
              const projectData: InsertProject = {
                name: project.name,
                description: project.description
              };
              await storage.createProject(projectData);
            }
          }
        }
        
        // Restore tasks
        if (backupData.data.tasks && backupData.data.tasks.length > 0) {
          console.log(`Restoring ${backupData.data.tasks.length} tasks...`);
          for (const task of backupData.data.tasks) {
            // For tasks we'll just create new ones since they might have updated statuses
            // Create task data with properly formatted dates
            const taskData: InsertTask = {
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              // Convert string dates to Date objects
              dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
              startDate: task.startDate ? new Date(task.startDate) : undefined,
              assigneeId: task.assigneeId,
              projectId: task.projectId,
              categoryId: task.categoryId,
              departmentId: task.departmentId
              // Remove creatorId as it's not in our schema
            };
            await storage.createTask(taskData);
          }
        }
        
        return res.status(200).json({ message: "Database restored successfully" });
      } catch (error) {
        console.error("Error restoring database:", error);
        return res.status(500).json({ error: "Failed to restore database" });
      }
    } catch (error) {
      console.error("Error parsing backup data:", error);
      return res.status(500).json({ error: "Failed to parse backup data" });
    }
  });
  
  app.post("/api/restore/settings", jsonUpload.single('file'), async (req, res) => {
    if (!req.isAuthenticated() || !req.user?.isAdmin) {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No backup file provided" });
      }
      
      // Parse the JSON file
      const backupData = JSON.parse(req.file.buffer.toString());
      
      // Validate backup structure
      if (!backupData.metadata || backupData.metadata.type !== 'settings' || !backupData.data) {
        return res.status(400).json({ error: "Invalid settings backup file format" });
      }
      
      // Restore SMTP settings
      if (backupData.data.smtpConfigs && backupData.data.smtpConfigs.length > 0) {
        await db.delete(smtpConfig);
        
        // Process and fix date fields before insertion
        const processedConfigs = backupData.data.smtpConfigs.map(config => {
          const processed = { ...config };
          
          // Convert string timestamps to Date objects
          if (processed.created_at && typeof processed.created_at === 'string') {
            processed.created_at = new Date(processed.created_at);
          }
          
          if (processed.updated_at && typeof processed.updated_at === 'string') {
            processed.updated_at = new Date(processed.updated_at);
          }
          
          return processed;
        });
        
        await db.insert(smtpConfig).values(processedConfigs);
      }
      
      // Restore app settings
      if (backupData.data.appSettings && backupData.data.appSettings.length > 0) {
        for (const setting of backupData.data.appSettings) {
          try {
            // Process dates if they exist
            const settingData = { ...setting };
            
            // Convert string timestamps to Date objects if they exist
            if (settingData.created_at && typeof settingData.created_at === 'string') {
              settingData.created_at = new Date(settingData.created_at);
            }
            
            if (settingData.updated_at && typeof settingData.updated_at === 'string') {
              settingData.updated_at = new Date(settingData.updated_at);
            }
            
            // Check if setting already exists
            const existingSetting = await storage.getAppSettingByKey(setting.key);
            if (existingSetting) {
              await storage.updateAppSetting(setting.id, { value: setting.value });
            } else {
              await storage.createAppSetting({ key: setting.key, value: setting.value });
            }
          } catch (error) {
            console.error(`Error restoring app setting ${setting.key}:`, error);
            // Continue with other settings even if one fails
          }
        }
      }
      
      return res.status(200).json({ message: "Settings restored successfully" });
    } catch (error) {
      console.error("Error restoring settings:", error);
      return res.status(500).json({ error: "Failed to restore settings" });
    }
  });
  
  // Set up file upload directory
  const uploadDir = path.join(process.cwd(), 'uploads');
  const logoDir = path.join(uploadDir, 'logos');
  
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    if (!fs.existsSync(logoDir)) {
      fs.mkdirSync(logoDir, { recursive: true });
    }
  } catch (error) {
    console.error('Error creating upload directories:', error);
  }
  
  // Serve uploaded files statically with simplified approach
  app.use('/uploads', express.static(uploadDir));
  
  // Configure multer storage
  const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Create a unique filename with original extension
      const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });
  
  // Configure multer storage for logos
  const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, logoDir);
    },
    filename: (req, file, cb) => {
      // Use a fixed filename for the logo to easily replace it
      const uniqueName = `logo${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });
  
  // Configure multer upload with 10MB file size limit
  const upload = multer({ 
    storage: multerStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB in bytes
    }
  });
  
  // Configure multer upload for logos with 10MB file size limit
  const uploadLogo = multer({
    storage: logoStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB in bytes
    },
    fileFilter: (req, file, cb) => {
      // Only allow image files
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and SVG files are allowed.'), false);
      }
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
      
      // Send email notification to the new user with their credentials
      try {
        await emailService.notifyUserCreation(newUser, password, req.user);
      } catch (emailError) {
        console.error('Failed to send new user notification email:', emailError);
        // Continue execution - email failure shouldn't break user creation
      }
      
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
      
      const { username, password, name, avatar, email, isAdmin } = req.body;
      let userData: any = {};
      
      // Only include fields that were provided
      if (username !== undefined) userData.username = username;
      if (name !== undefined) userData.name = name;
      if (avatar !== undefined) userData.avatar = avatar;
      if (email !== undefined) userData.email = email;
      if (isAdmin !== undefined) userData.isAdmin = isAdmin;
      
      // If password was provided and not empty, hash it
      if (password && password.trim() !== '') {
        const { hashPassword } = await import('./auth');
        userData.password = await hashPassword(password);
        
        // Send password reset notification email
        try {
          const user = await storage.getUserById(id);
          if (user) {
            await emailService.notifyPasswordReset(user, password);
          }
        } catch (emailError) {
          console.error('Failed to send password reset notification email:', emailError);
          // Continue execution - email failure shouldn't break password update
        }
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

  // Get project assignments
  app.get("/api/projects/:id/assignments", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      const assignments = await storage.getProjectAssignments(projectId);
      return res.status(200).json(assignments);
    } catch (error) {
      console.error("Error fetching project assignments:", error);
      return res.status(500).json({ message: "Failed to fetch project assignments" });
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
      const customFilter = req.query.customFilter as string | undefined;
      
      // Special handling for overdue filter
      const now = new Date();
      let statusFilter: string | undefined = req.query.status as string | undefined;
      
      // Handle comma-separated status values (e.g., 'todo,in_progress')
      if (statusFilter && statusFilter.includes(',')) {
        statusFilter = statusFilter.split(',').join('|'); // Convert to pipe-separated for OR in SQL
      }
      
      const filters = {
        status: statusFilter,
        priority: req.query.priority as string | undefined,
        projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
        assigneeId: req.query.assigneeId ? parseInt(req.query.assigneeId as string) : undefined,
        categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
        department: req.query.department as string | undefined,
        departmentId: req.query.departmentId as string | undefined,
        search: req.query.search as string | undefined,
        isOverdue: customFilter === 'overdue' ? true : undefined,
        // If we have a custom filter for 'all', we clear other filters to show all tasks
        ...(customFilter === 'all' ? {
          status: undefined,
          priority: undefined,
          projectId: undefined,
          assigneeId: undefined,
          categoryId: undefined,
          department: undefined
        } : {})
      };

      // If user is not authenticated, return 401
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get the authenticated user
      const user = req.user as Express.User;
      
      let tasks;
      
      // Admin users can access all tasks
      if (user.isAdmin) {
        tasks = await storage.getAllTasks(filters);
      } else {
        // Regular users can only see tasks that match ANY of these conditions:
        // 1. Tasks in the user's department OR
        // 2. Tasks from projects they're assigned to OR
        // 3. Tasks directly assigned to them
        
        // Get user's department and project assignments
        const userDepartmentId = user.departmentId;
        const userProjectAssignments = await storage.getProjectAssignments(undefined, user.id);
        const userProjectIds = userProjectAssignments.map(assignment => assignment.projectId);
        
        // Get restricted tasks using our access control logic
        const restrictedTasks = await storage.getAllTasksForUser(
          user.id,
          userDepartmentId || null,
          userProjectIds,
          filters
        );
        
        tasks = restrictedTasks;
      }
      
      return res.status(200).json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get task statistics for dashboard
  app.get("/api/tasks/statistics", async (req, res) => {
    try {
      // If user is not authenticated, return 401
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get the authenticated user
      const user = req.user as Express.User;
      
      let statistics;
      
      // Admin users can see global statistics
      if (user.isAdmin) {
        statistics = await storage.getTaskStatistics();
      } else {
        // Regular users see only their own statistics
        const userDepartmentId = user.departmentId;
        const userProjectAssignments = await storage.getProjectAssignments(undefined, user.id);
        const userProjectIds = userProjectAssignments.map(assignment => assignment.projectId);
        
        statistics = await storage.getUserTaskStatistics(
          user.id,
          userDepartmentId || null,
          userProjectIds
        );
      }
      
      return res.status(200).json(statistics);
    } catch (error) {
      console.error("Error fetching task statistics:", error);
      return res.status(500).json({ message: "Failed to fetch task statistics" });
    }
  });

  // Get task by ID
  app.get("/api/tasks/:id", async (req, res) => {
    try {
      // If user is not authenticated, return 401
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      const task = await storage.getTaskById(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Get the authenticated user
      const user = req.user as Express.User;
      
      // Admin users can access any task
      if (user.isAdmin) {
        return res.status(200).json(task);
      }
      
      // For regular users, check if they have access to this task
      const userDepartmentId = user.departmentId;
      const userProjectAssignments = await storage.getProjectAssignments(undefined, user.id);
      const userProjectIds = userProjectAssignments.map(assignment => assignment.projectId);
      
      // User can access a task if ANY of these conditions are true:
      // 1. Task is in their department, OR
      // 2. Task is from a project they're assigned to, OR
      // 3. Task is assigned to them
      const hasAccess = 
        (userDepartmentId && task.departmentId === userDepartmentId) || 
        (task.projectId && userProjectIds.includes(task.projectId)) ||
        (task.assigneeId === user.id);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this task" });
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
      
      // Send email notifications for task creation
      if (req.isAuthenticated()) {
        try {
          // Get assignee if task is assigned
          let assignee = null;
          if (taskData.assigneeId) {
            assignee = await storage.getUserById(taskData.assigneeId);
          }
          
          // Get project team members if this task is associated with a project
          let projectTeam: any[] = [];
          if (taskData.projectId) {
            const projectAssignments = await storage.getProjectAssignments(taskData.projectId);
            if (projectAssignments && projectAssignments.length > 0) {
              projectTeam = projectAssignments
                .filter(a => a.user)
                .map(a => a.user);
            }
          }
          
          // Get creator (current user)
          const creator = req.user;
          
          // Send email notification
          await emailService.notifyTaskCreation(newTask, creator, assignee, projectTeam);
          
          // Process mentions in the task description
          if (taskData.description) {
            const mentions = extractMentions(taskData.description);
            if (mentions.length > 0) {
              for (const username of mentions) {
                // Record mention update
                await storage.createTaskUpdate({
                  taskId: newTask.id,
                  userId: req.user.id,
                  updateType: 'Mention',
                  previousValue: '',
                  newValue: username,
                  comment: `@${username} was mentioned in the task description`
                });
                
                // Send email notification to mentioned user
                const mentionedUser = await storage.getUserByUsername(username);
                if (mentionedUser) {
                  await emailService.notifyMention(
                    newTask, 
                    mentionedUser, 
                    creator, 
                    taskData.description || ''
                  );
                }
              }
            }
          }
        } catch (emailError) {
          console.error('Failed to send task creation email notifications:', emailError);
          // Continue execution - email failure shouldn't break task creation
        }
      }
      
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
            console.log(`Found ${mentions.length} mentions in task description for task ${id}: [${mentions.join(', ')}]`);
            
            // Process mentions (e.g. notify mentioned users)
            for (const username of mentions) {
              try {
                const mentionedUser = await storage.getUserByUsername(username);
                
                // Skip self-mentions
                if (mentionedUser && mentionedUser.id !== userId) {
                  console.log(`Processing description mention for user ${mentionedUser.username} (${mentionedUser.id})`);
                  
                  try {
                    // Record mention update
                    const mentionUpdate = await storage.createTaskUpdate({
                      taskId: id,
                      userId: userId,
                      updateType: 'Mention',
                      previousValue: "",
                      newValue: username,
                      comment: `@${username} mentioned in task description`
                    });
                    
                    console.log(`Created mention update record: ${mentionUpdate.id}`);
                    
                    // Send mention notification
                    try {
                      await emailService.notifyMention(
                        updatedTask, 
                        mentionedUser, 
                        req.user, 
                        taskData.description || ''
                      );
                      console.log(`Successfully sent mention notification to ${mentionedUser.username} for task description mention`);
                    } catch (mentionError) {
                      console.error(`Error sending mention notification to ${mentionedUser.username} for task description:`, mentionError);
                    }
                  } catch (updateError) {
                    console.error(`Error creating mention update for ${username} in task description:`, updateError);
                  }
                } else if (mentionedUser) {
                  console.log(`Skipping self-mention for user ${username} in task description`);
                } else {
                  console.log(`Could not find user with username ${username} for task description mention notification`);
                }
              } catch (userLookupError) {
                console.error(`Error looking up mentioned user ${username} for task description:`, userLookupError);
              }
            }
          }
        }
        
        // Check for assignee change and send notification if needed
        if ('assigneeId' in taskData && taskData.assigneeId !== currentTask.assigneeId) {
          // Only send notification if there's a new assignee (not unassigning)
          if (taskData.assigneeId) {
            try {
              const assignee = await storage.getUserById(taskData.assigneeId);
              if (assignee) {
                await emailService.notifyTaskAssignment(updatedTask, assignee, req.user);
              }
            } catch (emailError) {
              console.error('Failed to send task assignment notification:', emailError);
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
      
      // Send email notification for project assignment
      if (req.isAuthenticated()) {
        try {
          // Get project info
          const project = await storage.getProjectById(assignmentData.projectId);
          
          // Get user info
          const user = await storage.getUserById(assignmentData.userId);
          
          // Get the authenticated user who created the assignment
          const assignedBy = req.user;
          
          if (project && user) {
            // Send notification
            await emailService.notifyProjectAssignment(
              project,
              user,
              assignedBy,
              assignmentData.role
            );
          }
        } catch (emailError) {
          console.error('Failed to send project assignment notification:', emailError);
          // Continue execution - email failure shouldn't break assignment creation
        }
      }
      
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
        
        // Process email notifications for comments
        try {
          // Get task details including assignee
          const taskWithDetails = await storage.getTaskById(taskId);
          
          // Get user who made the comment
          const commentUser = req.user;
          
          // Check for mentions in the comment
          const mentions = extractMentions(commentData.comment);
          
          // Collect users to notify (task assignee, mentioned users, task collaborators)
          const usersToNotify: any[] = [];
          
          // Add task assignee if exists and is not the commenter
          if (taskWithDetails?.assigneeId && taskWithDetails.assigneeId !== commentUser.id) {
            const assignee = await storage.getUserById(taskWithDetails.assigneeId);
            if (assignee) {
              usersToNotify.push(assignee);
            }
          }
          
          // Add mentioned users
          if (mentions.length > 0) {
            console.log(`Found ${mentions.length} mentions in comment for task ${taskId}: [${mentions.join(', ')}]`);
            
            for (const username of mentions) {
              try {
                const mentionedUser = await storage.getUserByUsername(username);
                
                // Skip self-mentions
                if (mentionedUser && mentionedUser.id !== commentUser.id) {
                  console.log(`Processing mention for user ${mentionedUser.username} (${mentionedUser.id})`);
                  
                  try {
                    // Record mention update
                    const mentionUpdate = await storage.createTaskUpdate({
                      taskId,
                      userId: commentUser.id,
                      updateType: 'Mention',
                      previousValue: '',
                      newValue: username,
                      comment: `@${username} was mentioned in a comment`
                    });
                    
                    console.log(`Created mention update record: ${mentionUpdate.id}`);
                    
                    // Add to notification list if not already included
                    if (!usersToNotify.some(u => u.id === mentionedUser.id)) {
                      usersToNotify.push(mentionedUser);
                      
                      // Send mention notification immediately
                      try {
                        await emailService.notifyMention(
                          taskWithDetails, 
                          mentionedUser, 
                          commentUser, 
                          commentData.comment
                        );
                        console.log(`Successfully sent mention notification to ${mentionedUser.username}`);
                      } catch (mentionError) {
                        console.error(`Error sending mention notification to ${mentionedUser.username}:`, mentionError);
                        // Continue processing other mentions even if this one failed
                      }
                    } else {
                      console.log(`User ${mentionedUser.username} already in notification list, skipping duplicate mention notification`);
                    }
                  } catch (updateError) {
                    console.error(`Error creating mention update for ${username}:`, updateError);
                  }
                } else if (mentionedUser) {
                  console.log(`Skipping self-mention for user ${username}`);
                } else {
                  console.log(`Could not find user with username ${username} for mention notification`);
                }
              } catch (userLookupError) {
                console.error(`Error looking up mentioned user ${username}:`, userLookupError);
              }
            }
          }
          
          // Add task collaborators
          const collaborators = await storage.getTaskCollaborators(taskId);
          if (collaborators && collaborators.length > 0) {
            for (const collaborator of collaborators) {
              if (collaborator.user && collaborator.user.id !== commentUser.id) {
                // Add to notification list if not already included
                if (!usersToNotify.some(u => u.id === collaborator.user.id)) {
                  usersToNotify.push(collaborator.user);
                }
              }
            }
          }
          
          // Send comment notification to all collected users
          if (usersToNotify.length > 0 && taskWithDetails) {
            await emailService.notifyTaskComment(
              taskWithDetails,
              commentData.comment,
              commentUser,
              usersToNotify
            );
          }
        } catch (emailError) {
          console.error('Failed to send comment email notifications:', emailError);
          // Continue execution - email failure shouldn't break comment creation
        }
        
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
      
      // Send email notification for collaboration invitation
      try {
        // Get user who is being invited
        const invitedUser = await storage.getUserById(userId);
        
        if (invitedUser) {
          // Send notification
          await emailService.notifyTaskCollaboration(
            task,
            invitedUser,
            req.user,
            collaboratorData.role
          );
        }
      } catch (emailError) {
        console.error('Failed to send task collaboration invitation notification:', emailError);
        // Continue execution - email failure shouldn't break collaboration creation
      }
      
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

  // === FILE UPLOAD ROUTES ===
  
  // Get all files for a task
  app.get("/api/tasks/:taskId/files", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }

      // Check if task exists
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Get files for this task (or return empty array if none)
      const files = taskFiles[taskId.toString()] || [];
      return res.status(200).json(files);
    } catch (error) {
      console.error("Error fetching task files:", error);
      return res.status(500).json({ message: "Failed to fetch task files" });
    }
  });

  // Upload a file for a task
  app.post("/api/tasks/:taskId/files", upload.single('file'), async (req, res) => {
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

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Create file record
      const fileInfo = {
        id: Date.now(), // Use timestamp as ID
        name: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        uploadedAt: new Date().toISOString()
      };

      // Add file to task files
      if (!taskFiles[taskId.toString()]) {
        taskFiles[taskId.toString()] = [];
      }
      taskFiles[taskId.toString()].push(fileInfo);

      // Record file upload in task updates
      await storage.createTaskUpdate({
        taskId: taskId,
        userId: req.user.id,
        updateType: 'File Upload',
        previousValue: null,
        newValue: req.file.originalname,
        comment: `File uploaded: ${req.file.originalname} (${formatFileSize(req.file.size)})`
      });

      return res.status(201).json(fileInfo);
    } catch (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File too large. Maximum file size is 10MB." });
        }
        return res.status(400).json({ message: `File upload error: ${error.message}` });
      }
      
      console.error("Error uploading file:", error);
      return res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Get a specific file
  app.get("/api/tasks/:taskId/files/:fileId", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const fileId = parseInt(req.params.fileId);
      
      if (isNaN(taskId) || isNaN(fileId)) {
        return res.status(400).json({ message: "Invalid task ID or file ID" });
      }

      // Check if task exists
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Find the file
      const taskFileList = taskFiles[taskId.toString()] || [];
      const file = taskFileList.find(f => f.id === fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Send the file
      const filePath = path.join(uploadDir, file.filename);
      return res.download(filePath, file.name);
    } catch (error) {
      console.error("Error downloading file:", error);
      return res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Delete a specific file
  app.delete("/api/tasks/:taskId/files/:fileId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const taskId = parseInt(req.params.taskId);
      const fileId = parseInt(req.params.fileId);
      
      if (isNaN(taskId) || isNaN(fileId)) {
        return res.status(400).json({ message: "Invalid task ID or file ID" });
      }

      // Check if task exists
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Find the file
      const taskFileList = taskFiles[taskId.toString()] || [];
      const fileIndex = taskFileList.findIndex(f => f.id === fileId);
      
      if (fileIndex === -1) {
        return res.status(404).json({ message: "File not found" });
      }

      const file = taskFileList[fileIndex];

      // Delete file from disk
      const filePath = path.join(uploadDir, file.filename);
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error("Failed to delete file from disk:", err);
        // Continue even if physical file deletion fails
      }

      // Remove file from task files
      taskFiles[taskId.toString()].splice(fileIndex, 1);

      // Record file deletion in task updates
      await storage.createTaskUpdate({
        taskId: taskId,
        userId: req.user.id,
        updateType: 'File Deleted',
        previousValue: file.name,
        newValue: null,
        comment: `File deleted: ${file.name}`
      });

      return res.status(200).json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      return res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Helper function to format file size
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // === REPORTS ROUTES ===
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
        return res.status(401).json({ message: "You must be logged in to create a report" });
      }

      const reportData = reportInsertSchema.parse({
        ...req.body,
        createdBy: req.user.id
      });
      
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

  // Generate report
  app.post("/api/reports/:id/generate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }

      const report = await storage.getReportById(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Update the last run timestamp
      await storage.updateReport(id, { lastRunAt: new Date() });

      // Generate the report data based on type
      let reportData;
      switch (report.type) {
        case 'tasks_by_project':
          reportData = await storage.generateTasksByProjectReport(report.parameters);
          break;
        case 'user_performance':
          reportData = await storage.generateUserPerformanceReport(report.parameters);
          break;
        case 'task_status_summary':
          reportData = await storage.generateTaskStatusSummaryReport(report.parameters);
          break;
        default:
          return res.status(400).json({ message: "Unsupported report type" });
      }

      return res.status(200).json(reportData);
    } catch (error) {
      console.error("Error generating report:", error);
      return res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Update report
  app.patch("/api/reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }

      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "You must be logged in to update a report" });
      }

      const report = await storage.getReportById(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Ensure only the creator can update the report
      if (report.createdBy !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to update this report" });
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid report ID" });
      }

      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "You must be logged in to delete a report" });
      }

      const report = await storage.getReportById(id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Ensure only the creator can delete the report
      if (report.createdBy !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to delete this report" });
      }

      await storage.deleteReport(id);
      return res.status(200).json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting report:", error);
      return res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // === NOTIFICATION ROUTES ===
  // Get notifications for the logged-in user
  app.get("/api/notifications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const isRead = req.query.isRead ? req.query.isRead === 'true' : undefined;
      const type = req.query.type as string | undefined;

      const notifications = await storage.getUserNotifications(req.user.id, {
        limit,
        offset,
        isRead,
        type
      });

      return res.status(200).json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count for the logged-in user
  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const count = await storage.getUnreadNotificationCount(req.user.id);
      return res.status(200).json({ count });
    } catch (error) {
      console.error("Error fetching unread notification count:", error);
      return res.status(500).json({ message: "Failed to fetch unread notification count" });
    }
  });

  // Mark a notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      // Check if notification exists and belongs to the user
      const notification = await storage.getNotificationById(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      if (notification.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to update this notification" });
      }

      const updatedNotification = await storage.markNotificationAsRead(id);
      return res.status(200).json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read for the logged-in user
  app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const count = await storage.markAllNotificationsAsRead(req.user.id);
      return res.status(200).json({ count, message: `Marked ${count} notifications as read` });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Delete a notification
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      // Check if notification exists and belongs to the user
      const notification = await storage.getNotificationById(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      if (notification.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this notification" });
      }

      await storage.deleteNotification(id);
      return res.status(200).json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      return res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Delete all notifications for the logged-in user
  app.delete("/api/notifications", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const count = await storage.deleteAllNotifications(req.user.id);
      return res.status(200).json({ count, message: `Deleted ${count} notifications` });
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      return res.status(500).json({ message: "Failed to delete all notifications" });
    }
  });

  // === SMTP CONFIGURATION ROUTES ===
  // Initialize email service
  await emailService.initializeEmailService();
  
  // Get SMTP configuration
  app.get("/api/smtp-config", isAdmin, async (req, res) => {
    try {
      // First try to get the active configuration
      const activeResult = await db.select().from(smtpConfig).where(eq(smtpConfig.active, true));
      
      if (activeResult.length > 0) {
        return res.status(200).json(activeResult[0]);
      }
      
      // If no active configuration, get the most recent one
      const allConfigs = await db.select().from(smtpConfig).orderBy(desc(smtpConfig.createdAt)).limit(1);
      
      if (allConfigs.length > 0) {
        return res.status(200).json(allConfigs[0]);
      }
      
      // If no configurations at all
      return res.status(404).json({ message: "No SMTP configuration found" });
    } catch (error) {
      console.error("Error fetching SMTP configuration:", error);
      return res.status(500).json({ message: "Failed to fetch SMTP configuration" });
    }
  });
  
  // Create SMTP configuration
  app.post("/api/smtp-config", isAdmin, async (req, res) => {
    try {
      const configData = smtpConfigFormSchema.parse(req.body);
      
      console.log('Creating SMTP config:', {
        host: configData.host,
        port: configData.port,
        username: configData.username,
        fromEmail: configData.fromEmail,
        fromName: configData.fromName,
        enableTls: configData.enableTls,
        active: configData.active
      });
      
      // If setting this config as active, deactivate all others
      if (configData.active) {
        await db.update(smtpConfig).set({ active: false });
      }
      
      // Insert the new configuration
      const result = await db.insert(smtpConfig).values({
        host: configData.host,
        port: configData.port,
        username: configData.username,
        password: configData.password,
        fromEmail: configData.fromEmail,
        fromName: configData.fromName || 'Promellon Notifications',
        enableTls: configData.enableTls,
        active: configData.active,
      }).returning();
      
      // Reinitialize email service if this config is active
      if (configData.active) {
        try {
          const success = await emailService.initializeEmailService();
          console.log('Email service initialization result:', success);
        } catch (initError) {
          console.error('Failed to initialize email service:', initError);
          // Continue execution - email service initialization failure shouldn't break config creation
        }
      }
      
      return res.status(201).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid SMTP configuration data", errors: error.errors });
      }
      console.error("Error creating SMTP configuration:", error);
      return res.status(500).json({ 
        message: "Failed to create SMTP configuration", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Update SMTP configuration
  app.put("/api/smtp-config/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid configuration ID" });
      }
      
      const configData = smtpConfigFormSchema.parse(req.body);
      
      console.log('Updating SMTP config:', {
        id,
        host: configData.host,
        port: configData.port,
        username: configData.username,
        fromEmail: configData.fromEmail,
        fromName: configData.fromName,
        enableTls: configData.enableTls,
        active: configData.active
      });
      
      // If setting this config as active, deactivate all others
      if (configData.active) {
        await db.update(smtpConfig).set({ active: false });
      }
      
      // Get the existing configuration to handle masked password
      const existingConfig = await db.select().from(smtpConfig).where(eq(smtpConfig.id, id));
      
      if (existingConfig.length === 0) {
        return res.status(404).json({ message: "SMTP configuration not found" });
      }
      
      // Don't update password if it looks like a masked password (e.g., "••••••••")
      const passwordToUse = configData.password.includes('•') ? 
        existingConfig[0].password : configData.password;
      
      // Update the configuration
      const result = await db.update(smtpConfig)
        .set({
          host: configData.host,
          port: configData.port,
          username: configData.username,
          password: passwordToUse,
          fromEmail: configData.fromEmail,
          fromName: configData.fromName || 'Promellon Notifications',
          enableTls: configData.enableTls,
          active: configData.active,
          updatedAt: new Date(),
        })
        .where(eq(smtpConfig.id, id))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ message: "SMTP configuration not found" });
      }
      
      // Reinitialize email service if this config is active
      if (configData.active) {
        try {
          const success = await emailService.initializeEmailService();
          console.log('Email service initialization result:', success);
        } catch (initError) {
          console.error('Failed to initialize email service:', initError);
          // Continue execution - email service initialization failure shouldn't break config update
        }
      }
      
      return res.status(200).json(result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid SMTP configuration data", errors: error.errors });
      }
      console.error("Error updating SMTP configuration:", error);
      return res.status(500).json({ 
        message: "Failed to update SMTP configuration", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Delete SMTP configuration
  app.delete("/api/smtp-config/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid configuration ID" });
      }
      
      // Check if it exists
      const configExists = await db.select().from(smtpConfig).where(eq(smtpConfig.id, id));
      if (configExists.length === 0) {
        return res.status(404).json({ message: "SMTP configuration not found" });
      }
      
      // Delete the configuration
      await db.delete(smtpConfig).where(eq(smtpConfig.id, id));
      
      // Reinitialize email service to use a different active config if available
      await emailService.initializeEmailService();
      
      return res.status(200).json({ message: "SMTP configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting SMTP configuration:", error);
      return res.status(500).json({ message: "Failed to delete SMTP configuration" });
    }
  });
  
  // Test SMTP configuration
  app.post("/api/smtp-config/test", isAdmin, async (req, res) => {
    try {
      const configData = smtpConfigFormSchema.parse(req.body);
      
      // Create a temporary transporter for testing
      const transporter = nodemailer.createTransport({
        host: configData.host,
        port: configData.port,
        secure: configData.port === 465, // Only use secure for port 465
        auth: {
          user: configData.username,
          pass: configData.password,
        },
        tls: {
          // Do not fail on invalid certs
          rejectUnauthorized: false
        }
      });
      
      console.log('Testing SMTP connection with settings:', {
        host: configData.host,
        port: configData.port,
        secure: configData.port === 465,
        user: configData.username,
        fromEmail: configData.fromEmail,
      });
      
      try {
        // Verify connection
        await transporter.verify();
        console.log('SMTP connection verified successfully');
        
        // Send a test email to the admin user if email exists
        if (req.user && req.user.email) {
          try {
            await transporter.sendMail({
              from: `"${configData.fromName}" <${configData.fromEmail}>`,
              to: req.user.email,
              subject: "TaskScout SMTP Test",
              text: "This is a test email from TaskScout to verify your SMTP configuration.",
              html: "<h1>TaskScout SMTP Test</h1><p>This is a test email from TaskScout to verify your SMTP configuration.</p>",
            });
            
            console.log(`Test email sent successfully to ${req.user.email}`);
            return res.status(200).json({ message: "Test email sent successfully" });
          } catch (emailError) {
            console.error("Failed to send test email:", emailError);
            return res.status(500).json({ 
              message: `SMTP connection OK, but failed to send email: ${emailError.message}`,
              error: emailError instanceof Error ? emailError.message : String(emailError)
            });
          }
        } else {
          // If no email is available, just return success for the connection test
          return res.status(200).json({ message: "SMTP connection verified successfully, but no email address available to send test email" });
        }
      } catch (verifyError) {
        console.error("SMTP connection verification failed:", verifyError);
        return res.status(500).json({ 
          message: `SMTP connection failed: ${verifyError.message}`,
          error: verifyError instanceof Error ? verifyError.message : String(verifyError)
        });
      }
    } catch (error) {
      console.error("Error testing SMTP configuration:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid SMTP configuration data", errors: error.errors });
      }
      return res.status(500).json({ 
        message: "Failed to test SMTP configuration", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // App Settings API
  // Get all app settings
  app.get("/api/app-settings", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const settings = await storage.getAllAppSettings();
      return res.status(200).json(settings);
    } catch (error) {
      console.error("Error fetching app settings:", error);
      return res.status(500).json({ message: "Failed to fetch app settings" });
    }
  });

  // Get app setting by key
  app.get("/api/app-settings/:key", async (req, res) => {
    try {
      const key = req.params.key;
      const setting = await storage.getAppSettingByKey(key);
      
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      return res.status(200).json(setting);
    } catch (error) {
      console.error(`Error fetching app setting with key ${req.params.key}:`, error);
      return res.status(500).json({ message: "Failed to fetch app setting" });
    }
  });

  // Create or update app setting
  app.post("/api/app-settings", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: "Admin privileges required" });
      }

      const { key, value, description } = req.body;
      
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ message: "Key is required and must be a string" });
      }
      
      const setting = await storage.getAppSettingByKey(key);
      
      let result;
      if (setting) {
        // Update existing setting
        result = await storage.updateAppSetting(setting.id, {
          value,
          description,
          updatedAt: new Date()
        });
      } else {
        // Create new setting
        result = await storage.createAppSetting({
          key,
          value,
          description
        });
      }
      
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error creating/updating app setting:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid setting data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create/update app setting" });
    }
  });

  // Delete app setting
  app.delete("/api/app-settings/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: "Admin privileges required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid setting ID" });
      }

      const setting = await storage.getAppSettingById(id);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }

      await storage.deleteAppSetting(id);
      return res.status(200).json({ message: "Setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting app setting:", error);
      return res.status(500).json({ message: "Failed to delete app setting" });
    }
  });
  
  // Get all authentication settings - public endpoint
  app.get("/api/app-settings/auth/all", async (req, res) => {
    try {
      // This endpoint needs to be accessible without authentication
      // so the login page can show the appropriate options
      const settings = {
        localAuth: true,
        microsoftAuth: true,
        userRegistration: false
      };
      
      try {
        const localAuthSetting = await storage.getAppSettingByKey("local_auth");
        if (localAuthSetting) {
          settings.localAuth = localAuthSetting.value === "true";
        }
      } catch (error) {
        console.error("Error fetching local_auth setting:", error);
      }
      
      try {
        const microsoftAuthSetting = await storage.getAppSettingByKey("microsoft_auth");
        if (microsoftAuthSetting) {
          settings.microsoftAuth = microsoftAuthSetting.value === "true";
        }
      } catch (error) {
        console.error("Error fetching microsoft_auth setting:", error);
      }
      
      try {
        const userRegSetting = await storage.getAppSettingByKey("allow_registration");
        if (userRegSetting) {
          settings.userRegistration = userRegSetting.value === "true";
        }
      } catch (error) {
        console.error("Error fetching allow_registration setting:", error);
      }
      
      return res.status(200).json(settings);
    } catch (error) {
      console.error("Error getting authentication settings:", error);
      return res.status(500).json({ message: "Failed to get authentication settings" });
    }
  });
  
  // Upload logo
  app.post("/api/app-settings/logo", upload.single('logo'), async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: "Admin privileges required" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const logoPath = `/uploads/${req.file.filename}`;
      
      // Save logo path to app settings
      const result = await storage.updateAppSettingByKey('logo', logoPath);
      
      return res.status(200).json({ 
        message: "Logo uploaded successfully",
        path: logoPath,
        setting: result
      });
    } catch (error) {
      console.error("Error uploading logo:", error);
      return res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  const httpServer = createServer(app);

  // === APP SETTINGS ROUTES ===
  // Get logo
  app.get("/api/app-settings/logo", async (req, res) => {
    try {
      // Get the logo setting from the database
      const logoSetting = await storage.getAppSettingByKey("logo");
      
      if (!logoSetting) {
        return res.status(404).json({ message: "Logo not found" });
      }
      
      return res.status(200).json(logoSetting);
    } catch (error) {
      console.error("Error fetching logo:", error);
      return res.status(500).json({ message: "Failed to fetch logo" });
    }
  });
  
  // Upload logo (admin only)
  app.post("/api/app-settings/logo", isAdmin, uploadLogo.single("logo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No logo file uploaded" });
      }
      
      // Generate a URL to the logo file
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const logoUrl = `${baseUrl}/uploads/logos/${req.file.filename}`;
      
      // Save or update the logo setting in the database
      const existingSetting = await storage.getAppSettingByKey("logo");
      
      let logoSetting;
      if (existingSetting) {
        // Update existing setting
        logoSetting = await storage.updateAppSetting(existingSetting.id, {
          value: logoUrl,
          updatedAt: new Date()
        });
      } else {
        // Create new setting
        logoSetting = await storage.createAppSetting({
          key: "logo",
          value: logoUrl,
          description: "Company logo used throughout the application"
        });
      }
      
      return res.status(200).json(logoSetting);
    } catch (error) {
      console.error("Error uploading logo:", error);
      return res.status(500).json({ message: "Failed to upload logo" });
    }
  });

  return httpServer;
}
