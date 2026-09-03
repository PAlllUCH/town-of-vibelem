'use strict';
(function (root) {
  var engine = root.VillageEngine;
  if (!engine && typeof require === 'function') {
    engine = require('../engine.js');
    root.VillageEngine = engine;
  }
  var NeuralNetwork = root.NeuralNetwork;
  if (!NeuralNetwork && typeof require === 'function') {
    NeuralNetwork = require('./neural-net.js');
  }
  var FeatureExtractor = root.FeatureExtractor;
  if (!FeatureExtractor && typeof require === 'function') {
    FeatureExtractor = require('./feature-extractor.js');
  }
  if (!engine || !NeuralNetwork || !FeatureExtractor) {
    throw new Error('agent-loader: neural-net.js, feature-extractor.js and the engine must be loaded first');
  }

  var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

  function readWeights(weightsFile) {
    var data;
    if (weightsFile && typeof weightsFile === 'object' && !Array.isArray(weightsFile)) {
      data = weightsFile;
    } else if (typeof weightsFile === 'string') {
      var trimmed = weightsFile.replace(/^\s+/, '');
      if (trimmed.charAt(0) === '{') data = JSON.parse(weightsFile);
      else if (isNode && typeof require === 'function') {
        data = JSON.parse(require('fs').readFileSync(weightsFile, 'utf8'));
      } else {
        throw new Error('agent-loader: weights must be a parsed object, a JSON string, or a file path in Node');
      }
    } else {
      throw new Error('agent-loader: weights must be a parsed object, a JSON string, or a file path in Node');
    }
    if (data && data.agent && typeof data.agent === 'object' && data.agent.version !== undefined) {
      data = data.agent;
    }
    return data;
  }

  function requireNetSpec(weights, key) {
    var spec = weights.trained_weights && weights.trained_weights[key];
    if (!spec) throw new Error('agent-loader: missing trained_weights.' + key);
    return spec;
  }

  function validateWeights(weights, state) {
    if (!weights || typeof weights !== 'object') throw new Error('agent-loader: invalid weights payload');
    if (weights.version !== 1) throw new Error('agent-loader: unsupported weights version ' + weights.version);
    var gc = weights.game_config || {};
    if (gc.player_count !== state.playerCount) {
      throw new Error('agent-loader: weights trained for ' + gc.player_count +
        ' players but state has ' + state.playerCount);
    }
    var base = FeatureExtractor.getFeatureDimension(state);
    if (gc.feature_dim !== base) {
      throw new Error('agent-loader: feature_dim mismatch, weights say ' + gc.feature_dim +
        ' but extractor computes ' + base);
    }
    var cand = FeatureExtractor.getCandidateDimension(state);
    if (gc.candidate_dim != null && gc.candidate_dim !== cand) {
      throw new Error('agent-loader: candidate_dim mismatch, weights say ' + gc.candidate_dim +
        ' but extractor computes ' + cand);
    }
    var roles = FeatureExtractor.getRoleList();
    var trainedRoles = gc.role_ids || [];
    if (trainedRoles.length !== roles.length) {
      throw new Error('agent-loader: role_ids length mismatch with engine.ROLES');
    }
    for (var i = 0; i < roles.length; i += 1) {
      if (trainedRoles[i] !== roles[i]) {
        throw new Error('agent-loader: role_ids order mismatch with engine.ROLES at index ' + i);
      }
    }
    var voteSpec = requireNetSpec(weights, 'vote_net');
    var nightSpec = requireNetSpec(weights, 'night_net');
    var claimSpec = requireNetSpec(weights, 'claim_net');
    var pairIn = base + cand;
    if (voteSpec.input_dim !== pairIn) {
      throw new Error('agent-loader: vote_net input_dim mismatch, expected ' + pairIn +
        ' got ' + voteSpec.input_dim);
    }
    if (nightSpec.input_dim !== pairIn) {
      throw new Error('agent-loader: night_net input_dim mismatch, expected ' + pairIn +
        ' got ' + nightSpec.input_dim);
    }
    if (claimSpec.input_dim !== base) {
      throw new Error('agent-loader: claim_net input_dim mismatch, expected ' + base +
        ' got ' + claimSpec.input_dim);
    }
    if (voteSpec.output_dims !== 3) {
      throw new Error('agent-loader: vote_net must have 3 outputs (GUILTY, INNOCENT, ABSTAIN)');
    }
    if (nightSpec.output_dims !== 3) {
      throw new Error('agent-loader: night_net must have 3 outputs (target_aggressive, target_defensive, no_action)');
    }
    if (claimSpec.output_dims !== roles.length) {
      throw new Error('agent-loader: claim_net must have ' + roles.length + ' outputs (one per role)');
    }
  }

  function makeNet(weights, key) {
    var spec = requireNetSpec(weights, key);
    return new NeuralNetwork(spec);
  }

  function Agent(weights, state, playerId) {
    this.playerId = playerId;
    this.playerCount = state.playerCount;
    this.voteNet = makeNet(weights, 'vote_net');
    this.nightNet = makeNet(weights, 'night_net');
    this.claimNet = makeNet(weights, 'claim_net');
    this.featureDim = weights.game_config.feature_dim;
  }

  Agent.prototype._candidateInput = function (state, memories, basePlayerId, candidateId) {
    return FeatureExtractor.extract(state, memories, basePlayerId).concat(
      FeatureExtractor.candidate(state, memories, basePlayerId, candidateId));
  };

  Agent.prototype.get_vote = function (state, memories, voterId, candidates) {
    if (!candidates || !candidates.length) return null;
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < candidates.length; i += 1) {
      var input = this._candidateInput(state, memories, voterId, candidates[i]);
      var probs = this.voteNet.predict(input);
      var score = probs[0] - probs[1];
      if (score > bestScore) {
        bestScore = score;
        best = candidates[i];
      }
    }
    return best;
  };

  Agent.prototype.get_night_target = function (state, memories, actorId, validTargets) {
    if (!validTargets || !validTargets.length) return null;
    var best = null;
    var bestScore = -Infinity;
    for (var i = 0; i < validTargets.length; i += 1) {
      var input = this._candidateInput(state, memories, actorId, validTargets[i]);
      var probs = this.nightNet.predict(input);
      var score = probs[0] - probs[2];
      if (score > bestScore) {
        bestScore = score;
        best = validTargets[i];
      }
    }
    return best;
  };

  Agent.prototype.get_claim = function (state, memories, playerId) {
    var input = FeatureExtractor.extract(state, memories, playerId);
    var probs = this.claimNet.predict(input);
    var roles = FeatureExtractor.getRoleList();
    var bestIdx = 0;
    for (var i = 1; i < probs.length; i += 1) {
      if (probs[i] > probs[bestIdx]) bestIdx = i;
    }
    return roles[bestIdx] || null;
  };

  function create_agents(state, weightsFile) {
    var weights = readWeights(weightsFile);
    validateWeights(weights, state);
    var agents = {};
    (state.players || []).forEach(function (p) {
      agents[p.id] = new Agent(weights, state, p.id);
    });
    return agents;
  }

  function get_vote(state, memories, voterId, candidates, agents) {
    if (!agents || !agents[voterId]) throw new Error('agent-loader: no agent for voter ' + voterId);
    return agents[voterId].get_vote(state, memories, voterId, candidates);
  }

  function get_night_target(state, memories, actorId, validTargets, agents) {
    if (!agents || !agents[actorId]) throw new Error('agent-loader: no agent for actor ' + actorId);
    return agents[actorId].get_night_target(state, memories, actorId, validTargets);
  }

  function get_claim(state, memories, playerId, agents) {
    if (!agents || !agents[playerId]) throw new Error('agent-loader: no agent for player ' + playerId);
    return agents[playerId].get_claim(state, memories, playerId);
  }

  root.AgentLoader = {
    create_agents: create_agents,
    get_vote: get_vote,
    get_night_target: get_night_target,
    get_claim: get_claim,
    validate_weights: validateWeights,
    Agent: Agent
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.AgentLoader;
  }
})(typeof window !== 'undefined' ? window : globalThis);
