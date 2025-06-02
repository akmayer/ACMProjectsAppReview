import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import GoogleSheetViewer from './pages/GoogleSheetViewer';
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/review" element={<GoogleSheetViewer />} />
    </Routes>
  );
}

export default App;
