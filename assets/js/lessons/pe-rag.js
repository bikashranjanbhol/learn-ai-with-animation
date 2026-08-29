export default {
  id: 'pe-rag',
  title: 'RAG: prompting with retrieved knowledge',
  minutes: 12,
  interactive: false,
  tags: ['rag', 'retrieval', 'grounding', 'citations', 'knowledge'],
  summary: 'Ground answers in retrieved documents and design prompts that distinguish evidence from instructions.',
  body: () => `
    <h2>Retrieval-augmented generation</h2>
    <p>RAG retrieves relevant information at request time and places it in the model's context. It is useful for private, changing, or too-large knowledge bases.</p>

    <h2>The basic pipeline</h2>
    <ol><li>User asks a question.</li><li>Search retrieves relevant chunks.</li><li>The application inserts those chunks as evidence.</li><li>The model answers from the evidence.</li><li>The application can expose citations to the source chunks.</li></ol>

    <h2>A grounded prompt</h2>
    <pre><code>Answer the question using only the supplied sources.
If the sources do not contain the answer, say that the available sources are insufficient.
Cite the source ID after each factual claim.

&lt;sources&gt;
[S1] ...
[S2] ...
&lt;/sources&gt;

Question: ...</code></pre>

    <h2>Retrieval quality comes first</h2>
    <p>A perfect generation prompt cannot recover a fact that retrieval failed to supply. Debug RAG in layers: query, retrieved chunks, ranking, context construction, then generation.</p>

    <h2>Watch for conflicting sources</h2>
    <p>Tell the model how to handle conflicts: prefer newer policy, prefer a designated authoritative source, or surface the disagreement instead of silently choosing.</p>

    <h2>RAG is not model training</h2>
    <p>Retrieved text is temporary context for the current request. Fine-tuning changes model behavior through training. Use retrieval for knowledge that must be current or attributable.</p>
  `,
  init() { return () => {}; },
};
