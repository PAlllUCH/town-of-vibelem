'use strict';
(function (root) {
  var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

  function sizesOf(config) {
    return [config.input_dim].concat(config.hidden_dims || [], [config.output_dims]);
  }

  function validate(net, sizes) {
    if (!Number.isInteger(net.input_dim) || net.input_dim < 1) {
      throw new Error('NeuralNetwork: input_dim must be a positive integer');
    }
    if (!Number.isInteger(net.output_dims) || net.output_dims < 1) {
      throw new Error('NeuralNetwork: output_dims must be a positive integer');
    }
    if (!Array.isArray(net.weights) || !Array.isArray(net.biases)) {
      throw new Error('NeuralNetwork: config.weights and config.biases are required');
    }
    if (net.weights.length !== sizes.length - 1 || net.biases.length !== sizes.length - 1) {
      throw new Error('NeuralNetwork: weights/biases layer count must equal hidden_dims.length + 1');
    }
    for (var l = 0; l < net.weights.length; l += 1) {
      if (net.weights[l].length !== sizes[l + 1]) {
        throw new Error('NeuralNetwork: layer ' + l + ' weight rows must equal ' + sizes[l + 1]);
      }
      for (var j = 0; j < net.weights[l].length; j += 1) {
        if (net.weights[l][j].length !== sizes[l]) {
          throw new Error('NeuralNetwork: layer ' + l + ' weight columns must equal ' + sizes[l]);
        }
      }
      if (net.biases[l].length !== sizes[l + 1]) {
        throw new Error('NeuralNetwork: layer ' + l + ' bias length must equal ' + sizes[l + 1]);
      }
    }
  }

  function gaussian() {
    var u = 0;
    var v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function randomConfig(arch) {
    if (!Array.isArray(arch) || arch.length < 2) {
      throw new Error('NeuralNetwork: array config must be [input_dim, ...hidden_dims, output_dim]');
    }
    var weights = [];
    var biases = [];
    for (var l = 0; l < arch.length - 1; l += 1) {
      var fanIn = arch[l];
      var fanOut = arch[l + 1];
      var scale = Math.sqrt(6 / (fanIn + fanOut));
      var w = [];
      var b = [];
      for (var j = 0; j < fanOut; j += 1) {
        var row = [];
        for (var k = 0; k < fanIn; k += 1) row.push((Math.random() * 2 - 1) * scale);
        w.push(row);
        b.push(0);
      }
      weights.push(w);
      biases.push(b);
    }
    return {
      input_dim: arch[0],
      hidden_dims: arch.slice(1, -1),
      output_dims: arch[arch.length - 1],
      weights: weights,
      biases: biases
    };
  }

  function NeuralNetwork(config) {
    if (Array.isArray(config)) config = randomConfig(config);
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('NeuralNetwork: a config object is required');
    }
    this.input_dim = config.input_dim;
    this.hidden_dims = (config.hidden_dims || []).slice();
    this.output_dims = config.output_dims;
    this.weights = config.weights;
    this.biases = config.biases;
    validate(this, sizesOf(this));
  }

  NeuralNetwork.randomConfig = randomConfig;

  NeuralNetwork.prototype.forward = function (input) {
    if (!Array.isArray(input) || input.length !== this.input_dim) {
      throw new Error('NeuralNetwork.forward: expected ' + this.input_dim + ' inputs, got ' +
        (input ? input.length : 'none'));
    }
    var current = input.slice();
    var last = this.weights.length - 1;
    for (var l = 0; l < this.weights.length; l += 1) {
      var w = this.weights[l];
      var b = this.biases[l];
      var out = new Array(w.length);
      for (var j = 0; j < w.length; j += 1) {
        var row = w[j];
        var sum = b[j];
        for (var k = 0; k < row.length; k += 1) sum += row[k] * current[k];
        out[j] = l < last ? (sum > 0 ? sum : 0) : sum;
      }
      current = out;
    }
    return current;
  };

  NeuralNetwork.prototype.softmax = function (logits) {
    var max = logits[0];
    for (var i = 1; i < logits.length; i += 1) {
      if (logits[i] > max) max = logits[i];
    }
    var exps = new Array(logits.length);
    var sum = 0;
    for (var j = 0; j < logits.length; j += 1) {
      exps[j] = Math.exp(logits[j] - max);
      sum += exps[j];
    }
    for (var k = 0; k < exps.length; k += 1) exps[k] /= sum;
    return exps;
  };

  NeuralNetwork.prototype.predict = function (input) {
    return this.softmax(this.forward(input));
  };

  NeuralNetwork.prototype.serialize = function () {
    return {
      input_dim: this.input_dim,
      hidden_dims: this.hidden_dims.slice(),
      output_dims: this.output_dims,
      weights: this.weights,
      biases: this.biases
    };
  };

  NeuralNetwork.prototype.clone = function () {
    var data = this.serialize();
    data.weights = this.weights.map(function (m) {
      return m.map(function (row) { return row.slice(); });
    });
    data.biases = this.biases.map(function (v) { return v.slice(); });
    return new NeuralNetwork(data);
  };

  NeuralNetwork.prototype.mutate = function (rate) {
    for (var l = 0; l < this.weights.length; l += 1) {
      var w = this.weights[l];
      for (var j = 0; j < w.length; j += 1) {
        for (var k = 0; k < w[j].length; k += 1) {
          if (Math.random() < rate) w[j][k] += gaussian() * 0.3;
        }
      }
      for (var jb = 0; jb < this.biases[l].length; jb += 1) {
        if (Math.random() < rate) this.biases[l][jb] += gaussian() * 0.3;
      }
    }
    return this;
  };

  NeuralNetwork.prototype.crossover = function (other) {
    var child = this.clone();
    for (var l = 0; l < child.weights.length; l += 1) {
      for (var j = 0; j < child.weights[l].length; j += 1) {
        for (var k = 0; k < child.weights[l][j].length; k += 1) {
          child.weights[l][j][k] = Math.random() < 0.5 ? this.weights[l][j][k] : other.weights[l][j][k];
        }
      }
      for (var jb = 0; jb < child.biases[l].length; jb += 1) {
        child.biases[l][jb] = Math.random() < 0.5 ? this.biases[l][jb] : other.biases[l][jb];
      }
    }
    return child;
  };

  NeuralNetwork.prototype.save = function (filepath) {
    var json = JSON.stringify(this.serialize());
    if (filepath && isNode && typeof require === 'function') {
      require('fs').writeFileSync(filepath, json, 'utf8');
    }
    return json;
  };

  NeuralNetwork.load = function (source) {
    var data = source;
    if (typeof source === 'string') {
      var trimmed = source.replace(/^\s+/, '');
      if (trimmed.charAt(0) === '{') {
        data = JSON.parse(source);
      } else if (isNode && typeof require === 'function') {
        data = JSON.parse(require('fs').readFileSync(source, 'utf8'));
      } else {
        throw new Error('NeuralNetwork.load: cannot read a file path in the browser; pass a JSON string or a parsed config object');
      }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('NeuralNetwork.load: invalid network config');
    }
    return new NeuralNetwork(data);
  };

  NeuralNetwork.deserialize = function (data) {
    if (typeof data === 'string') {
      var trimmed = data.replace(/^\s+/, '');
      if (trimmed.charAt(0) === '{') {
        data = JSON.parse(data);
      } else if (isNode && typeof require === 'function') {
        data = JSON.parse(require('fs').readFileSync(data, 'utf8'));
      } else {
        throw new Error('NeuralNetwork.deserialize: cannot read a file path in the browser; pass a JSON string or a parsed config object');
      }
    }
    return new NeuralNetwork(data);
  };

  function createInputEncoder(playerCount) {
    var FE = root.FeatureExtractor;
    if (!FE && isNode && typeof require === 'function') FE = require('./feature-extractor.js');
    if (!FE) throw new Error('createInputEncoder: feature-extractor.js must be loaded first');
    return {
      encodeGame: function (state, memories, actorId) {
        return FE.extract(state, memories, actorId);
      },
      getClaimInput: function (state, memories, playerId) {
        return FE.extract(state, memories, playerId);
      },
      getVoteInput: function (state, memories, voterId, candidateId) {
        return FE.extract(state, memories, voterId).concat(
          FE.candidate(state, memories, voterId, candidateId));
      },
      getNightInput: function (state, memories, actorId, targetId) {
        return FE.extract(state, memories, actorId).concat(
          FE.candidate(state, memories, actorId, targetId));
      }
    };
  }

  root.NeuralNetwork = NeuralNetwork;
  root.createInputEncoder = createInputEncoder;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NeuralNetwork;
    module.exports.NeuralNetwork = NeuralNetwork;
    module.exports.createInputEncoder = createInputEncoder;
  }
})(typeof window !== 'undefined' ? window : globalThis);
