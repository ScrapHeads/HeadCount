import { scheduleConfig, taskConfig } from '../../config/appConfig';
import { MAX_TASK_NAME_LENGTH } from '../../features/tasks/taskNameValidation';
import { FORM_INPUT_CLASS_NAME } from '../../styles/classNames';
import Button from '../shared/Button';
import Dropdown from '../shared/Dropdown';

const weekdayOptions = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const monthOptions = [
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
];

const dayOfMonthOptions = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

const taskSourceOptions = [
  {
    value: 'existing',
    title: 'Use Existing',
    description: 'Attach the event to a task that already exists in the system.',
  },
  {
    value: 'new',
    title: 'Create New',
    description: 'Make a new scheduled task first, then attach the event to it.',
  },
];

const scheduleTypeOptions = [
  {
    value: scheduleConfig.recurrenceTypes.oneTime,
    title: 'One-Time',
    description: 'A single event with explicit start and end dates.',
  },
  {
    value: scheduleConfig.recurrenceTypes.weekly,
    title: 'Weekly',
    description: 'Repeats every week on the selected weekday.',
  },
  {
    value: scheduleConfig.recurrenceTypes.monthly,
    title: 'Monthly',
    description: 'Repeats each month on the selected day of month.',
  },
  {
    value: scheduleConfig.recurrenceTypes.yearly,
    title: 'Yearly',
    description: 'Repeats once a year on the selected month and day.',
  },
];

const meetingCountingOptions = [
  { value: 'attendance', title: 'Counts for attendance' },
  { value: 'optional', title: 'Does not count' },
  { value: 'outreach', title: 'Counts for outreach' },
];

const noteRequirementOptions = [
  { value: scheduleConfig.noteRequirements.both, label: 'Sign in and sign out' },
  { value: scheduleConfig.noteRequirements.signIn, label: 'Sign in only' },
  { value: scheduleConfig.noteRequirements.signOut, label: 'Sign out only' },
  { value: scheduleConfig.noteRequirements.none, label: 'No notes needed' },
];

