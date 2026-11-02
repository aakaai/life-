import { Route, Routes } from 'react-router-dom'
import TodayView from './TodayView'
import AddFood from './AddFood'
import WeightView from './WeightView'
import FoodSettings from './FoodSettings'
import { RecipeList, RecipeDetail, RecipeEditor, IngredientsView } from './Recipes'
import PlanView from './PlanView'
import ShoppingView from './ShoppingView'

// Module Alimentation : aujourd'hui, ajout, recettes, poids, réglages.
export default function FoodModule() {
  return (
    <Routes>
      <Route index element={<TodayView />} />
      <Route path="ajouter" element={<AddFood />} />
      <Route path="planning" element={<PlanView />} />
      <Route path="courses" element={<ShoppingView />} />
      <Route path="recettes" element={<RecipeList />} />
      <Route path="recettes/nouvelle" element={<RecipeEditor />} />
      <Route path="recettes/:id" element={<RecipeDetail />} />
      <Route path="recettes/:id/modifier" element={<RecipeEditor />} />
      <Route path="ingredients" element={<IngredientsView />} />
      <Route path="poids" element={<WeightView />} />
      <Route path="reglages" element={<FoodSettings />} />
    </Routes>
  )
}
