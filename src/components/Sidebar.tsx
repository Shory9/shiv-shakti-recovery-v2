type Menu =
  | "Dashboard"
  | "Bank Import"
  | "Cases"
  | "Executives"
  | "Executive App"
  | "GPS Tracking"
  | "Payments"
  | "Reports";

type SidebarProps = {
  activeMenu: Menu;
  onMenuChange: (menu: Menu) => void;
};

const menuItems: { name: Menu; icon: string }[] = [
  { name: "Dashboard", icon: "🏠" },
  { name: "Bank Import", icon: "📤" },
  { name: "Cases", icon: "📁" },
  { name: "Executives", icon: "👨‍💼" },
  { name: "Executive App", icon: "📱" },
  { name: "GPS Tracking", icon: "📍" },
  { name: "Payments", icon: "💰" },
  { name: "Reports", icon: "📊" },
];

function Sidebar({ activeMenu, onMenuChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">SSR</div>

        <div>
          <h2>Shiv Shakti</h2>
          <p>Recovery CRM V2</p>
        </div>
      </div>

      <nav className="menu">
        {menuItems.map((item) => (
          <button
            type="button"
            key={item.name}
            className={`menu-item ${
              activeMenu === item.name ? "active" : ""
            }`}
            onClick={() => onMenuChange(item.name)}
          >
            <span>{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;

