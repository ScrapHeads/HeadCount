import React, { useEffect, useMemo, useState } from 'react';
import { timeLogConfig } from '../../config/appConfig';
import { useSchedules } from '../../features/schedules/useSchedules';
import { useStudents } from '../../features/students/useStudents';
import { useAnalyticsTimeLogs } from '../../features/timeLogs/useAnalyticsTimeLogs';
import {
  calculateAttendanceAnalytics,
  calculateHoursByCategory,
  calculateStudentCategoryBreakdown,
  calculateStudentHourTotals,
  calculateTeamHoursOverTime,
  formatHours,
  getEndOfDay,
  getLogsInDateRange,
  getStartOfDay,
} from '../../lib/analyticsUtils';
import { MINUTES_PER_HOUR, MISSING_VALUE_LABEL } from '../../lib/constants';
import { getDefaultDateRange } from '../../lib/dateUtils';
import {
  filterLogsForCurrentStudents,
  isCurrentMember,
} from '../../lib/studentUtils';
import {
  DASHBOARD_CARD_CLASS_NAME,
  DASHBOARD_TABLE_HEADER_CLASS_NAME,
  FORM_INPUT_CLASS_NAME,
} from '../../styles/classNames';
import CardMessage from '../shared/CardMessage';
import Dropdown from '../shared/Dropdown';
import TimeLogEditorDialog from './TimeLogEditorDialog';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const formatDate = (value, formatter = dateFormatter) => {
  const date = value instanceof Date ? value : getStartOfDay(value);

  return date ? formatter.format(date) : 'Not selected';
};

const formatDuration = (minutes) => {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / MINUTES_PER_HOUR);
  const remainingMinutes = safeMinutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  return remainingMinutes > 0
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
};

const formatStudentCount = (count) => `${count} ${count === 1 ? 'student' : 'students'}`;

const tableCellClassName = 'border-y border-border bg-transparent px-5 py-3 text-on-primary text-center';
const categoryColors = [
  'var(--app-accent)',
  'var(--app-secondary)',
  'color-mix(in oklab, var(--app-primary) 82%, var(--app-on-primary))',
  'color-mix(in oklab, var(--app-accent) 70%, var(--app-secondary))',
  'color-mix(in oklab, var(--app-secondary) 64%, var(--app-on-primary))',
  'color-mix(in oklab, var(--app-primary) 66%, var(--app-accent))',
  'color-mix(in oklab, var(--app-accent) 55%, var(--app-on-primary))',
  'color-mix(in oklab, var(--app-secondary) 48%, var(--app-primary))',
];

const getPiePoint = (center, radius, angleInDegrees) => {
  const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180);

  return {
    x: center + (radius * Math.cos(angleInRadians)),
    y: center + (radius * Math.sin(angleInRadians)),
  };
};

const getPieSlicePath = ({ center, endAngle, radius, startAngle }) => {
  const adjustedEndAngle = endAngle - startAngle >= 360 ? endAngle - 0.01 : endAngle;
  const start = getPiePoint(center, radius, startAngle);
  const end = getPiePoint(center, radius, adjustedEndAngle);
  const largeArcFlag = adjustedEndAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${center} ${center}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
};

const AnalyticsCard = ({
  children,
  description,
  emptyMessage,
  error,
  isEmpty,
  isLoading,
  title,
  cardClassName = DASHBOARD_CARD_CLASS_NAME,
}) => (
  <article className={cardClassName}>
    <div>
      <h3 className="text-lg font-semibold text-on-primary">{title}</h3>
      {description && (
        <p className="mt-2 text-sm leading-6 text-on-primary/90">{description}</p>
      )}
    </div>

    {isLoading ? (
      <CardMessage>Loading analytics...</CardMessage>
    ) : error ? (
      <CardMessage tone="error">{error}</CardMessage>
    ) : isEmpty ? (
      <CardMessage>{emptyMessage}</CardMessage>
    ) : (
      <div className="mt-5">{children}</div>
    )}
  </article>
);

const SummaryMetric = ({ label, value }) => (
  <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-border bg-transparent px-4 py-4 text-center shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-primary/90">{label}</p>
    <p className="mt-2 max-w-full break-words text-xl font-semibold leading-snug text-on-primary/90 sm:text-2xl">{value}</p>
  </div>
);

