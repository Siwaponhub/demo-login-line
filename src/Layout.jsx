import Navbar from "./components/Navbar"; // สมมุติว่ามี
import Sidebar from "./components/Sidebar"; // สมมุติว่ามี

function Layout({ children }) {
  return (
    <div>
      {/* <Navbar /> */}
      <div className="d-flex">
        {/* <Sidebar /> */}
        <div className="flex-grow-1 p-4">{children}</div>
      </div>
    </div>
  );
}

export default Layout;
