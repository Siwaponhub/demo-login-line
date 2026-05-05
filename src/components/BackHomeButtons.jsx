import { Link, useLocation, useNavigate } from "react-router-dom";

function BackHomeButtons() {
  const navigate = useNavigate();
  const location = useLocation();
  const isGroupDetail = /^\/group\/[^/]+$/.test(location.pathname);

  return (
    <div className="back-actions">
      {!isGroupDetail && (
        <button onClick={() => navigate(-1)} className="btn btn-light border py-3">
          กลับ
        </button>
      )}

      <Link to="/menu" className="btn btn-outline-success py-3">
        หน้าหลัก
      </Link>
    </div>
  );
}

export default BackHomeButtons;
