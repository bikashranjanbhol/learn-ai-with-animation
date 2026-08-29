export default {
  id: 'pe-anatomy',
  title: 'Anatomy of a strong prompt',
  minutes: 9,
  interactive: false,
  tags: ['instructions', 'context', 'constraints', 'format', 'delimiters'],
  summary: 'Build prompts from five reusable parts: task, context, constraints, input, and output contract.',
  body: () => `
    <h2>Five parts, one job</h2>
    <p>A strong prompt usually answers five questions: <strong>What should happen? What context matters? What rules apply? What input should be processed? What should the answer look like?</strong></p>
    <pre><code>Task: Rewrite the customer reply.
Context: The customer is upset about a delayed shipment.
Constraints: Be empathetic, do not promise a refund, under 120 words.
Input: &lt;customer_message&gt;...&lt;/customer_message&gt;
Output: Return only the reply.</code></pre>

    <h2>1. Task</h2>
    <p>Use an explicit verb: summarize, classify, extract, compare, rewrite, generate, rank, diagnose, or explain.</p>
    <pre><code>Vague: Help with this feedback.
Clear: Classify each feedback item as bug, feature request, or praise.</code></pre>

    <h2>2. Context</h2>
    <p>Context is information that changes the correct answer: audience, product, definitions, policy, prior decisions, or goal.</p>

    <h2>3. Constraints</h2>
    <p>Turn preferences into testable rules.</p>
    <ul><li>Maximum length</li><li>Allowed sources</li><li>Required sections</li><li>Forbidden claims</li><li>Tone and reading level</li></ul>

    <h2>4. Input boundaries</h2>
    <p>Separate instructions from data with headings, XML-style tags, or fenced blocks. This makes long prompts easier to read and reduces accidental mixing.</p>
    <pre><code>&lt;article&gt;
Paste the article here.
&lt;/article&gt;</code></pre>

    <h2>5. Output contract</h2>
    <p>Describe the exact shape of the answer.</p>
    <pre><code>Return:
- Decision: approve | reject
- Reason: one sentence
- Confidence: low | medium | high</code></pre>

    <div class="callout"><div class="callout-title">Rule of thumb</div><p>If a human teammate could misunderstand the assignment, a model probably can too. Improve the specification before adding clever wording.</p></div>
  `,
  init() { return () => {}; },
};
