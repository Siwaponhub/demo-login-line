import { Link, useNavigate, useLocation } from "react-router-dom";

function BackHomeButtons() {
  const navigate = useNavigate();
  const location = useLocation();

  const isGroupDetail = location.pathname.startsWith("/group/");

  return (
    <div className="text-center mt-4 d-flex gap-2">
      {!isGroupDetail && (
        <button
          onClick={() => navigate(-1)}
          className="d-block flex-fill p-3 shadow rounded-4 border-0"
          style={{
            backgroundColor: "#e9ecef",
            fontWeight: "500",
            color: "#333",
          }}
        >
          ⬅ กลับ
        </button>
      )}

      <Link
        to="/menu"
        className="d-block flex-fill p-3 shadow rounded-4 text-decoration-none"
        style={{
          backgroundColor: "#f8f9fa",
          border: "2px solid #dee2e6",
          fontWeight: "500",
          color: "#333",
        }}
      >
        🏠 Home
      </Link>
    </div>
  );
}

export default BackHomeButtons;
