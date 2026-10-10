import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import PartPage from './pages/PartPage.jsx';
import Planner from './pages/Planner.jsx';
import Parts from './pages/Parts.jsx';
import Cartons from './pages/Cartons.jsx';
import Masters from './pages/Masters.jsx';
import Result from './pages/Result.jsx';
import Plans from './pages/Plans.jsx';
import Team from './pages/Team.jsx';
import ShareView from './pages/ShareView.jsx';
import ShareRun from './pages/ShareRun.jsx';
import Jobs from './pages/Jobs.jsx';

function Private({ children }) {
  const { session } = useAuth();
  const loc = useLocation();
  if (session === undefined) return <p className="page muted">Loading…</p>;
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      {/* Public read-only loading view for the warehouse phone */}
      <Route path="/share/:token" element={<ShareView />} />
      <Route path="/s/:token" element={<ShareRun />} />

      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<Private><Projects /></Private>} />
      <Route path="/projects/:id" element={<Private><ProjectDetail /></Private>} />
      <Route path="/projects/:projectId/parts/:partId" element={<Private><PartPage /></Private>} />
      <Route path="/jobs" element={<Private><Jobs /></Private>} />
      <Route path="/planner" element={<Private><Planner /></Private>} />
      <Route path="/parts" element={<Private><Parts /></Private>} />
      <Route path="/cartons" element={<Private><Cartons /></Private>} />
      <Route path="/pallets-containers" element={<Private><Masters /></Private>} />
      <Route path="/result" element={<Private><Result /></Private>} />
      <Route path="/plans" element={<Private><Plans /></Private>} />
      <Route path="/plans/:id" element={<Private><Result /></Private>} />
      <Route path="/team" element={<Private><Team /></Private>} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
