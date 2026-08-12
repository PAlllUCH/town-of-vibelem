'use strict';

const engine = require('../../js/engine.js');
const { NeuralNetwork, createInputEncoder } = require('./neural-net.js');

class Agent {
  constructor(playerCount, role) {
    this.playerCount = playerCount;
    this.role = role;
    this.encoder = createInputEncoder(playerCount);
    
    this.voteNet = new NeuralNetwork([this.encoder.getVoteInput({players: [], graveyard: [], dayNumber: 0, night: {number: 0}}, {}, 1, 2).length, 32, 16, 3]);
    this.nightNet = new NeuralNetwork([this.encoder.getNightInput({players: [], graveyard: [], dayNumber: 0, night: {number: 0}}, {}, 1, 2).length, 32, 16, 5]);
    this.claimNet = new NeuralNetwork([this.encoder.getClaimInput({players: [], graveyard: [], dayNumber: 0, night: {number: 0}}, {}, 1).length, 16, 8, 5]);
    
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
      const score = output[0] - output[2];
      
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
    
    const maxIdx = output.indexOf(Math.max(...output));
    return ['GUILTY', 'ABSTAIN', 'INNOCENT'][maxIdx];
  }
  
  decideNightTarget(state, memories, actorId, validTargets) {
    if (!validTargets.length) return null;
    
    let bestScore = -Infinity;
    let bestTarget = null;
    
    validTargets.forEach(function (targetId) {
      const input = this.encoder.getNightInput(state, memories, actorId, targetId);
      const output = this.nightNet.predict(input);
      const score = output[0] + output[1] + output[2] + output[3] + output[4];
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = targetId;
      }
    }.bind(this));
    
    return bestTarget;
  }
  
  getNightAction(state, memories, actorId) {
    const mem = memories[actorId];
    const input = this.encoder.encodeGame(state, memories, actorId);
    const output = this.nightNet.predict(input);
    
    const maxIdx = output.indexOf(Math.max(...output));
    return ['target_self', 'target_known_safe', 'target_suspicious', 'target_random', 'no_action'][maxIdx];
  }
  
  decideClaim(state, memories, playerId) {
    const input = this.encoder.getClaimInput(state, memories, playerId);
    const output = this.claimNet.predict(input);
    
    const mem = memories[playerId];
    const maxIdx = output.indexOf(Math.max(...output));
    const claims = ['sheriff', 'doctor', 'veteran', 'civilian', 'unknown'];
    
    if (mem.team === 'TOWN') {
      return mem.roleId;
    } else if (mem.team === 'MAFIA') {
      const townClaims = ['sheriff', 'doctor', 'veteran', 'civilian'];
      return townClaims[Math.floor(Math.random() * townClaims.length)];
    }
    
    return 'civilian';
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
    return {
      playerCount: this.playerCount,
      role: this.role,
      voteNet: this.voteNet.serialize(),
      nightNet: this.nightNet.serialize(),
      claimNet: this.claimNet.serialize(),
      fitness: this.fitness,
      gamesPlayed: this.gamesPlayed
    };
  }
  
  static deserialize(data) {
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

module.exports = { Agent, Population };
