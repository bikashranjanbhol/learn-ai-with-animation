export default {
  id: 'pe-context',
  title: 'Context engineering and long prompts',
  minutes: 11,
  interactive: false,
  tags: ['context engineering', 'context window', 'long context', 'relevance', 'prompt design'],
  summary: 'Choose and organize the information a model sees instead of treating the context window like unlimited storage.',
  body: () => `
    <h2>Context engineering is information selection</h2>
    <p>The question is not "How much can I fit?" but "What information makes the next model decision easier and more correct?"</p>

    <h2>Useful context categories</h2>
    <ul><li>Current user request</li><li>Relevant conversation state</li><li>Authoritative policies or instructions</li><li>Retrieved evidence</li><li>Tool results</li><li>Compact examples</li></ul>

    <h2>More context can be worse</h2>
    <p>Irrelevant material adds competing details and costs tokens. Prefer the smallest context that preserves the evidence needed for the task.</p>
    <pre><code>Bad: Attach the entire 200-page handbook.
Better: Retrieve the leave-policy section plus definitions referenced by it.</code></pre>

    <h2>Put structure around long context</h2>
    <pre><code>&lt;task&gt;Answer the employee's leave question.&lt;/task&gt;
&lt;policy&gt;...retrieved policy text...&lt;/policy&gt;
&lt;question&gt;Can I carry unused days into next year?&lt;/question&gt;</code></pre>

    <h2>Manage conversation memory intentionally</h2>
    <p>Long-running assistants should preserve durable facts and current state, not blindly replay every previous turn. Summaries can compress history, but important exact constraints should remain explicit.</p>

    <div class="callout"><div class="callout-title">Prompting vs context engineering</div><p>Prompt engineering designs the instruction. Context engineering designs the information environment in which that instruction is executed.</p></div>
  `,
  init() { return () => {}; },
};
