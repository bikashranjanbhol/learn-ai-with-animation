export default {
  id: 'pe-production',
  title: 'Production prompt engineering',
  minutes: 12,
  interactive: false,
  tags: ['production', 'versioning', 'latency', 'cost', 'temperature', 'reliability'],
  summary: 'Treat prompts as versioned application components and balance quality with latency, cost, determinism, observability, and maintainability.',
  body: () => `
    <h2>Production changes the optimization target</h2>
    <p>A demo only has to work once. A product prompt must work across users, inputs, model updates, failures, and cost constraints.</p>

    <h2>Version prompts</h2>
    <pre><code>support_summary_v3
- added explicit missing-data behavior
- changed output schema
- passed 184/190 eval cases</code></pre>
    <p>Keep prompts in source control or a versioned prompt system so changes can be reviewed and rolled back.</p>

    <h2>Model settings are part of behavior</h2>
    <p>Sampling settings such as temperature can affect variability where the model/API exposes them. Model choice, token limits, tools, schemas, retrieval settings, and prompt text should be evaluated together.</p>

    <h2>Optimize the whole system</h2>
    <ul><li><strong>Quality:</strong> does it solve the task?</li><li><strong>Latency:</strong> how long does the workflow take?</li><li><strong>Cost:</strong> how many model and retrieval calls are needed?</li><li><strong>Reliability:</strong> what happens on malformed output or tool failure?</li><li><strong>Observability:</strong> can you reconstruct why a request failed?</li></ul>

    <h2>Prefer simple prompts that pass evals</h2>
    <p>Longer prompts are not automatically better. Remove redundant instructions, stale examples, and context that does not improve measured performance.</p>

    <h2>Use the right improvement lever</h2>
    <div class="table-wrap"><table><thead><tr><th>Problem</th><th>Likely lever</th></tr></thead><tbody>
      <tr><td>Task is ambiguous</td><td>Prompt specification</td></tr>
      <tr><td>Missing current/private facts</td><td>Retrieval / tools</td></tr>
      <tr><td>Output must be machine-readable</td><td>Structured output + validation</td></tr>
      <tr><td>Repeated domain behavior is hard to specify</td><td>Examples, evals, possibly fine-tuning</td></tr>
      <tr><td>Workflow requires actions</td><td>Tool calling / agent design</td></tr>
    </tbody></table></div>

    <div class="callout"><div class="callout-title">Final principle</div><p>Prompt engineering is one layer of an LLM system. Reliable products combine good instructions with good context, tools, validation, security, and evaluation.</p></div>
  `,
  init() { return () => {}; },
};
