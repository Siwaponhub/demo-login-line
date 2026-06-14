import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./Layout";
import LoginButton from "./components/LoginButton";
import BillManager from "./components/BillManager";
import Timeline from "./components/Timeline";
import AvailabilityCalendar from "./components/AvailabilityCalendar";
import Callback from "./Callback";
import Dashboard from "./components/Dashboard";
import Profile from "./components/Profile";
import Menu from "./components/Menu";
import CreateGroup from "./components/CreateGroup";
import GroupDetail from "./components/GroupDetail";
import CalendarGroups from "./components/CalendarGroups";
import GuideMenu from "./components/GuideMenu";
import GuideTutorial from "./components/GuideTutorial";
import AdminPanel from "./components/AdminPanel";
import { useAuth } from "./AuthContext";

function App() {
  const { user } = useAuth();
  const location = useLocation();

  const withAuth = (element) => {
    if (user) return element;

    const query = new URLSearchParams(location.search);
    const gid = query.get("groupId");
    if (gid) {
      localStorage.setItem("pendingGroupId", gid);
    }

    return <LoginButton />;
  };

  return (
    <Layout>
      <GuideTutorial />
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/menu" /> : <LoginButton />}
        />
        <Route path="/callback" element={<Callback />} />
        <Route path="/menu" element={withAuth(<Menu />)} />
        <Route path="/dashboard" element={withAuth(<Dashboard />)} />
        <Route path="/group/:id" element={withAuth(<GroupDetail />)} />
        <Route path="/group/:id/bills" element={withAuth(<BillManager />)} />
        <Route path="/group/:id/timeline" element={withAuth(<Timeline />)} />
        <Route path="/bills" element={withAuth(<BillManager />)} />
        <Route path="/timeline" element={withAuth(<Timeline />)} />
        <Route path="/calendar" element={withAuth(<CalendarGroups />)} />
        <Route path="/calendar/:id" element={withAuth(<AvailabilityCalendar />)} />
        <Route path="/profile" element={withAuth(<Profile />)} />
        <Route path="/creategroup" element={withAuth(<CreateGroup />)} />
        <Route path="/guide" element={withAuth(<GuideMenu />)} />
        <Route path="/admin" element={withAuth(<AdminPanel />)} />
        {/* <Route path="/join" element={withAuth(JoinGroup)} /> */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default App;
