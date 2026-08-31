export default {
  id: 'pe-zero-few-shot',
  title: 'Zero-shot and few-shot prompting',
  minutes: 10,
  interactive: false,
  tags: ['zero-shot', 'one-shot', 'few-shot', 'examples', 'classification'],
  summary: 'Know when instructions are enough and when examples are the clearest way to teach the pattern you want.',
  body: () => `
    <h2>Zero-shot: instruction only</h2>
    <p>Zero-shot prompting asks for a task without demonstrating it. Start here when the task and labels are obvious.</p>
    <pre><code>Classify the sentiment as positive, neutral, or negative.
Text: "The setup was easy, but reports load slowly."</code></pre>
    <p>A reasonable answer is <code>neutral</code> or mixed, which reveals an ambiguity: perhaps your label set needs a <code>mixed</code> class.</p>

    <h2>One-shot: show one example</h2>
    <pre><code>Example:
Text: "Love the new dashboard." → positive

Now classify:
Text: "Export works, but it takes forever."</code></pre>

    <h2>Few-shot: demonstrate the decision boundary</h2>
    <p>Few-shot prompting is useful when labels, style, or transformations are domain-specific.</p>
    <pre><code>"Login button does nothing" → bug
"Please add dark mode" → feature_request
"The new search is excellent" → praise

Classify: "Could you support CSV scheduling?"</code></pre>
    <p>The intended answer is <code>feature_request</code>.</p>

    <h2>Choose examples deliberately</h2>
    <ul><li>Cover different classes.</li><li>Include realistic edge cases.</li><li>Keep formatting consistent.</li><li>Do not accidentally teach irrelevant patterns.</li></ul>

    <div class="callout"><div class="callout-title">When examples beat explanation</div><p>If you need three paragraphs to describe a style or category boundary, one representative example may communicate it more precisely.</p></div>
  `,
  init() { return () => {}; },
};
