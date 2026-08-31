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

import promptEngineering from './lessons/prompt-engineering.js';
import peAnatomy     from './lessons/pe-anatomy.js';
import peZeroFewShot from './lessons/pe-zero-few-shot.js';
import peRoles       from './lessons/pe-roles.js';
import peReasoning   from './lessons/pe-reasoning.js';
import peStructured  from './lessons/pe-structured-output.js';
import peContext     from './lessons/pe-context.js';
import peRag         from './lessons/pe-rag.js';
import peTools       from './lessons/pe-tools.js';
import peSafety      from './lessons/pe-safety.js';
import peEvals       from './lessons/pe-evals.js';
import peProduction  from './lessons/pe-production.js';

import sdEstimation from './lessons/sd-estimation.js';
import sdLatency    from './lessons/sd-latency.js';
import sdCaching    from './lessons/sd-caching.js';
import sdLoadBal    from './lessons/sd-load-balancing.js';
import sdData       from './lessons/sd-data.js';
import sdConsistency from './lessons/sd-consistency.js';
import sdResilience from './lessons/sd-resilience.js';
import sdCaseStudy  from './lessons/sd-case-study.js';

export const AI = 'How AI Works';
export const SD = 'System Design';
export const PE = 'Prompt Engineering';

export const sections = [
  { track: AI, title: 'Foundations',        lessons: [whatIsAi, neuron, network] },
  { track: AI, title: 'How Models Learn',   lessons: [loss, gradient, backprop] },
  { track: AI, title: 'Modern AI',          lessons: [embeddings, attention, generation] },

  { track: SD, title: 'Sizing and Speed',   lessons: [sdEstimation, sdLatency, sdCaching] },
  { track: SD, title: 'Scaling Out',        lessons: [sdLoadBal, sdData, sdConsistency] },
  { track: SD, title: 'Staying Up',         lessons: [sdResilience, sdCaseStudy] },

  { track: PE, title: 'Foundations', lessons: [promptEngineering, peAnatomy, peRoles] },
  { track: PE, title: 'Prompting Techniques', lessons: [peZeroFewShot, peReasoning, peStructured] },
  { track: PE, title: 'Context and Tools', lessons: [peContext, peRag, peTools] },
  { track: PE, title: 'Reliability and Production', lessons: [peSafety, peEvals, peProduction] },
];

// Decorate each lesson with where it sits, then flatten in reading order.
sections.forEach(s => s.lessons.forEach(l => { l.section = s.title; l.track = s.track; }));

export const lessons = sections.flatMap(s => s.lessons);
export const byId = new Map(lessons.map(l => [l.id, l]));

/** Sections grouped by track, in order, for the sidebar and the home page. */
export const tracks = [AI, SD, PE].map(track => {
  const items = sections.filter(s => s.track === track);
  const trackLessons = items.flatMap(s => s.lessons);
  return {
    track,
    sections: items,
    lessons: trackLessons,
    minutes: trackLessons.reduce((n, l) => n + l.minutes, 0),
    blurb: track === AI
      ? 'What a model is, how it learns, and how a transformer turns that into text.'
      : track === SD
        ? 'Estimating scale, keeping latency low, and staying up when parts fail.'
        : 'From clear instructions and few-shot examples to RAG, tools, prompt injection defense, evals, and production reliability.',
  };
});

/** Position of a lesson within its own track — used for "Lesson 3 of 9". */
export const trackPosition = lesson => {
  const t = tracks.find(t => t.track === lesson.track);
  return { index: t.lessons.indexOf(lesson) + 1, total: t.lessons.length };
};
