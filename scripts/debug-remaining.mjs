import { createClient } from "@libsql/client/web";

const client = createClient({
  url: "libsql://apppro-kr-migkjy.aws-ap-northeast-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE2OTk5MDgsImlkIjoiMmRiNWUwMDktYzVhNS00ZTcxLWFlMDQtMTYyNmU2NjEwMTg5IiwicmlkIjoiMDkwMmJiMTEtODZjNy00MDBkLTg4MzEtMjdiNzA2YmQ5ZGZhIn0.iyA0v2sLm9Z8cyMvTuXMiXDsMNLmZ5dzAxhb8O50dVasBmya6ZBsGOYOUSJc120gRwFIIOE4-kNyXi1WNsZuAg",
});

const r = await client.execute(
  `SELECT id, slug, excerpt, metaDescription FROM blog_posts WHERE content LIKE '%vercel.app%' OR excerpt LIKE '%vercel.app%' OR metaDescription LIKE '%vercel.app%'`
);
for (const row of r.rows) {
  console.log("ID:", row.id, "| slug:", row.slug);
  console.log("excerpt vercel:", row.excerpt?.includes?.("vercel.app"));
  console.log("meta vercel:", row.metaDescription?.includes?.("vercel.app"));
}
