#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Dict, List, Sequence

# Manual seeds identified as special by the user
MANUAL_SEEDS: List[Dict] = [
    {
        "id": "manual-1",
        "label": "special",
        "params": {
            "du": 0.041,
            "dv": 0.028,
            "feed": 0.015,
            "kill": 0.044,
            "dt": 2.0,
            "threshold": 0.21,
            "contrast": 2.45,
            "gamma": 0.4,
            "invert": False,
        },
        "metrics": {
            "activity": 0.0,
            "entropy": 0.34,
            "stdU": 0.262,
            "stdV": 0.074,
        },
    },
    {
        "id": "manual-2",
        "label": "special",
        "params": {
            "du": 1.0,
            "dv": 0.266,
            "feed": 0.1,
            "kill": 0.054,
            "dt": 1.0,
            "threshold": 0.2,
            "contrast": 1.5,
            "gamma": 1.1,
            "invert": False,
        },
        "metrics": {
            "activity": 0.0,
            "entropy": 0.84,
            "stdU": 0.208,
            "stdV": 0.14,
        },
    },
    {
        "id": "manual-3",
        "label": "special",
        "params": {
            "du": 1.0,
            "dv": 0.306,
            "feed": 0.023,
            "kill": 0.06,
            "dt": 1.0,
            "threshold": 0.2,
            "contrast": 1.5,
            "gamma": 1.1,
            "invert": False,
        },
        "metrics": {
            "activity": 0.0,
            "entropy": 1.35,
            "stdU": 0.123,
            "stdV": 0.125,
        },
    },
    {
        "id": "manual-4",
        "label": "special",
        "params": {
            "du": 0.547,
            "dv": 0.089,
            "feed": 0.084,
            "kill": 0.077,
            "dt": 1.5,
            "threshold": 0.2,
            "contrast": 5.0,
            "gamma": 0.2,
            "invert": False,
        },
        "metrics": {
            "activity": 0.0,
            "entropy": 0.6,
            "stdU": 0.201,
            "stdV": 0.169,
        },
    },
    {
        "id": "manual-5",
        "label": "special",
        "params": {
            "du": 0.621,
            "dv": 0.07,
            "feed": 0.1,
            "kill": 0.07,
            "dt": 1.5,
            "threshold": 0.2,
            "contrast": 5.0,
            "gamma": 0.2,
            "invert": False,
        },
        "metrics": {
            "activity": 0.0,
            "entropy": 1.24,
            "stdU": 0.264,
            "stdV": 0.25,
        },
    },
    {
        "id": "manual-6",
        "label": "special",
        "params": {
            "du": 0.722,
            "dv": 0.08,
            "feed": 0.02,
            "kill": 0.056,
            "dt": 1.5,
            "threshold": 0.16,
            "contrast": 5.0,
            "gamma": 0.2,
            "invert": True,
        },
        "metrics": {
            "activity": 0.0,
            "entropy": 2.61,
            "stdU": 0.116,
            "stdV": 0.329,
        },
    },
    {
        "id": "manual-7",
        "label": "special",
        "params": {
            "du": 0.621,
            "dv": 0.07,
            "feed": 0.003,
            "kill": 0.021,
            "dt": 1.5,
            "threshold": 0.2,
            "contrast": 5.0,
            "gamma": 0.2,
            "invert": False,
        },
        "metrics": {
            "activity": 0.0,
            "entropy": 0.0,
            "stdU": 0.0,
            "stdV": 0.0,
        },
    },
    {
        "id": "manual-8",
        "label": "special",
        "params": {
            "du": 0.043,
            "dv": 0.009,
            "feed": 0.002,
            "kill": 0.021,
            "dt": 1.5,
            "threshold": 0.2,
            "contrast": 5.0,
            "gamma": 0.2,
            "invert": False,
        },
        "metrics": {
            "activity": 0.0,
            "entropy": 0.73,
            "stdU": 0.339,
            "stdV": 0.074,
        },
    },
    {
        "id": "manual-9",
        "label": "special",
        "params": {
            "du": 0.043,
            "dv": 0.009,
            "feed": 0.001,
            "kill": 0.026,
            "dt": 2.0,
            "threshold": 0.2,
            "contrast": 5.0,
            "gamma": 0.2,
            "invert": False,
        },
        "metrics": {
            "activity": 0.0,
            "entropy": 0.21,
            "stdU": 0.272,
            "stdV": 0.044,
        },
    },
]

