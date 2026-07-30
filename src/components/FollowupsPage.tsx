import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type FollowupRow = {
  id: string | number;
  case_id?: string | number | null;
  executive_id?: string | number | null;
  follow_up_date?: string | null;
  followup_date?: string | null;
  next_follow_up_date?: string | null;
  next_followup_date?: string | null;
  status?: string | null;
  remarks?: string | null;
  note?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type CaseRow = {
  id: string | number;
  customer_name?: string | null;
  borrower_name?: string | null;
  client_name?: string | null;
  account_number?: string | null;
  loan_account_number?: string | null;
  assigned_executive_id?: string | number | null;
  executive_id?: string | number | null;
};

type ProfileRow = {
  id: string | number;
  full_name?: string | null;
  name?: string | null;
  executive_name?: string | null;
};

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(table: string): Promise<T[]> {
  const allRows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const rows = (data ?? []) as T[];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) break;
  }

  return allRows;
}

function getFollowupDate(row: FollowupRow) {
  return (
    row.next_follow_up_date ||
    row.next_followup_date ||
    row.follow_up_date ||
    row.followup_date ||
    row.created_at ||
    ""
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function FollowupsPage() {
  const [followups, setFollowups] = useState<FollowupRow[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [followupRows, caseRows, profileRows] = await Promise.all([
        fetchAllRows<FollowupRow>("case_follow_ups"),
        fetchAllRows<CaseRow>("cases"),
        fetchAllRows<ProfileRow>("profiles"),
      ]);

      setFollowups(followupRows);
      setCases(caseRows);
      setProfiles(profileRows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Follow-ups load nahi hue.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("followups-page-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_follow_ups" },
        loadData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const caseMap = useMemo(
    () => new Map(cases.map((item) => [String(item.id), item])),
    [cases]
  );

  const profileMap = useMemo(
    () => new Map(profiles.map((item) => [String(item.id), item])),
    [profiles]
  );

  const rows = useMemo(() => {
    return followups
      .map((followup) => {
        const caseItem = followup.case_id
          ? caseMap.get(String(followup.case_id))
          : undefined;

        const executiveId =
          followup.executive_id ||
          caseItem?.assigned_executive_id ||
          caseItem?.executive_id;

        const profile = executiveId
          ? profileMap.get(String(executiveId))
          : undefined;

        const customerName =
          caseItem?.customer_name ||
          caseItem?.borrower_name ||
          caseItem?.client_name ||
          "Unknown Customer";

        const accountNumber =
          caseItem?.account_number ||
          caseItem?.loan_account_number ||
          "-";

        const executiveName =
          profile?.full_name ||
          profile?.name ||
          profile?.executive_name ||
          "-";

        const remarks =
          followup.remarks || followup.note || followup.notes || "-";

        const status = followup.status || "Pending";
        const date = getFollowupDate(followup);

        return {
          ...followup,
          customerName,
          accountNumber,
          executiveName,
          remarks,
          displayStatus: status,
          date,
        };
      })
      .filter((row) => {
        const query = search.trim().toLowerCase();

        const matchesSearch =
          !query ||
          row.customerName.toLowerCase().includes(query) ||
          row.accountNumber.toLowerCase().includes(query) ||
          row.executiveName.toLowerCase().includes(query) ||
          row.remarks.toLowerCase().includes(query);

        const matchesStatus =
          statusFilter === "all" ||
          row.displayStatus.toLowerCase() === statusFilter.toLowerCase();

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const first = new Date(a.date || 0).getTime();
        const second = new Date(b.date || 0).getTime();
        return first - second;
      });
  }, [followups, caseMap, profileMap, search, statusFilter]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(
        followups
          .map((item) => item.status?.trim())
          .filter((item): item is string => Boolean(item))
      )
    ).sort();
  }, [followups]);

  return (
    <main className="page-content">
      <section className="page-header">
        <div>
          <h1>Follow-ups</h1>
          <p>Customer follow-up schedule and status</p>
        </div>

        <button type="button" onClick={loadData}>
          Refresh
        </button>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>All Follow-ups</h2>
            <p>{rows.length} records</p>
          </div>

          <div className="table-filters">
            <input
              type="search"
              placeholder="Search customer, account or executive"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Follow-ups load ho rahe hain...</div>
        ) : errorMessage ? (
          <div className="empty-state">
            <p>{errorMessage}</p>
            <button type="button" onClick={loadData}>
              Try Again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">Koi follow-up record nahi mila.</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Account No.</th>
                  <th>Executive</th>
                  <th>Follow-up Date</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{row.customerName}</td>
                    <td>{row.accountNumber}</td>
                    <td>{row.executiveName}</td>
                    <td>{formatDate(row.date)}</td>
                    <td>
                      <span className={`status-badge ${row.displayStatus.toLowerCase()}`}>
                        {row.displayStatus}
                      </span>
                    </td>
                    <td>{row.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default FollowupsPage;