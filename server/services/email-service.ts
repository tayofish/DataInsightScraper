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
  console.log('Sending task creation notification for task:', {
    taskId: task.id,
    title: task.title,
    assigneeId: assignee?.id,
    assigneeEmail: assignee?.email,
    creatorId: creator?.id,
    teamSize: projectTeam?.length
  });
  
  // Notify assignee if assigned
  if (assignee && assignee.email) {
    const assigneeName = assignee.name || assignee.username || 'User';
    const creatorName = creator?.name || creator?.username || 'Admin';
    
    await sendEmail({
      to: assignee.email,
      subject: `[TaskScout] New task assigned: ${task.title}`,
      html: `
        <h2>New Task Assigned</h2>
        <p>Hello ${assigneeName},</p>
        <p>A new task has been assigned to you:</p>
        <p><strong>${task.title}</strong></p>
        <p>${task.description || ''}</p>
        <p>Priority: ${task.priority}</p>
        <p>Due date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</p>
        <p>Created by: ${creatorName}</p>
        <p><a href="${taskUrl}">View Task</a></p>
      `,
    });
  } else if (assignee) {
    console.log('Assignee has no email address:', assignee);
  }
  
  // Notify project team
  if (projectTeam && projectTeam.length > 0) {
    console.log(`Sending notifications to ${projectTeam.length} team members`);
    
    for (const member of projectTeam) {
      // Skip notification for assignee (already notified) and creator
      if ((assignee && member.id === assignee.id) || member.id === creator.id || !member.email) {
        continue;
      }
      
      const memberName = member.name || member.username || 'Team Member';
      const creatorName = creator?.name || creator?.username || 'Admin';
      const assigneeName = assignee ? (assignee.name || assignee.username || 'User') : 'Unassigned';
      
      await sendEmail({
        to: member.email,
        subject: `[TaskScout] New task created in your project: ${task.title}`,
        html: `
          <h2>New Task Created</h2>
          <p>Hello ${memberName},</p>
          <p>A new task has been created in your project:</p>
          <p><strong>${task.title}</strong></p>
          <p>${task.description || ''}</p>
          <p>Priority: ${task.priority}</p>
          <p>Due date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</p>
          <p>Created by: ${creatorName}</p>
          <p>Assigned to: ${assigneeName}</p>
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
  if (!assignee || !assignee.email) {
    console.log('Cannot send task assignment notification: assignee missing or has no email', {
      taskId: task?.id,
      assigneeId: assignee?.id,
      hasEmail: Boolean(assignee?.email)
    });
    return;
  }
  
  console.log('Sending task assignment notification:', {
    taskId: task.id,
    assigneeId: assignee.id,
    assigneeEmail: assignee.email,
    assignedById: assignedBy?.id
  });
  
  const taskUrl = `${process.env.APP_URL || ''}/tasks?id=${task.id}`;
  const assigneeName = assignee.name || assignee.username || 'User';
  const assignerName = assignedBy?.name || assignedBy?.username || 'Admin';
  
  await sendEmail({
    to: assignee.email,
    subject: `[TaskScout] You've been assigned a task: ${task.title}`,
    html: `
      <h2>Task Assignment</h2>
      <p>Hello ${assigneeName},</p>
      <p>You have been assigned to a task by ${assignerName}:</p>
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
  if (!mentionedUser || !mentionedUser.email) {
    console.log('Cannot send mention notification: mentioned user missing or has no email', {
      taskId: task?.id,
      mentionedUserId: mentionedUser?.id,
      hasEmail: Boolean(mentionedUser?.email)
    });
    return;
  }
  
  console.log('Sending mention notification:', {
    taskId: task.id,
    mentionedUserId: mentionedUser.id,
    mentionedUserEmail: mentionedUser.email,
    mentionedById: mentionedBy?.id
  });
  
  const taskUrl = `${process.env.APP_URL || ''}/tasks?id=${task.id}`;
  const userName = mentionedUser.name || mentionedUser.username || 'User';
  const mentionerName = mentionedBy?.name || mentionedBy?.username || 'Admin';
  
  await sendEmail({
    to: mentionedUser.email,
    subject: `[TaskScout] You were mentioned in a task: ${task.title}`,
    html: `
      <h2>Mention in Task</h2>
      <p>Hello ${userName},</p>
      <p>${mentionerName} mentioned you in a task:</p>
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
  if (!notifyUsers || notifyUsers.length === 0) {
    console.log('No users to notify about comment');
    return;
  }
  
  console.log('Sending comment notifications:', {
    taskId: task.id,
    commenterUserId: commentBy?.id,
    numberOfUsersToNotify: notifyUsers.length,
    commentPreview: comment.substring(0, 20) + (comment.length > 20 ? '...' : '')
  });
  
  const taskUrl = `${process.env.APP_URL || ''}/tasks?id=${task.id}`;
  const commenterName = commentBy?.name || commentBy?.username || 'Admin';
  let emailsSent = 0;
  
  for (const user of notifyUsers) {
    // Don't notify the commenter about their own comment
    if (user.id === commentBy.id || !user.email) {
      console.log(`Skipping notification for user ${user.id}: ${!user.email ? 'no email' : 'is commenter'}`);
      continue;
    }
    
    const userName = user.name || user.username || 'User';
    
    try {
      await sendEmail({
        to: user.email,
        subject: `[TaskScout] New comment on task: ${task.title}`,
        html: `
          <h2>New Comment on Task</h2>
          <p>Hello ${userName},</p>
          <p>${commenterName} commented on a task:</p>
          <p><strong>${task.title}</strong></p>
          <p>Comment: ${comment}</p>
          <p><a href="${taskUrl}">View Task</a></p>
        `,
      });
      emailsSent++;
    } catch (err) {
      console.error(`Failed to send comment notification to user ${user.id}:`, err);
    }
  }
  
  console.log(`Sent ${emailsSent} comment notification emails`);
}

/**
 * Send notification for new user creation
 */
export async function notifyUserCreation(user: any, password: string | null, admin: any) {
  if (!user || !user.email) {
    console.log('Cannot send user creation notification: user missing or has no email', {
      userId: user?.id,
      hasEmail: Boolean(user?.email)
    });
    return;
  }
  
  console.log('Sending user creation notification:', {
    userId: user.id,
    userEmail: user.email,
    adminId: admin?.id
  });
  
  const loginUrl = `${process.env.APP_URL || ''}/auth`;
  const userName = user.name || user.username || 'User';
  const adminName = admin?.name || admin?.username || 'Administrator';
  
  await sendEmail({
    to: user.email,
    subject: `[TaskScout] Welcome to TaskScout - Account Created`,
    html: `
      <h2>Welcome to TaskScout</h2>
      <p>Hello ${userName},</p>
      <p>Your account has been created by ${adminName}.</p>
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
  if (!user || !user.email) {
    console.log('Cannot send password reset notification: user missing or has no email', {
      userId: user?.id,
      hasEmail: Boolean(user?.email)
    });
    return;
  }
  
  console.log('Sending password reset notification:', {
    userId: user.id,
    userEmail: user.email
  });
  
  const loginUrl = `${process.env.APP_URL || ''}/auth`;
  const userName = user.name || user.username || 'User';
  
  await sendEmail({
    to: user.email,
    subject: `[TaskScout] Your Password Has Been Reset`,
    html: `
      <h2>Password Reset</h2>
      <p>Hello ${userName},</p>
      <p>Your password has been reset.</p>
      <p>Your new password is: ${newPassword}</p>
      <p>Please login at <a href="${loginUrl}">TaskScout</a>.</p>
      <p>For security reasons, please change your password after login.</p>
    `,
  });
}