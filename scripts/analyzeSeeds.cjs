#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const manualSeeds = [
  {
    id: 'manual-1',
    label: 'special',
    notedAt: '2025-09-28T09:19:56+09:00',
    params: {
      du: 0.041,
      dv: 0.028,
      feed: 0.015,
      kill: 0.044,
      dt: 2.0,
      threshold: 0.21,
      contrast: 2.45,
      gamma: 0.4,
      invert: false,
    },
    metrics: {
      activity: 0.0,
      entropy: 0.34,
      stdU: 0.262,
      stdV: 0.074,
    },
  },
  {
    id: 'manual-2',
    label: 'special',
    notedAt: '2025-09-28T09:06:48+09:00',
    params: {
      du: 1.0,
      dv: 0.266,
      feed: 0.1,
      kill: 0.054,
      dt: 1.0,
      threshold: 0.2,
      contrast: 1.5,
      gamma: 1.1,
      invert: false,
    },
    metrics: {
      activity: 0.0,
      entropy: 0.84,
      stdU: 0.208,
      stdV: 0.14,
    },
  },
  {
    id: 'manual-3',
    label: 'special',
    notedAt: '2025-09-28T09:13:46+09:00',
    params: {
      du: 1.0,
      dv: 0.306,
      feed: 0.023,
      kill: 0.06,
      dt: 1.0,
      threshold: 0.2,
      contrast: 1.5,
      gamma: 1.1,
      invert: false,
    },
    metrics: {
      activity: 0.0,
      entropy: 1.35,
      stdU: 0.123,
      stdV: 0.125,
    },
  },
  {
    id: 'manual-4',
    label: 'special',
    notedAt: '2025-09-28T09:16:49+09:00',
    params: {
      du: 0.547,
      dv: 0.089,
      feed: 0.084,
      kill: 0.077,
      dt: 1.5,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      activity: 0.0,
      entropy: 0.6,
      stdU: 0.201,
      stdV: 0.169,
    },
  },
  {
    id: 'manual-5',
    label: 'special',
    notedAt: '2025-09-28T09:19:10+09:00',
    params: {
      du: 0.621,
      dv: 0.07,
      feed: 0.1,
      kill: 0.07,
      dt: 1.5,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      activity: 0.0,
      entropy: 1.24,
      stdU: 0.264,
      stdV: 0.25,
    },
  },
  {
    id: 'manual-6',
    label: 'special',
    notedAt: '2025-09-28T09:22:05+09:00',
    params: {
      du: 0.722,
      dv: 0.08,
      feed: 0.02,
      kill: 0.056,
      dt: 1.5,
      threshold: 0.16,
      contrast: 5.0,
      gamma: 0.2,
      invert: true,
    },
    metrics: {
      activity: 0.0,
      entropy: 2.61,
      stdU: 0.116,
      stdV: 0.329,
    },
  },
  {
    id: 'manual-7',
    label: 'special',
    notedAt: '2025-09-28T09:25:55+09:00',
    params: {
      du: 0.621,
      dv: 0.07,
      feed: 0.003,
      kill: 0.021,
      dt: 1.5,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      activity: 0.0,
      entropy: 0.0,
      stdU: 0.0,
      stdV: 0.0,
    },
  },
  {
    id: 'manual-8',
    label: 'special',
    notedAt: '2025-09-28T09:27:48+09:00',
    params: {
      du: 0.043,
      dv: 0.009,
      feed: 0.002,
      kill: 0.021,
      dt: 1.5,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      activity: 0.0,
      entropy: 0.73,
      stdU: 0.339,
      stdV: 0.074,
    },
  },
  {
    id: 'manual-9',
    label: 'special',
    notedAt: '2025-09-28T09:28:41+09:00',
    params: {
      du: 0.043,
      dv: 0.009,
      feed: 0.001,
      kill: 0.026,
      dt: 2.0,
      threshold: 0.2,
      contrast: 5.0,
      gamma: 0.2,
      invert: false,
    },
    metrics: {
      activity: 0.0,
      entropy: 0.21,
      stdU: 0.272,
      stdV: 0.044,
    },
  },
];

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/analyzeSeeds.js <feedback-json>');
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);
let feedback = [];
try {
  const fileContents = fs.readFileSync(resolvedPath, 'utf8');
  feedback = JSON.parse(fileContents);
} catch (error) {
  console.error(`Failed to read feedback file at ${resolvedPath}:`, error.message);
  process.exit(1);
}

const combined = [...feedback, ...manualSeeds];

const metricsKeys = ['activity', 'entropy', 'stdU', 'stdV'];

