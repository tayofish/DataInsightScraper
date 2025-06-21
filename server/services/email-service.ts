import * as nodemailer from 'nodemailer';
import { db } from '@db';
import { users, tasks, notifications, directMessages, messages, channels, channelMembers, smtpConfig, appSettings, departments, userDepartments } from '@shared/schema';
import { eq, and, gte, lte, or, count, desc, ilike, sql } from 'drizzle-orm';

// Email transporter
let transporter: nodemailer.Transporter | null = null;

// Initialize email service with existing SMTP configuration
export async function initializeEmailService(): Promise<boolean> {
  try {
    // Get active SMTP configuration
    const activeConfig = await db.query.smtpConfig.findFirst({
      where: eq(smtpConfig.active, true)
    });

    if (!activeConfig) {
      console.log('No active SMTP configuration found');
      return false;
    }

    // Create transporter with existing configuration
    const transportConfig: any = {
      host: activeConfig.host,
      port: activeConfig.port,
      secure: activeConfig.port === 465,
      auth: {
        user: activeConfig.username,
        pass: activeConfig.password,
      },
    };

    if (activeConfig.enableTls) {
      transportConfig.tls = {
        rejectUnauthorized: false
      };
    }

    transporter = nodemailer.createTransport(transportConfig);

    // Verify connection
    await transporter.verify();
    console.log('Email service initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    transporter = null;
    return false;
  }
}

// Initialize on module load
initializeEmailService();

interface EmailData {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

// Send email using existing transporter (internal function)
async function sendEmailInternal(emailData: EmailData): Promise<boolean> {
  if (!transporter) {
    console.log('Email service not configured - no active SMTP configuration');
    return false;
  }

  try {
    await transporter.sendMail(emailData);
    console.log(`Email sent successfully to ${emailData.to}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Get from email from SMTP configuration
async function getFromEmail(): Promise<string> {
  try {
    const activeConfig = await db.query.smtpConfig.findFirst({
      where: eq(smtpConfig.active, true)
    });
    return activeConfig?.fromEmail || 'noreply@promellon.com';
  } catch (error) {
    console.error('Error getting from email:', error);
    return 'noreply@promellon.com';
  }
}

// Existing notification functions (preserved from your working system)
export async function notifyTaskAssignment(task: any, assignee: any, assignedBy: any): Promise<void> {
  const fromEmail = await getFromEmail();
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Task Assigned to You</h2>
      <p>Hi ${assignee.name || assignee.username},</p>
      <p>You have been assigned a new task by ${assignedBy.name || assignedBy.username}:</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0066cc;">${task.title}</h3>
        ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
        ${task.priority ? `<p><strong>Priority:</strong> ${task.priority}</p>` : ''}
        ${task.dueDate ? `<p><strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>` : ''}
      </div>
      
      <p>You can view and manage this task in your dashboard.</p>
      <hr style="margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">This notification was sent from Promellon Task Management System.</p>
    </div>
  `;

  await sendEmail({
    to: assignee.email,
    from: fromEmail,
    subject: `Task Assigned: ${task.title}`,
    html,
    text: `You have been assigned a new task: ${task.title}`
  });
}

export async function notifyTaskCreation(task: any, creator: any, assignee: any, projectTeam: any[]): Promise<void> {
  const fromEmail = await getFromEmail();
  
  // Notify assignee if different from creator
  if (assignee && assignee.id !== creator.id && assignee.email) {
    await notifyTaskAssignment(task, assignee, creator);
  }
  
  // Notify project team members
  for (const member of projectTeam) {
    if (member.id !== creator.id && member.id !== assignee?.id && member.email) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">New Task Created</h2>
          <p>Hi ${member.name || member.username},</p>
          <p>A new task has been created in your project by ${creator.name || creator.username}:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0066cc;">${task.title}</h3>
            ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
            ${assignee ? `<p><strong>Assigned to:</strong> ${assignee.name || assignee.username}</p>` : ''}
            ${task.priority ? `<p><strong>Priority:</strong> ${task.priority}</p>` : ''}
          </div>
          
          <p>You can view this task in your project dashboard.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This notification was sent from Promellon Task Management System.</p>
        </div>
      `;

      await sendEmail({
        to: member.email,
        from: fromEmail,
        subject: `New Task Created: ${task.title}`,
        html,
        text: `A new task has been created: ${task.title}`
      });
    }
  }
}

export async function notifyMention(task: any, mentionedUser: any, mentionedBy: any, content: string): Promise<void> {
  const fromEmail = await getFromEmail();
  
  if (!mentionedUser.email) return;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">You were mentioned in a task</h2>
      <p>Hi ${mentionedUser.name || mentionedUser.username},</p>
      <p>You were mentioned by ${mentionedBy.name || mentionedBy.username} in task:</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0066cc;">${task.title}</h3>
        <p><strong>Content:</strong></p>
        <div style="background-color: #fff; padding: 10px; border-left: 3px solid #0066cc; margin: 10px 0;">
          ${content}
        </div>
      </div>
      
      <p>You can view this task to see the full context.</p>
      <hr style="margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">This notification was sent from Promellon Task Management System.</p>
    </div>
  `;

  await sendEmail({
    to: mentionedUser.email,
    from: fromEmail,
    subject: `You were mentioned in: ${task.title}`,
    html,
    text: `You were mentioned in task: ${task.title}`
  });
}

// NEW: End-of-day notification functionality
interface UserTaskSummary {
  overdueTasks: any[];
  pendingTasks: any[];
  unreadNotifications: number;
  unreadDirectMessages: number;
  unreadChannelMessages: number;
}

interface AdminSummary {
  totalOverdueTasks: number;
  totalPendingTasks: number;
  tasksCompletedToday: any[];
  userSummaries: Array<{
    username: string;
    name: string;
    email: string;
    overdueTasks: number;
    pendingTasks: number;
  }>;
  usersWithCompletedWork: Array<{
    username: string;
    name: string;
    email: string;
    completedTasks: number;
  }>;
}

interface UnitSummary {
  unitName: string;
  unitId: number;
  totalOverdueTasks: number;
  totalPendingTasks: number;
  tasksCompletedToday: any[];
  unitMembers: Array<{
    username: string;
    name: string;
    email: string;
    overdueTasks: number;
    pendingTasks: number;
  }>;
  membersWithCompletedWork: Array<{
    username: string;
    name: string;
    email: string;
    completedTasks: number;
  }>;
}

export async function getUserTaskSummary(userId: number): Promise<UserTaskSummary> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Get overdue tasks (due date before today and not completed)
  const overdueTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.assigneeId, userId),
      lte(tasks.dueDate, startOfDay),
      or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
    ),
    with: {
      category: true,
      project: true
    },
    orderBy: [tasks.dueDate]
  });

  // Get pending tasks (not completed)
  const pendingTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.assigneeId, userId),
      or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
    ),
    with: {
      category: true,
      project: true
    },
    orderBy: [tasks.dueDate],
    limit: 10
  });

  // Get unread notifications count
  const unreadNotificationCount = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));

  // Get unread direct messages count
  const unreadDirectCount = await db
    .select({ count: count() })
    .from(directMessages)
    .where(and(
      eq(directMessages.receiverId, userId),
      eq(directMessages.isRead, false)
    ));

  // Get unread channel messages count for user's channels
  const userChannelIds = await db
    .select({ channelId: channelMembers.channelId })
    .from(channelMembers)
    .where(eq(channelMembers.userId, userId));

  let unreadChannelCount = 0;
  if (userChannelIds.length > 0) {
    const channelIds = userChannelIds.map(uc => uc.channelId);
    const unreadChannelResult = await db
      .select({ count: count() })
      .from(messages)
      .where(and(
        or(...channelIds.map(id => eq(messages.channelId, id))),
        gte(messages.createdAt, startOfDay)
      ));
    unreadChannelCount = unreadChannelResult[0]?.count || 0;
  }

  return {
    overdueTasks,
    pendingTasks,
    unreadNotifications: unreadNotificationCount[0]?.count || 0,
    unreadDirectMessages: unreadDirectCount[0]?.count || 0,
    unreadChannelMessages: unreadChannelCount
  };
}

