import { db } from "../db";
import * as schema from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdmin() {
  try {
    console.log("Creating admin user...");

    // Check if admin user already exists
    const existingAdmin = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, "admin")
    });
    
    if (existingAdmin) {
      console.log("Admin user already exists, skipping creation");
      return;
    }

    // Create admin user with hashed password
    const hashedPassword = await hashPassword("admin123");
    
    const admin = {
      username: "admin",
      password: hashedPassword,
      name: "Administrator",
      avatar: null
    };

    const insertedAdmin = await db.insert(schema.users).values(admin).returning();
    console.log(`Admin user created successfully with ID: ${insertedAdmin[0].id}`);
    console.log("Username: admin");
    console.log("Password: admin123");
    
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    process.exit(0);
  }
}

createAdmin();