function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark fixed-top px-3">
      <a className="navbar-brand" href="/">
        My App
      </a>

      <button
        className="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarNav"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span className="navbar-toggler-icon"></span>
      </button>

      <div className="collapse navbar-collapse" id="navbarNav">
        <ul className="navbar-nav ms-auto">
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
    </nav>
  );
}

export default Navbar;
