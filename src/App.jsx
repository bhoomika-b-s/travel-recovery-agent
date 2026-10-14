import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import StaffDashboard from './pages/StaffDashboard'
import StaffFlightDetail from './pages/StaffFlightDetail'
import PassengerDashboard from './pages/PassengerDashboard'

// All the routes of the app live here.
export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Passenger only */}
      <Route
        path="/passenger"
        element={
          <ProtectedRoute role="passenger">
            <PassengerDashboard />
          </ProtectedRoute>
        }
      />

      {/* Staff only */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute role="staff">
            <StaffDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/flights/:flightId"
        element={
          <ProtectedRoute role="staff">
            <StaffFlightDetail />
          </ProtectedRoute>
        }
      />

      {/* Anything else goes home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}