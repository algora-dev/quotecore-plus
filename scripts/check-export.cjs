const https = require('https');
const token = process.argv[2];

async function query(sql) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: '/v1/projects/aaavvfttkesdzblttmby/database/query',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.write(body);
    req.end();
  });
}

(async () => {
  const ra = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'quote_roof_areas' ORDER BY ordinal_position;`);
  console.log('quote_roof_areas:', ra);
  const re = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'quote_roof_area_entries' ORDER BY ordinal_position;`);
  console.log('quote_roof_area_entries:', re);
  const ce = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'quote_component_entries' ORDER BY ordinal_position;`);
  console.log('quote_component_entries:', ce);
})();