FEATURES: Sequence[str] = (
    'activity',
    'entropy',
    'stdU',
    'stdV',
    'feed',
    'kill',
    'threshold',
    'dt',
    'contrast',
    'gamma',
    'invert',
)


def build_dataset(entries: Sequence[Dict]) -> List[Dict]:
    combined = {entry['id']: entry for entry in MANUAL_SEEDS}
    for entry in entries:
        combined[entry['id']] = entry
    return list(combined.values())


def extract_features(entry: Dict) -> List[float]:
    metrics = entry.get('metrics', {})
    params = entry.get('params', {})
    features = [
        float(metrics.get('activity', 0.0)),
        float(metrics.get('entropy', 0.0)),
        float(metrics.get('stdU', 0.0)),
        float(metrics.get('stdV', 0.0)),
        float(params.get('feed', 0.0)),
        float(params.get('kill', 0.0)),
        float(params.get('threshold', 0.0)),
        float(params.get('dt', 1.0)),
        float(params.get('contrast', 1.0)),
        float(params.get('gamma', 1.0)),
        1.0 if params.get('invert') else 0.0,
    ]
    return features


def logistic(z: float) -> float:
    if z >= 0:
        ez = math.exp(-z)
        return 1.0 / (1.0 + ez)
    ez = math.exp(z)
    return ez / (1.0 + ez)


def train_logistic_regression(X: List[List[float]], y: List[int], *, epochs: int = 5000, lr: float = 0.05) -> Dict:
    n_samples = len(X)
    n_features = len(X[0])
    weights = [0.0] * n_features
    bias = 0.0

    for epoch in range(epochs):
        grad_w = [0.0] * n_features
        grad_b = 0.0
        for xi, yi in zip(X, y):
            z = sum(w * xij for w, xij in zip(weights, xi)) + bias
            pred = logistic(z)
            error = pred - yi
            grad_b += error
            for j in range(n_features):
                grad_w[j] += error * xi[j]
        bias -= lr * (grad_b / n_samples)
        for j in range(n_features):
            weights[j] -= lr * (grad_w[j] / n_samples)
        if epoch % 1000 == 0 and epoch > 0:
            lr *= 0.9
    return {"weights": weights, "bias": bias}


def main() -> None:
    parser = argparse.ArgumentParser(description="Train logistic regression on seed feedback")
    parser.add_argument('feedback_json', type=Path, help='Path to aggregated feedback JSON file')
    parser.add_argument('--output', '-o', type=Path, default=Path('src/data/special-model.json'), help='Where to save the trained model')
    args = parser.parse_args()

    if not args.feedback_json.exists():
        raise SystemExit(f"Feedback file not found: {args.feedback_json}")

    entries = json.loads(args.feedback_json.read_text())
    dataset = build_dataset(entries)

    X: List[List[float]] = []
    y: List[int] = []
    for entry in dataset:
        label = entry.get('label')
        if label not in {'special', 'normal'}:
            continue
        X.append(extract_features(entry))
        y.append(1 if label == 'special' else 0)

    if not X:
        raise SystemExit('No valid data to train on')

    # standardize features
    n_features = len(X[0])
    means = [0.0] * n_features
    stds = [0.0] * n_features
    n_samples = len(X)

    for j in range(n_features):
        values = [row[j] for row in X]
        mean = sum(values) / n_samples
        variance = sum((v - mean) ** 2 for v in values) / max(1, n_samples - 1)
        std = math.sqrt(variance) if variance > 0 else 1.0
        means[j] = mean
        stds[j] = std
        for i in range(n_samples):
            X[i][j] = (X[i][j] - mean) / std

    model = train_logistic_regression(X, y, epochs=6000, lr=0.08)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            {
                'features': list(FEATURES),
                'weights': model['weights'],
                'bias': model['bias'],
                'means': means,
                'stds': stds,
                'trainedAt': Path(args.feedback_json).name,
            },
            indent=2,
        )
        + '\n'
    )
    print(f"Model saved to {args.output}")


if __name__ == '__main__':
    main()
