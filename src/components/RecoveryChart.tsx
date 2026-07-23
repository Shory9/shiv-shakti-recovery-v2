const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const values = [42, 68, 54, 82, 72, 94, 61];

function RecoveryChart() {
  return (
    <article className="panel large-panel">
      <div className="panel-heading">
        <div>
          <h2>Weekly Recovery</h2>
          <p>Last 7 days performance</p>
        </div>

        <button type="button">This Week</button>
      </div>

      <div className="chart">
        {values.map((height, index) => (
          <div className="bar-wrap" key={days[index]}>
            <div className="bar" style={{ height: `${height}%` }} />
            <span>{days[index]}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default RecoveryChart;