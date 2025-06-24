import { storage } from './storage';
import { emailService } from './email-service';
import * as cron from 'node-cron';

interface EventReminderEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class CalendarEmailService {
  private isSchedulerRunning = false;

  /**
   * Initialize the calendar email reminder scheduler
   */
  public initializeReminderScheduler(): void {
    if (this.isSchedulerRunning) {
      console.log('Calendar reminder scheduler is already running');
      return;
    }

    // Check for pending reminders every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.processEventReminders();
      } catch (error) {
        console.error('Error processing event reminders:', error);
      }
    });

    this.isSchedulerRunning = true;
    console.log('Calendar reminder scheduler initialized - checking every 5 minutes');
  }

  /**
   * Process pending event reminders and send emails
   */
  private async processEventReminders(): Promise<void> {
    try {
      const pendingReminders = await storage.getPendingReminders();
      console.log(`Found ${pendingReminders.length} pending calendar reminders`);

      for (const reminder of pendingReminders) {
        try {
          await this.sendEventReminderEmail(reminder);
          await storage.markReminderAsSent(reminder.id);
          console.log(`Sent calendar reminder for event "${reminder.event.title}" to ${reminder.user.name}`);
        } catch (error) {
          console.error(`Failed to send calendar reminder for event ${reminder.event.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing calendar reminders:', error);
    }
  }

  /**
   * Send event reminder email
   */
  private async sendEventReminderEmail(reminder: any): Promise<void> {
    const { event, user, minutesBefore, reminderType } = reminder;
    
    if (!user.email) {
      console.log(`No email address for user ${user.name}, skipping email reminder`);
      return;
    }

    if (reminderType === 'notification') {
      // Only in-app notification, no email
      return;
    }

    const eventStartTime = new Date(event.startDate);
    const formattedDate = eventStartTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = event.allDay ? 'All Day' : eventStartTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const timeUntilEvent = this.formatTimeUntilEvent(minutesBefore);
    
    const subject = `Reminder: ${event.title} in ${timeUntilEvent}`;
    
    const html = this.generateReminderEmailHTML(event, user, formattedDate, formattedTime, timeUntilEvent);
    const text = this.generateReminderEmailText(event, user, formattedDate, formattedTime, timeUntilEvent);

    await emailService.sendEmail({
      to: user.email,
      subject,
      html,
      text
    });
  }

  /**
   * Send event invitation email
   */
  public async sendEventInvitationEmail(eventId: number, attendeeIds: number[], inviterId: number): Promise<void> {
    try {
      const event = await storage.getCalendarEventById(eventId);
      const inviter = await storage.getUserById(inviterId);
      
      if (!event || !inviter) {
        throw new Error('Event or inviter not found');
      }

      for (const attendeeId of attendeeIds) {
        const attendee = await storage.getUserById(attendeeId);
        if (attendee && attendee.email) {
          await this.sendSingleInvitationEmail(event, attendee, inviter);
        }
      }
    } catch (error) {
      console.error('Error sending event invitation emails:', error);
      throw error;
    }
  }

  /**
   * Send single invitation email
   */
  private async sendSingleInvitationEmail(event: any, attendee: any, inviter: any): Promise<void> {
    const eventStartTime = new Date(event.startDate);
    const formattedDate = eventStartTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = event.allDay ? 'All Day' : eventStartTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const subject = `Invitation: ${event.title} on ${formattedDate}`;
    
    const html = this.generateInvitationEmailHTML(event, attendee, inviter, formattedDate, formattedTime);
    const text = this.generateInvitationEmailText(event, attendee, inviter, formattedDate, formattedTime);

    await emailService.sendEmail({
      to: attendee.email,
      subject,
      html,
      text
    });
  }

  /**
   * Send event update notification email
   */
  public async sendEventUpdateEmail(eventId: number): Promise<void> {
    try {
      const event = await storage.getCalendarEventById(eventId);
      if (!event || !event.attendees) return;

      const eventStartTime = new Date(event.startDate);
      const formattedDate = eventStartTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = event.allDay ? 'All Day' : eventStartTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      for (const attendee of event.attendees) {
        if (attendee.user && attendee.user.email) {
          const subject = `Event Updated: ${event.title}`;
          const html = this.generateUpdateEmailHTML(event, attendee.user, formattedDate, formattedTime);
          const text = this.generateUpdateEmailText(event, attendee.user, formattedDate, formattedTime);

          await emailService.sendEmail({
            to: attendee.user.email,
            subject,
            html,
            text
          });
        }
      }
    } catch (error) {
      console.error('Error sending event update emails:', error);
    }
  }

  /**
   * Format time until event for display
   */
  private formatTimeUntilEvent(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Generate reminder email HTML
   */
  private generateReminderEmailHTML(event: any, user: any, formattedDate: string, formattedTime: string, timeUntilEvent: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; color: #374151; }
          .value { color: #6b7280; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Event Reminder</h1>
            <p>Your event "${event.title}" is starting in ${timeUntilEvent}</p>
          </div>
          
          <div class="content">
            <p>Hello ${user.name},</p>
            
            <p>This is a friendly reminder about your upcoming event:</p>
            
            <div class="event-details">
              <h3 style="margin-top: 0; color: #1f2937;">${event.title}</h3>
              
              <div class="detail-row">
                <span class="label">📅 Date:</span>
                <span class="value">${formattedDate}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">🕐 Time:</span>
                <span class="value">${formattedTime}</span>
              </div>
              
              ${event.location ? `
              <div class="detail-row">
                <span class="label">📍 Location:</span>
                <span class="value">${event.location}</span>
              </div>
              ` : ''}
              
              ${event.description ? `
              <div class="detail-row">
                <span class="label">📝 Description:</span>
                <span class="value">${event.description}</span>
              </div>
              ` : ''}
            </div>
            
            <p>Don't forget to prepare for your event!</p>
          </div>
          
          <div class="footer">
            <p>This reminder was sent from your Promellon Calendar</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate reminder email text
   */
  private generateReminderEmailText(event: any, user: any, formattedDate: string, formattedTime: string, timeUntilEvent: string): string {
    return `
EVENT REMINDER

Hello ${user.name},

Your event "${event.title}" is starting in ${timeUntilEvent}.

Event Details:
- Title: ${event.title}
- Date: ${formattedDate}
- Time: ${formattedTime}
${event.location ? `- Location: ${event.location}` : ''}
${event.description ? `- Description: ${event.description}` : ''}

Don't forget to prepare for your event!

---
This reminder was sent from your Promellon Calendar
    `;
  }

  /**
   * Generate invitation email HTML
   */
  private generateInvitationEmailHTML(event: any, attendee: any, inviter: any, formattedDate: string, formattedTime: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; color: #374151; }
          .value { color: #6b7280; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 10px 20px 0; }
          .button-decline { background: #ef4444; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Event Invitation</h1>
            <p>You're invited to "${event.title}"</p>
          </div>
          
          <div class="content">
            <p>Hello ${attendee.name},</p>
            
            <p>${inviter.name} has invited you to the following event:</p>
            
            <div class="event-details">
              <h3 style="margin-top: 0; color: #1f2937;">${event.title}</h3>
              
              <div class="detail-row">
                <span class="label">📅 Date:</span>
                <span class="value">${formattedDate}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">🕐 Time:</span>
                <span class="value">${formattedTime}</span>
              </div>
              
              ${event.location ? `
              <div class="detail-row">
                <span class="label">📍 Location:</span>
                <span class="value">${event.location}</span>
              </div>
              ` : ''}
              
              ${event.description ? `
              <div class="detail-row">
                <span class="label">📝 Description:</span>
                <span class="value">${event.description}</span>
              </div>
              ` : ''}
              
              <div class="detail-row">
                <span class="label">👤 Organizer:</span>
                <span class="value">${inviter.name}</span>
              </div>
            </div>
            
            <p>Please respond to this invitation by logging into your calendar.</p>
          </div>
          
          <div class="footer">
            <p>This invitation was sent from Promellon Calendar</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate invitation email text
   */
  private generateInvitationEmailText(event: any, attendee: any, inviter: any, formattedDate: string, formattedTime: string): string {
    return `
EVENT INVITATION

Hello ${attendee.name},

${inviter.name} has invited you to the following event:

Event Details:
- Title: ${event.title}
- Date: ${formattedDate}
- Time: ${formattedTime}
${event.location ? `- Location: ${event.location}` : ''}
${event.description ? `- Description: ${event.description}` : ''}
- Organizer: ${inviter.name}

Please respond to this invitation by logging into your calendar.

---
This invitation was sent from Promellon Calendar
    `;
  }

  /**
   * Generate update email HTML
   */
  private generateUpdateEmailHTML(event: any, attendee: any, formattedDate: string, formattedTime: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Updated</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .event-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .detail-row { margin: 10px 0; }
          .label { font-weight: bold; color: #374151; }
          .value { color: #6b7280; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Event Updated</h1>
            <p>The event "${event.title}" has been updated</p>
          </div>
          
          <div class="content">
            <p>Hello ${attendee.name},</p>
            
            <p>An event you're attending has been updated:</p>
            
            <div class="event-details">
              <h3 style="margin-top: 0; color: #1f2937;">${event.title}</h3>
              
              <div class="detail-row">
                <span class="label">📅 Date:</span>
                <span class="value">${formattedDate}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">🕐 Time:</span>
                <span class="value">${formattedTime}</span>
              </div>
              
              ${event.location ? `
              <div class="detail-row">
                <span class="label">📍 Location:</span>
                <span class="value">${event.location}</span>
              </div>
              ` : ''}
              
              ${event.description ? `
              <div class="detail-row">
                <span class="label">📝 Description:</span>
                <span class="value">${event.description}</span>
              </div>
              ` : ''}
            </div>
            
            <p>Please check your calendar for the latest details.</p>
          </div>
          
          <div class="footer">
            <p>This update notification was sent from Promellon Calendar</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate update email text
   */
  private generateUpdateEmailText(event: any, attendee: any, formattedDate: string, formattedTime: string): string {
    return `
EVENT UPDATED

Hello ${attendee.name},

An event you're attending has been updated:

Updated Event Details:
- Title: ${event.title}
- Date: ${formattedDate}
- Time: ${formattedTime}
${event.location ? `- Location: ${event.location}` : ''}
${event.description ? `- Description: ${event.description}` : ''}

Please check your calendar for the latest details.

---
This update notification was sent from Promellon Calendar
    `;
  }
}

export const calendarEmailService = new CalendarEmailService();