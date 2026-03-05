import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import Home from './pages/Home';
import DemoIntro from './pages/DemoIntro';
import Recaudos from './pages/Recaudos';
import Done from './pages/Done';

export default function App() {
  return (
    <div className="min-h-screen bg-ubii-blue text-ubii-black">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<DemoIntro />} />
        <Route path="/onboarding" element={<Recaudos />} />
        <Route path="/recaudos" element={<Recaudos />} />
        <Route path="/done" element={<Done />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
