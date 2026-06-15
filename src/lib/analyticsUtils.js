import { scheduleConfig, studentAuthConfig, timeLogConfig } from '../config/appConfig';
import { isScheduleActive } from '../features/schedules/validateSchedule';
import {
  MILLISECONDS_PER_MINUTE,
  MINUTES_PER_HOUR,
  MISSING_VALUE_LABEL,
} from './constants';
import { toDate } from './dateUtils';

const UNKNOWN_STUDENT_NAME = 'Unknown student';
const UNCATEGORIZED_TASK_NAME = 'Uncategorized';

const padDatePart = (value) => String(value).padStart(2, '0');
const normalizeTaskNameKey = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

export const isExtraHoursTaskName = (value) => {
  const taskNameKey = normalizeTaskNameKey(value);

  return Boolean(taskNameKey) && (
    taskNameKey === 'extrahours'
    || taskNameKey === 'extratime'
    || taskNameKey === normalizeTaskNameKey(timeLogConfig.extraTimeTaskName)
  );
};

export const formatTaskName = (value, fallback = UNCATEGORIZED_TASK_NAME) => {
  const taskName = String(value ?? '').trim();

  if (!taskName) {
    return fallback;
  }

  if (isExtraHoursTaskName(taskName)) {
    return timeLogConfig.extraTimeTaskName;
  }

  return taskName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
};

export const formatDateKey = (value) => {
  const date = toDate(value);

  if (!date) {
    return '';
  }

  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
};

export const getStartOfDay = (value) => {
  const date = typeof value === 'string' && value
    ? new Date(`${value}T00:00:00`)
    : toDate(value);

  if (!date) {
    return null;
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  return startOfDay;
};

export const getEndOfDay = (value) => {
  const date = typeof value === 'string' && value
    ? new Date(`${value}T00:00:00`)
    : toDate(value);

  if (!date) {
    return null;
  }

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return endOfDay;
};

const getLogDate = (log) => (
  toDate(log?.[timeLogConfig.signInAtField])
  ?? toDate(log?.[timeLogConfig.createdAtField])
);

export const getLogsInDateRange = (logs, startDate, endDate) => {
  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);

  if (!start || !end) {
    return [];
  }

  return logs.filter((log) => {
    const logDate = getLogDate(log);

    return Boolean(logDate && logDate >= start && logDate <= end);
  });
};

export const getDurationMinutes = (log) => {
  const storedDuration = Number(log?.[timeLogConfig.durationMinutesField]);

  if (Number.isFinite(storedDuration) && storedDuration > 0) {
    return storedDuration;
  }

  const signInAt = toDate(log?.[timeLogConfig.signInAtField]);
  const signOutAt = toDate(log?.[timeLogConfig.signOutAtField]);

  if (!signInAt || !signOutAt) {
    return 0;
  }

  const calculatedDuration = Math.round(
    (signOutAt.getTime() - signInAt.getTime()) / MILLISECONDS_PER_MINUTE,
  );

  return Number.isFinite(calculatedDuration) ? Math.max(0, calculatedDuration) : 0;
};

export const isCompletedLog = (log) => {
  return (
    log?.[timeLogConfig.statusField] === timeLogConfig.completedStatus
    && Boolean(toDate(log?.[timeLogConfig.signOutAtField]) || getLogDate(log))
    && getDurationMinutes(log) > 0
  );
};

export const minutesToHours = (minutes) => {
  const safeMinutes = Number(minutes);

  if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) {
    return 0;
  }

  return Number((safeMinutes / MINUTES_PER_HOUR).toFixed(1));
};

export const formatHours = (hours, fractionDigits = 1) => (
  Number(hours || 0).toFixed(fractionDigits)
);

const getStudentKey = (log) => {
  const studentDocId = String(log?.[timeLogConfig.studentDocIdField] ?? '').trim();
  const studentId = String(log?.[timeLogConfig.studentIdField] ?? '').trim();
  const studentName = String(log?.[timeLogConfig.studentNameField] ?? '').trim();

  if (studentDocId) {
    return `doc:${studentDocId}`;
  }

  if (studentId) {
    return `student:${studentId}`;
  }

  return `name:${studentName || UNKNOWN_STUDENT_NAME}`;
};

