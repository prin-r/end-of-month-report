const fetch = require("node-fetch");
const fs = require("fs");
const Web3 = require("web3");
const web3 = new Web3("https://bsc-dataseed.binance.org/");

// http://std-price.d3n.xyz//v1/graphql
// http://feeder-graphql.bandchain.org/v1/graphql

const graphqlURL = "http://std-price.d3n.xyz//v1/graphql";

const network = "mainnet_target_mirror";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function zip(arrays) {
  return arrays[0].map(function (_, i) {
    return arrays.map(function (array) {
      return array[i];
    });
  });
}

txNotFound = [];

async function getTxInput(created_at, txHash) {
  try {
    const tx = await web3.eth.getTransaction(txHash);
    const r = web3.eth.abi.decodeParameters(
      ["string[]", "uint64[]", "uint64[]", "uint64[]"],
      "0x" + tx["input"].slice(10)
    );
    return zip([r["0"], r["1"], r["2"], r["3"]]);
  } catch (e) {
    console.log("get: ", txHash, " : fail");
    txNotFound = [...txNotFound, [created_at, txHash]];
  }
  return [];
}

async function getTxInputTerra(created_at, txHash) {
  let i = 0;
  while (i < 10) {
    try {
      const result = await fetch("https://fcd.terra.dev/v1/tx/" + txHash);
      const {
        tx: {
          value: { msg },
        },
      } = await result.json();

      let acc = [];
      for (let i = 0; i < msg.length; i++) {
        const {
          relay: { symbols, rates, resolve_times, request_ids },
        } = JSON.parse(
          Buffer.from(msg[i]["value"]["execute_msg"], "base64").toString(
            "utf-8"
          )
        );
        const z = zip([symbols, rates, resolve_times, request_ids]);
        acc = [...acc, ...z];
      }

      if (i !== 0) {
        console.log("recover:", txHash);
      }

      return acc;
    } catch (e) {
      console.log("get: ", txHash, " : fail ", i);
      // txNotFound = [...txNotFound, [created_at, txHash]];
    }
    i++;
    await sleep(1000);
  }
  return [];
}

async function fetchGraphQL(offset) {
  const result = await fetch(graphqlURL, {
    method: "POST",
    body: JSON.stringify({
      query: `
      query MyQuery {
        ${network}_relay_tx(limit: 1000, order_by: {created_at: desc}, offset: ${offset}) {
          created_at
          tx_hash
        }
      }
    `,
      variables: {},
      operationName: "MyQuery",
    }),
  });

  const { errors, data } = await result.json();
  if (errors) {
    console.error(errors);
    return null;
  }
  return data[`${network}_relay_tx`];
}

const graphqlToJson = async () => {
  let offset = 0;
  let l = 1000;
  let accTxs = [];
  let currentMonth = "04";
  let isFuture = true;
  while (l === 1000 || isFuture) {
    isFuture = false;
    const rs = await fetchGraphQL(accTxs.length + offset);
    let txs = [];
    for (r of rs) {
      const [a, b] = r["created_at"].split("-");
      if (Number(b) > Number(currentMonth)) {
        isFuture = true;
        offset += 1;
      }
      if (a === "2021" && b === currentMonth) {
        txs = [...txs, [r["created_at"].split("T")[0], r["tx_hash"]]];
      }
    }
    if (isFuture) {
      console.log("future, offset:", offset);
      l = rs.length;
    } else {
      l = txs.length;
      console.log(accTxs.length, txs[0][0]);
    }
    accTxs = [...accTxs, ...txs];
    await sleep(500);
  }

  console.log(accTxs.length);

  fs.writeFile(
    network + "_raw_txs.json",
    JSON.stringify(accTxs),
    function (err) {
      if (err) throw err;
      console.log("Saved Result");
    }
  );
};

(async () => {
  // await graphqlToJson();
  // return;

  const accTxs = JSON.parse(fs.readFileSync(network + "_raw_txs.json"));

  let pairs = [];
  // start
  l = 120000;
  while (true) {
    try {
      console.log("pairs:", l, pairs.length);
      const slice = accTxs.slice(l, l + 100);
      if (slice.length < 1) {
        break;
      }

      const tmp = await Promise.all(
        slice.map(async (e) => {
          return [e[0], await getTxInputTerra(e[0], e[1])];
        })
      );
      pairs = [...pairs, ...tmp];
      l += 100;
    } catch (e) {
      console.log(e);
      break;
    }
    await sleep(5000);
    if (l % 30000 === 0) {
      console.log("break if l % 30000 === 0: ", l);
      break;
    }
  }

  const a = {};
  for (const p of pairs) {
    const [date, datas] = p;
    for (const data of datas) {
      const [symbol, rate] = data;
      if (!a[date]) {
        a[date] = {};
      }
      if (!a[date][symbol]) {
        a[date][symbol] = [];
      }
      a[date][symbol] = [...a[date][symbol], rate];
    }
  }

  fs.writeFile(network + "_" + l + ".json", JSON.stringify(a), function (err) {
    if (err) throw err;
    console.log("Saved Result");
  });

  fs.writeFile(
    network + "_" + l + "_tx_not_found.json",
    JSON.stringify(txNotFound),
    function (err) {
      if (err) throw err;
      console.log("Saved Tx Not Found");
    }
  );
})();
