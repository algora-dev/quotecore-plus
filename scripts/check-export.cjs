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
  const exportRow = await query(`SELECT ee.status, ee.error_summary, ee.completed_at FROM integration_exports ee WHERE ee.id = '42d70258-01bd-4bcd-9937-37a3b871ba09';`);
  console.log('Export:', exportRow);
  
  const attempts = await query(`SELECT step, error_summary, response_summary FROM integration_export_attempts WHERE export_id = '42d70258-01bd-4bcd-9937-37a3b871ba09' AND created_at > '2026-08-02 16:45:00' ORDER BY created_at;`);
  console.log('Recent attempts:', attempts);
  
  const records = await query(`SELECT external_type, external_id FROM integration_external_records WHERE integration_id = 'b003d57d-3c86-4c22-9a22-bc130d31cc2f';`);
  console.log('External records:', records);
})();
