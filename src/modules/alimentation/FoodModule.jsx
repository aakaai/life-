import { Route, Routes } from 'react-router-dom'
import TodayView from './TodayView'
import AddFood from './AddFood'
import WeightView from './WeightView'
import FoodSettings from './FoodSettings'
import { RecipeList, RecipeEditor } from './Recipes'

// Module Alimentation : aujourd'hui, ajout, recettes, poids, réglages.
export default function FoodModule() {
  return (
    <Routes>
      <Route index element={<TodayView />} />
      <Route path="ajouter" element={<AddFood />} />
      <Route path="recettes" element={<RecipeList />} />
      <Route path="recettes/:id" element={<RecipeEditor />} />
      <Route path="poids" element={<WeightView />} />
      <Route path="reglages" element={<FoodSettings />} />
    </Routes>
  )
}
