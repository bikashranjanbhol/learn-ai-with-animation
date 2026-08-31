export default {
  id: 'pe-evals',
  title: 'Prompt evaluation and testing',
  minutes: 12,
  interactive: false,
  tags: ['evals', 'testing', 'metrics', 'regression', 'quality'],
  summary: 'Replace prompt vibes with a repeatable test set, measurable criteria, regression checks, and human review where judgment matters.',
  body: () => `
    <h2>A prompt is part of your software</h2>
    <p>Changing a prompt can fix one example and silently break ten others. Keep representative test cases and rerun them after changes.</p>

    <h2>Build an eval set</h2>
    <ul><li>Normal examples</li><li>Edge cases</li><li>Ambiguous inputs</li><li>Missing information</li><li>Long inputs</li><li>Adversarial or malformed inputs</li></ul>

    <h2>Choose measurable criteria</h2>
    <div class="table-wrap"><table><thead><tr><th>Task</th><th>Possible metric</th></tr></thead><tbody>
      <tr><td>Classification</td><td>Accuracy / precision / recall</td></tr>
      <tr><td>Extraction</td><td>Field-level exact match</td></tr>
      <tr><td>RAG answer</td><td>Answer correctness + citation support</td></tr>
      <tr><td>Writing</td><td>Human rubric or model-assisted rubric with audits</td></tr>
      <tr><td>Tool use</td><td>Correct tool + correct arguments + successful outcome</td></tr>
    </tbody></table></div>

    <h2>Example rubric</h2>
    <pre><code>Score 0-2 for each:
- Correctness
- Completeness
- Follows constraints
- Supported by supplied evidence
- Appropriate format</code></pre>

    <h2>Compare versions</h2>
    <p>Store the prompt version, model/configuration, test input, output, and score. Evaluate changes across the whole set rather than choosing the version that wins on your favorite example.</p>

    <h2>Production feedback is another dataset</h2>
    <p>Collect failures, anonymize them where needed, and turn representative failures into regression tests. Your eval set should grow with the product.</p>
  `,
  init() { return () => {}; },
};
