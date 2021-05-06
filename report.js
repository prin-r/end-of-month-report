const fs = require("fs");

const folder = "fantom_mainnet";
const header = "fantom_mainnet";
const mids = [
  "2000",
  "4000",
  "6000",
  "8000",
  "10000",
  "12000",
  "14000",
  "16000",
  "18000",
  "20000",
  "22000",
  "24000",
  "26000",
  "28000",
  "30000",
  "32000",
  "34000",
  "36000",
  "38000",
  "38400",
];
const tnfs = (() => {
  let acc = [];
  for (const m of mids) {
    const a = JSON.parse(
      fs.readFileSync(`${folder}/${header}_${m}_tx_not_found.json`)
    );
    acc = [...acc, ...a];
  }
  return acc;
})();

const rs = (() => {
  let acc = null;
  for (const m of mids) {
    if (!acc) {
      acc = JSON.parse(fs.readFileSync(`${folder}/${header}_${m}.json`));
    } else {
      const a = JSON.parse(fs.readFileSync(`${folder}/${header}_${m}.json`));
      for (const [k, v] of Object.entries(a)) {
        if (!acc[k]) {
          acc[k] = v;
        } else {
          for (const [kk, vv] of Object.entries(acc[k])) {
            if (!acc[k][kk]) {
              acc[k][kk] = vv;
            } else {
              acc[k][kk] = [...acc[k][kk], ...vv];
            }
          }
        }
      }
    }
  }
  return acc;
})();

const tnfObj = tnfs.reduce((a, b) => {
  if (!a[b[0]]) {
    a[b[0]] = 1;
  } else {
    a[b[0]] = a[b[0]] + 1;
  }
  return a;
}, {});

const days = Object.keys(rs).sort();
const symbols = Array.from(
  Object.values(rs).reduce((s, e) => {
    for (const k in e) {
      s.add(k);
    }
    return s;
  }, new Set())
).sort();

let text = "Date,Fail Txs," + symbols.join() + "\n";
for (const day of days) {
  text += day + ",";
  if (tnfObj[day]) {
    text += tnfObj[day] + ",";
  } else {
    text += "0,";
  }
  let aa = [];
  for (const symbol of symbols) {
    if (rs[day] && rs[day][symbol]) {
      aa = [...aa, rs[day][symbol].length];
    } else {
      aa = [...aa, 0];
    }
  }
  text += aa.join() + "\n";
}

fs.writeFile(header + ".csv", text, function (err) {
  if (err) throw err;
  console.log("Saved Tx Not Found");
});