const getStudentDisplay = (log) => ({
  studentKey: getStudentKey(log),
  studentName: String(log?.[timeLogConfig.studentNameField] ?? '').trim() || UNKNOWN_STUDENT_NAME,
  studentId: String(log?.[timeLogConfig.studentIdField] ?? '').trim() || MISSING_VALUE_LABEL,
});

const getRosterStudentDisplay = (student) => {
  const studentDocId = String(student?.id ?? '').trim();
  const studentId = String(student?.[studentAuthConfig.idField] ?? '').trim();
  const studentName = String(student?.name ?? '').trim();

  return {
    studentKey: studentDocId
      ? `doc:${studentDocId}`
      : `student:${studentId || studentName || UNKNOWN_STUDENT_NAME}`,
    studentName: studentName || UNKNOWN_STUDENT_NAME,
    studentId: studentId || MISSING_VALUE_LABEL,
  };
};

const getCategoryKey = (log) => {
  const taskId = String(log?.[timeLogConfig.taskIdField] ?? '').trim();
  const taskName = String(log?.[timeLogConfig.taskNameField] ?? '').trim();

  if (taskId) {
    return `task:${taskId}`;
  }

  if (isExtraHoursTaskName(taskName)) {
    return 'task-name:extra-hours';
  }

  return `task-name:${taskName || UNCATEGORIZED_TASK_NAME}`;
};

const getCategoryDisplay = (log) => ({
  categoryKey: getCategoryKey(log),
  taskName: formatTaskName(log?.[timeLogConfig.taskNameField]),
});

const getCompletedLogs = (logs) => logs.filter(isCompletedLog);

const sortByMinutesDescending = (left, right) => (
  right.totalMinutes - left.totalMinutes
  || left.name.localeCompare(right.name)
);

export const calculateStudentHourTotals = (logs) => {
  const studentTotals = new Map();
  const completedLogs = getCompletedLogs(logs);

  completedLogs.forEach((log) => {
    const durationMinutes = getDurationMinutes(log);
    const student = getStudentDisplay(log);
    const existingStudent = studentTotals.get(student.studentKey) ?? {
      ...student,
      name: student.studentName,
      totalMinutes: 0,
      logCount: 0,
    };

    studentTotals.set(student.studentKey, {
      ...existingStudent,
      studentName: existingStudent.studentName === UNKNOWN_STUDENT_NAME
        ? student.studentName
        : existingStudent.studentName,
      studentId: existingStudent.studentId === MISSING_VALUE_LABEL
        ? student.studentId
        : existingStudent.studentId,
      totalMinutes: existingStudent.totalMinutes + durationMinutes,
      logCount: existingStudent.logCount + 1,
    });
  });

  const students = Array.from(studentTotals.values())
    .map((student) => ({
      ...student,
      totalHours: minutesToHours(student.totalMinutes),
    }))
    .sort(sortByMinutesDescending);
  const totalMinutes = students.reduce((sum, student) => sum + student.totalMinutes, 0);
  const activeStudentCount = students.length;

  return {
    totalMinutes,
    totalTeamHours: minutesToHours(totalMinutes),
    activeStudentCount,
    averageHoursPerStudent: activeStudentCount > 0
      ? minutesToHours(totalMinutes / activeStudentCount)
      : 0,
    students,
  };
};

const getWeekStartDate = (value) => {
  const date = toDate(value);

  if (!date) {
    return null;
  }

  const weekStart = new Date(date);
  const daysSinceMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  return weekStart;
};

