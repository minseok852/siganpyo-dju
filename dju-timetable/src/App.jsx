// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SharedPage from './pages/SharedPage';
import PopularPage from './pages/PopularPage';
import AIPage from './pages/AIPage';
import RecommendPage from './pages/RecommendPage';
import FAQPage from './pages/FAQPage';
import FeedbackPage from './pages/FeedbackPage';
import FeedbackAdminPage from './pages/FeedbackAdminPage';
import UpdateLogPage from './pages/UpdateLogPage';
import UpdateAdminPage from './pages/UpdateAdminPage';
import GraduationCalculator from './pages/Graduationcalculator';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/share/:shareId" element={<SharedPage />} />
        <Route path="/popular" element={<PopularPage />} />
        <Route path="/ai" element={<AIPage />} />
        <Route path="/recommend" element={<RecommendPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/feedback/admin" element={<FeedbackAdminPage />} />
        <Route path="/updates" element={<UpdateLogPage />} />
        <Route path="/updates/admin" element={<UpdateAdminPage />} />
        <Route path="/graduation" element={<GraduationCalculator />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;