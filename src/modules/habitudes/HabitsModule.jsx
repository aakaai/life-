import { Route, Routes } from 'react-router-dom'
import RoutineView from './RoutineView'
import RoutinesManage from './RoutinesManage'
import TodayView from './TodayView'
import CalendarView from './CalendarView'
import ReviewView from './ReviewView'
import ManageView from './ManageView'
import HabitEditor from './HabitEditor'

// Module Habitudes : aujourd'hui, calendrier, bilans, gérer.
export default function HabitsModule() {
  return (
    <Routes>
      <Route index element={<TodayView />} />
      <Route path="calendrier" element={<CalendarView />} />
      <Route path="bilans" element={<ReviewView />} />
      <Route path="gerer" element={<ManageView />} />
      <Route path="routines" element={<RoutinesManage />} />
      <Route path="routine/:which" element={<RoutineView />} />
      <Route path="gerer/nouvelle" element={<HabitEditor />} />
      <Route path="gerer/:id" element={<HabitEditor />} />
    </Routes>
  )
}
