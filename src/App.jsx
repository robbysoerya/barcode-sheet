import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import SheetDetail from './pages/SheetDetail';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sheet/:sheetId" element={<SheetDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
