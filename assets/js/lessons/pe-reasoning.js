export default {
  id: 'pe-reasoning',
  title: 'Reasoning, decomposition, and planning',
  minutes: 11,
  interactive: false,
  tags: ['reasoning', 'decomposition', 'planning', 'verification', 'complex tasks'],
  summary: 'Improve difficult tasks by decomposing them into explicit stages and asking for useful intermediate artifacts and checks.',
  body: () => `
    <h2>Complex jobs contain smaller jobs</h2>
    <p>For difficult tasks, reliability often improves when you specify a workflow rather than asking for the final answer in one leap.</p>
    <pre><code>Goal: Recommend a database.
1. Extract the workload requirements.
2. List the important decision criteria.
3. Compare the candidates against those criteria.
4. Identify missing information.
5. Give the recommendation and biggest trade-off.</code></pre>

    <h2>Ask for useful intermediate artifacts</h2>
    <p>You usually care more about inspectable outputs than hidden internal reasoning. Request a checklist, calculation, evidence table, assumptions, or verification result.</p>
    <pre><code>Calculate the monthly infrastructure cost.
Show the quantities and unit prices used.
Then verify the arithmetic and return the total.</code></pre>

    <h2>Plan before acting</h2>
    <p>For multi-step agent workflows, separate planning from actions when mistakes are expensive.</p>
    <pre><code>Before changing any files:
- identify the files involved,
- explain the minimal change,
- list tests that should pass.
Then perform the approved change.</code></pre>

    <h2>Break large prompts into stages</h2>
    <p>Instead of one giant instruction that researches, analyzes, writes, critiques, and reformats simultaneously, use a pipeline when you can inspect or programmatically validate each stage.</p>

    <div class="callout"><div class="callout-title">Key idea</div><p>Decomposition is not about making the prompt longer. It is about turning one fuzzy failure point into several observable steps.</p></div>
  `,
  init() { return () => {}; },
};
