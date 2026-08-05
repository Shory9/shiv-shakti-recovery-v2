import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabaseClient";

type CaseRow = {
  id: string;
  account_number?: string | null;
  account_name?: string | null;
  bank_name?: string | null;
  assigned_executive?: string | null;
  assigned_executive_id?: string | null;
  executive_code?: string | null;
  status?: string | null;
  balance_inr?: number | string | null;
  customer_balance?: number | string | null;
  created_at?: string | null;
};

type PaymentRow = {
  id: string;
  case_id?: string | null;
  amount?: number | string | null;
  payment_date?: string | null;
  executive_id?: string | null;
  payment_mode?: string | null;
  receipt_number?: string | null;
  reference_number?: string | null;
  verification_status?: string | null;
  created_at?: string | null;
};

type ExecutiveRow = {
  id: string;
  executive_code?: string | null;
  agent_code?: string | null;
  full_name?: string | null;
  name?: string | null;
  area?: string | null;
};
type VisitRow = {
  case_id?: string | null;
  captured_at?: string | null;
  outcome?: string | null;
  executive_id?: string | null;
};

export default function ReportsPage(): React.ReactElement {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [executives, setExecutives] = useState<ExecutiveRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Date Filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const fetchAllRows = useCallback(async <T,>(table: string): Promise<T[]> => {
    const pageSize = 1000;
    const rows: T[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const page = (data ?? []) as T[];
      rows.push(...page);

      if (page.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [allCases, allPayments, allExecutives, allVisits] = await Promise.all([
        fetchAllRows<CaseRow>("cases"),
        fetchAllRows<PaymentRow>("payments"),
        fetchAllRows<ExecutiveRow>("executives"),
        fetchAllRows<VisitRow>("case_visits"),
      ]);

      setCases(allCases);
      setPayments(allPayments);
      setExecutives(allExecutives);
      setVisits(allVisits);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Reports data load nahi ho saka.";
      console.error("Error loading reports data:", message);
    } finally {
      setLoading(false);
    }
  }, [fetchAllRows]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Filtered Payments based on Date Range
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const pDate = p.payment_date || p.created_at;
      if (!pDate) return true;
      const dateStr = pDate.split("T")[0];
      if (fromDate && dateStr < fromDate) return false;
      if (toDate && dateStr > toDate) return false;
      return true;
    });
  }, [payments, fromDate, toDate]);
  const filteredVisits = useMemo(() => visits.filter((v) => { const d=(v.captured_at||"").split("T")[0]; if(fromDate&&d&&d<fromDate)return false;if(toDate&&d&&d>toDate)return false;return true;}),[visits,fromDate,toDate]);

  // Real Analytics Calculations
  const totalRecoveryAmount = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const totalAssignedLoan = useMemo(() => {
    return cases.reduce(
      (sum, c) => sum + (Number(c.balance_inr ?? c.customer_balance) || 0) * 100000,
      0
    );
  }, [cases]);

  // Bank-Wise Recovery Metrics
  const bankReport = useMemo(() => {
    const map = new Map<string, { totalAmount: number; count: number }>();
    const casesById = new Map(cases.map((item) => [String(item.id), item]));
    filteredPayments.forEach((p) => {
      const linkedCase = p.case_id ? casesById.get(String(p.case_id)) : undefined;
      const bank = linkedCase?.bank_name?.trim() || "Unspecified Bank";
      const current = map.get(bank) || { totalAmount: 0, count: 0 };
      map.set(bank, {
        totalAmount: current.totalAmount + (Number(p.amount) || 0),
        count: current.count + 1,
      });
    });
    return Array.from(map.entries()).map(([bank, data]) => ({
      bank,
      totalAmount: data.totalAmount,
      count: data.count,
    }));
  }, [cases, filteredPayments]);

  // Executive-Wise Performance Report
  const executiveReport = useMemo(() => {
    const map = new Map<string, { name: string; recovered: number; collectionsCount: number }>();

    const profileById = new Map<string, string>();

    executives.forEach((ex) => {
      const code = (ex.executive_code || ex.agent_code || `SS${ex.id}`)
        .trim()
        .toLowerCase();
      const name = ex.full_name || ex.name || "Unknown Executive";

      map.set(code, { name, recovered: 0, collectionsCount: 0 });
      profileById.set(String(ex.id), code);
    });

    filteredPayments.forEach((p) => {
      const matchedCode = p.executive_id
        ? profileById.get(String(p.executive_id))
        : undefined;

      if (!matchedCode) return;

      const item = map.get(matchedCode);
      if (!item) return;

      item.recovered += Number(p.amount) || 0;
      item.collectionsCount += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.recovered - a.recovered);
  }, [executives, filteredPayments]);

  // Case Status Overview
  const statusReport = useMemo(() => {
    const map = new Map<string, number>();
    cases.forEach((c) => {
      const st = c.status?.trim().toUpperCase() || "PENDING";
      map.set(st, (map.get(st) || 0) + 1);
    });
    return Array.from(map.entries());
  }, [cases]);

  // CSV Export Handler
  const exportToCSV = () => {
    const casesById = new Map(cases.map((item) => [String(item.id), item]));
    const executivesById = new Map(
      executives.map((item) => [String(item.id), item])
    );
    const headers = ["Payment ID", "Case ID", "Bank Name", "Executive Code", "Amount (₹)", "Payment Date"];
    const rows = filteredPayments.map((p) => [
      p.id,
      p.case_id || "-",
      `"${(p.case_id ? casesById.get(String(p.case_id))?.bank_name : null) || "-"}"`,
      `"${(p.executive_id ? executivesById.get(String(p.executive_id))?.executive_code : null) || "-"}"`,
      p.amount || 0,
      p.payment_date || p.created_at || "-",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Recovery_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: "26px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
            📊 Live Executive & Recovery Analytics Report
          </h1>
          <p style={{ color: "#64748b", margin: "4px 0 0 0", fontSize: "14px" }}>
            Shiv Shakti Recovery V2 CRM - Financial Real-time Reports
          </p>
        </div>

        <button
          onClick={exportToCSV}
          style={{
            padding: "12px 20px",
            backgroundColor: "#059669",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontWeight: "700",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(5, 150, 105, 0.2)",
          }}
        >
          📥 Export Payments CSV
        </button>
      </div>

      {/* Date Filter Bar */}
      <div style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "24px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontWeight: "700", color: "#334155", fontSize: "14px" }}>📅 Filter By Date:</span>
        <label style={{ fontSize: "13px", color: "#64748b" }}>
          From:{" "}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginLeft: "6px" }}
          />
        </label>
        <label style={{ fontSize: "13px", color: "#64748b" }}>
          To:{" "}
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", marginLeft: "6px" }}
          />
        </label>
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(""); setToDate(""); }}
            style={{ padding: "8px 14px", backgroundColor: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading real-time reports data...</div>
      ) : (
        <>
          {/* Top Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>Real Total Recovery</span>
              <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#059669", margin: "8px 0 0 0" }}>
                ₹{totalRecoveryAmount.toLocaleString("en-IN")}
              </h2>
            </div>

            <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>Total Loan Outstanding</span>
              <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#2563eb", margin: "8px 0 0 0" }}>
                ₹{totalAssignedLoan.toLocaleString("en-IN")}
              </h2>
            </div>

            <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>Total Cases</span>
              <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "8px 0 0 0" }}>
                {cases.length}
              </h2>
            </div>

            <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>Total Field Staff</span>
              <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#d97706", margin: "8px 0 0 0" }}>
                {executives.length}
              </h2>
            </div>
            <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}><span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>Verified Field Visits</span><h2 style={{ fontSize: "28px", fontWeight: "800", color: "#7c3aed", margin: "8px 0 0 0" }}>{filteredVisits.length}</h2></div>
          </div>

          {/* Grid Layout for Detailed Reports */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "20px" }}>
            
            {/* Executive Leaderboard */}
            <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", color: "#0f172a" }}>
                🏆 Executive Recovery Performance
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                    <th style={{ padding: "8px" }}>Executive</th>
                    <th style={{ padding: "8px" }}>Collections</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {executiveReport.map((ex, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 8px", fontWeight: "600", color: "#1e293b" }}>{ex.name}</td>
                      <td style={{ padding: "10px 8px", color: "#64748b" }}>{ex.collectionsCount} txns</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "700", color: "#059669" }}>
                        ₹{ex.recovered.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                  {executiveReport.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: "12px", textAlign: "center", color: "#94a3b8" }}>No data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bank-wise Recovery Report */}
            <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", color: "#0f172a" }}>
                🏦 Bank-Wise Recovery Report
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                    <th style={{ padding: "8px" }}>Bank / Client</th>
                    <th style={{ padding: "8px" }}>Payments</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>Recovered Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bankReport.map((b, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 8px", fontWeight: "600", color: "#1e293b" }}>{b.bank}</td>
                      <td style={{ padding: "10px 8px", color: "#64748b" }}>{b.count} txns</td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: "700", color: "#2563eb" }}>
                        ₹{b.totalAmount.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                  {bankReport.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: "12px", textAlign: "center", color: "#94a3b8" }}>No data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Case Status Distribution */}
            <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", color: "#0f172a" }}>
                📌 Case Status Breakdown
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {statusReport.map(([st, count], idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontWeight: "700", fontSize: "12px", color: "#334155" }}>{st}</span>
                    <span style={{ fontWeight: "800", fontSize: "14px", color: "#2563eb" }}>{count} Cases</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