const ScheduleEventForm = ({
  form,
  isLoadingTasks,
  isSaving,
  lockScheduleType = false,
  onFieldChange,
  onSubmit,
  submitLabel,
  tasks,
}) => (
  <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
    <div className="md:col-span-2">
      <span className="text-sm font-medium text-on-primary">Task source</span>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {taskSourceOptions.map((option) => {
          const isActive = form.taskMode === option.value;

          return (
            <button
              key={option.value}
              className={`rounded-[1.5rem] border p-4 text-left transition ${
                isActive
                  ? 'border-accent bg-accent/12 shadow-sm text-on-primary'
                  : 'border-border bg-secondary hover:bg-accent/10'
              }`}
              onClick={() => onFieldChange('taskMode', option.value)}
              type="button"
            >
              <p className={`text-base font-semibold ${isActive ? 'text-on-primary' : 'text-on-secondary'}`}>{option.title}</p>
              <p className={`mt-2 text-sm leading-6 ${isActive ? 'text-on-primary/90' : 'text-on-secondary/90'}`}>{option.description}</p>
            </button>
          );
        })}
      </div>
    </div>

    {form.taskMode === 'existing' ? (
      <Dropdown
        className="md:col-span-2 text-on-secondary"
        label="Task"
        onChange={(value) => onFieldChange('taskId', value)}
        options={tasks.map((task) => ({
          label: task[taskConfig.nameField],
          value: task.id,
        }))}
        placeholder="Select a task"
        value={form.taskId}
      />
    ) : (
      <label className="flex flex-col gap-1.5 md:col-span-2">
        <span className="text-sm font-medium text-on-primary">New task name</span>
        <input
          className={FORM_INPUT_CLASS_NAME}
          maxLength={MAX_TASK_NAME_LENGTH}
          onChange={(event) => onFieldChange('newTaskName', event.target.value)}
          placeholder="Example: CAD Workshop"
          required
          type="text"
          value={form.newTaskName}
        />
      </label>
    )}

    <div className="md:col-span-2">
      <span className="text-sm font-medium text-on-primary">Schedule type</span>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        {scheduleTypeOptions.map((option) => {
          const isActive = form.scheduleMode === option.value;

          return (
            <button
              key={option.value}
              className={`rounded-[1.5rem] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${
                isActive
                  ? 'border-accent bg-accent/12 shadow-sm'
                  : 'border-border bg-secondary hover:bg-accent/10'
              }`}
              disabled={lockScheduleType && !isActive}
              onClick={() => onFieldChange('scheduleMode', option.value)}
              type="button"
            >
              <p className={`text-base font-semibold ${isActive ? 'text-on-primary' : 'text-on-secondary'}`}>{option.title}</p>
              <p className={`mt-2 text-sm leading-6 ${isActive ? 'text-on-primary/90' : 'text-on-secondary/90'}`}>{option.description}</p>
            </button>
          );
        })}
      </div>
    </div>

    <div className="md:col-span-2">
      <span className="text-sm font-medium text-on-primary">Meeting hours type</span>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        {meetingCountingOptions.map((option) => {
          const isActive = form.meetingCountingType === option.value;

          return (
            <button
              key={option.value}
              aria-pressed={isActive}
              className={`rounded-[1.5rem] border p-4 text-left transition ${
                isActive
                  ? 'border-accent bg-accent/12 shadow-sm'
                  : 'border-border bg-secondary hover:bg-accent/10'
              }`}
              onClick={() => onFieldChange('meetingCountingType', option.value)}
              type="button"
            >
              <p className={`text-base font-semibold ${isActive ? 'text-on-primary' : 'text-on-secondary'}`}>{option.title}</p>
            </button>
          );
        })}
      </div>
    </div>

    <Dropdown
      className="md:col-span-2"
      label="Notes required"
      onChange={(value) => onFieldChange('noteRequirement', value)}
      options={noteRequirementOptions}
      value={form.noteRequirement}
    />

    {form.scheduleMode === scheduleConfig.recurrenceTypes.weekly && (
      <Dropdown
        className="md:col-span-2"
        label="Recurring day"
        onChange={(value) => onFieldChange('recurringDayOfWeek', value)}
        options={weekdayOptions}
        value={form.recurringDayOfWeek}
      />
    )}

    {form.scheduleMode === scheduleConfig.recurrenceTypes.monthly && (
      <Dropdown
        className="md:col-span-2"
        label="Recurring day of month"
        onChange={(value) => onFieldChange('recurringDayOfMonth', value)}
        options={dayOfMonthOptions}
        value={form.recurringDayOfMonth}
      />
    )}

    {form.scheduleMode === scheduleConfig.recurrenceTypes.yearly && (
      <>
        <Dropdown
          label="Recurring month"
          onChange={(value) => onFieldChange('recurringMonthOfYear', value)}
          options={monthOptions}
          value={form.recurringMonthOfYear}
        />

        <Dropdown
          label="Recurring day of month"
          onChange={(value) => onFieldChange('recurringDayOfMonth', value)}
          options={dayOfMonthOptions}
          value={form.recurringDayOfMonth}
        />
      </>
    )}

    {form.scheduleMode !== scheduleConfig.recurrenceTypes.oneTime && (
      <fieldset className="grid gap-4 rounded-2xl border border-border p-4 md:col-span-2 md:grid-cols-2">
        <legend className="px-2 text-sm font-medium text-on-primary">Recurring date range</legend>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">Start date</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
            onChange={(event) => onFieldChange('recurringStartDate', event.target.value)}
            required
            type="date"
            value={form.recurringStartDate}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">End date</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
            min={form.recurringStartDate || undefined}
            onChange={(event) => onFieldChange('recurringEndDate', event.target.value)}
            required
            type="date"
            value={form.recurringEndDate}
          />
        </label>
      </fieldset>
    )}

    {form.scheduleMode === scheduleConfig.recurrenceTypes.oneTime ? (
      <>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">Start date</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
            onChange={(event) => onFieldChange('startDate', event.target.value)}
            required
            type="date"
            value={form.startDate}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">Start time</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
            onChange={(event) => onFieldChange('startTime', event.target.value)}
            required
            type="time"
            value={form.startTime}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">End date</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
            onChange={(event) => onFieldChange('endDate', event.target.value)}
            required
            type="date"
            value={form.endDate}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">End time</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
            onChange={(event) => onFieldChange('endTime', event.target.value)}
            required
            type="time"
            value={form.endTime}
          />
        </label>
      </>
    ) : (
      <>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">Start time</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
            onChange={(event) => onFieldChange('startTime', event.target.value)}
            required
            type="time"
            value={form.startTime}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-primary">End time</span>
          <input
            className={FORM_INPUT_CLASS_NAME}
            onChange={(event) => onFieldChange('endTime', event.target.value)}
            required
            type="time"
            value={form.endTime}
          />
        </label>
      </>
    )}

    <div className="md:col-span-2">
      <Button className="md:w-auto" disabled={isSaving || isLoadingTasks} type="submit">
        {isSaving ? 'Saving event...' : submitLabel}
      </Button>
    </div>
  </form>
);

export default ScheduleEventForm;
