function Sidebar() {
  return (
    <div
      className="bg-light border-end vh-100 position-fixed d-none d-md-block"
      style={{ width: "220px", top: "56px", left: 0 }}
    >
      <h5 className="p-3">Menu</h5>
      <ul className="nav flex-column">
        <li className="nav-item">
          <a className="nav-link" href="/dashboard">
            Dashboard
          </a>
        </li>
        <li className="nav-item">
          <a className="nav-link" href="/bills">
            Bills
          </a>
        </li>
        <li className="nav-item">
          <a className="nav-link" href="/timeline">
            Timeline
          </a>
        </li>
        <li className="nav-item">
          <a className="nav-link" href="/calendar">
            Calendar
          </a>
        </li>
        <li className="nav-item">
          <a className="nav-link" href="/profile">
            Profile
          </a>
        </li>
      </ul>
    </div>
  );
}

export default Sidebar;