export async function getAdminSummary(): Promise<AdminSummary> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  // Get total overdue tasks count
  const overdueCount = await db
    .select({ count: count() })
    .from(tasks)
    .where(and(
      lte(tasks.dueDate, startOfDay),
      or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
    ));

  // Get total pending tasks count
  const pendingCount = await db
    .select({ count: count() })
    .from(tasks)
    .where(or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress')));

  // Get tasks completed today
  const completedToday = await db.query.tasks.findMany({
    where: and(
      eq(tasks.status, 'completed'),
      gte(tasks.updatedAt, startOfDay),
      lte(tasks.updatedAt, endOfDay)
    ),
    with: {
      assignee: true,
      category: true,
      project: true
    },
    orderBy: [desc(tasks.updatedAt)]
  });

  // Get summary for each user
  const allUsers = await db.query.users.findMany({
    where: eq(users.isAdmin, false)
  });

  const userSummaries = [];
  const usersWithCompletedWork = [];
  
  for (const user of allUsers) {
    const userOverdue = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, user.id),
        lte(tasks.dueDate, startOfDay),
        or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
      ));

    const userPending = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, user.id),
        or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
      ));

    const userCompleted = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, user.id),
        eq(tasks.status, 'completed'),
        gte(tasks.updatedAt, startOfDay),
        lte(tasks.updatedAt, endOfDay)
      ));

    const overdueTasks = userOverdue[0]?.count || 0;
    const pendingTasks = userPending[0]?.count || 0;
    const completedTasks = userCompleted[0]?.count || 0;

    if (overdueTasks > 0 || pendingTasks > 0) {
      userSummaries.push({
        username: user.username,
        name: user.name || user.username,
        email: user.email || '',
        overdueTasks,
        pendingTasks
      });
    }

    if (completedTasks > 0) {
      usersWithCompletedWork.push({
        username: user.username,
        name: user.name || user.username,
        email: user.email || '',
        completedTasks
      });
    }
  }

  // Add unassigned tasks to user summaries
  const unassignedOverdue = await db
    .select({ count: count() })
    .from(tasks)
    .where(and(
      sql`${tasks.assigneeId} IS NULL`,
      lte(tasks.dueDate, startOfDay),
      or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
    ));

  const unassignedPending = await db
    .select({ count: count() })
    .from(tasks)
    .where(and(
      sql`${tasks.assigneeId} IS NULL`,
      or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
    ));

  const unassignedOverdueCount = unassignedOverdue[0]?.count || 0;
  const unassignedPendingCount = unassignedPending[0]?.count || 0;

  if (unassignedOverdueCount > 0 || unassignedPendingCount > 0) {
    userSummaries.push({
      username: 'unassigned',
      name: 'Unassigned Tasks',
      email: '',
      overdueTasks: unassignedOverdueCount,
      pendingTasks: unassignedPendingCount
    });
  }

  return {
    totalOverdueTasks: overdueCount[0]?.count || 0,
    totalPendingTasks: pendingCount[0]?.count || 0,
    tasksCompletedToday: completedToday,
    userSummaries,
    usersWithCompletedWork
  };
}

