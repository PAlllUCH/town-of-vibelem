import json

import numpy as np

from feature_extractor import FeatureExtractor
from network import MLP

VERDICTS = ['GUILTY', 'INNOCENT', 'ABSTAIN']


class Agent:
    def __init__(self, game_config, hidden_vote=(64, 32), hidden_night=(48, 24),
                 hidden_claim=(48, 24), seed=None):
        self.game_config = game_config
        self.extractor = FeatureExtractor(game_config)
        self.vote_net = MLP(self.extractor.vote_dim, hidden_vote, 3, seed)
        self.night_net = MLP(self.extractor.night_dim, hidden_night, 3, seed)
        self.claim_net = MLP(self.extractor.claim_dim, hidden_claim,
                             game_config.role_count, seed)
        self.fitness = 0.0
        self.games_played = 0

    def decide_vote(self, state, memories, voter_id, candidates):
        if not candidates:
            return None
        best = None
        best_score = float('-inf')
        for c in candidates:
            f = self.extractor.vote_feature(state, memories, voter_id, c)
            p = self.vote_net.predict(f)
            score = p[0] - p[1]
            if score > best_score:
                best_score = score
                best = c
        return best if best_score > 0 else None

    def vote_verdict(self, state, memories, voter_id, accused_id):
        f = self.extractor.vote_feature(state, memories, voter_id, accused_id)
        p = self.vote_net.predict(f)
        return VERDICTS[int(np.argmax(p))]

    def decide_night_target(self, state, memories, actor_id, valid_targets):
        if not valid_targets:
            return None
        best = None
        best_score = float('-inf')
        for t in valid_targets:
            f = self.extractor.night_feature(state, memories, actor_id, t)
            p = self.night_net.predict(f)
            score = p[0] - p[2]
            if score > best_score:
                best_score = score
                best = t
        return best

    def decide_claim(self, state, memories, player_id):
        f = self.extractor.claim_feature(state, memories, player_id)
        p = self.claim_net.predict(f)
        idx = int(np.argmax(p))
        return self.game_config.role_list[idx]

    def mutate(self, rate):
        self.vote_net.mutate(rate)
        self.night_net.mutate(rate)
        self.claim_net.mutate(rate)
        return self

    def crossover(self, other):
        child = Agent(self.game_config)
        child.vote_net = self.vote_net.crossover(other.vote_net)
        child.night_net = self.night_net.crossover(other.night_net)
        child.claim_net = self.claim_net.crossover(other.claim_net)
        return child

    def clone(self):
        c = Agent(self.game_config)
        c.vote_net = self.vote_net.clone()
        c.night_net = self.night_net.clone()
        c.claim_net = self.claim_net.clone()
        return c

    def avg_fitness(self):
        return self.fitness / self.games_played if self.games_played else 0.0

    def to_dict(self):
        cfg = self.game_config
        nets = {
            'vote_net': self.vote_net.to_dict(),
            'night_net': self.night_net.to_dict(),
            'claim_net': self.claim_net.to_dict(),
        }
        return {
            'version': 1,
            'game_config': {
                'player_count': cfg.player_count,
                'preset_id': cfg.preset_id,
                'feature_dim': cfg.base_dim,
                'candidate_dim': cfg.candidate_dim,
                'role_ids': cfg.role_list,
            },
            'network_configs': dict(nets),
            'trained_weights': dict(nets),
        }

    @staticmethod
    def from_dict(data, game_config):
        if 'trained_weights' in data:
            data = data['trained_weights']
        agent = Agent(game_config)
        agent.vote_net = MLP.from_dict(data['vote_net'])
        agent.night_net = MLP.from_dict(data['night_net'])
        agent.claim_net = MLP.from_dict(data['claim_net'])
        return agent

    def save(self, path):
        with open(path, 'w') as f:
            json.dump(self.to_dict(), f)

    @staticmethod
    def load(path, game_config):
        with open(path) as f:
            return Agent.from_dict(json.load(f), game_config)
