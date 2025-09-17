import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="navbar navbar-dark bg-dark fixed-top px-3 d-flex justify-content-between align-items-center">
      {/* โลโก้ */}
      <Link className="navbar-brand" to="/">
        My App
      </Link>

      {/* เมนู */}
      <div className="d-flex align-items-center gap-2">
        <Link className="btn btn-outline-light btn-sm" to="/dashboard">
          Dashboard
        </Link>
        <Link className="btn btn-outline-light btn-sm" to="/bills">
          Bills
        </Link>
        <Link className="btn btn-outline-light btn-sm" to="/timeline">
          Timeline
        </Link>
        <Link className="btn btn-outline-light btn-sm" to="/calendar">
          Calendar
        </Link>

        {user ? (
          <div className="d-flex align-items-center ms-3">
            <img
              src={user.picture}
              alt="profile"
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                marginRight: "8px",
              }}
            />
            <span className="text-white me-2">{user.name}</span>
            <button onClick={handleLogout} className="btn btn-sm btn-danger">
              Logout
            </button>
          </div>
        ) : (
          <Link className="btn btn-outline-light btn-sm" to="/">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