export async function getUnitSummary(unitId: number): Promise<UnitSummary> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  // Get unit information
  const unit = await db.query.departments.findFirst({
    where: eq(departments.id, unitId)
  });

  if (!unit) {
    throw new Error(`Unit with ID ${unitId} not found`);
  }

  // Get all users in this unit (including primary and additional assignments)
  const unitUsers = await db.query.userDepartments.findMany({
    where: eq(userDepartments.departmentId, unitId),
    with: {
      user: true
    }
  });

  // Also get users whose primary department is this unit
  const primaryUsers = await db.query.users.findMany({
    where: eq(users.departmentId, unitId)
  });

  // Combine and deduplicate users
  const allUnitUsers = new Map();
  unitUsers.forEach(ud => {
    if (ud.user && typeof ud.user === 'object' && 'id' in ud.user) {
      allUnitUsers.set((ud.user as any).id, ud.user);
    }
  });
  primaryUsers.forEach(user => {
    if (user && user.id) {
      allUnitUsers.set(user.id, user);
    }
  });

  const userIds = Array.from(allUnitUsers.keys());

  // Get unit's overdue tasks count
  let unitOverdueCount;
  if (userIds.length > 0) {
    unitOverdueCount = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        or(
          ...userIds.map(userId => eq(tasks.assigneeId, userId)),
          eq(tasks.departmentId, unitId)
        ),
        lte(tasks.dueDate, startOfDay),
        or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
      ));
  } else {
    unitOverdueCount = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.departmentId, unitId),
        lte(tasks.dueDate, startOfDay),
        or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
      ));
  }

  // Get unit's pending tasks count
  let unitPendingCount;
  if (userIds.length > 0) {
    unitPendingCount = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        or(
          ...userIds.map(userId => eq(tasks.assigneeId, userId)),
          eq(tasks.departmentId, unitId)
        ),
        or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
      ));
  } else {
    unitPendingCount = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.departmentId, unitId),
        or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
      ));
  }

  // Get tasks completed today in this unit
  let unitCompletedToday;
  if (userIds.length > 0) {
    unitCompletedToday = await db.query.tasks.findMany({
      where: and(
        or(
          ...userIds.map(userId => eq(tasks.assigneeId, userId)),
          eq(tasks.departmentId, unitId)
        ),
        eq(tasks.status, 'completed'),
        gte(tasks.updatedAt, startOfDay),
        lte(tasks.updatedAt, endOfDay)
      ),
      with: {
        assignee: true,
        category: true,
        project: true
      },
      orderBy: [desc(tasks.updatedAt)]
    });
  } else {
    unitCompletedToday = await db.query.tasks.findMany({
      where: and(
        eq(tasks.departmentId, unitId),
        eq(tasks.status, 'completed'),
        gte(tasks.updatedAt, startOfDay),
        lte(tasks.updatedAt, endOfDay)
      ),
      with: {
        assignee: true,
        category: true,
        project: true
      },
      orderBy: [desc(tasks.updatedAt)]
    });
  }

  // Get summary for each unit member
  const unitMembers = [];
  const membersWithCompletedWork = [];
  
  for (const user of Array.from(allUnitUsers.values())) {
    const userOverdue = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, user.id),
        lte(tasks.dueDate, startOfDay),
        or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
      ));

    const userPending = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, user.id),
        or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
      ));

    const userCompleted = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, user.id),
        eq(tasks.status, 'completed'),
        gte(tasks.updatedAt, startOfDay),
        lte(tasks.updatedAt, endOfDay)
      ));

    const overdueTasks = userOverdue[0]?.count || 0;
    const pendingTasks = userPending[0]?.count || 0;
    const completedTasks = userCompleted[0]?.count || 0;

    if (overdueTasks > 0 || pendingTasks > 0) {
      unitMembers.push({
        username: (user as any).username,
        name: (user as any).name || (user as any).username,
        email: (user as any).email || '',
        overdueTasks,
        pendingTasks
      });
    }

    if (completedTasks > 0) {
      membersWithCompletedWork.push({
        username: (user as any).username,
        name: (user as any).name || (user as any).username,
        email: (user as any).email || '',
        completedTasks
      });
    }
  }

  return {
    unitName: unit.name,
    unitId: unit.id,
    totalOverdueTasks: unitOverdueCount[0]?.count || 0,
    totalPendingTasks: unitPendingCount[0]?.count || 0,
    tasksCompletedToday: unitCompletedToday || [],
    unitMembers,
    membersWithCompletedWork
  };
}

