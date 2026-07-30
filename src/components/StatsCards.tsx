import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type CaseRow = {
  id: number | string;
  status?: string | null;
};

type PaymentRow = {
  id: number | string;
  amount?: number | string | null;
};

type OperationRow = {
  id: number | string;
  created_at?: string | null;
  operation_date?: string | null;
  visit_date?: string | null;
  action_type?: string | null;
  operation_type?: string | null;
  status?: string | null;
};

type Tone = "blue" | "amber" | "green" | "purple";

type StatCard = {
  title: string;
  value: string;
  icon: string;
  note: string;
  trend: string;
  tone: Tone;
};

function isPendingStatus(status?: string | null): boolean {
  const normalized = String(status || "").trim().toLowerCase();

  return (
    !normalized ||
    normalized === "pending" ||
    normalized === "assigned" ||
    normalized === "open" ||
    normalized === "in progress" ||
    normalized === "in_progress" ||
    normalized === "follow up" ||
    normalized === "follow_up"
  );
}

function isVisitOperation(operation: OperationRow): boolean {
  const type = String(
    operation.action_type ||
      operation.operation_type ||
      operation.status ||
      ""
  )
    .trim()
    .toLowerCase();

  return (
    !type ||
    type.includes("visit") ||
    type.includes("field") ||
    type.includes("customer met")
  );
}

function getOperationDate(operation: OperationRow): string {
  return (
    operation.visit_date ||
    operation.operation_date ||
    operation.created_at ||
    ""
  );
}

function StatsCards() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [operations, setOperations] = useState<OperationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAllRows = useCallback(async <T,>(table: string): Promise<T[]> => {
    const rows: T[] = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error: queryError } = await supabase
        .from(table)
        .select("*")
        .range(from, from + pageSize - 1);

      if (queryError) throw queryError;

      const page = (data ?? []) as T[];
      rows.push(...page);

      if (page.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [caseRows, paymentRows, operationRows] = await Promise.all([
        fetchAllRows<CaseRow>("cases"),
        fetchAllRows<PaymentRow>("payments"),
        fetchAllRows<OperationRow>("case_operations"),
      ]);

      setCases(caseRows);
      setPayments(paymentRows);
      setOperations(operationRows);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Dashboard stats load nahi ho sake.";

      console.error("StatsCards load error:", caughtError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchAllRows]);

  useEffect(() => {
    void loadStats();

    const channel = supabase
      .channel("stats-cards-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => void loadStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => void loadStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_operations" },
        () => void loadStats()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadStats]);

  const stats = useMemo<StatCard[]>(() => {
    const totalCases = cases.length;
    const pendingCases = cases.filter((item) =>
      isPendingStatus(item.status)
    ).length;

    const today = new Date();
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    const visitedToday = operations.filter((operation) => {
      const operationDate = getOperationDate(operation);

      return (
        Boolean(operationDate) &&
        operationDate.slice(0, 10) === todayKey &&
        isVisitOperation(operation)
      );
    }).length;

    const totalRecovery = payments.reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0
    );

    const pendingPercent =
      totalCases > 0 ? (pendingCases / totalCases) * 100 : 0;

    return [
      {
        title: "Total Cases",
        value: totalCases.toLocaleString("en-IN"),
        icon: "▦",
        note: "All recovery cases",
        trend: "Live Data",
        tone: "blue",
      },
      {
        title: "Pending Cases",
        value: pendingCases.toLocaleString("en-IN"),
        icon: "◷",
        note: "Cases requiring action",
        trend: `${pendingPercent.toFixed(1)}%`,
        tone: "amber",
      },
      {
        title: "Visited Today",
        value: visitedToday.toLocaleString("en-IN"),
        icon: "✓",
        note: "Field visits completed",
        trend: "Today",
        tone: "green",
      },
      {
        title: "Total Recovery",
        value: `₹${totalRecovery.toLocaleString("en-IN")}`,
        icon: "₹",
        note: "Current collection value",
        trend: `${payments.length.toLocaleString("en-IN")} payments`,
        tone: "purple",
      },
    ];
  }, [cases, payments, operations]);

  return (
    <section className="stats-cards-grid">
      <style>{`
        .stats-cards-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .stats-cards-message {
          grid-column: 1 / -1;
          padding: 18px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
          color: #64748b;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
        }

        .stats-cards-message.error {
          color: #b91c1c;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .premium-stat-card {
          position: relative;
          overflow: hidden;
          min-width: 0;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .premium-stat-card:hover {
          transform: translateY(-3px);
          border-color: #cbd5e1;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
        }

        .premium-stat-card::after {
          content: "";
          position: absolute;
          top: -42px;
          right: -42px;
          width: 112px;
          height: 112px;
          border-radius: 999px;
          opacity: 0.14;
        }

        .premium-stat-card.blue::after { background: #2563eb; }
        .premium-stat-card.amber::after { background: #f59e0b; }
        .premium-stat-card.green::after { background: #10b981; }
        .premium-stat-card.purple::after { background: #7c3aed; }

        .premium-stat-top {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .premium-stat-copy {
          min-width: 0;
        }

        .premium-stat-copy p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .premium-stat-copy h3 {
          margin: 9px 0 0;
          color: #0f172a;
          font-size: clamp(24px, 2.4vw, 31px);
          line-height: 1;
          letter-spacing: -0.04em;
          overflow-wrap: anywhere;
        }

        .premium-stat-icon {
          width: 48px;
          height: 48px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 15px;
          font-size: 22px;
          font-weight: 900;
        }

        .blue .premium-stat-icon {
          color: #1d4ed8;
          background: #eff6ff;
        }

        .amber .premium-stat-icon {
          color: #b45309;
          background: #fffbeb;
        }

        .green .premium-stat-icon {
          color: #047857;
          background: #ecfdf5;
        }

        .purple .premium-stat-icon {
          color: #6d28d9;
          background: #f5f3ff;
        }

        .premium-stat-bottom {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #eef2f7;
        }

        .premium-stat-note {
          min-width: 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.4;
        }

        .premium-stat-trend {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 850;
          white-space: nowrap;
        }

        .blue .premium-stat-trend {
          color: #1d4ed8;
          background: #eff6ff;
        }

        .amber .premium-stat-trend {
          color: #b45309;
          background: #fffbeb;
        }

        .green .premium-stat-trend {
          color: #047857;
          background: #ecfdf5;
        }

        .purple .premium-stat-trend {
          color: #6d28d9;
          background: #f5f3ff;
        }

        @media (max-width: 1100px) {
          .stats-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .stats-cards-grid {
            grid-template-columns: 1fr;
          }

          .premium-stat-card {
            padding: 17px;
          }
        }
      `}</style>

      {loading ? (
        <div className="stats-cards-message">Loading live dashboard stats...</div>
      ) : error ? (
        <div className="stats-cards-message error">{error}</div>
      ) : (
        stats.map((stat) => (
          <article
            className={`premium-stat-card ${stat.tone}`}
            key={stat.title}
          >
            <div className="premium-stat-top">
              <div className="premium-stat-copy">
                <p>{stat.title}</p>
                <h3>{stat.value}</h3>
              </div>

              <div className="premium-stat-icon">{stat.icon}</div>
            </div>

            <div className="premium-stat-bottom">
              <span className="premium-stat-note">{stat.note}</span>
              <span className="premium-stat-trend">{stat.trend}</span>
            </div>
          </article>
        ))
      )}
    </section>
  );
}

export default StatsCards;