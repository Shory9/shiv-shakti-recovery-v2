import { useState } from "react";
import "./App.css";

import BankImportPage from "./components/BankImportPage";
import CasesPage from "./components/CasesPage";
import DashboardPage from "./components/DashboardPage";
import ExecutiveAppPage from "./components/ExecutiveAppPage";
import ExecutivesPage from "./components/ExecutivesPage";
import GPSPage from "./components/GPSPage";
import Header from "./components/Header";
import LoginPage from "./components/LoginPage";
import PaymentsPage from "./components/PaymentsPage";
import ReportsPage from "./components/ReportsPage";
import Sidebar from "./components/Sidebar";

type Menu =
  | "Dashboard"
  | "Bank Import"
  | "Cases"
  | "Executives"
  | "Executive App"
  | "GPS Tracking"
  | "Payments"
  | "Reports";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeMenu, setActiveMenu] = useState<Menu>("Dashboard");

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveMenu("Dashboard");
  };

  const renderPage = () => {
    switch (activeMenu) {
      case "Dashboard":
        return <DashboardPage />;

      case "Bank Import":
        return <BankImportPage />;

      case "Cases":
        return <CasesPage />;

      case "Executives":
        return <ExecutivesPage />;

      case "Executive App":
        return <ExecutiveAppPage />;

      case "GPS Tracking":
        return <GPSPage />;

      case "Payments":
        return <PaymentsPage />;

      case "Reports":
        return <ReportsPage />;

      default:
        return <DashboardPage />;
    }
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeMenu={activeMenu}
        onMenuChange={setActiveMenu}
      />

      <main className="main-content">
        <Header
          activeMenu={activeMenu}
          onLogout={handleLogout}
        />

        {renderPage()}
      </main>
    </div>
  );
}

export default App;

