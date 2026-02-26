/**
 * DB에 vercel.app 링크가 남아 있는지 최종 확인
 */
import { createClient } from "@libsql/client/web";

const DBS = [
  {
    name: "apppro-kr",
    url: "libsql://apppro-kr-migkjy.aws-ap-northeast-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE2OTk5MDgsImlkIjoiMmRiNWUwMDktYzVhNS00ZTcxLWFlMDQtMTYyNmU2NjEwMTg5IiwicmlkIjoiMDkwMmJiMTEtODZjNy00MDBkLTg4MzEtMjdiNzA2YmQ5ZGZhIn0.iyA0v2sLm9Z8cyMvTuXMiXDsMNLmZ5dzAxhb8O50dVasBmya6ZBsGOYOUSJc120gRwFIIOE4-kNyXi1WNsZuAg",
    tables: ["blog_posts"],
  },
  {
    name: "content-os",
    url: "libsql://content-os-migkjy.aws-ap-northeast-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzE4MzEzNjcsImlkIjoiM2NkMTE2YjUtOWMwZS00YWZkLWI1OGYtYWZlZDZmZTgwMzRmIiwicmlkIjoiNGU2NmY0YWMtN2M2Ni00YTFiLThmNzEtYTEzNWU1YTUzNWQ2In0.6rSElslfeBOerqeipE0aDZFRUl-2_YpV1wac2cMljWLFadHL8XHw7PYZY6T2p57GJkIuItGlpxkSUnZb8xKzAA",
    tables: ["newsletters"],
  },
];

async function main() {
  let totalFound = 0;

  for (const db of DBS) {
    const client = createClient({ url: db.url, authToken: db.authToken });

    for (const table of db.tables) {
      let cols;
      try {
        const r = await client.execute(`PRAGMA table_info(${table})`);
        cols = r.rows.map((row) => row.name);
      } catch {
        continue;
      }

      const textCols = ["content", "html_content", "plain_content", "subject", "excerpt"].filter((c) => cols.includes(c));
      if (textCols.length === 0) continue;

      const conditions = textCols.map((c) => `${c} LIKE '%vercel.app%'`).join(" OR ");
      const result = await client.execute(`SELECT COUNT(*) as cnt FROM ${table} WHERE ${conditions}`);
      const cnt = Number(result.rows[0].cnt);
      console.log(`${db.name}/${table}: ${cnt} rows with vercel.app`);
      totalFound += cnt;
    }
  }

  if (totalFound === 0) {
    console.log("\nvercel.app 링크 0건 확인 — 완전 제거 완료.");
  } else {
    console.log(`\n경고: ${totalFound}건 남아 있음. 재실행 필요.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
