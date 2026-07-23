const executives = [
  ["Rahul Sharma", "₹1,48,000"],
  ["Amit Verma", "₹1,26,500"],
  ["Vikas Patel", "₹98,400"],
  ["Sanjay Singh", "₹82,300"],
];

function ExecutiveRanking() {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <h2>Executive Ranking</h2>
          <p>Top field performers</p>
        </div>
      </div>

      <div className="ranking-list">
        {executives.map((item, index) => (
          <div className="ranking-row" key={item[0]}>
            <span className="rank">{index + 1}</span>

            <div>
              <strong>{item[0]}</strong>
              <small>Field Executive</small>
            </div>

            <b>{item[1]}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

export default ExecutiveRanking;