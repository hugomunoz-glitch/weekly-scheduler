import DayColumn from './DayColumn'

export default function WeekGrid({ days, tasksForDay, dueCardsForDay, goalMap, collabMap, onMarkDone, onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit, onAddTaskForBucket }) {
  return (
    <div className="grid grid-cols-7 gap-2 min-w-[840px] h-full min-h-[500px]">
      {days.map(day => (
        <DayColumn
          key={day.toISOString()}
          date={day}
          tasks={tasksForDay(day)}
          dueCards={dueCardsForDay ? dueCardsForDay(day) : []}
          goalMap={goalMap}
          collabMap={collabMap}
          onMarkDone={onMarkDone}
          onRescheduleToTomorrow={onRescheduleToTomorrow}
          onMoveToInbox={onMoveToInbox}
          onDelete={onDelete}
          onEdit={onEdit}
          onAddTaskForBucket={onAddTaskForBucket}
        />
      ))}
    </div>
  )
}