export function generateUserEmailHTML(username: string, summary: UserTaskSummary): string {
  const hasContent = summary.overdueTasks.length > 0 || 
                    summary.pendingTasks.length > 0 || 
                    summary.unreadNotifications > 0 ||
                    summary.unreadDirectMessages > 0 ||
                    summary.unreadChannelMessages > 0;

  if (!hasContent) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Daily Summary - All Caught Up! 🎉</h2>
        <p>Hi ${username},</p>
        <p>Great news! You have no overdue tasks, pending items, or unread messages.</p>
        <p>Keep up the excellent work!</p>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is your daily task summary from Promellon.</p>
      </div>
    `;
  }

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Daily Task Summary</h2>
      <p>Hi ${username},</p>
      <p>Here's your daily summary:</p>
  `;

  // Overdue tasks section
  if (summary.overdueTasks.length > 0) {
    html += `
      <div style="margin: 20px 0; padding: 15px; background-color: #fee; border-left: 4px solid #f56565;">
        <h3 style="color: #c53030; margin-top: 0;">⚠️ Overdue Tasks (${summary.overdueTasks.length})</h3>
        <ul style="margin: 10px 0;">
    `;
    
    summary.overdueTasks.slice(0, 5).forEach(task => {
      const dueDate = new Date(task.dueDate).toLocaleDateString();
      html += `
        <li style="margin: 5px 0;">
          <strong>${task.title}</strong> - Due: ${dueDate}
          ${task.category ? `<br><small style="color: #666;">Category: ${task.category.name}</small>` : ''}
        </li>
      `;
    });

    if (summary.overdueTasks.length > 5) {
      html += `<li style="color: #666;">... and ${summary.overdueTasks.length - 5} more</li>`;
    }

    html += `</ul></div>`;
  }

  // Pending tasks section
  if (summary.pendingTasks.length > 0) {
    html += `
      <div style="margin: 20px 0; padding: 15px; background-color: #fffbeb; border-left: 4px solid #f59e0b;">
        <h3 style="color: #d97706; margin-top: 0;">📋 Pending Tasks (${summary.pendingTasks.length})</h3>
        <ul style="margin: 10px 0;">
    `;
    
    summary.pendingTasks.slice(0, 5).forEach(task => {
      const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
      html += `
        <li style="margin: 5px 0;">
          <strong>${task.title}</strong> - Due: ${dueDate}
          ${task.category ? `<br><small style="color: #666;">Category: ${task.category.name}</small>` : ''}
        </li>
      `;
    });

    if (summary.pendingTasks.length > 5) {
      html += `<li style="color: #666;">... and ${summary.pendingTasks.length - 5} more</li>`;
    }

    html += `</ul></div>`;
  }

  // Unread notifications section
  const totalUnread = summary.unreadNotifications + summary.unreadDirectMessages + summary.unreadChannelMessages;
  if (totalUnread > 0) {
    html += `
      <div style="margin: 20px 0; padding: 15px; background-color: #eff6ff; border-left: 4px solid #3b82f6;">
        <h3 style="color: #1d4ed8; margin-top: 0;">🔔 Unread Notifications (${totalUnread})</h3>
        <ul style="margin: 10px 0;">
    `;

    if (summary.unreadNotifications > 0) {
      html += `<li>General notifications: ${summary.unreadNotifications}</li>`;
    }
    if (summary.unreadDirectMessages > 0) {
      html += `<li>Direct messages: ${summary.unreadDirectMessages}</li>`;
    }
    if (summary.unreadChannelMessages > 0) {
      html += `<li>Channel messages: ${summary.unreadChannelMessages}</li>`;
    }

    html += `</ul></div>`;
  }

  html += `
      <hr style="margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">
        This is your daily task summary from Promellon.
        <br>
        <a href="https://mist.promellon.com" style="color: #3b82f6; text-decoration: none;">Visit Application →</a>
      </p>
    </div>
  `;

  return html;
}

