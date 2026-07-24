import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { format, parseISO, startOfDay, addDays } from 'date-fns'

const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }
const STATUS_LABEL = { inbox: 'Inbox', scheduled: 'Scheduled', done: 'Done' }

function fmtDate(str) {
  if (!str) return ''
  try { return format(parseISO(str), 'MMM d, yyyy') } catch { return str }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function weekRange(weekStart) {
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), 'yyyy-MM-dd')
  )
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function exportPDF({ tasks, goals, reflections }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = margin

  function sectionTitle(text) {
    if (y > 250) { doc.addPage(); y = margin }
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(79, 70, 229)
    doc.text(text, margin, y)
    y += 2
    doc.setDrawColor(200, 200, 235)
    doc.line(margin, y, pageW - margin, y)
    y += 6
    doc.setTextColor(30, 30, 30)
  }

  // Header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Schedulent Export', margin, y)
  y += 5
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(130, 130, 130)
  doc.text('Generated ' + format(new Date(), 'MMMM d, yyyy · h:mm a'), margin, y)
  y += 10

  // Goals
  if (goals.length > 0) {
    sectionTitle('Goals')
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Goal', 'Category', 'Status']],
      body: goals.map(g => [g.title || '', g.category || '', g.status || '']),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 247, 255] },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // Tasks — grouped by status
  const scheduled = tasks.filter(t => t.status === 'scheduled').sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
  const inbox = tasks.filter(t => t.status === 'inbox')
  const done = tasks.filter(t => t.status === 'done')

  const taskGroups = [
    { label: 'Scheduled Tasks', rows: scheduled },
    { label: 'Inbox (Unscheduled)', rows: inbox },
    { label: 'Completed Tasks', rows: done },
  ].filter(g => g.rows.length > 0)

  for (const group of taskGroups) {
    if (y > 220) { doc.addPage(); y = margin }
    sectionTitle(group.label)
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Title', 'Priority', 'Scheduled', 'Due', 'Category']],
      body: group.rows.map(t => [
        t.title || '',
        PRIORITY_LABEL[t.priority] || '',
        fmtDate(t.scheduled_date),
        fmtDate(t.due_date),
        t.category || '',
      ]),
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 247, 255] },
      columnStyles: { 0: { cellWidth: 70 } },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // Reflections
  if (reflections.length > 0) {
    const sorted = [...reflections].sort((a, b) => b.date.localeCompare(a.date))
    if (y > 220) { doc.addPage(); y = margin }
    sectionTitle('Daily Reflections')
    for (const r of sorted) {
      if (y > 255) { doc.addPage(); y = margin }
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(60, 60, 60)
      doc.text(fmtDate(r.date), margin, y)
      y += 5

      if (r.completed_notes) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 100, 100)
        doc.text('What I got done:', margin + 2, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(40, 40, 40)
        const lines = doc.splitTextToSize(r.completed_notes, pageW - margin * 2 - 4)
        doc.text(lines, margin + 2, y)
        y += lines.length * 4 + 2
      }

      if (r.goals_notes) {
        if (y > 265) { doc.addPage(); y = margin }
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 100, 100)
        doc.text('Intentions for tomorrow:', margin + 2, y)
        y += 4
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(40, 40, 40)
        const lines = doc.splitTextToSize(r.goals_notes, pageW - margin * 2 - 4)
        doc.text(lines, margin + 2, y)
        y += lines.length * 4 + 2
      }

      y += 4
      doc.setDrawColor(220, 220, 220)
      doc.line(margin, y, pageW - margin, y)
      y += 6
    }
  }

  doc.save('schedulent-export-' + todayStr() + '.pdf')
}

// ─── SPREADSHEET ─────────────────────────────────────────────────────────────

function taskRows(tasks) {
  return tasks.map(t => ({
    Title: t.title || '',
    Status: STATUS_LABEL[t.status] || t.status || '',
    Priority: PRIORITY_LABEL[t.priority] || '',
    'Scheduled Date': t.scheduled_date || '',
    'Due Date': t.due_date || '',
    'Time Slot': t.bucket || '',
    'Start Time': t.start_time || '',
    Category: t.category || '',
    Notes: t.notes || '',
    'Created At': t.created_at ? format(parseISO(t.created_at), 'yyyy-MM-dd HH:mm') : '',
  }))
}

export function exportSpreadsheet({ tasks, goals, reflections, scope, weekStart }) {
  const wb = XLSX.utils.book_new()

  // Tasks sheet — filtered by scope
  let filteredTasks = tasks
  let sheetLabel = 'All Tasks'

  if (scope === 'today') {
    const today = todayStr()
    filteredTasks = tasks.filter(t => t.scheduled_date === today)
    sheetLabel = 'Today'
  } else if (scope === 'week') {
    const days = weekRange(weekStart)
    filteredTasks = tasks.filter(t => t.scheduled_date && days.includes(t.scheduled_date))
    sheetLabel = 'This Week'
  } else if (scope === 'inbox') {
    filteredTasks = tasks.filter(t => t.status === 'inbox')
    sheetLabel = 'Inbox'
  }

  const taskWs = XLSX.utils.json_to_sheet(taskRows(filteredTasks))
  taskWs['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, taskWs, sheetLabel)

  // Goals sheet (always all)
  const goalRows = goals.map(g => ({
    Title: g.title || '',
    Category: g.category || '',
    Status: g.status || '',
    Notes: g.notes || '',
    'Created At': g.created_at ? format(parseISO(g.created_at), 'yyyy-MM-dd HH:mm') : '',
  }))
  const goalWs = XLSX.utils.json_to_sheet(goalRows)
  goalWs['!cols'] = [{ wch: 40 }, { wch: 25 }, { wch: 12 }, { wch: 40 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, goalWs, 'Goals')

  // Reflections sheet (always all)
  const reflectionRows = [...reflections]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(r => ({
      Date: r.date,
      'What I Got Done': r.completed_notes || '',
      'Intentions for Tomorrow': r.goals_notes || '',
      'Last Updated': r.updated_at ? format(parseISO(r.updated_at), 'yyyy-MM-dd HH:mm') : '',
    }))
  const reflectWs = XLSX.utils.json_to_sheet(reflectionRows)
  reflectWs['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 50 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, reflectWs, 'Reflections')

  XLSX.writeFile(wb, 'schedulent-export-' + todayStr() + '.xlsx')
}
