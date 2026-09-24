import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/login/Login'
import Signup from './pages/signup/Signup'
import Dashboard from './pages/dashboard/Dashboard'
import UploadInvoice from './pages/dashboard/uploadInvoice/UploadInvoice'
import Invoices from './pages/dashboard/invoices/Invoices'
import InvoiceDetail from './pages/dashboard/invoices/InvoiceDetail'
import FraudDetection from './pages/dashboard/fraudDetection/FraudDetection'
import Analytics from './pages/dashboard/analytics/Analytics'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/upload-invoice" element={<UploadInvoice />} />
      <Route path="/dashboard/invoices" element={<Invoices />} />
      <Route path="/dashboard/invoices/:invoiceId" element={<InvoiceDetail />} />
      <Route path="/dashboard/fraud-detection" element={<FraudDetection />} />
      <Route path="/dashboard/analytics" element={<Analytics />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
