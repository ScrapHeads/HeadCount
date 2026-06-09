import React, { useEffect, useMemo, useState } from 'react';
import { useAnalyticsTimeLogs } from '../../features/timeLogs/useAnalyticsTimeLogs';
import {
  calculateAttendanceAnalytics,
  calculateHoursByCategory,
  calculateStudentCategoryBreakdown,
  calculateStudentHourTotals,
  calculateTeamHoursOverTime,
  getEndOfDay,
  getLogsInDateRange,
  getStartOfDay,
} from '../../lib/analyticsUtils';
import Dropdown from '../shared/Dropdown';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 29);

  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  };
};

const formatDate = (value, formatter = dateFormatter) => {
  const date = value instanceof Date ? value : getStartOfDay(value);

  return date ? formatter.format(date) : 'Not selected';
};

const formatHours = (hours) => Number(hours || 0).toFixed(1);

const formatStudentCount = (count) => `${count} ${count === 1 ? 'student' : 'students'}`;

const inputClassName = 'w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-on-secondary outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15';
const tableHeaderClassName = 'px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-on-primary';
const tableCellClassName = 'border-y border-border bg-secondary px-4 py-3 text-sm text-on-secondary';
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

const CardMessage = ({ children, tone = 'muted' }) => (
  <div
    className={`mt-5 rounded-2xl border px-4 py-4 text-sm ${
      tone === 'error'
        ? 'border-accent/30 bg-accent/12 text-on-primary'
        : 'border-border bg-accent/10 text-on-primary/80'
    }`}
  >
    {children}
  </div>
);

