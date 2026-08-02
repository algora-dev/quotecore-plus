const https = require('https');
https.get('https://api.fergus.com/docs/json', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const spec = JSON.parse(data);
    // Get the full quote creation schema
    const quotePath = spec.paths['/jobs/{jobId}/quotes']?.post?.requestBody?.content['application/json']?.schema;
    if (quotePath?.properties?.sections?.items) {
      console.log('Section schema:', JSON.stringify(quotePath.properties.sections.items, null, 2));
    }
    // Check CreateNotePayload
    const notePayload = spec.components?.schemas?.CreateNotePayload;
    console.log('CreateNotePayload:', JSON.stringify(notePayload, null, 2));
    // Check attachment schema more closely
    const attPath = spec.paths['/attachments']?.post?.requestBody;
    console.log('Attachment requestBody:', JSON.stringify(attPath, null, 2));
  });
});
