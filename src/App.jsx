import { Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import LoginButton from "./components/LoginButton";
import BillManager from "./components/BillManager";
import Timeline from "./components/Timeline";
import AvailabilityCalendar from "./components/AvailabilityCalendar";
import Callback from "./Callback";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LoginButton />} />
        <Route path="/callback" element={<Callback />} /> {/* ✅ ใช้ตรงนี้ */}
        <Route path="/bills" element={<BillManager />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/calendar" element={<AvailabilityCalendar />} />
      </Routes>
    </Layout>
  );
}

export default App;
