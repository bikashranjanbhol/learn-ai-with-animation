export default {
  id: 'pe-tools',
  title: 'Tool calling and agent prompts',
  minutes: 12,
  interactive: false,
  tags: ['tools', 'function calling', 'agents', 'apis', 'actions'],
  summary: 'Move beyond text generation by letting models choose structured tools, observe results, and continue the task safely.',
  body: () => `
    <h2>A model cannot know or do everything from text alone</h2>
    <p>Tools let an application give the model controlled capabilities: search a database, read a calendar, calculate a value, or create a ticket.</p>

    <h2>Describe tools precisely</h2>
    <pre><code>Tool: get_weather
Purpose: Get current or forecast weather for a location.
Arguments:
- location: city and country
- date: ISO date</code></pre>
    <p>Good tool descriptions explain when to use the tool and define arguments that are hard to misuse.</p>

    <h2>The tool loop</h2>
    <ol><li>User gives a goal.</li><li>Model decides whether a tool is needed.</li><li>Application validates and executes the tool call.</li><li>Tool result returns to the model.</li><li>Model answers or chooses another tool.</li></ol>

    <h2>Example</h2>
    <pre><code>User: What meetings do I have tomorrow afternoon?
Model → calendar_search(date=..., time_range=...)
Tool → [three events]
Model → summarizes the three events.</code></pre>

    <h2>Agents add repeated decisions</h2>
    <p>An agent can plan, call tools, inspect results, and continue until a stopping condition is reached. This increases capability and also increases the number of ways a workflow can fail.</p>

    <h2>Guard side effects</h2>
    <p>Reading data and changing data are different risk levels. Validate arguments, constrain permissions, require confirmation for consequential actions when appropriate, and never rely on prompt wording as the only security boundary.</p>
  `,
  init() { return () => {}; },
};
