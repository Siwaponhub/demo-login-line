import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import LoginButton from "./components/LoginButton";
import BillManager from "./components/BillManager";
import Timeline from "./components/Timeline";
import AvailabilityCalendar from "./components/AvailabilityCalendar";
import Callback from "./Callback";
import Dashboard from "./components/Dashboard";
import Profile from "./components/Profile";
import Menu from "./components/Menu";
import { useAuth } from "./AuthContext";

function App() {
  const { user } = useAuth();

  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/menu" /> : <LoginButton />}
        />
        <Route path="/callback" element={<Callback />} />
        <Route path="/menu" element={user ? <Menu /> : <Navigate to="/" />} />
        <Route
          path="/dashboard"
          element={user ? <Dashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/bills"
          element={user ? <BillManager /> : <Navigate to="/" />}
        />
        <Route
          path="/timeline"
          element={user ? <Timeline /> : <Navigate to="/" />}
        />
        <Route
          path="/calendar"
          element={user ? <AvailabilityCalendar /> : <Navigate to="/" />}
        />
        <Route
          path="/profile"
          element={user ? <Profile /> : <Navigate to="/" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default App;
