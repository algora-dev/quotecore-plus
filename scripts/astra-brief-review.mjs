import fs from 'node:fs';
const brief = fs.readFileSync('docs/AI_SCAN_V3_ACCURACY_BRIEF.md', 'utf8');

const system = `You are reviewing an engineering brief for a roof-plan AI takeoff pipeline (Next.js + OpenAI vision). The brief was written by another engineer after auditing the code. Your job: find flaws, gaps, edge cases, or improvements in the PROPOSED PLAN - be concrete and technical. Focus especially on: (1) the proposed hip/valley 45-degree angle gate (rotation-invariance via dominant outline axis - is the longest-edge reference robust? what about L-shaped/complex outlines or near-square roofs?), (2) the orphan-line rejection heuristic (could it drop genuine short components like broken hips?), (3) anything the brief misses that would improve classification accuracy cheaply. Keep your answer under 900 words. Format: numbered findings, each with severity (high/med/low) and a concrete recommendation. Do not rewrite the brief.`;

const body = {
  model: 'gpt-6-astra',
  reasoning_effort: 'low',
  max_completion_tokens: 4000,
  messages: [
    { role: 'system', content: system },
    { role: 'user', content: brief },
  ],
};

fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: JSON.stringify(body),
})
  .then(async r => {
    const j = await r.json();
    console.error('usage:', JSON.stringify(j.usage));
    console.log(j.choices?.[0]?.message?.content ?? JSON.stringify(j).slice(0, 2000));
  })
  .catch(e => { console.error(e.message); process.exit(1); });
