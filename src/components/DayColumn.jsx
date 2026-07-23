import { format, isToday, isBefore, startOfDay } from 'date-fns'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { createPortal } from 'react-dom'
import TaskCard from './TaskCard'

const BUCKETS = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Afternoon' },
  { id: 'afternoon', label: 'Evening' },
]

const OVERLOAD_CAP = 5

export default function DayColumn({ date, tasks, dueCards, goalMap, collabMap, profileMap, onMarkDone, onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit, onAddTaskForBucket }) {
  const today = isToday(date)
  const isPast = isBefore(date, startOfDay(new Date())) && !today
  const dateStr = format(date, 'yyyy-MM-dd')
  const allDayItems = [...tasks, ...(dueCards || [])]
  const activeTasks = allDayItems.filter(t => t.status !== 'done')
  const doneTasks = allDayItems.filter(t => t.status === 'done')
  const donePct = allDayItems.length > 0 ? Math.round((doneTasks.length / allDayItems.length) * 100) : 0
  const overloadBorder = activeTasks.length === 0 ? null : activeTasks.length >= OVERLOAD_CAP ? 'border-red-400' : activeTasks.length >= 3 ? 'border-amber-400' : 'border-emerald-400'

  return (
    <div className={'flex flex-col rounded-xl border transition-colors ' + (overloadBorder ? overloadBorder + ' bg-white' : today ? 'border-indigo-200 bg-white' : isPast ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white')}>
      <div className={'px-3 pt-3 pb-2 border-b ' + (today ? 'border-indigo-100' : 'border-gray-100')}>
        <div className="flex items-center justify-between mb-1.5">
          <span className={'text-lg font-semibold uppercase tracking-wide ' + (isPast ? 'text-gray-400' : 'text-gray-700')}>{format(date, 'EEE')}</span>
          <span className={'text-lg font-bold px-2 py-0.5 rounded ' + (today ? 'bg-indigo-600 text-white' : isPast ? 'text-gray-400' : 'text-gray-700')}>{format(date, 'd')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: donePct + '%', background: '#6366f1' }} />
          </div>
          <span className="text-xs text-gray-400 shrink-0">{donePct}%</span>
        </div>
        <p className="text-xs text-gray-300 mt-0.5">{doneTasks.length}/{allDayItems.length}</p>
      </div>
      <div className="flex-1 flex flex-col">
        {BUCKETS.map(bucket => {
          const bucketActiveCount = tasks.filter(t => t.status !== 'done' && (t.bucket || 'morning') === bucket.id).length
            + (dueCards || []).filter(t => t.status !== 'done' && (t.due_date_card_bucket || 'morning') === bucket.id).length
          const bucketAll = tasks.filter(t => (t.bucket || 'morning') === bucket.id).sort((a, b) => {
            if (a.start_time && b.start_time) return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
            if (a.start_time && !b.start_time) return -1
            if (!a.start_time && b.start_time) return 1
            return (a.position || 0) - (b.position || 0)
          })
          const bucketDueCards = (dueCards || []).filter(t => (t.due_date_card_bucket || 'morning') === bucket.id).sort((a, b) => (a.due_date_card_position || 0) - (b.due_date_card_position || 0))
          const droppableId = bucket.id + '-' + dateStr
          const dueDroppableId = bucket.id + '-due-' + dateStr
          return (
            <div key={bucket.id} className="group relative flex-1 flex flex-col border-b border-gray-50 last:border-0">
              <div className="px-3 py-1.5 flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-medium text-gray-700 uppercase tracking-wide">{bucket.label}</span>
                {bucketActiveCount > 0 && <span className="text-xs text-gray-300">{bucketActiveCount}</span>}
                <button
                  onClick={() => onAddTaskForBucket(date, bucket.id)}
                  className="ml-auto w-5 h-5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title={'Add task to ' + bucket.label}
                >
                  +
                </button>
              </div>
              <Droppable droppableId={droppableId}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={'flex-1 px-2 pb-2 min-h-[44px] transition-colors ' + (snapshot.isDraggingOver ? 'bg-indigo-50' : '')}
                  >
                    {bucketAll.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={task.status === 'done'}>
                        {(provided, snapshot) => {
                          const card = (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="mb-1.5" style={provided.draggableProps.style}>
                              <TaskCard task={task} isDone={task.status === 'done'} isDragging={snapshot.isDragging} collabBadge={task.collaboration_id && collabMap ? collabMap[task.collaboration_id] : null} assigneeName={task.assigned_to && profileMap ? profileMap[task.assigned_to] : null} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} />
                            </div>
                          )
                          return snapshot.isDragging ? createPortal(card, document.body) : card
                        }}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              {bucketDueCards.length > 0 && (
                <Droppable droppableId={dueDroppableId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={'px-2 pb-2 min-h-[10px] transition-colors ' + (snapshot.isDraggingOver ? 'bg-indigo-50' : '')}
                    >
                      {bucketDueCards.map((task, index) => (
                        <Draggable key={task.id + '__due__'} draggableId={task.id + '__due__'} index={index} isDragDisabled={task.status === 'done'}>
                          {(provided, snapshot) => {
                            const card = (
                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="mb-1.5" style={provided.draggableProps.style}>
                                <TaskCard task={task} isDone={task.status === 'done'} isDragging={snapshot.isDragging} isDueCard collabBadge={task.collaboration_id && collabMap ? collabMap[task.collaboration_id] : null} assigneeName={task.assigned_to && profileMap ? profileMap[task.assigned_to] : null} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} />
                              </div>
                            )
                            return snapshot.isDragging ? createPortal(card, document.body) : card
                          }}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
