export default {
  id: 'prompt-engineering',
  title: 'Prompt engineering: giving models a better job description',
  minutes: 8,
  interactive: false,
  tags: ['prompt engineering', 'llm', 'instructions', 'context', 'examples', 'evaluation'],
  summary: 'Good prompts reduce ambiguity. Learn a practical structure for telling a language model what to do, what context matters, what constraints to follow, and what a useful answer should look like.',

  body: () => `
    <h2>A prompt is a specification</h2>
    <p>A language model can respond to a short request, but reliable results usually come from treating the prompt like a small specification rather than a magic phrase. The goal is not to discover secret words. The goal is to remove avoidable ambiguity.</p>

    <div class="callout">
      <div class="callout-title">A useful mental model</div>
      <p><strong>Task + context + constraints + output format + examples.</strong> You do not need every part every time, but each one answers a different question the model would otherwise have to guess.</p>
    </div>

    <h2>1. State the task clearly</h2>
    <p>Start with the action you want. Prefer a concrete verb and a measurable result.</p>
    <pre><code>Weak:  Tell me about this article.
Better: Summarize this article in 5 bullets for a product manager.</code></pre>
    <p>The second prompt defines both the operation and the audience, so the model has fewer plausible interpretations to choose from.</p>

    <h2>2. Give the context that changes the answer</h2>
    <p>Models cannot know which background details matter unless you provide them. Include only context that can change the result.</p>
    <pre><code>You are reviewing onboarding copy for a B2B analytics product.
The reader is a first-time admin who has never configured SSO.</code></pre>
    <p>Useful context often includes the audience, source material, product constraints, prior decisions, definitions, and the reason the output will be used.</p>

    <h2>3. Add constraints</h2>
    <p>Constraints turn preferences into testable requirements. They can control length, tone, scope, sources, forbidden assumptions, or required coverage.</p>
    <ul>
      <li><strong>Length:</strong> "Keep it under 150 words."</li>
      <li><strong>Scope:</strong> "Only use information in the supplied notes."</li>
      <li><strong>Tone:</strong> "Use plain language; avoid marketing claims."</li>
      <li><strong>Coverage:</strong> "Include risks, trade-offs, and next steps."</li>
    </ul>

    <h2>4. Specify the shape of the answer</h2>
    <p>If you know how you will use the answer, tell the model. A requested structure is often more reliable than asking for something "clear" or "professional."</p>
    <pre><code>Return:
1. A one-sentence recommendation
2. Three reasons
3. The biggest risk
4. One next action</code></pre>

    <h2>5. Show examples when style or judgment matters</h2>
    <p>Examples are especially useful when the task depends on a pattern that is hard to describe precisely. Give one or two representative inputs and ideal outputs, then ask the model to apply the same rule to the new case.</p>

    <div class="table-wrap"><table>
      <thead><tr><th>Technique</th><th>Best for</th><th>Common mistake</th></tr></thead>
      <tbody>
        <tr><td><strong>Clear instructions</strong></td><td>Most everyday tasks</td><td>Using vague verbs like "improve" without saying how</td></tr>
        <tr><td><strong>Context</strong></td><td>Domain-specific answers</td><td>Dumping irrelevant background into the prompt</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Reliable boundaries</td><td>Adding conflicting requirements</td></tr>
        <tr><td><strong>Output format</strong></td><td>Reusable or machine-consumed output</td><td>Asking for structure but not defining it</td></tr>
        <tr><td><strong>Examples</strong></td><td>Classification, style, extraction</td><td>Showing examples that do not match the real task</td></tr>
      </tbody>
    </table></div>

    <h2>A reusable prompt pattern</h2>
    <pre><code>Task:
[What should the model do?]

Context:
[What facts or audience details change the answer?]

Constraints:
[What must it include, avoid, or limit?]

Output:
[What structure should the result follow?]</code></pre>

    <h2>Prompt engineering is iterative</h2>
    <p>The first prompt is a hypothesis. Test the output against real examples, notice where it fails, then change the prompt to address that failure. If the model repeatedly misses a requirement, make the requirement explicit. If the answer is bloated, tighten the output contract. If important facts are missing, improve the context.</p>

    <h3>Evaluate the result, not the prompt</h3>
    <p>A prompt is only "good" if it produces useful outputs consistently. For important workflows, keep a small set of representative test cases and compare prompt changes against them. This is more dependable than judging a prompt because it sounds sophisticated.</p>

    <div class="callout">
      <div class="callout-title">The core skill</div>
      <p>Prompt engineering is mostly <strong>problem specification</strong>: deciding what success means, supplying the information needed to reach it, and making the result easy to evaluate.</p>
    </div>
  `,

  init() {
    return () => {};
  },
};