export const calculateTeamHoursOverTime = (logs) => {
  const weekTotals = new Map();

  getCompletedLogs(logs).forEach((log) => {
    const weekStartDate = getWeekStartDate(getLogDate(log));

    if (!weekStartDate) {
      return;
    }

    const weekStart = formatDateKey(weekStartDate);
    const existingWeek = weekTotals.get(weekStart) ?? {
      weekStart,
      weekStartDate,
      totalMinutes: 0,
      logCount: 0,
    };

    weekTotals.set(weekStart, {
      ...existingWeek,
      totalMinutes: existingWeek.totalMinutes + getDurationMinutes(log),
      logCount: existingWeek.logCount + 1,
    });
  });

  const weeks = Array.from(weekTotals.values())
    .map((week) => ({
      ...week,
      totalHours: minutesToHours(week.totalMinutes),
    }))
    .sort((left, right) => left.weekStartDate - right.weekStartDate);

  return {
    weeks,
    totalMinutes: weeks.reduce((sum, week) => sum + week.totalMinutes, 0),
  };
};

export const calculateHoursByCategory = (logs) => {
  const categoryTotals = new Map();

  getCompletedLogs(logs).forEach((log) => {
    const category = getCategoryDisplay(log);
    const existingCategory = categoryTotals.get(category.categoryKey) ?? {
      ...category,
      name: category.taskName,
      totalMinutes: 0,
      logCount: 0,
    };

    categoryTotals.set(category.categoryKey, {
      ...existingCategory,
      taskName: existingCategory.taskName === UNCATEGORIZED_TASK_NAME
        ? category.taskName
        : existingCategory.taskName,
      totalMinutes: existingCategory.totalMinutes + getDurationMinutes(log),
      logCount: existingCategory.logCount + 1,
    });
  });

  const totalMinutes = Array.from(categoryTotals.values())
    .reduce((sum, category) => sum + category.totalMinutes, 0);
  const categories = Array.from(categoryTotals.values())
    .map((category) => ({
      ...category,
      totalHours: minutesToHours(category.totalMinutes),
      percentage: totalMinutes > 0
        ? Math.round((category.totalMinutes / totalMinutes) * 100)
        : 0,
    }))
    .sort(sortByMinutesDescending);

  return {
    totalMinutes,
    totalHours: minutesToHours(totalMinutes),
    categories,
  };
};

export const calculateStudentCategoryBreakdown = (logs, studentKey) => {
  const matchingLogs = getCompletedLogs(logs).filter((log) => getStudentKey(log) === studentKey);
  const categorySummary = calculateHoursByCategory(matchingLogs);
  const student = matchingLogs.length > 0 ? getStudentDisplay(matchingLogs[0]) : null;

  return {
    student,
    totalMinutes: categorySummary.totalMinutes,
    totalHours: categorySummary.totalHours,
    categories: categorySummary.categories.map((category) => ({
      ...category,
      percentage: categorySummary.totalMinutes > 0
        ? Math.round((category.totalMinutes / categorySummary.totalMinutes) * 100)
        : 0,
    })),
  };
};

const logMatchesAttendanceSchedule = (log, schedules) => {
  const taskId = String(log?.[timeLogConfig.taskIdField] ?? '').trim();
  const signInAt = toDate(log?.[timeLogConfig.signInAtField]);

  if (!taskId || !signInAt) {
    return false;
  }

  return schedules.some((schedule) => (
    String(schedule?.[scheduleConfig.taskIdField] ?? '').trim() === taskId
    && schedule?.[scheduleConfig.countsForAttendanceField] !== false
    && isScheduleActive(schedule, signInAt)
  ));
};

