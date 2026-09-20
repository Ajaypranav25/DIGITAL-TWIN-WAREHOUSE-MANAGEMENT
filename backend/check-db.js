const { Client } = require('pg');
const c = new Client({ host:'localhost', port:5432, user:'postgres', password:'postgres', database:'digital_twin_wms' });
c.connect().then(async () => {
  const r = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  console.log('Tables:', r.rows.map(x => x.tablename).join(', '));
  const v = await c.query("SELECT viewname FROM pg_views WHERE schemaname='public'");
  console.log('Views:', v.rows.map(x => x.viewname).join(', ') || 'none');
  const f = await c.query("SELECT proname, prokind FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')");
  console.log('Functions/Procs:', f.rows.map(x => x.proname).join(', ') || 'none');
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