function summarize(label) {
  const items = combined.filter((entry) => entry.label === label);
  const summary = {
    count: items.length,
    metrics: {},
    feed: {},
    kill: {},
  };
  if (items.length === 0) {
    return summary;
  }
  metricsKeys.forEach((key) => {
    const values = items
      .map((entry) => entry.metrics?.[key])
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    if (values.length === 0) {
      return;
    }
    values.sort((a, b) => a - b);
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const median = values[Math.floor(values.length / 2)];
    summary.metrics[key] = {
      min: values[0],
      median,
      max: values[values.length - 1],
      mean: avg,
    };
  });
  const feedValues = items.map((entry) => entry.params.feed).sort((a, b) => a - b);
  const killValues = items.map((entry) => entry.params.kill).sort((a, b) => a - b);
  summary.feed = {
    min: feedValues[0],
    median: feedValues[Math.floor(feedValues.length / 2)],
    max: feedValues[feedValues.length - 1],
  };
  summary.kill = {
    min: killValues[0],
    median: killValues[Math.floor(killValues.length / 2)],
    max: killValues[killValues.length - 1],
  };
  return summary;
}

const groups = ['special', 'normal'];
const result = {};
for (const label of groups) {
  result[label] = summarize(label);
}

const difference = {};
metricsKeys.forEach((key) => {
  const specialMean = result.special.metrics[key]?.mean ?? 0;
  const normalMean = result.normal.metrics[key]?.mean ?? 0;
  difference[key] = specialMean - normalMean;
});

console.log('=== Seed Feedback Analysis ===');
console.log(
  `Total entries: ${combined.length} (manual specials: ${manualSeeds.length}, feedback file: ${feedback.length})`,
);
console.log('\nGroup summary:');
for (const label of groups) {
  const summary = result[label];
  console.log(`\n- ${label.toUpperCase()} (${summary.count})`);
  if (summary.count === 0) {
    continue;
  }
  metricsKeys.forEach((key) => {
    const stats = summary.metrics[key];
    if (!stats) {
      return;
    }
    console.log(
      `  ${key.padEnd(8)} min=${stats.min.toFixed(4)} median=${stats.median.toFixed(4)} mean=${stats.mean.toFixed(4)} max=${stats.max.toFixed(4)}`,
    );
  });
  console.log(
    `  feed range ${summary.feed.min.toFixed(4)} – ${summary.feed.max.toFixed(4)} (median ${summary.feed.median.toFixed(4)})`,
  );
  console.log(
    `  kill range ${summary.kill.min.toFixed(4)} – ${summary.kill.max.toFixed(4)} (median ${summary.kill.median.toFixed(4)})`,
  );
}

console.log('\nMetric mean differences (special - normal):');
for (const key of metricsKeys) {
  console.log(`  ${key.padEnd(8)} ${difference[key].toFixed(4)}`);
}

const specialHighEntropy = combined
  .filter((entry) => entry.label === 'special' && entry.metrics.entropy >= 0.8)
  .map((entry) => entry.id);

console.log('\nSpecial entries with entropy >= 0.8:', specialHighEntropy.length);
if (specialHighEntropy.length > 0) {
  console.log(`  ids: ${specialHighEntropy.join(', ')}`);
}

function classifyCandidate(entry) {
  const avgStd = (entry.metrics.stdU + entry.metrics.stdV) * 0.5;
  const { activity, entropy } = entry.metrics;
  if (activity <= 0.003 && ((avgStd >= 0.14 && entropy >= 0.18) || entropy >= 0.85)) {
    return 'structured';
  }
  if (activity <= 0.003) {
    return 'dormant';
  }
  if (activity > 0.16 || avgStd > 0.34 || entropy > 4.4) {
    return 'chaotic';
  }
  if (avgStd < 0.035 || entropy < 0.22) {
    return 'dormant';
  }
  return 'balanced';
}

const evaluation = {
  special: { structured: 0, other: 0, missed: [] },
  normal: { structured: 0, other: 0, flagged: [] },
};

combined.forEach((entry) => {
  const predicted = classifyCandidate(entry);
  if (entry.label === 'special') {
    if (predicted === 'structured') {
      evaluation.special.structured += 1;
    } else {
      evaluation.special.other += 1;
      evaluation.special.missed.push(entry.id);
    }
  }
  if (entry.label === 'normal') {
    if (predicted === 'structured') {
      evaluation.normal.structured += 1;
      evaluation.normal.flagged.push(entry.id);
    } else {
      evaluation.normal.other += 1;
    }
  }
});

console.log('\nDraft heuristic evaluation:');
console.log(
  `  Specials classified as structured: ${evaluation.special.structured}/${result.special.count} (missed ${evaluation.special.other})`,
);
console.log(
  `  Normals incorrectly classified as structured: ${evaluation.normal.structured}/${result.normal.count}`,
);
if (evaluation.special.missed.length > 0) {
  console.log(`  Missed special ids: ${evaluation.special.missed.join(', ')}`);
}
if (evaluation.normal.flagged.length > 0) {
  console.log(`  Normal false positives: ${evaluation.normal.flagged.join(', ')}`);
}
