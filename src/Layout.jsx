import { Link, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

function Layout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const showNav = user && location.pathname !== "/";

  return (
    <div className="app-shell">
      {showNav && (
        <header className="app-topbar">
          <Link to="/menu" className="brand-link">
            <span className="brand-mark">L</span>
            <span>
              <strong>LINE Group Planner</strong>
              <small>จัดกลุ่มและวันว่าง</small>
            </span>
          </Link>
          <Link to="/profile" className="profile-chip">
            <img src={user.picture} alt={user.name} />
            <span>{user.name}</span>
          </Link>
        </header>
      )}

      <main className="app-main">{children}</main>
    </div>
  );
}

export default Layout;
