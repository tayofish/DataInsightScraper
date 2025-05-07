import nodemailer, { Transporter } from 'nodemailer';
import { db } from '@db';
import { smtpConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

let transporter: Transporter | null = null;
let smtpSettings: any = null;

/**
 * Initialize the email service with the active SMTP configuration
 */
export async function initializeEmailService() {
  try {
    // Get the active SMTP configuration
    const configs = await db.select().from(smtpConfig).where(eq(smtpConfig.active, true));
    
    if (configs.length === 0) {
      console.log('No active SMTP configuration found. Email notifications are disabled.');
      return false;
    }
    
    smtpSettings = configs[0];
    
    // Create the transporter
    transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.port === 465, // Only use secure for port 465
      auth: {
        user: smtpSettings.username,
        pass: smtpSettings.password,
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      }
    });
    
    // Verify connection
    await transporter.verify();
    console.log('SMTP connection verified successfully. Email notifications are enabled.');
    return true;
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    transporter = null;
    smtpSettings = null;
    return false;
  }
}

/**
 * Send an email
 */
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  if (!transporter || !smtpSettings) {
    await initializeEmailService();
    if (!transporter) {
      console.error('Email service not initialized. Cannot send email.');
      return false;
    }
  }
  
  try {
    await transporter.sendMail({
      from: `"${smtpSettings.fromName}" <${smtpSettings.fromEmail}>`,
      to,
      subject,
      text: text || '',
      html,
    });
    
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Event-specific notification functions

/**
 * Send notification for task creation
 */
export async function notifyTaskCreation(task: any, creator: any, assignee: any | null, projectTeam: any[] = []) {
  if (!assignee && (!projectTeam || projectTeam.length === 0)) {
    return; // No one to notify
  }
  
  const taskUrl = `${process.env.APP_URL || ''}/tasks?id=${task.id}`;
  
  // Notify assignee if assigned
  if (assignee && assignee.email) {
    await sendEmail({
      to: assignee.email,
      subject: `[TaskScout] New task assigned: ${task.title}`,
      html: `
        <h2>New Task Assigned</h2>
        <p>Hello ${assignee.name},</p>
        <p>A new task has been assigned to you:</p>
        <p><strong>${task.title}</strong></p>
        <p>${task.description || ''}</p>
        <p>Priority: ${task.priority}</p>
        <p>Due date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</p>
        <p>Created by: ${creator.name}</p>
        <p><a href="${taskUrl}">View Task</a></p>
      `,
    });
  }
  
  // Notify project team
  if (projectTeam && projectTeam.length > 0) {
    for (const member of projectTeam) {
      // Skip notification for assignee (already notified) and creator
      if ((assignee && member.id === assignee.id) || member.id === creator.id || !member.email) {
        continue;
      }
      
      await sendEmail({
        to: member.email,
        subject: `[TaskScout] New task created in your project: ${task.title}`,
        html: `
          <h2>New Task Created</h2>
          <p>Hello ${member.name},</p>
          <p>A new task has been created in your project:</p>
          <p><strong>${task.title}</strong></p>
          <p>${task.description || ''}</p>
          <p>Priority: ${task.priority}</p>
          <p>Due date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</p>
          <p>Created by: ${creator.name}</p>
          <p>Assigned to: ${assignee ? assignee.name : 'Unassigned'}</p>
          <p><a href="${taskUrl}">View Task</a></p>
        `,
      });
    }
  }
}

/**
 * Send notification for task assignment
 */
export async function notifyTaskAssignment(task: any, assignee: any, assignedBy: any) {
  if (!assignee || !assignee.email) return;
  
  const taskUrl = `${process.env.APP_URL || ''}/tasks?id=${task.id}`;
  
  await sendEmail({
    to: assignee.email,
    subject: `[TaskScout] You've been assigned a task: ${task.title}`,
    html: `
      <h2>Task Assignment</h2>
      <p>Hello ${assignee.name},</p>
      <p>You have been assigned to a task by ${assignedBy.name}:</p>
      <p><strong>${task.title}</strong></p>
      <p>${task.description || ''}</p>
      <p>Priority: ${task.priority}</p>
      <p>Due date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</p>
      <p><a href="${taskUrl}">View Task</a></p>
    `,
  });
}

/**
 * Send notification for mention in task
 */
export async function notifyMention(task: any, mentionedUser: any, mentionedBy: any, comment: string) {
  if (!mentionedUser || !mentionedUser.email) return;
  
  const taskUrl = `${process.env.APP_URL || ''}/tasks?id=${task.id}`;
  
  await sendEmail({
    to: mentionedUser.email,
    subject: `[TaskScout] You were mentioned in a task: ${task.title}`,
    html: `
      <h2>Mention in Task</h2>
      <p>Hello ${mentionedUser.name},</p>
      <p>${mentionedBy.name} mentioned you in a task:</p>
      <p><strong>${task.title}</strong></p>
      <p>Comment: ${comment}</p>
      <p><a href="${taskUrl}">View Task</a></p>
    `,
  });
}

/**
 * Send notification for task comment
 */
export async function notifyTaskComment(task: any, comment: string, commentBy: any, notifyUsers: any[]) {
  if (!notifyUsers || notifyUsers.length === 0) return;
  
  const taskUrl = `${process.env.APP_URL || ''}/tasks?id=${task.id}`;
  
  for (const user of notifyUsers) {
    // Don't notify the commenter about their own comment
    if (user.id === commentBy.id || !user.email) {
      continue;
    }
    
    await sendEmail({
      to: user.email,
      subject: `[TaskScout] New comment on task: ${task.title}`,
      html: `
        <h2>New Comment on Task</h2>
        <p>Hello ${user.name},</p>
        <p>${commentBy.name} commented on a task:</p>
        <p><strong>${task.title}</strong></p>
        <p>Comment: ${comment}</p>
        <p><a href="${taskUrl}">View Task</a></p>
      `,
    });
  }
}

/**
 * Send notification for new user creation
 */
export async function notifyUserCreation(user: any, password: string | null, admin: any) {
  if (!user || !user.email) return;
  
  const loginUrl = `${process.env.APP_URL || ''}/auth`;
  
  await sendEmail({
    to: user.email,
    subject: `[TaskScout] Welcome to TaskScout - Account Created`,
    html: `
      <h2>Welcome to TaskScout</h2>
      <p>Hello ${user.name},</p>
      <p>Your account has been created by ${admin.name}.</p>
      <p>Here are your login details:</p>
      <p>Username: ${user.username}</p>
      ${password ? `<p>Password: ${password}</p>` : ''}
      <p>Please login at <a href="${loginUrl}">TaskScout</a>.</p>
      ${password ? `<p>For security reasons, please change your password after the first login.</p>` : ''}
    `,
  });
}

/**
 * Send notification for password reset
 */
export async function notifyPasswordReset(user: any, newPassword: string) {
  if (!user || !user.email) return;
  
  const loginUrl = `${process.env.APP_URL || ''}/auth`;
  
  await sendEmail({
    to: user.email,
    subject: `[TaskScout] Your Password Has Been Reset`,
    html: `
      <h2>Password Reset</h2>
      <p>Hello ${user.name},</p>
      <p>Your password has been reset.</p>
      <p>Your new password is: ${newPassword}</p>
      <p>Please login at <a href="${loginUrl}">TaskScout</a>.</p>
      <p>For security reasons, please change your password after login.</p>
    `,
  });
}