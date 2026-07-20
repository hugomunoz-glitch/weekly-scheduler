import { format, isToday, isBefore, startOfDay } from 'date-fns'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import TaskCard from './TaskCard'

const DAILY_CAP = 5
const BUCKETS = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Afternoon' },
  { id: 'afternoon', label: 'Evening' },
]

export default function DayColumn({ date, tasks, goalMap, onMarkDone, onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit, onAddTaskForDay }) {
  const today = isToday(date)
  const isPast = isBefore(date, startOfDay(new Date())) && !today
  const dateStr = format(date, 'yyyy-MM-dd')
  const activeTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const count = activeTasks.length
  const fillPct = Math.min((count / DAILY_CAP) * 100, 100)
  const capColor = count >= DAILY_CAP ? 'bg-red-400' : count >= 3 ? 'bg-amber-400' : count > 0 ? 'bg-emerald-400' : 'bg-gray-200'

  return (
    <div className={'flex flex-col rounded-xl border transition-colors ' + (today ? 'border-indigo-200 bg-white' : isPast ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white')}>
      <div className={'px-3 pt-3 pb-2 border-b ' + (today ? 'border-indigo-100' : 'border-gray-100')}>
        <div className="flex items-center justify-between mb-1.5">
          <span className={'text-lg font-semibold uppercase tracking-wide ' + (isPast ? 'text-gray-400' : 'text-gray-700')}>{format(date, 'EEE')}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => onAddTaskForDay(date)} className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded px-1.5 py-0.5 leading-none" title="Add task for this day">+</button>
            <span className={'text-lg font-bold px-2 py-0.5 rounded ' + (today ? 'bg-indigo-600 text-white' : isPast ? 'text-gray-400' : 'text-gray-700')}>{format(date, 'd')}</span>
          </div>
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className={'h-full rounded-full transition-all duration-300 ' + capColor} style={{ width: fillPct + '%' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className={'text-xs ' + (count >= DAILY_CAP ? 'text-red-400 font-medium' : 'text-gray-400')}>{count} {count === 1 ? 'task' : 'tasks'}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {BUCKETS.map(bucket => {
          const bucketTasks = activeTasks.filter(t => (t.bucket || 'morning') === bucket.id).sort((a, b) => (a.position || 0) - (b.position || 0))
          const bucketDone = doneTasks.filter(t => (t.bucket || 'morning') === bucket.id)
          const droppableId = bucket.id + '-' + dateStr
          return (
            <div key={bucket.id} className="flex-1 flex flex-col border-b border-gray-50 last:border-0">
              <div className="px-3 py-1.5 flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-medium text-gray-700 uppercase tracking-wide">{bucket.label}</span>
                {bucketTasks.length > 0 && <span className="text-xs text-gray-300">{bucketTasks.length}</span>}
              </div>
              <Droppable droppableId={droppableId}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={'flex-1 px-2 pb-2 min-h-[44px] transition-colors ' + (snapshot.isDraggingOver ? 'bg-indigo-50' : '')}
                  >
                    {bucketTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="mb-1.5">
                            <TaskCard task={task} isDragging={snapshot.isDragging} goalColor={goalMap[task.goal_id] ? goalMap[task.goal_id].color : null} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {bucketDone.map(task => (
                      <div key={task.id} className="mb-1.5">
                        <TaskCard task={task} isDone goalColor={goalMap[task.goal_id] ? goalMap[task.goal_id].color : null} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} />
                      </div>
                    ))}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </div>
  )
}
