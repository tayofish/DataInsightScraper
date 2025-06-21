import * as nodemailer from 'nodemailer';
import { db } from '@db';
import { users, tasks, notifications, directMessages, messages, channels, channelMembers, smtpConfig, appSettings } from '@shared/schema';
import { eq, and, gte, lte, or, count, desc } from 'drizzle-orm';

// Email transporter
let transporter: nodemailer.Transporter | null = null;

// Initialize email service with existing SMTP configuration
async function initializeEmailService(): Promise<boolean> {
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
    email: string;
    overdueTasks: number;
    pendingTasks: number;
  }>;
}

export async function sendEmail(emailData: EmailData): Promise<boolean> {
  if (!mailService) {
    console.log('Email service not configured - SENDGRID_API_KEY missing');
    return false;
  }

  try {
    await mailService.send(emailData);
    console.log(`Email sent successfully to ${emailData.to}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function getUserTaskSummary(userId: number): Promise<UserTaskSummary> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  // Get overdue tasks (due date before today and not completed)
  const overdueTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.assigneeId, userId),
      lte(tasks.dueDate, startOfDay),
      or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))
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
      or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))
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
    .select({ channelId: userChannels.channelId })
    .from(userChannels)
    .where(eq(userChannels.userId, userId));

  let unreadChannelCount = 0;
  if (userChannelIds.length > 0) {
    const channelIds = userChannelIds.map(uc => uc.channelId);
    const unreadChannelResult = await db
      .select({ count: count() })
      .from(channelMessages)
      .where(and(
        or(...channelIds.map(id => eq(channelMessages.channelId, id))),
        gte(channelMessages.createdAt, startOfDay),
        eq(channelMessages.isRead, false)
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
      or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))
    ));

  // Get total pending tasks count
  const pendingCount = await db
    .select({ count: count() })
    .from(tasks)
    .where(or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress')));

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
    where: eq(users.role, 'user')
  });

  const userSummaries = [];
  for (const user of allUsers) {
    const userOverdue = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, user.id),
        lte(tasks.dueDate, startOfDay),
        or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))
      ));

    const userPending = await db
      .select({ count: count() })
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, user.id),
        or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress'))
      ));

    userSummaries.push({
      username: user.username,
      email: user.email || '',
      overdueTasks: userOverdue[0]?.count || 0,
      pendingTasks: userPending[0]?.count || 0
    });
  }

  return {
    totalOverdueTasks: overdueCount[0]?.count || 0,
    totalPendingTasks: pendingCount[0]?.count || 0,
    tasksCompletedToday: completedToday,
    userSummaries: userSummaries.filter(u => u.overdueTasks > 0 || u.pendingTasks > 0)
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
      <p style="color: #666; font-size: 12px;">This is your daily task summary from Promellon.</p>
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
      const assignee = task.assignee?.username || 'Unassigned';
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

  // User summaries
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
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${user.username}</td>
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

  html += `
      <hr style="margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">This is your daily admin summary from Promellon.</p>
    </div>
  `;

  return html;
}

export async function sendEndOfDayNotifications(): Promise<void> {
  console.log('Starting end-of-day email notifications...');

  // Get notification settings
  const userNotificationsSetting = await db.query.appSettings.findFirst({
    where: eq(require('@shared/schema').appSettings.key, 'end_of_day_user_notifications')
  });

  const adminNotificationsSetting = await db.query.appSettings.findFirst({
    where: eq(require('@shared/schema').appSettings.key, 'end_of_day_admin_notifications')
  });

  const userNotificationsEnabled = userNotificationsSetting?.value === 'true';
  const adminNotificationsEnabled = adminNotificationsSetting?.value === 'true';

  // Send user notifications
  if (userNotificationsEnabled) {
    const regularUsers = await db.query.users.findMany({
      where: eq(users.role, 'user')
    });

    for (const user of regularUsers) {
      if (!user.email) continue;

      try {
        const summary = await getUserTaskSummary(user.id);
        const html = generateUserEmailHTML(user.username, summary);
        
        await sendEmail({
          to: user.email,
          from: process.env.FROM_EMAIL || 'noreply@promellon.com',
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
      where: eq(users.role, 'admin')
    });

    if (adminUsers.length > 0) {
      try {
        const adminSummary = await getAdminSummary();
        const html = generateAdminEmailHTML(adminSummary);

        for (const admin of adminUsers) {
          if (!admin.email) continue;

          await sendEmail({
            to: admin.email,
            from: process.env.FROM_EMAIL || 'noreply@promellon.com',
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

  console.log('End-of-day email notifications completed');
}