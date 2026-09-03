'use strict';

const engine = require('../../js/engine.js');
const { NeuralNetwork, createInputEncoder } = require('./neural-net.js');
const FeatureExtractor = require('./feature-extractor.js');

const HIDDEN_DIMS = [32, 16];
const CLAIM_HIDDEN_DIMS = [16, 8];

function probeState(playerCount) {
  return { playerCount: playerCount, players: [], graveyard: [], dayNumber: 0, night: { number: 0 } };
}

function inputDims(playerCount) {
  const probe = probeState(playerCount);
  return {
    base: FeatureExtractor.getFeatureDimension(probe),
    pair: FeatureExtractor.getVoteDimension(probe),
    roles: FeatureExtractor.getRoleList().length
  };
}

function argmax(values) {
  let best = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[best]) best = i;
  }
  return best;
}

class Agent {
  constructor(playerCount, role) {
    this.playerCount = playerCount;
    this.role = role;
    this.encoder = createInputEncoder(playerCount);

    const dims = inputDims(playerCount);
    this.voteNet = new NeuralNetwork([dims.pair].concat(HIDDEN_DIMS, [3]));
    this.nightNet = new NeuralNetwork([dims.pair].concat(HIDDEN_DIMS, [3]));
    this.claimNet = new NeuralNetwork([dims.base].concat(CLAIM_HIDDEN_DIMS, [dims.roles]));

    this.fitness = 0;
    this.gamesPlayed = 0;
  }

  decideVote(state, memories, voterId, candidates) {
    if (!candidates.length) return null;

    let bestScore = -Infinity;
    let bestCandidate = null;

    candidates.forEach(function (candidateId) {
      const input = this.encoder.getVoteInput(state, memories, voterId, candidateId);
      const output = this.voteNet.predict(input);
      const score = output[0] - output[1];

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidateId;
      }
    }.bind(this));

    return bestCandidate;
  }

  getVoteVerdict(state, memories, voterId, accusedId) {
    const input = this.encoder.getVoteInput(state, memories, voterId, accusedId);
    const output = this.voteNet.predict(input);
    return ['GUILTY', 'INNOCENT', 'ABSTAIN'][argmax(output)];
  }

  decideNightTarget(state, memories, actorId, validTargets) {
    if (!validTargets.length) return null;

    let bestScore = -Infinity;
    let bestTarget = null;

    validTargets.forEach(function (targetId) {
      const input = this.encoder.getNightInput(state, memories, actorId, targetId);
      const output = this.nightNet.predict(input);
      const score = output[0] - output[2];

      if (score > bestScore) {
        bestScore = score;
        bestTarget = targetId;
      }
    }.bind(this));

    return bestTarget;
  }

  getNightAction(state, memories, actorId, validTargets) {
    if (!validTargets || !validTargets.length) return 'no_action';
    const target = this.decideNightTarget(state, memories, actorId, validTargets);
    if (target == null) return 'no_action';
    const input = this.encoder.getNightInput(state, memories, actorId, target);
    const output = this.nightNet.predict(input);
    return ['target_aggressive', 'target_defensive', 'no_action'][argmax(output)];
  }

  decideClaim(state, memories, playerId) {
    const input = this.encoder.getClaimInput(state, memories, playerId);
    const output = this.claimNet.predict(input);
    return FeatureExtractor.getRoleList()[argmax(output)] || null;
  }

  getFitness() {
    return this.fitness;
  }

  resetFitness() {
    this.fitness = 0;
    this.gamesPlayed = 0;
  }

  mutate(rate) {
    this.voteNet.mutate(rate);
    this.nightNet.mutate(rate);
    this.claimNet.mutate(rate);
  }

  crossover(other) {
    const child = new Agent(this.playerCount, this.role);
    child.voteNet = this.voteNet.crossover(other.voteNet);
    child.nightNet = this.nightNet.crossover(other.nightNet);
    child.claimNet = this.claimNet.crossover(other.claimNet);
    return child;
  }

  serialize() {
    const dims = inputDims(this.playerCount);
    return {
      version: 1,
      game_config: {
        player_count: this.playerCount,
        feature_dim: dims.base,
        candidate_dim: FeatureExtractor.getCandidateDimension(probeState(this.playerCount)),
        role_ids: FeatureExtractor.getRoleList().slice()
      },
      network_configs: {
        vote_net: this.voteNet.serialize(),
        night_net: this.nightNet.serialize(),
        claim_net: this.claimNet.serialize()
      },
      trained_weights: {
        vote_net: this.voteNet.serialize(),
        night_net: this.nightNet.serialize(),
        claim_net: this.claimNet.serialize()
      }
    };
  }

  static deserialize(data) {
    if (data && data.trained_weights && data.game_config) {
      const agent = new Agent(data.game_config.player_count, 'random');
      agent.voteNet = NeuralNetwork.deserialize(data.trained_weights.vote_net);
      agent.nightNet = NeuralNetwork.deserialize(data.trained_weights.night_net);
      agent.claimNet = NeuralNetwork.deserialize(data.trained_weights.claim_net);
      return agent;
    }
    const agent = new Agent(data.playerCount, data.role);
    agent.voteNet = NeuralNetwork.deserialize(data.voteNet);
    agent.nightNet = NeuralNetwork.deserialize(data.nightNet);
    agent.claimNet = NeuralNetwork.deserialize(data.claimNet);
    agent.fitness = data.fitness;
    agent.gamesPlayed = data.gamesPlayed;
    return agent;
  }
}

class Population {
  constructor(size, playerCount) {
    this.size = size;
    this.playerCount = playerCount;
    this.agents = [];
    this.generation = 0;

    for (let i = 0; i < size; i++) {
      this.agents.push(new Agent(playerCount, 'random'));
    }
  }

  getBest() {
    return this.agents.reduce(function (best, agent) {
      return agent.getFitness() > best.getFitness() ? agent : best;
    });
  }

  getAverage() {
    const total = this.agents.reduce(function (sum, agent) {
      return sum + agent.getFitness();
    }, 0);
    return total / this.agents.length;
  }

  select() {
    const sorted = this.agents.slice().sort(function (a, b) {
      return b.getFitness() - a.getFitness();
    });

    const survivors = sorted.slice(0, Math.floor(this.size / 2));

    const children = [];
    while (children.length < this.size) {
      const parent1 = survivors[Math.floor(Math.random() * survivors.length)];
      const parent2 = survivors[Math.floor(Math.random() * survivors.length)];
      const child = parent1.crossover(parent2);
      child.mutate(0.1);
      children.push(child);
    }

    this.agents = children;
    this.generation++;
  }

  serialize() {
    return {
      size: this.size,
      playerCount: this.playerCount,
      generation: this.generation,
      agents: this.agents.map(function (a) { return a.serialize(); })
    };
  }

  static deserialize(data) {
    const pop = new Population(data.size, data.playerCount);
    pop.generation = data.generation;
    pop.agents = data.agents.map(function (a) { return Agent.deserialize(a); });
    return pop;
  }
}

module.exports = { Agent, Population, inputDims };
