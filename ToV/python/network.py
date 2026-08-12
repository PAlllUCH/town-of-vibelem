import json

import numpy as np


class MLP:
    def __init__(self, input_dim, hidden_dims, output_dim, seed=None):
        self.arch = [int(input_dim)] + [int(h) for h in hidden_dims] + [int(output_dim)]
        rng = np.random.default_rng(seed)
        self.W = []
        self.b = []
        for i in range(len(self.arch) - 1):
            fan_in = self.arch[i]
            fan_out = self.arch[i + 1]
            scale = np.sqrt(6.0 / (fan_in + fan_out))
            self.W.append(rng.uniform(-scale, scale, (fan_out, fan_in)))
            self.b.append(np.zeros(fan_out))
        self.dW = [None] * len(self.W)
        self.db = [None] * len(self.W)
        self._a = None
        self._z = None

    @staticmethod
    def _softmax(z):
        m = np.max(z)
        e = np.exp(z - m)
        return e / np.sum(e)

    def forward(self, x):
        x = np.asarray(x, dtype=np.float64)
        self._a = [x]
        self._z = []
        a = x
        last = len(self.W) - 1
        for l, w in enumerate(self.W):
            z = w @ a + self.b[l]
            self._z.append(z)
            a = self._softmax(z) if l == last else np.maximum(0.0, z)
            self._a.append(a)
        return a

    def predict(self, x):
        return self.forward(x)

    def backward(self, d_logits):
        d = np.asarray(d_logits, dtype=np.float64)
        for l in range(len(self.W) - 1, -1, -1):
            self.dW[l] = np.outer(d, self._a[l])
            self.db[l] = d
            if l > 0:
                d = (self.W[l].T @ d) * (self._z[l - 1] > 0)
        return self

    def update(self, lr, weight_decay=0.0):
        for l in range(len(self.W)):
            self.W[l] -= lr * (self.dW[l] + weight_decay * self.W[l])
            self.b[l] -= lr * self.db[l]
        return self

    def cross_entropy(self, x, target_idx):
        probs = self.forward(x)
        return float(-np.log(probs[target_idx] + 1e-12))

    def train_step(self, x, target_idx, lr=0.01):
        probs = self.forward(x)
        loss = float(-np.log(probs[target_idx] + 1e-12))
        d_logits = probs.copy()
        d_logits[target_idx] -= 1.0
        self.backward(d_logits)
        self.update(lr)
        return loss

    def mutate(self, rate, scale=0.3):
        rng = np.random.default_rng()
        for l in range(len(self.W)):
            m = rng.random(self.W[l].shape) < rate
            self.W[l] = self.W[l] + m * rng.normal(0.0, scale, self.W[l].shape)
            mb = rng.random(self.b[l].shape) < rate
            self.b[l] = self.b[l] + mb * rng.normal(0.0, scale, self.b[l].shape)
        return self

    def crossover(self, other):
        child = MLP(self.arch[0], self.arch[1:-1], self.arch[-1])
        rng = np.random.default_rng()
        for l in range(len(self.W)):
            m = rng.random(self.W[l].shape) < 0.5
            child.W[l] = np.where(m, self.W[l], other.W[l])
            mb = rng.random(self.b[l].shape) < 0.5
            child.b[l] = np.where(mb, self.b[l], other.b[l])
        return child

    def clone(self):
        c = MLP(self.arch[0], self.arch[1:-1], self.arch[-1])
        for l in range(len(self.W)):
            c.W[l] = self.W[l].copy()
            c.b[l] = self.b[l].copy()
        return c

    def to_dict(self):
        return {
            'input_dim': int(self.arch[0]),
            'hidden_dims': [int(h) for h in self.arch[1:-1]],
            'output_dims': int(self.arch[-1]),
            'weights': [w.tolist() for w in self.W],
            'biases': [b.tolist() for b in self.b],
        }

    @staticmethod
    def from_dict(data):
        if isinstance(data, dict) and isinstance(data.get('network'), dict):
            data = data['network']
        if 'input_dim' in data:
            arch = ([int(data['input_dim'])]
                    + [int(h) for h in data.get('hidden_dims', [])]
                    + [int(data['output_dims'])])
        else:
            arch = [int(x) for x in data['arch']]
        net = MLP(arch[0], arch[1:-1], arch[-1])
        net.W = [np.asarray(w, dtype=np.float64) for w in data['weights']]
        net.b = [np.asarray(b, dtype=np.float64) for b in data['biases']]
        return net

    def save(self, path):
        with open(path, 'w') as f:
            json.dump({'version': 1, 'network': self.to_dict()}, f)

    @staticmethod
    def load(path):
        with open(path) as f:
            return MLP.from_dict(json.load(f))
