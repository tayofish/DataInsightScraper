import * as cron from 'node-cron';
import { db } from '@db';
import { appSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as emailService from './email-service';

let scheduledTask: cron.ScheduledTask | null = null;

interface SchedulerConfig {
  enabled: boolean;
  time: string; // Format: "HH:MM" (24-hour format)
  timezone: string;
}

export async function getSchedulerConfig(): Promise<SchedulerConfig> {
  try {
    const enabledSetting = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'scheduler_enabled')
    });

    const timeSetting = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'scheduler_time')
    });

    const timezoneSetting = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, 'scheduler_timezone')
    });

    return {
      enabled: enabledSetting?.value === 'true',
      time: timeSetting?.value || '18:00', // Default to 6 PM
      timezone: timezoneSetting?.value || 'UTC'
    };
  } catch (error) {
    console.error('Error fetching scheduler config:', error);
    return {
      enabled: false,
      time: '18:00',
      timezone: 'UTC'
    };
  }
}

export async function updateSchedulerConfig(config: Partial<SchedulerConfig>): Promise<void> {
  try {
    if (config.enabled !== undefined) {
      const enabledSetting = await db.query.appSettings.findFirst({
        where: eq(appSettings.key, 'scheduler_enabled')
      });

      if (enabledSetting) {
        await db.update(appSettings)
          .set({ value: config.enabled ? 'true' : 'false' })
          .where(eq(appSettings.id, enabledSetting.id));
      } else {
        await db.insert(appSettings).values({
          key: 'scheduler_enabled',
          value: config.enabled ? 'true' : 'false',
          description: 'Enable/disable automatic end-of-day email scheduler'
        });
      }
    }

    if (config.time !== undefined) {
      const timeSetting = await db.query.appSettings.findFirst({
        where: eq(appSettings.key, 'scheduler_time')
      });

      if (timeSetting) {
        await db.update(appSettings)
          .set({ value: config.time })
          .where(eq(appSettings.id, timeSetting.id));
      } else {
        await db.insert(appSettings).values({
          key: 'scheduler_time',
          value: config.time,
          description: 'Time for automatic end-of-day email notifications (HH:MM format)'
        });
      }
    }

    if (config.timezone !== undefined) {
      const timezoneSetting = await db.query.appSettings.findFirst({
        where: eq(appSettings.key, 'scheduler_timezone')
      });

      if (timezoneSetting) {
        await db.update(appSettings)
          .set({ value: config.timezone })
          .where(eq(appSettings.id, timezoneSetting.id));
      } else {
        await db.insert(appSettings).values({
          key: 'scheduler_timezone',
          value: config.timezone,
          description: 'Timezone for automatic end-of-day email notifications'
        });
      }
    }

    // Restart scheduler with new config
    await restartScheduler();
  } catch (error) {
    console.error('Error updating scheduler config:', error);
    throw error;
  }
}

function createCronExpression(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${minutes} ${hours} * * *`; // Daily at specified time
}

async function executeScheduledTask(): Promise<void> {
  try {
    console.log('Executing scheduled end-of-day notifications...');
    await emailService.sendEndOfDayNotifications();
    console.log('Scheduled end-of-day notifications completed successfully');
  } catch (error) {
    console.error('Error executing scheduled task:', error);
  }
}

export async function startScheduler(): Promise<void> {
  try {
    const config = await getSchedulerConfig();
    
    if (!config.enabled) {
      console.log('End-of-day email scheduler is disabled');
      return;
    }

    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
    }

    const cronExpression = createCronExpression(config.time);
    
    scheduledTask = cron.schedule(cronExpression, executeScheduledTask, {
      scheduled: true,
      timezone: config.timezone
    });

    console.log(`End-of-day email scheduler started: ${config.time} ${config.timezone} (${cronExpression})`);
  } catch (error) {
    console.error('Error starting scheduler:', error);
  }
}

export async function stopScheduler(): Promise<void> {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('End-of-day email scheduler stopped');
  }
}

export async function restartScheduler(): Promise<void> {
  await stopScheduler();
  await startScheduler();
}

export function getSchedulerStatus(): { running: boolean; nextRun?: string } {
  if (!scheduledTask) {
    return { running: false };
  }

  try {
    // Get next execution time if possible
    return {
      running: true,
      nextRun: 'Check admin dashboard for schedule details'
    };
  } catch (error) {
    return { running: true };
  }
}

// Initialize scheduler on module load
export async function initializeScheduler(): Promise<void> {
  console.log('Initializing end-of-day email scheduler...');
  await startScheduler();
}