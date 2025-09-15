import { Routes, Route } from "react-router-dom";
import LoginButton from "./LoginButton";
import Callback from "./Callback";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginButton />} />
      <Route path="/callback" element={<Callback />} />
    </Routes>
  );
}

export default App;
