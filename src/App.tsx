import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import "./App.css";

import BankImport from "./components/BankImport";
import CasesPage from "./components/CasesPage";
import DashboardPage from "./components/DashboardPage";
import ExecutiveAppPage from "./components/ExecutiveAppPage";
import ExecutivesPage from "./components/ExecutivesPage";
import type { Executive } from "./components/ExecutivesPage";
import FieldVisitsPage from "./components/FieldVisitsPage";
import GPSPage from "./components/GPSPage";
import Header from "./components/Header";
import LoginPage from "./components/LoginPage";
import MobileExecutiveApp from "./components/MobileExecutiveApp";
import PaymentsPage from "./components/PaymentsPage";
import ReportsPage from "./components/ReportsPage";
import Sidebar from "./components/Sidebar";
import type { Menu } from "./components/Sidebar";
import SBIManagementPage from "./components/SBIManagementPage";
import type { SbiExecutive } from "./components/SBIManagementPage";

function App() {
  const isNativeApp = Capacitor.isNativePlatform();
  const isSbiBuild = import.meta.env.VITE_MOBILE_BANK === "SBI";
  const isSbiPreview = window.location.pathname === "/sbi-preview";

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeMenu, setActiveMenu] = useState<Menu>("Dashboard");
  const [bankImportExecutive, setBankImportExecutive] = useState<Executive | null>(null);
  const [sbiImportExecutive, setSbiImportExecutive] = useState<SbiExecutive | null>(null);

  if (isNativeApp || isSbiPreview) {
    return <MobileExecutiveApp bankCode={isSbiBuild || isSbiPreview ? "SBI" : "BOB"} />;
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
        return <BankImport
          directExecutiveId={sbiImportExecutive?.id || (bankImportExecutive ? String(bankImportExecutive.id) : null)}
          directExecutiveName={sbiImportExecutive?.full_name || bankImportExecutive?.full_name || null}
          directBank={sbiImportExecutive ? "SBI" : bankImportExecutive ? "BOB" : null}
          onClearDirectExecutive={() => { setBankImportExecutive(null); setSbiImportExecutive(null); }}
        />;

      case "Cases":
        return <CasesPage />;

      case "Executive":
        return <ExecutivesPage onDirectImport={(executive) => { setSbiImportExecutive(null); setBankImportExecutive(executive); setActiveMenu("Bank Import"); }} />;

      case "Executive App":
        return <ExecutiveAppPage />;

      case "SBI Management":
        return <SBIManagementPage onDirectImport={(executive) => { setBankImportExecutive(null); setSbiImportExecutive(executive); setActiveMenu("Bank Import"); }} />;

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
