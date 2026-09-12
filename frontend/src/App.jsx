import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/login/Login'
import Signup from './pages/signup/Signup'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