const AnalyticsCard = ({
  children,
  description,
  emptyMessage,
  error,
  isEmpty,
  isLoading,
  title,
  cardClassName = defaultCardClassName,
}) => (
  <article className={cardClassName}>
    <div>
      <h3 className="text-lg font-semibold text-on-primary">{title}</h3>
      {description && (
        <p className="mt-2 text-sm leading-6 text-on-primary/80">{description}</p>
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
  <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-border bg-secondary px-4 py-4 text-center shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-secondary/80">{label}</p>
    <p className="mt-2 max-w-full break-words text-xl font-semibold leading-snug text-on-secondary sm:text-2xl">{value}</p>
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
  cardClassName = defaultCardClassName,
  dateRange,
  error,
  onDateChange,
}) => (
  <article className={cardClassName}>
    <div>
      <h3 className="text-lg font-semibold text-on-primary">Analytics Date Range</h3>
      <p className="mt-2 text-sm leading-6 text-on-primary/80">
        Showing logs from {formatDate(dateRange.startDate)} through {formatDate(dateRange.endDate)}.
      </p>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-primary">Start date</span>
        <input
          className={inputClassName}
          onChange={(event) => onDateChange('startDate', event.target.value)}
          type="date"
          value={dateRange.startDate}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-primary">End date</span>
        <input
          className={inputClassName}
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
            <th className={tableHeaderClassName}>Student Name</th>
            <th className={tableHeaderClassName}>Student ID</th>
            <th className={`${tableHeaderClassName} text-right`}>Hours</th>
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
          { label: 'Student ID', value: selectedStudent?.studentId ?? 'Not set' },
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
  rangeLabel,
}) => {
  const highestAttendance = analytics.highestAttendanceDay
    ? `${formatDate(analytics.highestAttendanceDay.dateValue)}, ${formatStudentCount(analytics.highestAttendanceDay.studentsAttended)}`
    : 'None';
  const lowestAttendance = analytics.lowestAttendanceDay
    ? `${formatDate(analytics.lowestAttendanceDay.dateValue)}, ${formatStudentCount(analytics.lowestAttendanceDay.studentsAttended)}`
    : 'None';

  return (
    <AnalyticsCard
      description={`Attendance grouped by sign-in date for ${rangeLabel}.`}
      emptyMessage="No attendance data found for this date range."
      error={error}
      isEmpty={analytics.totalMeetingDays === 0}
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
                <th className={tableHeaderClassName}>Date</th>
                <th className={tableHeaderClassName}>Students Attended</th>
                <th className={tableHeaderClassName}>Total Completed Hours</th>
                <th className={tableHeaderClassName}>Completed Logs</th>
                <th className={tableHeaderClassName}>Incomplete Logs</th>
              </tr>
            </thead>
            <tbody>
              {analytics.meetingDays.map((meetingDay) => (
                <tr key={meetingDay.date}>
                  <td className={`${tableCellClassName} rounded-l-xl border-l font-semibold`}>
                    {formatDate(meetingDay.dateValue)}
                  </td>
                  <td className={tableCellClassName}>{meetingDay.studentsAttended}</td>
                  <td className={tableCellClassName}>{formatHours(meetingDay.totalHours)}</td>
                  <td className={tableCellClassName}>{meetingDay.completedLogCount}</td>
                  <td className={`${tableCellClassName} rounded-r-xl border-r`}>
                    {meetingDay.incompleteLogCount}
                  </td>
                </tr>
              ))}
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
                <th className={tableHeaderClassName}>Student</th>
                <th className={tableHeaderClassName}>Student ID</th>
                <th className={tableHeaderClassName}>Days Attended</th>
                <th className={tableHeaderClassName}>Attendance Rate</th>
              </tr>
            </thead>
            <tbody>
              {analytics.students.map((student) => (
                <tr key={student.studentKey}>
                  <td className={`${tableCellClassName} rounded-l-xl border-l font-semibold`}>
                    {student.studentName}
                  </td>
                  <td className={tableCellClassName}>{student.studentId}</td>
                  <td className={tableCellClassName}>{student.daysAttended}</td>
                  <td className={`${tableCellClassName} rounded-r-xl border-r`}>
                    {student.attendanceRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AnalyticsCard>
  );
};

const AnalyticsDashboard = ({ cardClassName = defaultCardClassName }) => {
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
  } = useAnalyticsTimeLogs({
    startDate: parsedDateRange.startDate,
    endDate: parsedDateRange.endDate,
    enabled: !parsedDateRange.error,
  });
  const analyticsError = parsedDateRange.error || loadError;

  const logsInDateRange = useMemo(() => (
    analyticsError
      ? []
      : getLogsInDateRange(logs, parsedDateRange.startDate, parsedDateRange.endDate)
  ), [analyticsError, logs, parsedDateRange.endDate, parsedDateRange.startDate]);

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
    () => calculateAttendanceAnalytics(logsInDateRange),
    [logsInDateRange],
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
          isLoading={isLoading}
          rangeLabel={parsedDateRange.rangeLabel}
        />
        <TeamHoursOverTimeCard
          analytics={teamHoursOverTime}
          cardClassName={cardClassName}
          error={analyticsError}
          isLoading={isLoading}
          rangeLabel={parsedDateRange.rangeLabel}
        />
        <HoursByCategoryCard
          analytics={hoursByCategory}
          cardClassName={`${cardClassName} xl:col-span-2`}
          error={analyticsError}
          isLoading={isLoading}
          rangeLabel={parsedDateRange.rangeLabel}
        />
        <StudentCategoryBreakdownCard
          analytics={studentCategoryBreakdown}
          cardClassName={cardClassName}
          error={analyticsError}
          isLoading={isLoading}
          onStudentChange={setSelectedStudentKey}
          selectedStudent={selectedStudent}
          selectedStudentKey={effectiveStudentKey}
          studentOptions={studentHourTotals.students}
        />
      </div>

      <AttendanceAnalyticsCard
        analytics={attendanceAnalytics}
        cardClassName={cardClassName}
        error={analyticsError}
        isLoading={isLoading}
        rangeLabel={parsedDateRange.rangeLabel}
      />
    </div>
  );
};

export default AnalyticsDashboard;
