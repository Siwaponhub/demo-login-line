import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

function Menu() {
  const { user, logout } = useAuth();

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: "📊" },
    { name: "Bills", path: "/bills", icon: "💰" },
    { name: "Timeline", path: "/timeline", icon: "🗓️" },
    { name: "Calendar", path: "/calendar", icon: "📅" },
    { name: "Profile", path: "/profile", icon: "👤" },
  ];

  return (
    <div className="container pt-4">
      <div className="row g-3">
        {/* แสดงปุ่มเมนูหลัก */}
        {menuItems.map((item) => (
          <div className="col-6 col-md-4 col-lg-3" key={item.path}>
            <Link
              to={item.path}
              className="btn btn-outline-primary w-100 h-100 d-flex flex-column align-items-center justify-content-center p-4 shadow rounded-4"
              style={{ minHeight: "120px", fontSize: "18px" }}
            >
              <span style={{ fontSize: "32px" }}>{item.icon}</span>
              <span className="mt-2">{item.name}</span>
            </Link>
          </div>
        ))}

        {/* ปุ่ม Login / Logout */}
        <div className="col-6 col-md-4 col-lg-3">
          {user ? (
            <div
              className="btn btn-outline-danger w-100 h-100 d-flex flex-column align-items-center justify-content-center p-4 shadow rounded-4"
              style={{ minHeight: "120px", fontSize: "18px" }}
              onClick={logout}
            >
              <img
                src={user.picture}
                alt="profile"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  marginBottom: "8px",
                }}
              />
              <span>{user.name}</span>
              <small className="text-muted mt-1">Logout</small>
            </div>
          ) : (
            <Link
              to="/"
              className="btn btn-success w-100 h-100 d-flex flex-column align-items-center justify-content-center p-4 shadow rounded-4"
              style={{ minHeight: "120px", fontSize: "18px" }}
            >
              <span style={{ fontSize: "32px" }}>🔑</span>
              <span className="mt-2">Login with LINE</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default Menu;