export const calculateAttendanceAnalytics = (logs, schedules = [], students = []) => {
  const meetingDaysByDate = new Map();
  const studentsByKey = new Map(students.map((student) => {
    const studentDisplay = getRosterStudentDisplay(student);

    return [
      studentDisplay.studentKey,
      {
        ...studentDisplay,
        daysAttended: new Set(),
      },
    ];
  }));

  logs.forEach((log) => {
    if (!logMatchesAttendanceSchedule(log, schedules)) {
      return;
    }

    const signInAt = toDate(log?.[timeLogConfig.signInAtField]);

    if (!signInAt) {
      return;
    }

    const dateKey = formatDateKey(signInAt);
    const student = getStudentDisplay(log);
    const studentAttendance = studentsByKey.get(student.studentKey) ?? {
      ...student,
      daysAttended: new Set(),
    };
    const meetingDay = meetingDaysByDate.get(dateKey) ?? {
      date: dateKey,
      dateValue: new Date(signInAt.getFullYear(), signInAt.getMonth(), signInAt.getDate()),
      studentKeys: new Set(),
      attendeesByKey: new Map(),
      totalMinutes: 0,
      completedLogCount: 0,
      incompleteLogCount: 0,
    };
    const attendee = meetingDay.attendeesByKey.get(student.studentKey) ?? {
      ...student,
      completedLogCount: 0,
      incompleteLogCount: 0,
      logs: [],
      totalMinutes: 0,
    };

    meetingDay.studentKeys.add(student.studentKey);
    studentAttendance.daysAttended.add(dateKey);

    if (isCompletedLog(log)) {
      const durationMinutes = getDurationMinutes(log);

      meetingDay.totalMinutes += durationMinutes;
      meetingDay.completedLogCount += 1;
      attendee.totalMinutes += durationMinutes;
      attendee.completedLogCount += 1;
    } else {
      meetingDay.incompleteLogCount += 1;
      attendee.incompleteLogCount += 1;
    }

    attendee.logs.push(log);
    meetingDay.attendeesByKey.set(student.studentKey, attendee);
    meetingDaysByDate.set(dateKey, meetingDay);
    studentsByKey.set(student.studentKey, studentAttendance);
  });

  const meetingDays = Array.from(meetingDaysByDate.values())
    .map((meetingDay) => {
      const attendees = Array.from(meetingDay.attendeesByKey.values())
        .sort((left, right) => left.studentName.localeCompare(right.studentName));

      return {
        date: meetingDay.date,
        dateValue: meetingDay.dateValue,
        totalMinutes: meetingDay.totalMinutes,
        completedLogCount: meetingDay.completedLogCount,
        incompleteLogCount: meetingDay.incompleteLogCount,
        studentsAttended: meetingDay.studentKeys.size,
        totalHours: minutesToHours(meetingDay.totalMinutes),
        attendees,
      };
    })
    .sort((left, right) => left.dateValue - right.dateValue);
  const totalMeetingDays = meetingDays.length;
  const totalAttendanceCount = meetingDays.reduce(
    (sum, meetingDay) => sum + meetingDay.studentsAttended,
    0,
  );
  const sortedByAttendance = [...meetingDays].sort((left, right) => (
    right.studentsAttended - left.studentsAttended
    || left.dateValue - right.dateValue
  ));
  const lowestAttendanceDay = [...meetingDays].sort((left, right) => (
    left.studentsAttended - right.studentsAttended
    || left.dateValue - right.dateValue
  ))[0] ?? null;
  const studentAttendance = Array.from(studentsByKey.values())
    .map((student) => {
      const meetingHistory = meetingDays.map((meetingDay) => {
        const attendee = meetingDay.attendees.find(
          (meetingAttendee) => meetingAttendee.studentKey === student.studentKey,
        );

        return {
          date: meetingDay.date,
          dateValue: meetingDay.dateValue,
          attended: Boolean(attendee),
          totalMinutes: attendee?.totalMinutes ?? 0,
          incompleteLogCount: attendee?.incompleteLogCount ?? 0,
        };
      });

      return {
        ...student,
        daysAttended: student.daysAttended.size,
        attendanceRate: totalMeetingDays > 0
          ? Math.round((student.daysAttended.size / totalMeetingDays) * 100)
          : 0,
        meetingHistory,
      };
    })
    .sort((left, right) => (
      right.daysAttended - left.daysAttended
      || left.studentName.localeCompare(right.studentName)
    ));

  return {
    totalMeetingDays,
    averageStudentsPerMeetingDay: totalMeetingDays > 0
      ? Number((totalAttendanceCount / totalMeetingDays).toFixed(1))
      : 0,
    highestAttendanceDay: sortedByAttendance[0] ?? null,
    lowestAttendanceDay,
    meetingDays,
    students: studentAttendance,
  };
};
