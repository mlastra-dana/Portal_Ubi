import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import Home from './pages/Home';
import DemoIntro from './pages/DemoIntro';
import OnboardingWizard from './pages/OnboardingWizard';
import Done from './pages/Done';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<DemoIntro />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/done" element={<Done />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
