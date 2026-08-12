import numpy as np

from config import PHASES, MAX_DAYS


class FeatureExtractor:
    def __init__(self, game_config):
        self.cfg = game_config
        self.base_dim = game_config.base_dim
        self.candidate_dim = game_config.candidate_dim
        self.vote_dim = game_config.vote_dim
        self.night_dim = game_config.night_dim
        self.claim_dim = game_config.claim_dim

    def _one_hot(self, idx, size):
        v = np.zeros(size, dtype=np.float64)
        v[idx] = 1.0
        return v

    def _role_one_hot(self, role_id, size):
        idx = self.cfg.role_index.get(role_id)
        if idx is None:
            return np.zeros(size, dtype=np.float64)
        return self._one_hot(idx, size)

    def _claim_one_hot(self, role_id, size):
        if role_id is None:
            return self._one_hot(self.cfg.role_count, size)
        idx = self.cfg.role_index.get(role_id)
        if idx is None:
            return self._one_hot(self.cfg.role_count, size)
        return self._one_hot(idx, size)

    @staticmethod
    def _grave_entry(state, target):
        for e in reversed(state.get('graveyard', [])):
            if e['playerId'] == target:
                return e
        return None

    def _sheriff_slot(self, memories, pid, target):
        r = memories.get(pid, {}).get('sheriff_results', {}).get(target)
        if r is None:
            r = memories.get(pid, {}).get('ownSheriffResults', {}).get(target)
        if r == 'INNOCENT':
            return np.array([0.0, 1.0, 0.0])
        if r == 'SUSPICIOUS':
            return np.array([0.0, 0.0, 1.0])
        return np.array([1.0, 0.0, 0.0])

    def _consigliere_slot(self, memories, pid, target):
        r = memories.get(pid, {}).get('consigliere_results', {}).get(target)
        if r is None:
            return np.zeros(self.cfg.role_count, dtype=np.float64)
        return self._role_one_hot(r, self.cfg.role_count)

    def _claim_slot(self, memories, pid, target):
        claims = memories.get(pid, {}).get('claims', {})
        return self._claim_one_hot(claims.get(target), self.cfg.role_count + 1)

    def _dead_slot(self, state, memories, pid, target):
        size = self.cfg.role_count + 1
        known = memories.get(pid, {}).get('dead_roles_known', {}).get(target)
        if known is not None:
            return self._claim_one_hot(known, size)
        entry = self._grave_entry(state, target)
        if entry is None:
            return np.zeros(size, dtype=np.float64)
        if entry.get('wasCleaned'):
            return self._one_hot(self.cfg.role_count, size)
        return self._claim_one_hot(entry.get('trueRole'), size)

    def _team_vector(self, team):
        v = np.zeros(3, dtype=np.float64)
        if team == 'TOWN':
            v[0] = 1.0
        elif team == 'MAFIA':
            v[1] = 1.0
        else:
            v[2] = 1.0
        return v

    def extract(self, state, memories, pid):
        cfg = self.cfg
        p = cfg.player_count
        feats = []

        phase = state.get('phase', 'NIGHT')
        pv = np.zeros(6)
        if phase in PHASES:
            pv[PHASES.index(phase)] = 1.0
        else:
            pv[5] = 1.0
        feats.append(pv)

        feats.append(np.array([state.get('dayNumber', 0) / MAX_DAYS]))
        feats.append(np.array([state.get('night', {}).get('number', 1) / MAX_DAYS]))

        alive = sum(1 for pl in state['players'] if pl['isAlive'])
        feats.append(np.array([alive / p]))

        tc = cfg.team_counts
        feats.append(np.array([tc.get('town', 0) / p, tc.get('mafia', 0) / p, tc.get('neutral', 0) / p]))

        mem = memories.get(pid, {})
        feats.append(self._role_one_hot(mem.get('role_id'), cfg.role_count))
        feats.append(self._team_vector(mem.get('team', 'NEUTRAL')))
        feats.append(np.array([1.0 if state['players'][pid - 1]['isAlive'] else 0.0]))

        for target in range(1, p + 1):
            feats.append(self._sheriff_slot(memories, pid, target))
            feats.append(self._consigliere_slot(memories, pid, target))
            feats.append(self._claim_slot(memories, pid, target))
            feats.append(self._dead_slot(state, memories, pid, target))

        return np.concatenate(feats)

    def _candidate(self, state, memories, pid, candidate):
        cfg = self.cfg
        feats = []
        cand = state['players'][candidate - 1]
        mem = memories.get(pid, {})
        feats.append(np.array([1.0 if cand['isAlive'] else 0.0]))
        feats.append(np.array([1.0 if candidate == pid else 0.0]))
        teammates = mem.get('mafia_teammates', set())
        feats.append(np.array([1.0 if candidate in teammates else 0.0]))
        feats.append(self._sheriff_slot(memories, pid, candidate))
        feats.append(self._consigliere_slot(memories, pid, candidate))
        feats.append(self._claim_slot(memories, pid, candidate))
        feats.append(self._dead_slot(state, memories, pid, candidate))
        return np.concatenate(feats)

    def vote_feature(self, state, memories, voter_id, candidate_id):
        return np.concatenate([self.extract(state, memories, voter_id),
                               self._candidate(state, memories, voter_id, candidate_id)])

    def night_feature(self, state, memories, actor_id, target_id):
        return np.concatenate([self.extract(state, memories, actor_id),
                               self._candidate(state, memories, actor_id, target_id)])

    def claim_feature(self, state, memories, player_id):
        return self.extract(state, memories, player_id)
