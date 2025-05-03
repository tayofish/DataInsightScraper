import { db } from "./index";
import * as schema from "@shared/schema";

async function seed() {
  try {
    console.log("Seeding database...");

    // Check if there are already users
    const existingUsers = await db.query.users.findMany();
    
    // Only seed if there are no users yet
    if (existingUsers.length === 0) {
      console.log("Seeding users...");
      // Create users
      const users = [
        {
          username: "tom.cook",
          password: "password123", // In a real app, this would be hashed
          name: "Tom Cook",
          avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
        },
        {
          username: "sarah.johnson",
          password: "password123",
          name: "Sarah Johnson",
          avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
        },
        {
          username: "michael.rodriguez",
          password: "password123",
          name: "Michael Rodriguez",
          avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
        },
      ];

      const insertedUsers = await db.insert(schema.users).values(users).returning();
      console.log(`Inserted ${insertedUsers.length} users`);

      // Check if there are already projects
      const existingProjects = await db.query.projects.findMany();
      if (existingProjects.length === 0) {
        console.log("Seeding projects...");
        // Create projects
        const projects = [
          {
            name: "Web Scraping",
            description: "Projects related to scraping data from websites",
          },
          {
            name: "Analytics",
            description: "Data analysis and visualization projects",
          },
          {
            name: "SQL Queries",
            description: "SQL query templates and database analysis",
          },
        ];

        const insertedProjects = await db.insert(schema.projects).values(projects).returning();
        console.log(`Inserted ${insertedProjects.length} projects`);

        // Check if there are already tasks
        const existingTasks = await db.query.tasks.findMany();
        if (existingTasks.length === 0) {
          console.log("Seeding tasks...");
          
          const now = new Date();
          // Calculate due dates
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          const nextWeek = new Date(now);
          nextWeek.setDate(nextWeek.getDate() + 7);
          
          const pastDue = new Date(now);
          pastDue.setDate(pastDue.getDate() - 2);
          
          // Create tasks
          const tasks = [
            {
              title: "Create web scraper for competitor analysis",
              description: "Build a scraper to extract product data from competitor websites",
              dueDate: tomorrow,
              priority: "high",
              status: "todo",
              projectId: insertedProjects[0].id,
              assigneeId: insertedUsers[0].id,
            },
            {
              title: "Analyze social media sentiment for Product X",
              description: "Collect and analyze social media posts about our latest product",
              dueDate: nextWeek,
              priority: "medium",
              status: "todo",
              projectId: insertedProjects[1].id,
              assigneeId: insertedUsers[1].id,
            },
            {
              title: "Create SQL query templates for monthly reports",
              description: "Develop reusable SQL templates for generating monthly sales reports",
              dueDate: nextWeek,
              priority: "low",
              status: "todo",
              projectId: insertedProjects[2].id,
              assigneeId: null,
            },
            {
              title: "Set up data extraction from Instagram",
              description: "Configure APIs to extract engagement metrics from Instagram",
              dueDate: pastDue,
              priority: "medium",
              status: "completed",
              projectId: insertedProjects[0].id,
              assigneeId: insertedUsers[0].id,
            },
          ];

          const insertedTasks = await db.insert(schema.tasks).values(tasks).returning();
          console.log(`Inserted ${insertedTasks.length} tasks`);
        }
      }
    } else {
      console.log("Database already has data, skipping seed");
    }
    
    console.log("Seeding complete!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
