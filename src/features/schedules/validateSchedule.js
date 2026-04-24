import { scheduleConfig } from '../../config/appConfig';
import { toDate } from '../../lib/dateUtils';
import { isCurrentTimeWithinSchedule } from '../../lib/timeUtils';

export const isScheduleActive = (schedule, now = new Date()) => {
  const startTime = toDate(schedule[scheduleConfig.startTimeField]);
  console.log("Start time: ", startTime);
  const endTime = toDate(schedule[scheduleConfig.endTimeField]);
  console.log("End time: ", endTime);
  const isRecurring = Boolean(schedule[scheduleConfig.isRecurringField]);
  console.log("Is recurring: ", isRecurring);

  if (!startTime || !endTime) {
    return false;
  }

  if (isRecurring) {
    return (
      schedule[scheduleConfig.dayOfWeekField] === now.getDay()
      && isCurrentTimeWithinSchedule({ now, startTime, endTime, isRecurring: true })
    );
  }

  return isCurrentTimeWithinSchedule({ now, startTime, endTime, isRecurring: false });
};
