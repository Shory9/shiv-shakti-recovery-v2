import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type Payment = {
  amount?: number | string | null;
  payment_date?: string | null;
  created_at?: string | null;
};

export default function RecoveryChart() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("payments").select("amount,payment_date,created_at");
      setPayments(data ?? []);
    })();
  }, []);

  const chart = useMemo(() => {
    const labels:string[] = [];
    const totals:number[] = [];
    for (let i=6;i>=0;i--){
      const d=new Date();
      d.setDate(d.getDate()-i);
      const key=d.toISOString().slice(0,10);
      labels.push(d.toLocaleDateString("en-US",{weekday:"short"}));
      const total=payments.reduce((s,p)=>{
        const dt=(p.payment_date||p.created_at||"").slice(0,10);
        return s+(dt===key?(Number(p.amount)||0):0);
      },0);
      totals.push(total);
    }
    const max=Math.max(...totals,1);
    return labels.map((l,i)=>({label:l,height:(totals[i]/max)*100,value:totals[i]}));
  },[payments]);

  return (
    <article className="panel large-panel">
      <div className="panel-heading">
        <div>
          <h2>Weekly Recovery</h2>
          <p>Last 7 days performance</p>
        </div>
        <button type="button">Live</button>
      </div>

      <div className="chart">
        {chart.map((d)=>(
          <div className="bar-wrap" key={d.label}>
            <div className="bar" style={{height:`${d.height}%`}} title={`₹${d.value.toLocaleString("en-IN")}`} />
            <span>{d.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}