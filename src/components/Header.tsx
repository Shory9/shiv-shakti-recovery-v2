type Menu =
  | "Dashboard"
  | "Bank Import"
  | "Cases"
  | "Executives"
  | "Executive App"
  | "GPS Tracking"
  | "Payments"
  | "Reports";

type HeaderProps = {
  activeMenu: Menu;
  onLogout: () => void;
};

function Header({ activeMenu, onLogout }: HeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">SHIV SAKTI RECOVERY NIMACH</p>
        <h1>{activeMenu}</h1>
        <p>Cases, recovery aur field team ka complete management.</p>
      </div>

      <div className="profile-box">
        <div className="profile-avatar">A</div>

        <div>
          <strong>Admin</strong>
          <span>Management</span>
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

export default Header;