import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import "./App.css";

import BankImport from "./components/BankImport";
import CasesPage from "./components/CasesPage";
import DashboardPage from "./components/DashboardPage";
import ExecutiveAppPage from "./components/ExecutiveAppPage";
import ExecutivesPage from "./components/ExecutivesPage";
import FieldVisitsPage from "./components/FieldVisitsPage";
import GPSPage from "./components/GPSPage";
import Header from "./components/Header";
import LoginPage from "./components/LoginPage";
import MobileExecutiveApp from "./components/MobileExecutiveApp";
import PaymentsPage from "./components/PaymentsPage";
import ReportsPage from "./components/ReportsPage";
import Sidebar from "./components/Sidebar";
import type { Menu } from "./components/Sidebar";

function App() {
  const isNativeApp = Capacitor.isNativePlatform();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeMenu, setActiveMenu] = useState<Menu>("Dashboard");

  if (isNativeApp) {
    return <MobileExecutiveApp />;
  }

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveMenu("Dashboard");
  };

  const renderPage = () => {
    switch (activeMenu) {
      case "Dashboard":
        return <DashboardPage />;

      case "Bank Import":
        return <BankImport />;

      case "Cases":
        return <CasesPage />;

      case "Executive":
        return <ExecutivesPage />;

      case "Executive App":
        return <ExecutiveAppPage />;

      case "GPS Tracking":
        return <GPSPage />;

      case "Field Visits":
        return <FieldVisitsPage />;

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
