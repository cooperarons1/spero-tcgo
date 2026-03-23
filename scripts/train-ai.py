#!/usr/bin/env python3
"""
Spero TCGO AI Weight Trainer

Learns scoring weights from AI self-play game traces.
Trains a logistic regression model per decision type to predict win probability
from game state features.

Usage:
  python scripts/train-ai.py --input data/traces.jsonl --output data/ai-weights.json
  python scripts/train-ai.py --input data/traces.jsonl --output data/ai-weights.json --verbose
"""

import argparse
import json
import sys
import os
from collections import defaultdict

def load_traces(path: str) -> list:
    """Load JSONL game traces."""
    traces = []
    with open(path, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                traces.append(json.loads(line))
    return traces

def extract_training_data(traces: list) -> dict:
    """Extract (features, label) pairs grouped by decision type."""
    data = defaultdict(lambda: {'X': [], 'y': []})

    for trace in traces:
        winner = trace.get('winner', 'timeout')
        if winner == 'timeout':
            continue

        for decision in trace.get('decisions', []):
            player_id = decision.get('playerId', '')
            # Determine if this player won
            if 'sim-player-1' in player_id:
                won = 1.0 if winner == 'deck1' else 0.0
            elif 'sim-player-2' in player_id:
                won = 1.0 if winner == 'deck2' else 0.0
            else:
                continue

            dtype = decision.get('type', 'BUILD')
            features = decision.get('state', [])
            if not features:
                continue

            data[dtype]['X'].append(features)
            data[dtype]['y'].append(won)

    return dict(data)

def sigmoid(z):
    """Numerically stable sigmoid."""
    import math
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    else:
        ez = math.exp(z)
        return ez / (1.0 + ez)

def train_logistic_regression(X: list, y: list, lr: float = 0.01, epochs: int = 100) -> dict:
    """
    Train logistic regression weights using gradient descent.
    Pure Python — no numpy/sklearn dependency.
    """
    if not X or not y:
        return {'bias': 0.0, 'coefficients': []}

    n_features = len(X[0])
    n_samples = len(X)

    # Initialize weights
    weights = [0.0] * n_features
    bias = 0.0

    for epoch in range(epochs):
        # Compute gradients
        grad_w = [0.0] * n_features
        grad_b = 0.0

        for i in range(n_samples):
            z = bias + sum(w * x for w, x in zip(weights, X[i]))
            pred = sigmoid(z)
            error = pred - y[i]

            grad_b += error
            for j in range(n_features):
                grad_w[j] += error * X[i][j]

        # Update
        bias -= lr * grad_b / n_samples
        for j in range(n_features):
            weights[j] -= lr * grad_w[j] / n_samples

    return {'bias': bias, 'coefficients': weights}

def evaluate_accuracy(X: list, y: list, weights: dict) -> float:
    """Evaluate prediction accuracy."""
    if not X:
        return 0.0

    correct = 0
    for i in range(len(X)):
        z = weights['bias'] + sum(w * x for w, x in zip(weights['coefficients'], X[i]))
        pred = 1.0 if sigmoid(z) >= 0.5 else 0.0
        if pred == y[i]:
            correct += 1

    return correct / len(X)

FEATURE_NAMES = [
    'myAP', 'oppAP', 'apDiff', 'handSize', 'deckRemaining',
    'numMyStacks', 'numOppStacks', 'maxMyPower', 'maxMySmarts',
    'maxOppPower', 'maxOppSmarts', 'myTotalCards', 'oppTotalCards',
    'turnNumber', 'mySideplayCount', 'oppSideplayCount',
    'myViciousBonus', 'myStrategyBonus',
    'handCharacters', 'handEquipment', 'handActions', 'handTricks',
    'handAvgCost', 'handAvgStats',
]

def main():
    parser = argparse.ArgumentParser(description='Train AI weights from game traces')
    parser.add_argument('--input', required=True, help='Path to JSONL traces file')
    parser.add_argument('--output', required=True, help='Path to output weights JSON')
    parser.add_argument('--lr', type=float, default=0.01, help='Learning rate')
    parser.add_argument('--epochs', type=int, default=200, help='Training epochs')
    parser.add_argument('--verbose', action='store_true', help='Print detailed output')
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading traces from {args.input}...")
    traces = load_traces(args.input)
    print(f"Loaded {len(traces)} game traces")

    # Filter out timeouts
    valid_traces = [t for t in traces if t.get('winner') != 'timeout']
    print(f"Valid traces (non-timeout): {len(valid_traces)}")

    if not valid_traces:
        print("No valid traces to train on!", file=sys.stderr)
        sys.exit(1)

    print("Extracting training data...")
    data = extract_training_data(valid_traces)

    all_weights = {}
    for dtype, samples in data.items():
        n = len(samples['X'])
        wins = sum(samples['y'])
        print(f"\n--- {dtype} ---")
        print(f"  Samples: {n}, Wins: {int(wins)}, Win rate: {wins/n:.1%}")

        if n < 10:
            print(f"  Skipping (too few samples)")
            continue

        weights = train_logistic_regression(
            samples['X'], samples['y'],
            lr=args.lr, epochs=args.epochs
        )
        accuracy = evaluate_accuracy(samples['X'], samples['y'], weights)
        print(f"  Accuracy: {accuracy:.1%}")

        if args.verbose and len(FEATURE_NAMES) == len(weights['coefficients']):
            print("  Top features:")
            indexed = list(zip(FEATURE_NAMES, weights['coefficients']))
            indexed.sort(key=lambda x: abs(x[1]), reverse=True)
            for name, w in indexed[:8]:
                print(f"    {name}: {w:+.4f}")

        all_weights[dtype] = weights

    # Write output
    os.makedirs(os.path.dirname(args.output) or '.', exist_ok=True)
    with open(args.output, 'w') as f:
        json.dump({
            'featureNames': FEATURE_NAMES,
            'weights': all_weights,
            'meta': {
                'traces': len(valid_traces),
                'epochs': args.epochs,
                'lr': args.lr,
            }
        }, f, indent=2)

    print(f"\nWeights written to {args.output}")
    print(f"Decision types trained: {list(all_weights.keys())}")

if __name__ == '__main__':
    main()
