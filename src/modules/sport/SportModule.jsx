import { Route, Routes } from 'react-router-dom'
import WeekView from './WeekView'
import WorkoutMode from './WorkoutMode'
import RideView from './RideView'
import SportSettings from './SportSettings'

// Module Sport : semaine, séance muscu, séance vélo, réglages.
export default function SportModule() {
  return (
    <Routes>
      <Route index element={<WeekView />} />
      <Route path="seance/:id" element={<WorkoutMode />} />
      <Route path="velo/:id" element={<RideView />} />
      <Route path="reglages" element={<SportSettings />} />
    </Routes>
  )
}
