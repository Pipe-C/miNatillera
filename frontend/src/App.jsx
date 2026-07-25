import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AuroraBackground from './components/AuroraBackground'
import Landing from './views/Landing'
import Home from './views/Home'
import GroupDashboard from './views/GroupDashboard'
import Contribute from './views/Contribute'
import JoinManager from './views/JoinManager'
import Layout from './components/Layout'

export default function App() {
  const location = useLocation()
  const bgVariant = location.pathname === '/' ? 'landing' : 'home'

  return (
    <>
      <AuroraBackground variant={bgVariant} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={<Layout><Home /></Layout>} />
        <Route path="/group/:groupId" element={<Layout><GroupDashboard /></Layout>} />
        <Route path="/group/:groupId/contribute" element={<Layout><Contribute /></Layout>} />
        <Route path="/group/:groupId/join-manager" element={<Layout><JoinManager /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
