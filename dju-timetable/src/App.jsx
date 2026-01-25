// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SharedPage from './pages/SharedPage';
import PopularPage from './pages/PopularPage';
// import AIPage from './pages/AIPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/share/:shareId" element={<SharedPage />} />
        <Route path="/popular" element={<PopularPage />} />
        {/* <Route path="/ai" element={<AIPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;