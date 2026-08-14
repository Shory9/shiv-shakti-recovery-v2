import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type Visit = { id:string; case_id:string; executive_id:string; photo_path:string; latitude:number; longitude:number; captured_at:string; outcome?:string|null; remarks?:string|null; next_follow_up?:string|null };
type CaseRow = { id:string; account_number?:string|null; account_name?:string|null; bank_name?:string|null };
type Executive = { id:string; executive_code?:string|null; full_name?:string|null; area?:string|null };
type VisitView = Visit & { customer:string; account:string; bank:string; executive:string; area:string };

export default function FieldVisitsPage() {
  const [visits,setVisits]=useState<Visit[]>([]);
  const [cases,setCases]=useState<CaseRow[]>([]);
  const [executives,setExecutives]=useState<Executive[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [outcome,setOutcome]=useState("All");
  const [selected,setSelected]=useState<VisitView|null>(null);
  const [photoUrl,setPhotoUrl]=useState("");

  const load=useCallback(async()=>{
    setLoading(true); setError("");
    try {
      const [v,c,e]=await Promise.all([
        supabase.from("case_visits").select("*").order("captured_at",{ascending:false}),
        supabase.from("cases").select("id,account_number,account_name,bank_name"),
        supabase.from("executives").select("id,executive_code,full_name,area")
      ]);
      if(v.error) throw v.error; if(c.error) throw c.error; if(e.error) throw e.error;
      setVisits((v.data??[]) as Visit[]); setCases((c.data??[]) as CaseRow[]); setExecutives((e.data??[]) as Executive[]);
    } catch(err){ setError(err instanceof Error?err.message:"Visits load nahi hue."); }
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load();},[load]);

  const rows=useMemo<VisitView[]>(()=>{
    const cm=new Map(cases.map(c=>[String(c.id),c]));
    const em=new Map(executives.map(e=>[String(e.id),e]));
    return visits.map(v=>{const c=cm.get(String(v.case_id));const e=em.get(String(v.executive_id));return {...v,customer:c?.account_name||"Unknown",account:c?.account_number||"-",bank:c?.bank_name||"-",executive:`${e?.executive_code||""}${e?.executive_code?" - ":""}${e?.full_name||"Unknown"}`,area:e?.area||"-"};});
  },[visits,cases,executives]);

  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return rows.filter(r=>(outcome==="All"||(r.outcome||"Not recorded")===outcome)&&(!q||[r.customer,r.account,r.executive,r.area,r.remarks||""].some(x=>x.toLowerCase().includes(q))));},[rows,search,outcome]);
  const groupedVisits=useMemo(()=>{
    const groups=new Map<string,{executive:string;area:string;visits:VisitView[]}>();
    filtered.forEach(row=>{
      const key=row.executive||"Unknown Executive";
      const group=groups.get(key)??{executive:key,area:row.area,visits:[]};
      group.visits.push(row);
      groups.set(key,group);
    });
    return Array.from(groups.values()).sort((a,b)=>a.executive.localeCompare(b.executive));
  },[filtered]);
  const outcomes=useMemo(()=>["All",...Array.from(new Set(rows.map(r=>r.outcome||"Not recorded")))],[rows]);
  const today=new Date().toISOString().slice(0,10);
  const todayCount=rows.filter(r=>r.captured_at.slice(0,10)===today).length;
  const followups=rows.filter(r=>r.next_follow_up&&r.next_follow_up>=today).length;

  async function openProof(row:VisitView){
    setSelected(row); setPhotoUrl("");
    const {data,error:photoError}=await supabase.storage.from("visit-photos").createSignedUrl(row.photo_path,3600);
    if(photoError){setError(photoError.message);return;} setPhotoUrl(data.signedUrl);
  }

  return <div className="fv-page"><style>{`
    .fv-page{min-height:100%;padding:26px;background:#f5f7fb;color:#0f172a}.fv-page *{box-sizing:border-box}.fv-hero{display:flex;justify-content:space-between;gap:18px;padding:26px;border-radius:20px;background:linear-gradient(135deg,#07192d,#12497b);color:#fff}.fv-hero h1{margin:0}.fv-hero p{margin:8px 0 0;color:#dbeafe}.fv-btn{border:0;border-radius:10px;padding:0 15px;min-height:40px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}.fv-alert{margin-top:14px;padding:12px;border-radius:10px;background:#fef2f2;color:#b91c1c}.fv-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}.fv-card,.fv-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px}.fv-card{padding:17px}.fv-card span{color:#64748b;font-size:11px;font-weight:800}.fv-card strong{display:block;margin-top:6px;font-size:25px}.fv-panel{margin-top:16px;padding:18px}.fv-filters{display:grid;grid-template-columns:1fr 240px;gap:12px;margin-bottom:14px}.fv-input{height:44px;padding:0 12px;border:1px solid #cbd5e1;border-radius:10px}.fv-wrap{overflow:auto}.fv-table{width:100%;min-width:1050px;border-collapse:collapse}.fv-table th,.fv-table td{padding:12px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:12px}.fv-table th{background:#f8fafc;color:#475569}.fv-badge{padding:5px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-weight:800}.fv-modal-bg{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.65)}.fv-modal{width:min(780px,100%);max-height:94vh;overflow:auto;padding:20px;border-radius:18px;background:#fff}.fv-head{display:flex;justify-content:space-between;gap:12px}.fv-close{border:0;width:36px;height:36px;border-radius:9px}.fv-photo{width:100%;max-height:60vh;object-fit:contain;margin-top:14px;border-radius:13px;background:#0f172a}.fv-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}.fv-grid div{padding:11px;border-radius:10px;background:#f8fafc}.fv-grid span{display:block;color:#64748b;font-size:10px}.fv-grid strong{display:block;margin-top:4px}.fv-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:14px}.fv-actions a{display:flex;align-items:center;padding:0 14px;border-radius:9px;background:#2563eb;color:#fff;text-decoration:none;font-weight:800}@media(max-width:700px){.fv-page{padding:14px}.fv-stats,.fv-filters,.fv-grid{grid-template-columns:1fr}}
    .fv-groups{display:grid;gap:14px}.fv-group{overflow:hidden;border:1px solid #cbd5e1;border-radius:14px;background:#fff}.fv-group summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;background:#eff6ff;cursor:pointer;list-style:none}.fv-group summary::-webkit-details-marker{display:none}.fv-group-title strong{display:block;font-size:16px}.fv-group-title span{display:block;margin-top:4px;color:#64748b;font-size:12px}.fv-count{min-width:76px;padding:7px 10px;border-radius:999px;background:#2563eb;color:#fff;text-align:center;font-size:12px;font-weight:800}.fv-empty{padding:18px;color:#64748b}
  `}</style>
    <section className="fv-hero"><div><h1>Field Visits</h1><p>Sabhi executives ke GPS, photo, outcome, remarks aur follow-up.</p></div><button className="fv-btn" onClick={()=>void load()} disabled={loading}>{loading?"Loading...":"Refresh"}</button></section>
    {error&&<div className="fv-alert">{error}</div>}
    <section className="fv-stats"><div className="fv-card"><span>TOTAL VISITS</span><strong>{rows.length}</strong></div><div className="fv-card"><span>TODAY</span><strong>{todayCount}</strong></div><div className="fv-card"><span>UPCOMING FOLLOW-UPS</span><strong>{followups}</strong></div></section>
    <section className="fv-panel"><div className="fv-filters"><input className="fv-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Customer, account, executive, remark..."/><select className="fv-input" value={outcome} onChange={e=>setOutcome(e.target.value)}>{outcomes.map(x=><option key={x}>{x}</option>)}</select></div><div className="fv-groups">{groupedVisits.map((group,index)=><details className="fv-group" key={group.executive} open={index===0}><summary><div className="fv-group-title"><strong>{group.executive}</strong><span>Area: {group.area}</span></div><span className="fv-count">{group.visits.length} Visits</span></summary><div className="fv-wrap"><table className="fv-table"><thead><tr><th>Visit Time</th><th>Customer / Account</th><th>Area</th><th>Outcome</th><th>Remark</th><th>Follow-up</th><th>Proof</th></tr></thead><tbody>{group.visits.map(r=><tr key={r.id}><td>{new Date(r.captured_at).toLocaleString("en-IN")}</td><td><b>{r.customer}</b><br/>{r.account}</td><td>{r.area}</td><td><span className="fv-badge">{r.outcome||"Not recorded"}</span></td><td>{r.remarks||"-"}</td><td>{r.next_follow_up||"-"}</td><td><button className="fv-btn" onClick={()=>void openProof(r)}>View</button></td></tr>)}</tbody></table></div></details>)}{!loading&&groupedVisits.length===0&&<div className="fv-empty">Abhi matching visit record nahi hai.</div>}</div></section>
    {selected&&<div className="fv-modal-bg" onMouseDown={()=>setSelected(null)}><div className="fv-modal" onMouseDown={e=>e.stopPropagation()}><div className="fv-head"><div><h2>Visit Proof</h2><b>{selected.customer} · {selected.account}</b></div><button className="fv-close" onClick={()=>setSelected(null)}>×</button></div>{photoUrl?<img className="fv-photo" src={photoUrl} alt="Visit proof"/>:<p>Photo loading...</p>}<div className="fv-grid"><div><span>EXECUTIVE</span><strong>{selected.executive}</strong></div><div><span>OUTCOME</span><strong>{selected.outcome||"-"}</strong></div><div><span>REMARK</span><strong>{selected.remarks||"-"}</strong></div><div><span>NEXT FOLLOW-UP</span><strong>{selected.next_follow_up||"-"}</strong></div><div><span>LATITUDE</span><strong>{Number(selected.latitude).toFixed(6)}</strong></div><div><span>LONGITUDE</span><strong>{Number(selected.longitude).toFixed(6)}</strong></div></div><div className="fv-actions"><a href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer">Open in Maps</a><button className="fv-btn" onClick={()=>setSelected(null)}>Close</button></div></div></div>}
  </div>;
}