export function generateAdminEmailHTML(summary: AdminSummary): string {
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Daily Admin Summary</h2>
      <p>Here's today's team productivity summary:</p>
  `;

  // Overall statistics
  html += `
    <div style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
      <h3 style="margin-top: 0; color: #374151;">📊 Overall Statistics</h3>
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="text-align: center; padding: 10px;">
          <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${summary.totalOverdueTasks}</div>
          <div style="color: #666;">Overdue Tasks</div>
        </div>
        <div style="text-align: center; padding: 10px;">
          <div style="font-size: 24px; font-weight: bold; color: #d97706;">${summary.totalPendingTasks}</div>
          <div style="color: #666;">Pending Tasks</div>
        </div>
        <div style="text-align: center; padding: 10px;">
          <div style="font-size: 24px; font-weight: bold; color: #059669;">${summary.tasksCompletedToday.length}</div>
          <div style="color: #666;">Completed Today</div>
        </div>
      </div>
    </div>
  `;

  // Tasks completed today
  if (summary.tasksCompletedToday.length > 0) {
    html += `
      <div style="margin: 20px 0; padding: 15px; background-color: #ecfdf5; border-left: 4px solid #10b981;">
        <h3 style="color: #047857; margin-top: 0;">✅ Tasks Completed Today (${summary.tasksCompletedToday.length})</h3>
        <ul style="margin: 10px 0;">
    `;
    
    summary.tasksCompletedToday.slice(0, 10).forEach(task => {
      const assignee = task.assignee?.name || 'Unassigned';
      const category = task.category?.name || 'No category';
      html += `
        <li style="margin: 8px 0;">
          <strong>${task.title}</strong> - ${assignee}
          <br><small style="color: #666;">Category: ${category}</small>
        </li>
      `;
    });

    if (summary.tasksCompletedToday.length > 10) {
      html += `<li style="color: #666;">... and ${summary.tasksCompletedToday.length - 10} more</li>`;
    }

    html += `</ul></div>`;
  }

  // User summaries with pending work
  if (summary.userSummaries.length > 0) {
    html += `
      <div style="margin: 20px 0; padding: 15px; background-color: #fefce8; border-left: 4px solid #eab308;">
        <h3 style="color: #a16207; margin-top: 0;">👥 Users with Pending Work</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">User</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">Overdue</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">Pending</th>
            </tr>
          </thead>
          <tbody>
    `;

    summary.userSummaries.forEach(user => {
      html += `
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${user.name}</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; color: ${user.overdueTasks > 0 ? '#dc2626' : '#666'};">
            ${user.overdueTasks}
          </td>
          <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; color: ${user.pendingTasks > 0 ? '#d97706' : '#666'};">
            ${user.pendingTasks}
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  // Users with completed work table
  if (summary.usersWithCompletedWork.length > 0) {
    html += `
      <div style="margin: 20px 0; padding: 15px; background-color: #ecfdf5; border-left: 4px solid #10b981;">
        <h3 style="color: #047857; margin-top: 0;">🎯 Users with Completed Work</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
          <thead>
            <tr style="background-color: #f0fdf4;">
              <th style="padding: 8px; text-align: left; border: 1px solid #bbf7d0;">User</th>
              <th style="padding: 8px; text-align: center; border: 1px solid #bbf7d0;">Tasks Completed</th>
            </tr>
          </thead>
          <tbody>
    `;

    summary.usersWithCompletedWork.forEach(user => {
      html += `
        <tr>
          <td style="padding: 8px; border: 1px solid #bbf7d0;">${user.name}</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #bbf7d0; color: #059669; font-weight: bold;">
            ${user.completedTasks}
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  html += `
      <hr style="margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">
        This is your daily admin summary from Promellon.
        <br>
        <a href="https://mist.promellon.com" style="color: #3b82f6; text-decoration: none;">Visit Application →</a>
      </p>
    </div>
  `;

  return html;
}

export function generateUnitHeadEmailHTML(unitHeadName: string, summary: UnitSummary): string {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">
        End-of-Day Summary for ${summary.unitName}
      </h2>
      <p>Hi ${unitHeadName},</p>
      <p>Here's your unit's daily task summary:</p>
      
      <!-- Unit Overview -->
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0066cc;">Unit Overview</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Overdue Tasks:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; color: ${summary.totalOverdueTasks > 0 ? '#dc3545' : '#28a745'};">
              ${summary.totalOverdueTasks}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Pending Tasks:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; color: ${summary.totalPendingTasks > 0 ? '#ffc107' : '#28a745'};">
              ${summary.totalPendingTasks}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px;"><strong>Tasks Completed Today:</strong></td>
            <td style="padding: 8px; color: #28a745;">${summary.tasksCompletedToday.length}</td>
          </tr>
        </table>
      </div>

      ${summary.unitMembers.length > 0 ? `
      <!-- Unit Members Summary -->
      <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #856404;">Unit Members Requiring Attention</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #ffeaa7;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Member</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Overdue</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Pending</th>
            </tr>
          </thead>
          <tbody>
            ${summary.unitMembers.map(member => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                  <strong>${member.name}</strong><br>
                  <small style="color: #666;">${member.username}</small>
                </td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd; color: ${member.overdueTasks > 0 ? '#dc3545' : '#666'};">
                  ${member.overdueTasks}
                </td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd; color: ${member.pendingTasks > 0 ? '#ffc107' : '#666'};">
                  ${member.pendingTasks}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      ${summary.tasksCompletedToday.length > 0 ? `
      <!-- Tasks Completed Today -->
      <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #155724;">Tasks Completed Today</h3>
        ${summary.tasksCompletedToday.map(task => `
          <div style="background-color: #fff; padding: 10px; border-left: 3px solid #28a745; margin: 10px 0;">
            <h4 style="margin: 0 0 5px 0; color: #333;">${task.title}</h4>
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Completed by:</strong> ${task.assignee?.name || task.assignee?.username || 'Unknown'}<br>
              ${task.category ? `<strong>Department:</strong> ${task.category.name}<br>` : ''}
              ${task.project ? `<strong>Project:</strong> ${task.project.name}` : ''}
            </p>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${summary.membersWithCompletedWork.length > 0 ? `
      <!-- Members with Completed Work -->
      <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0c5460;">Unit Members with Completed Work</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #bee5eb;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Member</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Tasks Completed</th>
            </tr>
          </thead>
          <tbody>
            ${summary.membersWithCompletedWork.map(member => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                  <strong>${member.name}</strong><br>
                  <small style="color: #666;">${member.username}</small>
                </td>
                <td style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd; color: #28a745;">
                  ${member.completedTasks}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <hr style="margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">This notification was sent from Promellon Task Management System.</p>
    </div>
  `;

  return html;
}

// User creation notification
export async function notifyUserCreation(user: any, password: string, createdBy: any): Promise<void> {
  if (!transporter) {
    console.log('Email service not initialized');
    return;
  }

  try {
    const fromEmailSetting = await db.query.smtpConfig.findFirst({
      where: eq(smtpConfig.active, true)
    });

    if (!fromEmailSetting || !user.email) return;

    const html = `
      <h2>Welcome to Promellon</h2>
      <p>Hello ${user.name || user.username},</p>
      <p>A new account has been created for you by ${createdBy?.name || createdBy?.username}.</p>
      <p><strong>Username:</strong> ${user.username}</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
      <p>Please log in and change your password as soon as possible.</p>
      <p>Best regards,<br>Promellon Team</p>
    `;

    await sendEmail({
      to: user.email,
      from: fromEmailSetting.fromEmail,
      subject: 'Welcome to Promellon - Account Created',
      html,
      text: `Welcome to Promellon! Username: ${user.username}, Password: ${password}`
    });
  } catch (error) {
    console.error('Failed to send user creation notification:', error);
  }
}

// Password reset notification
export async function notifyPasswordReset(user: any, newPassword: string): Promise<void> {
  if (!transporter) {
    console.log('Email service not initialized');
    return;
  }

  try {
    const fromEmailSetting = await db.query.smtpConfig.findFirst({
      where: eq(smtpConfig.active, true)
    });

    if (!fromEmailSetting || !user.email) return;

    const html = `
      <h2>Password Reset - Promellon</h2>
      <p>Hello ${user.name || user.username},</p>
      <p>Your password has been reset.</p>
      <p><strong>New Password:</strong> ${newPassword}</p>
      <p>Please log in and change your password as soon as possible.</p>
      <p>Best regards,<br>Promellon Team</p>
    `;

    await sendEmail({
      to: user.email,
      from: fromEmailSetting.fromEmail,
      subject: 'Password Reset - Promellon',
      html,
      text: `Your password has been reset. New password: ${newPassword}`
    });
  } catch (error) {
    console.error('Failed to send password reset notification:', error);
  }
}

// Project assignment notification
export async function notifyProjectAssignment(project: any, user: any, assignedBy: any): Promise<void> {
  if (!transporter) {
    console.log('Email service not initialized');
    return;
  }

  try {
    const fromEmailSetting = await db.query.smtpConfig.findFirst({
      where: eq(smtpConfig.active, true)
    });

    if (!fromEmailSetting || !user.email) return;

    const html = `
      <h2>Project Assignment - Promellon</h2>
      <p>Hello ${user.name || user.username},</p>
      <p>You have been assigned to a new project:</p>
      <p><strong>Project:</strong> ${project.name}</p>
      <p><strong>Description:</strong> ${project.description || 'No description provided'}</p>
      <p><strong>Assigned by:</strong> ${assignedBy?.name || assignedBy?.username}</p>
      <p>Best regards,<br>Promellon Team</p>
    `;

    await sendEmail({
      to: user.email,
      from: fromEmailSetting.fromEmail,
      subject: `Project Assignment: ${project.name}`,
      html,
      text: `You have been assigned to project: ${project.name}`
    });
  } catch (error) {
    console.error('Failed to send project assignment notification:', error);
  }
}

// Task comment notification
export async function notifyTaskComment(task: any, comment: any, commenter: any, assignee: any): Promise<void> {
  if (!transporter) {
    console.log('Email service not initialized');
    return;
  }

  try {
    const fromEmailSetting = await db.query.smtpConfig.findFirst({
      where: eq(smtpConfig.active, true)
    });

    if (!fromEmailSetting || !assignee?.email) return;

    const html = `
      <h2>New Comment on Task - Promellon</h2>
      <p>Hello ${assignee.name || assignee.username},</p>
      <p>A new comment has been added to your task:</p>
      <p><strong>Task:</strong> ${task.title}</p>
      <p><strong>Comment by:</strong> ${commenter?.name || commenter?.username}</p>
      <p><strong>Comment:</strong> ${comment.content}</p>
      <p>Best regards,<br>Promellon Team</p>
    `;

    await sendEmail({
      to: assignee.email,
      from: fromEmailSetting.fromEmail,
      subject: `New comment on: ${task.title}`,
      html,
      text: `New comment on task "${task.title}" by ${commenter?.name || commenter?.username}`
    });
  } catch (error) {
    console.error('Failed to send task comment notification:', error);
  }
}

// Task collaboration notification
export async function notifyTaskCollaboration(task: any, collaborator: any, inviter: any): Promise<void> {
  if (!transporter) {
    console.log('Email service not initialized');
    return;
  }

  try {
    const fromEmailSetting = await db.query.smtpConfig.findFirst({
      where: eq(smtpConfig.active, true)
    });

    if (!fromEmailSetting || !collaborator?.email) return;

    const html = `
      <h2>Task Collaboration Invitation - Promellon</h2>
      <p>Hello ${collaborator.name || collaborator.username},</p>
      <p>You have been invited to collaborate on a task:</p>
      <p><strong>Task:</strong> ${task.title}</p>
      <p><strong>Description:</strong> ${task.description || 'No description provided'}</p>
      <p><strong>Invited by:</strong> ${inviter?.name || inviter?.username}</p>
      <p>Best regards,<br>Promellon Team</p>
    `;

    await sendEmail({
      to: collaborator.email,
      from: fromEmailSetting.fromEmail,
      subject: `Collaboration invitation: ${task.title}`,
      html,
      text: `You have been invited to collaborate on task: ${task.title}`
    });
  } catch (error) {
    console.error('Failed to send task collaboration notification:', error);
  }
}

// Mention notification
export async function sendMentionNotification(mentionedUser: any, message: any, mentionedBy: any): Promise<void> {
  if (!transporter) {
    console.log('Email service not initialized');
    return;
  }

  try {
    const fromEmailSetting = await db.query.smtpConfig.findFirst({
      where: eq(smtpConfig.active, true)
    });

    if (!fromEmailSetting || !mentionedUser?.email) return;

    const html = `
      <h2>You were mentioned - Promellon</h2>
      <p>Hello ${mentionedUser.name || mentionedUser.username},</p>
      <p>You were mentioned in a message:</p>
      <p><strong>From:</strong> ${mentionedBy?.name || mentionedBy?.username}</p>
      <p><strong>Message:</strong> ${message.content}</p>
      <p>Best regards,<br>Promellon Team</p>
    `;

    await sendEmail({
      to: mentionedUser.email,
      from: fromEmailSetting.fromEmail,
      subject: 'You were mentioned in Promellon',
      html,
      text: `You were mentioned by ${mentionedBy?.name || mentionedBy?.username}: ${message.content}`
    });
  } catch (error) {
    console.error('Failed to send mention notification:', error);
  }
}

// Generic send email function
export async function sendEmail(emailData: {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!transporter) {
    console.log('Email service not initialized');
    return;
  }

  try {
    await transporter.sendMail(emailData);
    console.log(`Email sent to ${emailData.to}: ${emailData.subject}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export async function sendEndOfDayNotifications(): Promise<void> {
  console.log('Starting end-of-day email notifications...');

  // Get notification settings
  const userNotificationsSetting = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, 'end_of_day_user_notifications')
  });

  const adminNotificationsSetting = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, 'end_of_day_admin_notifications')
  });

  const unitHeadNotificationsSetting = await db.query.appSettings.findFirst({
    where: eq(appSettings.key, 'end_of_day_unit_head_notifications')
  });

  const userNotificationsEnabled = userNotificationsSetting?.value === 'true';
  const adminNotificationsEnabled = adminNotificationsSetting?.value === 'true';
  const unitHeadNotificationsEnabled = unitHeadNotificationsSetting?.value === 'true';

  const fromEmail = await getFromEmail();

  // Send user notifications
  if (userNotificationsEnabled) {
    const regularUsers = await db.query.users.findMany({
      where: eq(users.isAdmin, false)
    });

    for (const user of regularUsers) {
      if (!user.email) continue;

      try {
        const summary = await getUserTaskSummary(user.id);
        
        // Skip sending email if user has no pending items
        const hasPendingItems = summary.overdueTasks.length > 0 || 
                               summary.pendingTasks.length > 0 || 
                               summary.unreadNotifications > 0 || 
                               summary.unreadDirectMessages > 0 || 
                               summary.unreadChannelMessages > 0;
        
        if (!hasPendingItems) {
          console.log(`Skipped notification for ${user.username} - no pending items`);
          continue;
        }
        
        const html = generateUserEmailHTML(user.username, summary);
        
        await sendEmail({
          to: user.email,
          from: fromEmail,
          subject: 'Daily Task Summary',
          html,
          text: `Daily task summary for ${user.username}`
        });

        console.log(`Sent user notification to ${user.username}`);
      } catch (error) {
        console.error(`Failed to send notification to ${user.username}:`, error);
      }
    }
  }

  // Send admin notifications
  if (adminNotificationsEnabled) {
    const adminUsers = await db.query.users.findMany({
      where: eq(users.isAdmin, true)
    });

    if (adminUsers.length > 0) {
      try {
        const adminSummary = await getAdminSummary();
        const html = generateAdminEmailHTML(adminSummary);

        for (const admin of adminUsers) {
          if (!admin.email) continue;

          await sendEmail({
            to: admin.email,
            from: fromEmail,
            subject: 'Daily Admin Summary',
            html,
            text: 'Daily admin summary from Promellon'
          });

          console.log(`Sent admin notification to ${admin.username}`);
        }
      } catch (error) {
        console.error('Failed to send admin notifications:', error);
      }
    }
  }

  // Send unit head notifications
  if (unitHeadNotificationsEnabled) {
    console.log('Sending unit head notifications...');
    
    try {
      // Get all departments that have unit heads assigned
      const unitsWithHeads = await db.query.departments.findMany({
        where: sql`${departments.unitHeadId} IS NOT NULL`
      });

      for (const unit of unitsWithHeads) {
        if (!unit.unitHeadId) continue;

        try {
          // Get unit head user details
          const unitHead = await db.query.users.findFirst({
            where: eq(users.id, unit.unitHeadId)
          });

          if (!unitHead || !unitHead.email) {
            console.log(`Unit head not found or no email for unit ${unit.name}`);
            continue;
          }

          const unitSummary = await getUnitSummary(unit.id);
          
          // Only send if unit has activity to report
          if (unitSummary.totalOverdueTasks > 0 || 
              unitSummary.totalPendingTasks > 0 || 
              unitSummary.tasksCompletedToday.length > 0) {
            
            const html = generateUnitHeadEmailHTML(
              unitHead.name || unitHead.username, 
              unitSummary
            );
            
            await sendEmail({
              to: unitHead.email,
              from: fromEmail,
              subject: `Daily Unit Summary - ${unit.name}`,
              html,
              text: `Unit ${unit.name} summary: ${unitSummary.totalOverdueTasks} overdue, ${unitSummary.totalPendingTasks} pending tasks.`
            });
            
            console.log(`Sent unit head notification to ${unitHead.username} for unit ${unit.name}`);
          } else {
            console.log(`Skipped notification for unit ${unit.name} - no activity to report`);
          }
        } catch (error) {
          console.error(`Failed to send unit head notification for unit ${unit.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to send unit head notifications:', error);
    }
  }

  console.log('End-of-day email notifications completed');
}