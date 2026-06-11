import { Routes, Route, Navigate } from 'react-router-dom'
import UploadPage from './pages/UploadPage.jsx'
import PreviewPage from './pages/PreviewPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import HealthPage from './pages/HealthPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sync" replace />} />
      <Route path="/sync" element={<UploadPage />} />
      <Route path="/sync/history" element={<HistoryPage />} />
      <Route path="/sync/:id" element={<PreviewPage />} />
      <Route path="/sync/health" element={<HealthPage />} />
    </Routes>
  )
}