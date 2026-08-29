/** Course registry — the single source of truth for navigation order. */
import whatIsAi     from './lessons/what-is-ai.js';
import neuron       from './lessons/neuron.js';
import network      from './lessons/network.js';
import loss         from './lessons/loss.js';
import gradient     from './lessons/gradient-descent.js';
import backprop     from './lessons/backprop.js';
import embeddings   from './lessons/embeddings.js';
import attention    from './lessons/attention.js';
import generation   from './lessons/generation.js';

export const sections = [
  { title: 'Foundations',      lessons: [whatIsAi, neuron, network] },
  { title: 'How Models Learn', lessons: [loss, gradient, backprop] },
  { title: 'Modern AI',        lessons: [embeddings, attention, generation] },
];

// Decorate each lesson with its section name, then flatten in reading order.
sections.forEach(s => s.lessons.forEach(l => { l.section = s.title; }));

export const lessons = sections.flatMap(s => s.lessons);
export const byId = new Map(lessons.map(l => [l.id, l]));
