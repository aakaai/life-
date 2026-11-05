import { Route, Routes } from 'react-router-dom'
import WeekView from './WeekView'
import WorkoutMode from './WorkoutMode'
import RideView from './RideView'
import SouplesseMode from './SouplesseMode'
import SportSettings from './SportSettings'
import ProgressView from './ProgressView'

// Module Sport : semaine, progrès (graphiques), séance muscu, séance vélo, étirements et mobilité, réglages.
export default function SportModule() {
  return (
    <Routes>
      <Route index element={<WeekView />} />
      <Route path="seance/:id" element={<WorkoutMode />} />
      <Route path="velo/:id" element={<RideView />} />
      <Route path="souplesse/:id" element={<SouplesseMode />} />
      <Route path="progres" element={<ProgressView />} />
      <Route path="reglages" element={<SportSettings />} />
    </Routes>
  )
}
