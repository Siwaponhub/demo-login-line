import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";

function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container mt-4 text-center">
        <h3>ยังไม่ได้ Login</h3>
        <Link to="/" className="btn btn-success mt-3">
          🔑 Login with LINE
        </Link>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="card shadow rounded-4 p-4 text-center">
        <img
          src={user.picture}
          alt="profile"
          className="rounded-circle mb-3 shadow mx-auto d-block"
          style={{ width: "120px", height: "120px" }}
        />
        <h3 className="fw-bold">{user.name}</h3>
        <p className="text-muted">{user.email}</p>
        {/* <p className="text-muted small">LINE ID: {user.userId}</p> */}
      </div>

      <div className="text-center mt-4">
        <Link
          to="/"
          className="d-block p-3 shadow rounded-4 text-decoration-none"
          style={{
            backgroundColor: "#f8f9fa",
            border: "2px solid #dee2e6",
            fontWeight: "500",
            color: "#333",
          }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}

export default Profile;
