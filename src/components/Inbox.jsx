import { useState } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'

export default function Inbox({ tasks, goalMap, onAddTask, onEdit, onDelete }) {
  const [hoverId, setHoverId] = useState(null)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Task List</h2>
          {tasks.length > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-600 font-medium px-1.5 py-0.5 rounded-full">{tasks.length}</span>
          )}
        </div>
        <button onClick={onAddTask} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">+ Add</button>
      </div>
      <Droppable droppableId="inbox">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={'flex-1 overflow-y-auto p-3 space-y-2 min-h-[60px] transition-colors ' + (snapshot.isDraggingOver ? 'bg-indigo-50' : '')}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center pt-10">
                <p className="text-xs text-gray-400 leading-relaxed">Nothing waiting.<br />Add a task to get started.</p>
              </div>
            )}
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={'border rounded-lg px-3 py-2.5 bg-white transition-all ' + (snapshot.isDragging ? 'border-indigo-300 shadow-lg rotate-1' : 'border-gray-200 hover:border-gray-300')}
                    onMouseEnter={() => setHoverId(task.id)}
                    onMouseLeave={() => setHoverId(null)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-800 leading-snug break-words flex-1">{task.title}</p>
                      {task.goal_id && goalMap[task.goal_id] && (
                        <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: goalMap[task.goal_id].color }} />
                      )}
                    </div>
                    {task.notes && <p className="text-xs text-gray-400 mt-1 truncate">{task.notes}</p>}
                    {!snapshot.isDragging && hoverId === task.id && (
                      <div className="flex gap-2 mt-1.5">
                        <button onClick={() => onEdit(task)} className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">Edit</button>
                        <button onClick={() => onDelete(task.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">Delete</button>
                      </div>
                    )}
                    {!snapshot.isDragging && hoverId !== task.id && (
                      <p className="text-xs text-gray-400 mt-1.5">Drag to a day</p>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <p className="text-xs text-gray-400 leading-relaxed">Drag tasks onto any day to schedule them.</p>
      </div>
    </div>
  )
}
