import json
import subprocess
from pathlib import Path

_CACHE = None

PHASES = ['SETUP', 'SEATS', 'NIGHT', 'MORNING', 'DAY', 'END']
MAX_DAYS = 25


def _project_root():
    return Path(__file__).resolve().parent.parent


def _dump_engine(node_bin, project_root):
    script = (
        "const e = require('./js/engine.js');\n"
        "console.log(JSON.stringify({roles: e.ROLES, ratioTable: e.RATIO_TABLE, "
        "presets: e.PRESETS, nightSteps: e.NIGHT_STEPS}));"
    )
    proc = subprocess.run(
        [node_bin, '-e', script],
        cwd=str(project_root), capture_output=True, text=True, timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError('node engine dump failed: ' + (proc.stderr or proc.stdout))
    return json.loads(proc.stdout)


def load_engine_constants(node_bin='node', project_root=None):
    global _CACHE
    if _CACHE is None:
        root = Path(project_root) if project_root else _project_root()
        _CACHE = _dump_engine(node_bin, root)
    return _CACHE


class GameConfig:
    def __init__(self, player_count, preset_id, roles, ratio_table, presets, night_steps):
        self.player_count = int(player_count)
        self.preset_id = preset_id
        self.role_list = list(roles.keys())
        self.role_index = {rid: i for i, rid in enumerate(self.role_list)}
        self.role_team = {rid: roles[rid]['team'] for rid in self.role_list}
        self.role_name = {rid: roles[rid]['name'] for rid in self.role_list}
        self.team_counts = dict(ratio_table[self.player_count])
        self.preset = presets[preset_id]
        self.night_steps = night_steps
        self.mafia_roles = [rid for rid in self.role_list if self.role_team[rid] == 'MAFIA']
        self.town_roles = [rid for rid in self.role_list if self.role_team[rid] == 'TOWN']
        self.neutral_roles = [rid for rid in self.role_list if self.role_team[rid] == 'NEUTRAL']

    @property
    def role_count(self):
        return len(self.role_list)

    @property
    def base_dim(self):
        return 16 + self.role_count + self.player_count * (3 * self.role_count + 5)

    @property
    def candidate_dim(self):
        return 3 * self.role_count + 8

    @property
    def vote_dim(self):
        return self.base_dim + self.candidate_dim

    @property
    def night_dim(self):
        return self.base_dim + self.candidate_dim

    @property
    def claim_dim(self):
        return self.base_dim

    def to_dict(self):
        return {
            'player_count': self.player_count,
            'preset_id': self.preset_id,
            'role_list': self.role_list,
            'team_counts': self.team_counts,
        }


def build_config(player_count, preset_id, node_bin='node', project_root=None):
    data = load_engine_constants(node_bin, project_root)
    ratio_table = {int(k): v for k, v in data['ratioTable'].items()}
    if player_count not in ratio_table:
        raise ValueError('player_count must be in %s, got %s' % (sorted(ratio_table), player_count))
    if preset_id not in data['presets']:
        raise ValueError('preset_id must be in %s, got %s' % (sorted(data['presets']), preset_id))
    return GameConfig(
        player_count, preset_id,
        data['roles'], ratio_table, data['presets'], data['nightSteps'],
    )
