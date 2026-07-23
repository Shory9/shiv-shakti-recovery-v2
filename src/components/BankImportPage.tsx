import {
  type ChangeEvent,
  useMemo,
  useState,
} from "react";

import { supabase } from "../supabaseClient";

import {
  createCaseDatabaseRow,
  normalizeText,
  parseBankExcel,
  type BankFileFormat,
  type ParsedCase,
} from "../helpers/caseImport";

type ImportStatus =
  | "idle"
  | "ready"
  | "importing"
  | "imported";

type Agent = {
  id: number;
  name: string;
  agent_code: string | null;
  area: string | null;
  status: string | null;
};

type ExistingCase = {
  account_no: string | null;
  assigned_agent: number | null;
};

type AreaSummaryItem = {
  area: string;
  excelCases: number;
  newCases: number;
  existingAssignedCases: number;
  agents: Agent[];
};

function BankImportPage() {
  const [bankName, setBankName] = useState(
    "Bank of Baroda (BOB)"
  );

  const [fileName, setFileName] = useState("");
  const [fileFormat, setFileFormat] =
    useState<BankFileFormat>("unknown");

  const [status, setStatus] =
    useState<ImportStatus>("idle");

  const [cases, setCases] = useState<ParsedCase[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [existingAccountKeys, setExistingAccountKeys] =
    useState<Set<string>>(new Set());

  const [
    existingAssignedByArea,
    setExistingAssignedByArea,
  ] = useState<Record<string, number>>({});

  const [duplicatePreviewCount, setDuplicatePreviewCount] =
    useState(0);

  const [missingAddressCount, setMissingAddressCount] =
    useState(0);

  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [unassignedCount, setUnassignedCount] =
    useState(0);

  function normalizeArea(value: string | null) {
    return normalizeText(value);
  }

  async function loadActiveAgents() {
    const { data, error } = await supabase
      .from("agents")
      .select("id, name, agent_code, area, status")
      .eq("status", "Active")
      .order("id", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const activeAgents = (data || []) as Agent[];

    setAgents(activeAgents);
    return activeAgents;
  }

  async function loadExistingCases() {
    const existingKeys = new Set<string>();
    const existingRows: ExistingCase[] = [];

    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("cases")
        .select("account_no, assigned_agent")
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data || []) as ExistingCase[];

      rows.forEach((item) => {
        const key = normalizeText(item.account_no);

        if (key) {
          existingKeys.add(key);
        }

        existingRows.push(item);
      });

      if (rows.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return {
      existingKeys,
      existingRows,
    };
  }

  function buildExistingAreaCounts(
    activeAgents: Agent[],
    existingRows: ExistingCase[]
  ) {
    const agentAreaById = new Map<number, string>();

    activeAgents.forEach((agent) => {
      const area = agent.area?.trim() || "";

      if (area) {
        agentAreaById.set(agent.id, area);
      }
    });

    const counts: Record<string, number> = {};

    existingRows.forEach((item) => {
      if (!item.assigned_agent) return;

      const area = agentAreaById.get(
        Number(item.assigned_agent)
      );

      if (!area) return;

      const areaKey = normalizeArea(area);

      if (!areaKey) return;

      counts[areaKey] =
        (counts[areaKey] || 0) + 1;
    });

    return counts;
  }

  async function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setCases([]);
    setFileFormat("unknown");
    setExistingAccountKeys(new Set());
    setExistingAssignedByArea({});
    setDuplicatePreviewCount(0);
    setMissingAddressCount(0);
    setImportedCount(0);
    setSkippedCount(0);
    setUnassignedCount(0);
    setStatus("idle");

    try {
      const [activeAgents, existingData, result] =
        await Promise.all([
          loadActiveAgents(),
          loadExistingCases(),
          parseBankExcel(file, bankName),
        ]);

      setFileFormat(result.format);
      setCases(result.cases);
      setExistingAccountKeys(
        existingData.existingKeys
      );
      setExistingAssignedByArea(
        buildExistingAreaCounts(
          activeAgents,
          existingData.existingRows
        )
      );
      setDuplicatePreviewCount(
        result.duplicateCount
      );
      setMissingAddressCount(
        result.missingAddressCount
      );
      setStatus("ready");

      if (result.cases.length === 0) {
        alert(
          "Excel read hui, lekin valid cases nahi mile."
        );
      }
    } catch (error) {
      setStatus("idle");

      alert(
        "Excel read error: " +
          (error instanceof Error
            ? error.message
            : "Unknown error")
      );
    }
  }

  const areaSummary = useMemo<AreaSummaryItem[]>(() => {
    const excelCountByArea = new Map<string, number>();
    const newCountByArea = new Map<string, number>();

    cases.forEach((item) => {
      const area =
        item.resolvedArea || "Unmatched Area";

      excelCountByArea.set(
        area,
        (excelCountByArea.get(area) || 0) + 1
      );

      const accountKey = normalizeText(item.accountNo);

      if (
        accountKey &&
        !existingAccountKeys.has(accountKey)
      ) {
        newCountByArea.set(
          area,
          (newCountByArea.get(area) || 0) + 1
        );
      }
    });

    /*
      Union of:
      1. Areas found in current Excel
      2. Areas of active executives
      3. Areas that already have assigned database cases

      Isse Pustak Bajar / CRPF / other markets table me
      tab bhi dikhenge jab current Excel me count 0 ho.
    */
    const allAreas = new Set<string>();

    excelCountByArea.forEach((_, area) =>
      allAreas.add(area)
    );

    agents.forEach((agent) => {
      const area = agent.area?.trim();

      if (area) {
        allAreas.add(area);
      }
    });

    /*
      existingAssignedByArea uses normalized internal keys.
      Agent areas are already added above as display names, so normalized
      keys must not be added to the visible area list.
    */

    return Array.from(allAreas)
      .map((area) => {
        const matchingAgents = agents.filter(
          (agent) =>
            normalizeArea(agent.area) ===
            normalizeText(area)
        );

        return {
          area,
          excelCases:
            excelCountByArea.get(area) || 0,
          newCases:
            newCountByArea.get(area) || 0,
          existingAssignedCases:
            existingAssignedByArea[
              normalizeText(area)
            ] || 0,
          agents: matchingAgents,
        };
      })
      .sort((first, second) => {
        const firstTotal =
          first.existingAssignedCases +
          first.excelCases;

        const secondTotal =
          second.existingAssignedCases +
          second.excelCases;

        return secondTotal - firstTotal;
      });
  }, [
    cases,
    agents,
    existingAccountKeys,
    existingAssignedByArea,
  ]);

  const autoAssignedPreviewCount = useMemo(
    () =>
      areaSummary.reduce(
        (total, item) =>
          total +
          (item.agents.length > 0
            ? item.newCases
            : 0),
        0
      ),
    [areaSummary]
  );

  const totalNewPreviewCount = useMemo(
    () =>
      areaSummary.reduce(
        (total, item) =>
          total + item.newCases,
        0
      ),
    [areaSummary]
  );

  const unassignedPreviewCount =
    totalNewPreviewCount -
    autoAssignedPreviewCount;

  async function refreshAgentCaseCounts(
    agentIds: number[]
  ) {
    const uniqueAgentIds = Array.from(
      new Set(agentIds)
    );

    for (const agentId of uniqueAgentIds) {
      const { count, error } = await supabase
        .from("cases")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("assigned_agent", agentId);

      if (!error) {
        await supabase
          .from("agents")
          .update({
            cases: count || 0,
          })
          .eq("id", agentId);
      }
    }
  }

  async function importCases() {
    if (cases.length === 0) {
      alert("Import ke liye cases nahi mile.");
      return;
    }

    const confirmed = window.confirm(
      [
        "Safe Bank Import",
        "",
        `File format: ${fileFormat}`,
        `Unique cases in Excel: ${cases.length}`,
        `Excel duplicates removed: ${duplicatePreviewCount}`,
        `Existing Account IDs skipped: ${
          cases.length - totalNewPreviewCount
        }`,
        `New cases: ${totalNewPreviewCount}`,
        `Auto assigned: ${autoAssignedPreviewCount}`,
        `Unassigned: ${unassignedPreviewCount}`,
        `Missing addresses: ${missingAddressCount}`,
        "",
        "Existing agents aur existing cases delete nahi honge.",
        "",
        "Import continue karein?",
      ].join("\n")
    );

    if (!confirmed) return;

    setStatus("importing");
    setImportedCount(0);
    setSkippedCount(
      cases.length - totalNewPreviewCount
    );
    setUnassignedCount(0);

    try {
      const activeAgents =
        await loadActiveAgents();

      const currentExisting =
        await loadExistingCases();

      const newCases = cases.filter(
        (item) =>
          !currentExisting.existingKeys.has(
            normalizeText(item.accountNo)
          )
      );

      const skipped =
        cases.length - newCases.length;

      setSkippedCount(skipped);

      if (newCases.length === 0) {
        setStatus("imported");

        alert(
          `New imported: 0\nSkipped existing cases: ${skipped}`
        );

        return;
      }

      /*
        Start with each active executive's real existing workload.
        Every new case goes to the least-loaded active executive of the
        resolved market. This keeps repeated imports balanced and avoids
        always starting from the first executive.
      */
      const agentWorkload = new Map<number, number>();

      activeAgents.forEach((agent) => {
        agentWorkload.set(agent.id, 0);
      });

      currentExisting.existingRows.forEach((existingCase) => {
        if (!existingCase.assigned_agent) return;

        const agentId = Number(
          existingCase.assigned_agent
        );

        if (!agentWorkload.has(agentId)) return;

        agentWorkload.set(
          agentId,
          (agentWorkload.get(agentId) || 0) + 1
        );
      });

      const assignedAgentIds: number[] = [];
      let unassigned = 0;

      const rowsToInsert = newCases.map((item) => {
        const matchingAgents =
          activeAgents.filter(
            (agent) =>
              normalizeArea(agent.area) ===
              normalizeText(item.resolvedArea)
          );

        let selectedAgent: Agent | undefined;

        if (matchingAgents.length > 0) {
          selectedAgent = [...matchingAgents].sort(
            (first, second) => {
              const firstLoad =
                agentWorkload.get(first.id) || 0;

              const secondLoad =
                agentWorkload.get(second.id) || 0;

              if (firstLoad !== secondLoad) {
                return firstLoad - secondLoad;
              }

              return first.id - second.id;
            }
          )[0];

          agentWorkload.set(
            selectedAgent.id,
            (agentWorkload.get(selectedAgent.id) || 0) + 1
          );

          assignedAgentIds.push(
            selectedAgent.id
          );
        } else {
          unassigned += 1;
        }

        const assignmentText = selectedAgent
          ? `${
              selectedAgent.agent_code || ""
            } - ${selectedAgent.name}`
          : "Unassigned";

        return createCaseDatabaseRow(item, {
          bankId: 1,
          assignedExecutiveId:
            selectedAgent?.id ?? null,
          sourceFileName: fileName,
          assignmentText,
        });
      });

      setUnassignedCount(unassigned);

      const chunkSize = 250;
      let totalImported = 0;

      for (
        let index = 0;
        index < rowsToInsert.length;
        index += chunkSize
      ) {
        const chunk = rowsToInsert.slice(
          index,
          index + chunkSize
        );

        const { error } = await supabase
          .from("cases")
          .insert(chunk);

        if (error) {
          setImportedCount(totalImported);
          setStatus("ready");

          alert(
            [
              "Import stopped.",
              `Imported before error: ${totalImported}`,
              `Error: ${error.message}`,
              "",
              "Same file dobara upload kar sakte ho.",
              "Already imported Account IDs skip honge.",
            ].join("\n")
          );

          return;
        }

        totalImported += chunk.length;
        setImportedCount(totalImported);
      }

      await refreshAgentCaseCounts(
        assignedAgentIds
      );

      setImportedCount(totalImported);
      setStatus("imported");

      alert(
        [
          "Import complete.",
          "",
          `Imported: ${totalImported}`,
          `Skipped existing: ${skipped}`,
          `Auto assigned: ${
            totalImported - unassigned
          }`,
          `Unassigned: ${unassigned}`,
        ].join("\n")
      );
    } catch (error) {
      setStatus("ready");

      alert(
        "Import error: " +
          (error instanceof Error
            ? error.message
            : "Unknown error")
      );
    }
  }

  return (
    <div className="module-card">
      <h1>📄 Safe Bank Excel Import</h1>

      <p>
        Branch/market ke hisab se cases resolve honge aur har market ke
        active executives me existing workload dekhkar balanced assignment hoga.
      </p>

      <hr />

      <h3>Select Bank</h3>

      <select
        value={bankName}
        onChange={(event) =>
          setBankName(event.target.value)
        }
      >
        <option>Bank of Baroda (BOB)</option>
        <option>State Bank of India (SBI)</option>
      </select>

      <br />
      <br />

      <h3>Select Bank Excel</h3>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
      />

      {fileName && (
        <div className="card">
          <h3>Selected File</h3>

          <p>
            <strong>Bank:</strong> {bankName}
          </p>

          <p>
            <strong>File:</strong> {fileName}
          </p>

          <p>
            <strong>Format:</strong> {fileFormat}
          </p>

          <p>
            <strong>Status:</strong> {status}
          </p>

          <p>
            <strong>Unique Excel Cases:</strong>{" "}
            {cases.length}
          </p>

          <p>
            <strong>Already Existing:</strong>{" "}
            {cases.length - totalNewPreviewCount}
          </p>

          <p>
            <strong>New Cases:</strong>{" "}
            {totalNewPreviewCount}
          </p>

          <p>
            <strong>Auto Assigned Preview:</strong>{" "}
            {autoAssignedPreviewCount}
          </p>

          <p>
            <strong>Unassigned Preview:</strong>{" "}
            {unassignedPreviewCount}
          </p>

          <p>
            <strong>Missing Address:</strong>{" "}
            {missingAddressCount}
          </p>

          {cases.length > 0 &&
            status !== "importing" && (
              <button
                className="primary-btn"
                onClick={importCases}
              >
                Import Only {totalNewPreviewCount} New Cases
              </button>
            )}
        </div>
      )}

      {areaSummary.length > 0 && (
        <div className="card">
          <h3>Market-wise Assignment Preview</h3>

          <table>
            <thead>
              <tr>
                <th>Market / Area</th>
                <th>Current Excel</th>
                <th>New Cases</th>
                <th>Already Assigned</th>
                <th>Active Executives</th>
                <th>Import Result</th>
              </tr>
            </thead>

            <tbody>
              {areaSummary.map((item) => (
                <tr key={item.area}>
                  <td>
                    <strong>{item.area}</strong>
                  </td>

                  <td>{item.excelCases}</td>

                  <td>{item.newCases}</td>

                  <td>
                    {item.existingAssignedCases}
                  </td>

                  <td>
                    {item.agents.length > 0
                      ? item.agents
                          .map(
                            (agent) =>
                              `${
                                agent.agent_code || ""
                              } ${agent.name}`
                          )
                          .join(", ")
                      : "No Active Executive"}
                  </td>

                  <td>
                    {item.newCases === 0
                      ? "No new case"
                      : item.agents.length > 0
                      ? `✅ ${item.newCases} case(s) assigned`
                      : `⚠️ ${item.newCases} unassigned`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cases.length > 0 && (
        <div className="card">
          <h3>First 20 Excel Cases Preview</h3>

          <table>
            <thead>
              <tr>
                <th>Account No.</th>
                <th>Customer</th>
                <th>Market</th>
                <th>Category</th>
                <th>Balance</th>
                <th>Address</th>
              </tr>
            </thead>

            <tbody>
              {cases
                .slice(0, 20)
                .map((item, index) => (
                  <tr
                    key={`${item.accountNo}-${index}`}
                  >
                    <td>{item.accountNo}</td>
                    <td>{item.customerName}</td>
                    <td>
                      {item.resolvedArea ||
                        "Unmatched"}
                    </td>
                    <td>
                      {item.assetClassification ||
                        "-"}
                    </td>
                    <td>
                      ₹
                      {item.loanAmount.toLocaleString(
                        "en-IN",
                        {
                          maximumFractionDigits: 2,
                        }
                      )}
                    </td>
                    <td>
                      {item.address || "-"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {status === "importing" && (
        <div className="card">
          <h3>⏳ Importing cases...</h3>
          <p>Imported so far: {importedCount}</p>
          <p>Skipped existing: {skippedCount}</p>
          <p>Unassigned: {unassignedCount}</p>
        </div>
      )}

      {status === "imported" && (
        <div className="card">
          <h3>✅ Import Complete</h3>
          <p>Imported: {importedCount}</p>
          <p>Skipped existing: {skippedCount}</p>
          <p>
            Auto assigned:{" "}
            {importedCount - unassignedCount}
          </p>
          <p>Unassigned: {unassignedCount}</p>
        </div>
      )}
    </div>
  );
}

export default BankImportPage;