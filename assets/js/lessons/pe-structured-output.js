export default {
  id: 'pe-structured-output',
  title: 'Structured outputs and extraction',
  minutes: 10,
  interactive: false,
  tags: ['json', 'schema', 'extraction', 'structured output', 'validation'],
  summary: 'Design outputs that software can consume reliably, and validate them instead of parsing decorative prose.',
  body: () => `
    <h2>Humans like prose; software likes contracts</h2>
    <p>If another program consumes the answer, define fields and allowed values explicitly.</p>
    <pre><code>Extract:
{
  "company": string,
  "amount_usd": number | null,
  "renewal_date": "YYYY-MM-DD" | null,
  "auto_renews": boolean | null
}
Use null when the document does not provide a value.</code></pre>

    <h2>Do not make the model guess missing facts</h2>
    <p>Extraction prompts should define missing-data behavior. Otherwise the model may try to be helpful by filling gaps.</p>

    <h2>Constrain categories</h2>
    <pre><code>priority must be exactly one of:
"low", "medium", "high", "urgent"</code></pre>

    <h2>Validate outside the prompt</h2>
    <p>When your model/API supports schema-constrained structured output, prefer it. Regardless, application code should validate types, required fields, ranges, and business rules.</p>

    <h2>Separate extraction from interpretation</h2>
    <pre><code>Step 1: Extract the cancellation date stated in the contract.
Step 2: Based only on that extracted clause, explain whether notice is late.</code></pre>
    <p>This makes it easier to see whether an error came from reading the source or reasoning about it.</p>
  `,
  init() { return () => {}; },
};
