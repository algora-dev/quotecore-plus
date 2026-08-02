const https = require('https');
const body = JSON.stringify({
  query: `SELECT ee.id, ee.status, ee.queued_at, ee.started_at, ee.completed_at, ee.error_summary, ee.error_code, ee.retry_count FROM integration_exports ee WHERE ee.id = '42d70258-01bd-4bcd-9937-37a3b871ba09';`
});
const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/aaavvfttkesdzblttmby/database/query',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN }
};
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log(data));
});
req.write(body);
req.end();