const SummaryGrid = ({ metrics }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {metrics.map((metric) => (
      <SummaryMetric key={metric.label} {...metric} />
    ))}
  </div>
);

const AnalyticsDateRangeCard = ({
  cardClassName = DASHBOARD_CARD_CLASS_NAME,
  dateRange,
  error,
  onDateChange,
}) => (
  <article className={cardClassName}>
    <div>
      <h3 className="text-lg font-semibold text-on-primary">Analytics Date Range</h3>
      <p className="mt-2 leading-6 text-on-primary/90">
        Showing logs from {formatDate(dateRange.startDate)} through {formatDate(dateRange.endDate)}.
      </p>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-primary">Start date</span>
        <input
          className={FORM_INPUT_CLASS_NAME}
          onChange={(event) => onDateChange('startDate', event.target.value)}
          type="date"
          value={dateRange.startDate}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-primary">End date</span>
        <input
          className={FORM_INPUT_CLASS_NAME}
          onChange={(event) => onDateChange('endDate', event.target.value)}
          type="date"
          value={dateRange.endDate}
        />
      </label>
    </div>

    {error && <CardMessage tone="error">{error}</CardMessage>}
  </article>
);

const StudentHourTotalsCard = ({
  analytics,
  cardClassName,
  error,
  isLoading,
  rangeLabel,
}) => (
  <AnalyticsCard
    description={`Selected range: ${rangeLabel}`}
    emptyMessage="No completed time logs found for this date range."
    error={error}
    isEmpty={analytics.students.length === 0}
    isLoading={isLoading}
    title="Student Hour Totals"
    cardClassName={cardClassName}
  >
    <SummaryGrid
      metrics={[
        { label: 'Total Team Hours', value: formatHours(analytics.totalTeamHours) },
        { label: 'Active Students', value: analytics.activeStudentCount },
        { label: 'Average Hours / Student', value: formatHours(analytics.averageHoursPerStudent) },
      ]}
    />

    <div className="mt-5 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-2">
        <thead>
          <tr>
            <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Student Name</th>
            <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Student ID</th>
            <th className={`${DASHBOARD_TABLE_HEADER_CLASS_NAME} text-right`}>Hours</th>
          </tr>
        </thead>
        <tbody>
          {analytics.students.map((student, index) => (
            <tr key={student.studentKey}>
              <td className={`${tableCellClassName} rounded-l-xl border-l`}>
                <span className="mr-2 text-on-primary/55">#{index + 1}</span>
                <span className="font-semibold">{student.studentName}</span>
              </td>
              <td className={tableCellClassName}>{student.studentId}</td>
              <td className={`${tableCellClassName} rounded-r-xl border-r text-right font-semibold`}>
                {formatHours(student.totalHours)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </AnalyticsCard>
);

const TeamHoursOverTimeCard = ({
  analytics,
  cardClassName,
  error,
  isLoading,
  rangeLabel,
}) => {
  const maxHours = Math.max(...analytics.weeks.map((week) => week.totalHours), 1);

  return (
    <AnalyticsCard
      description={`Weekly completed hours for ${rangeLabel}.`}
      emptyMessage="No completed time logs found for this time period."
      error={error}
      isEmpty={analytics.weeks.length === 0}
      isLoading={isLoading}
      title="Team Hours Over Time"
      cardClassName={cardClassName}
    >
      <div className="space-y-4">
        {analytics.weeks.map((week) => {
          const width = Math.max(4, (week.totalHours / maxHours) * 100);
          const tooltip = `${formatDate(week.weekStartDate)}: ${formatHours(week.totalHours)} hours`;

          return (
            <div key={week.weekStart} title={tooltip}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm text-on-primary">
                <span className="font-medium">{formatDate(week.weekStartDate, shortDateFormatter)}</span>
                <span className="tabular-nums">{formatHours(week.totalHours)} hrs</span>
              </div>
              <div className="h-3 rounded-full bg-secondary/65">
                <div
                  aria-label={tooltip}
                  className="h-3 rounded-full bg-accent"
                  role="img"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </AnalyticsCard>
  );
};

const CategoryProgressList = ({ categories }) => (
  <div className="space-y-4">
    {categories.map((category) => (
      <div key={category.categoryKey}>
        <div className="mb-1 flex items-center justify-between gap-3 text-sm text-on-primary">
          <span className="font-medium">{category.taskName}</span>
          <span className="shrink-0 tabular-nums">
            {formatHours(category.totalHours)} hrs | {category.percentage}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-secondary/65">
          <div
            className="h-3 rounded-full bg-accent"
            style={{ width: `${Math.max(4, category.percentage)}%` }}
          />
        </div>
      </div>
    ))}
  </div>
);

const CategoryPieChart = ({ categories, totalHours, totalMinutes }) => {
  let cumulativeAngle = 0;
  const center = 90;
  const radius = 78;
  const slices = categories.map((category, index) => {
    const sliceAngle = totalMinutes > 0
      ? (category.totalMinutes / totalMinutes) * 360
      : 0;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sliceAngle;

    cumulativeAngle = endAngle;

    return {
      ...category,
      color: categoryColors[index % categoryColors.length],
      path: getPieSlicePath({
        center,
        endAngle,
        radius,
        startAngle,
      }),
    };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] lg:items-center">
      <div className="mx-auto w-full max-w-[320px]">
        <svg
          aria-label={`Hours by category pie chart, ${formatHours(totalHours)} total hours`}
          className="h-auto w-full drop-shadow-lg"
          role="img"
          viewBox="0 0 180 180"
        >
          {slices.map((slice) => (
            <path
              key={slice.categoryKey}
              d={slice.path}
              fill={slice.color}
              stroke="var(--app-on-primary)"
              strokeOpacity="0.7"
              strokeWidth="1.5"
            >
              <title>
                {slice.taskName}: {formatHours(slice.totalHours)} hours, {slice.percentage}%
              </title>
            </path>
          ))}
        </svg>
        <p className="mt-3 text-center text-sm font-semibold text-on-primary">
          {formatHours(totalHours)} total hours
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {slices.map((slice) => (
          <div
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-secondary px-3 py-3"
            key={slice.categoryKey}
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 rounded-full border border-on-secondary/40"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 truncate text-sm font-medium text-on-secondary">
              {slice.taskName}
            </span>
            <span className="shrink-0 text-sm tabular-nums text-on-secondary/85">
              {formatHours(slice.totalHours)} hrs | {slice.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const HoursByCategoryCard = ({
  analytics,
  cardClassName,
  error,
  isLoading,
  rangeLabel,
}) => (
  <AnalyticsCard
    description={`Completed team hours by task for ${rangeLabel}.`}
    emptyMessage="No category data found for this date range."
    error={error}
    isEmpty={analytics.categories.length === 0}
    isLoading={isLoading}
    title="Hours by Category"
    cardClassName={cardClassName}
  >
    <CategoryPieChart
      categories={analytics.categories}
      totalHours={analytics.totalHours}
      totalMinutes={analytics.totalMinutes}
    />
  </AnalyticsCard>
);

const StudentCategoryBreakdownCard = ({
  analytics,
  cardClassName,
  error,
  isLoading,
  onStudentChange,
  selectedStudent,
  selectedStudentKey,
  studentOptions,
}) => {
  const hasStudents = studentOptions.length > 0;
  const emptyMessage = hasStudents
    ? 'No category breakdown is available for this student.'
    : 'No students have completed time logs for this date range.';

  return (
    <AnalyticsCard
      description="Review one student's completed hours by task."
      emptyMessage={emptyMessage}
      error={error}
      isEmpty={!hasStudents || analytics.categories.length === 0}
      isLoading={isLoading}
      title="Student Category Breakdown"
      cardClassName={cardClassName}
    >
      <Dropdown
        className="mb-5"
        label="Student"
        onChange={onStudentChange}
        options={studentOptions.map((student) => ({
          label: `${student.studentName} (${student.studentId})`,
          value: student.studentKey,
        }))}
        value={selectedStudentKey}
      />

      <SummaryGrid
        metrics={[
          { label: 'Selected Student', value: selectedStudent?.studentName ?? 'Student' },
          {
            label: 'Student ID',
            value: selectedStudent?.studentId ?? MISSING_VALUE_LABEL,
          },
          { label: 'Student Total Hours', value: formatHours(analytics.totalHours) },
        ]}
      />

      <div className="mt-5">
        <CategoryProgressList categories={analytics.categories} />
      </div>
    </AnalyticsCard>
  );
};

const AttendanceAnalyticsCard = ({
  analytics,
  cardClassName,
  error,
  isLoading,
  onLogSaved,
  rangeLabel,
  students,
}) => {
  const [expandedMeetingDate, setExpandedMeetingDate] = useState('');
  const [expandedStudentKey, setExpandedStudentKey] = useState('');
  const [selectedLogDetails, setSelectedLogDetails] = useState(null);
  const highestAttendance = analytics.highestAttendanceDay
    ? `${formatDate(analytics.highestAttendanceDay.dateValue)}, ${formatStudentCount(analytics.highestAttendanceDay.studentsAttended)}`
    : 'None';
  const lowestAttendance = analytics.lowestAttendanceDay
    ? `${formatDate(analytics.lowestAttendanceDay.dateValue)}, ${formatStudentCount(analytics.lowestAttendanceDay.studentsAttended)}`
    : 'None';

  return (
    <AnalyticsCard
      description={`Attendance for scheduled events marked as counting for attendance, grouped by sign-in date for ${rangeLabel}.`}
      emptyMessage="No students found for attendance analytics."
      error={error}
      isEmpty={analytics.students.length === 0}
      isLoading={isLoading}
      title="Attendance Analytics"
      cardClassName={cardClassName}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Total Meeting Days" value={analytics.totalMeetingDays} />
        <SummaryMetric label="Average Students / Meeting Day" value={analytics.averageStudentsPerMeetingDay.toFixed(1)} />
        <SummaryMetric label="Highest Attendance Day" value={highestAttendance} />
        <SummaryMetric label="Lowest Attendance Day" value={lowestAttendance} />
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">Meeting Day Summary</h4>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Date</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Students Attended</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Total Completed Hours</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Completed Logs</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Incomplete Logs</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Details</th>
              </tr>
            </thead>
            <tbody>
              {analytics.meetingDays.map((meetingDay) => {
                const isExpanded = expandedMeetingDate === meetingDay.date;
                const detailId = `attendance-meeting-${meetingDay.date}`;

                return (
                  <React.Fragment key={meetingDay.date}>
                    <tr>
                      <td className={`${tableCellClassName} rounded-l-xl border-l font-semibold`}>
                        {formatDate(meetingDay.dateValue)}
                      </td>
                      <td className={tableCellClassName}>{meetingDay.studentsAttended}</td>
                      <td className={tableCellClassName}>{formatHours(meetingDay.totalHours)}</td>
                      <td className={tableCellClassName}>{meetingDay.completedLogCount}</td>
                      <td className={tableCellClassName}>{meetingDay.incompleteLogCount}</td>
                      <td className={`${tableCellClassName} rounded-r-xl border-r`}>
                        <button
                          aria-controls={detailId}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center justify-center rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-semibold text-on-secondary transition hover:bg-accent/10"
                          onClick={() => setExpandedMeetingDate(isExpanded ? '' : meetingDay.date)}
                          type="button"
                        >
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr id={detailId}>
                        <td className="rounded-2xl border border-border bg-secondary/40 px-5 py-4" colSpan={6}>
                          <p className="font-semibold text-on-primary">
                            Signed in on {formatDate(meetingDay.dateValue)}
                          </p>
                          <div className="mt-3 overflow-x-auto">
                            <table className="min-w-full">
                              <thead>
                                <tr>
                                  <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Student</th>
                                  <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Student ID</th>
                                  <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Time Attended</th>
                                  <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Status</th>
                                  <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {meetingDay.attendees.map((attendee) => (
                                  <tr key={attendee.studentKey}>
                                    <td className={`${tableCellClassName} rounded-l-xl border-l font-semibold`}>
                                      {attendee.studentName}
                                    </td>
                                    <td className={tableCellClassName}>{attendee.studentId}</td>
                                    <td className={tableCellClassName}>
                                      {formatDuration(attendee.totalMinutes)}
                                    </td>
                                    <td className={tableCellClassName}>
                                      {attendee.incompleteLogCount > 0
                                        ? `${attendee.incompleteLogCount} incomplete`
                                        : 'Complete'}
                                    </td>
                                    <td className={`${tableCellClassName} rounded-r-xl border-r`}>
                                      <div className="flex flex-wrap justify-center gap-2">
                                        {attendee.logs.map((log, logIndex) => (
                                          <button
                                            className="inline-flex items-center justify-center rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-semibold text-on-secondary transition hover:bg-accent/10"
                                            key={log.id}
                                            onClick={() => {
                                              const studentDocId = String(
                                                log[timeLogConfig.studentDocIdField] ?? '',
                                              ).trim();

                                              setSelectedLogDetails({
                                                log,
                                                student: students.find((student) => student.id === studentDocId) ?? null,
                                                studentName: attendee.studentName,
                                              });
                                            }}
                                            type="button"
                                          >
                                            {attendee.logs.length > 1
                                              ? `Edit Log ${logIndex + 1}`
                                              : 'Edit Log'}
                                          </button>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-on-primary">Student Attendance</h4>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Student</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Student ID</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Days Attended</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Attendance Rate</th>
                <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Details</th>
              </tr>
            </thead>
            <tbody>
              {analytics.students.map((student) => {
                const isExpanded = expandedStudentKey === student.studentKey;
                const detailId = `student-attendance-${student.studentKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

                return (
                  <React.Fragment key={student.studentKey}>
                    <tr>
                      <td className={`${tableCellClassName} rounded-l-xl border-l font-semibold`}>
                        {student.studentName}
                      </td>
                      <td className={tableCellClassName}>{student.studentId}</td>
                      <td className={tableCellClassName}>{student.daysAttended}</td>
                      <td className={tableCellClassName}>{student.attendanceRate}%</td>
                      <td className={`${tableCellClassName} rounded-r-xl border-r`}>
                        <button
                          aria-controls={detailId}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center justify-center rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-semibold text-on-secondary transition hover:bg-accent/10"
                          onClick={() => setExpandedStudentKey(isExpanded ? '' : student.studentKey)}
                          type="button"
                        >
                          {isExpanded ? 'Hide Details' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr id={detailId}>
                        <td className="rounded-2xl border border-border bg-secondary/40 px-5 py-4" colSpan={5}>
                          <p className="font-semibold text-on-primary">
                            Meeting attendance for {student.studentName}
                          </p>
                          {student.meetingHistory.length === 0 ? (
                            <p className="mt-3 text-sm text-on-primary/90">
                              No attendance meetings were found in this date range.
                            </p>
                          ) : (
                            <div className="mt-3 overflow-x-auto">
                              <table className="min-w-full">
                                <thead>
                                  <tr>
                                    <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Meeting Date</th>
                                    <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Attendance</th>
                                    <th className={DASHBOARD_TABLE_HEADER_CLASS_NAME}>Time Attended</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {student.meetingHistory.map((meeting) => (
                                    <tr key={meeting.date}>
                                      <td className={`${tableCellClassName} rounded-l-xl border-l font-semibold`}>
                                        {formatDate(meeting.dateValue)}
                                      </td>
                                      <td className={tableCellClassName}>
                                        {meeting.attended ? 'Attended' : 'Missed'}
                                      </td>
                                      <td className={`${tableCellClassName} rounded-r-xl border-r`}>
                                        {meeting.attended
                                          ? formatDuration(meeting.totalMinutes)
                                          : '-'}
                                        {meeting.incompleteLogCount > 0 ? ' (incomplete)' : ''}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLogDetails && (
        <TimeLogEditorDialog
          log={selectedLogDetails.log}
          onClose={() => setSelectedLogDetails(null)}
          onSaved={onLogSaved}
          student={selectedLogDetails.student}
          studentName={selectedLogDetails.studentName}
        />
      )}
    </AnalyticsCard>
  );
};

const AnalyticsDashboard = ({ cardClassName = DASHBOARD_CARD_CLASS_NAME }) => {
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [selectedStudentKey, setSelectedStudentKey] = useState('');

  const parsedDateRange = useMemo(() => {
    const startDate = getStartOfDay(dateRange.startDate);
    const endDate = getEndOfDay(dateRange.endDate);
    let error = '';

    if (!startDate || !endDate) {
      error = 'Select a valid start date and end date.';
    } else if (startDate > endDate) {
      error = 'Start date must be on or before end date.';
    }

    return {
      startDate,
      endDate,
      error,
      rangeLabel: `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`,
    };
  }, [dateRange.endDate, dateRange.startDate]);

  const {
    logs,
    isLoading,
    error: loadError,
    reloadLogs,
  } = useAnalyticsTimeLogs({
    startDate: parsedDateRange.startDate,
    endDate: parsedDateRange.endDate,
    enabled: !parsedDateRange.error,
  });
  const {
    schedules,
    isLoading: isLoadingSchedules,
    error: schedulesError,
  } = useSchedules();
  const {
    students,
    isLoading: isLoadingStudents,
    error: studentsError,
  } = useStudents();
  const analyticsError = parsedDateRange.error || loadError || studentsError;
  const attendanceError = analyticsError || schedulesError;
  const currentStudents = useMemo(
    () => students.filter(isCurrentMember),
    [students],
  );

  const logsInDateRange = useMemo(() => (
    analyticsError
      ? []
      : filterLogsForCurrentStudents(
        getLogsInDateRange(logs, parsedDateRange.startDate, parsedDateRange.endDate),
        currentStudents,
      )
  ), [
    analyticsError,
    currentStudents,
    logs,
    parsedDateRange.endDate,
    parsedDateRange.startDate,
  ]);

  const studentHourTotals = useMemo(
    () => calculateStudentHourTotals(logsInDateRange),
    [logsInDateRange],
  );
  const teamHoursOverTime = useMemo(
    () => calculateTeamHoursOverTime(logsInDateRange),
    [logsInDateRange],
  );
  const hoursByCategory = useMemo(
    () => calculateHoursByCategory(logsInDateRange),
    [logsInDateRange],
  );
  const attendanceAnalytics = useMemo(
    () => calculateAttendanceAnalytics(logsInDateRange, schedules, currentStudents),
    [currentStudents, logsInDateRange, schedules],
  );
  const defaultStudentKey = studentHourTotals.students[0]?.studentKey ?? '';
  const effectiveStudentKey = selectedStudentKey || defaultStudentKey;
  const selectedStudent = studentHourTotals.students.find(
    (student) => student.studentKey === effectiveStudentKey,
  ) ?? null;
  const studentCategoryBreakdown = useMemo(
    () => calculateStudentCategoryBreakdown(logsInDateRange, effectiveStudentKey),
    [effectiveStudentKey, logsInDateRange],
  );

  useEffect(() => {
    if (!defaultStudentKey) {
      setSelectedStudentKey('');
      return;
    }

    const selectedStudentStillExists = studentHourTotals.students.some(
      (student) => student.studentKey === selectedStudentKey,
    );

    if (!selectedStudentStillExists) {
      setSelectedStudentKey(defaultStudentKey);
    }
  }, [defaultStudentKey, selectedStudentKey, studentHourTotals.students]);

  const handleDateChange = (field, value) => {
    setDateRange((currentRange) => ({
      ...currentRange,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-6">
      <AnalyticsDateRangeCard
        cardClassName={cardClassName}
        dateRange={dateRange}
        error={parsedDateRange.error}
        onDateChange={handleDateChange}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <StudentHourTotalsCard
          analytics={studentHourTotals}
          cardClassName={cardClassName}
          error={analyticsError}
          isLoading={isLoading || isLoadingStudents}
          rangeLabel={parsedDateRange.rangeLabel}
        />
        <TeamHoursOverTimeCard
          analytics={teamHoursOverTime}
          cardClassName={cardClassName}
          error={analyticsError}
          isLoading={isLoading || isLoadingStudents}
          rangeLabel={parsedDateRange.rangeLabel}
        />
        <HoursByCategoryCard
          analytics={hoursByCategory}
          cardClassName={`${cardClassName} xl:col-span-2`}
          error={analyticsError}
          isLoading={isLoading || isLoadingStudents}
          rangeLabel={parsedDateRange.rangeLabel}
        />
        <StudentCategoryBreakdownCard
          analytics={studentCategoryBreakdown}
          cardClassName={cardClassName}
          error={analyticsError}
          isLoading={isLoading || isLoadingStudents}
          onStudentChange={setSelectedStudentKey}
          selectedStudent={selectedStudent}
          selectedStudentKey={effectiveStudentKey}
          studentOptions={studentHourTotals.students}
        />
      </div>

      <AttendanceAnalyticsCard
        analytics={attendanceAnalytics}
        cardClassName={cardClassName}
        error={attendanceError}
        isLoading={isLoading || isLoadingSchedules || isLoadingStudents}
        onLogSaved={reloadLogs}
        rangeLabel={parsedDateRange.rangeLabel}
        students={currentStudents}
      />
    </div>
  );
};

export default AnalyticsDashboard;
