import json
import subprocess
from pathlib import Path

_BRIDGE_JS = r'''
const engine = require('./js/engine.js');
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

let state = null;

function respond(result) {
  process.stdout.write(JSON.stringify({ ok: true, result: result }) + '\n');
}
function respondError(err) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }) + '\n');
}

function morningKnowledge(recorded) {
  recorded = recorded || [];
  const voided = [];
  recorded.forEach(function (a) {
    if (a.position === 0 && a.roleId === 'veteran' && a.extra && a.extra.alert) {
      recorded.forEach(function (x) {
        if (x.targetId === a.playerId && x.position !== 0) voided.push(x.playerId);
      });
    }
  });
  const witchAction = recorded.find(function (a) { return a.position === 2 && a.roleId === 'witch'; });
  const witchControl = witchAction && witchAction.extra && witchAction.extra.controlRedirect
    ? { controlledId: witchAction.targetId, redirect: witchAction.extra.controlRedirect } : null;
  const effTargets = [];
  recorded.forEach(function (a) {
    if (a.position === 13 || a.position === 14) return;
    const actor = state.players[a.playerId - 1];
    if (!actor || !actor.isAlive || actor.isRoleblocked || actor.jailed) return;
    if (voided.indexOf(a.playerId) !== -1) return;
    const target = a.targetId != null ? state.players[a.targetId - 1] : null;
    if (!target || !target.isAlive) return;
    let effTid = a.targetId;
    if (witchControl && a.playerId === witchControl.controlledId) effTid = witchControl.redirect;
    else if (a.extra && a.extra.controlRedirect) effTid = a.extra.controlRedirect;
    effTargets.push({ playerId: a.playerId, targetId: effTid });
  });
  const out = { sheriff: [], consigliere: [], undertaker: [] };
  recorded.forEach(function (a) {
    if (a.position !== 11) return;
    const actor = state.players[a.playerId - 1];
    if (!actor) return;
    if (a.roleId === 'undertaker') {
      const entry = state.graveyard.find(function (e) { return e.playerId === a.targetId; });
      if (entry && entry.inspectedByUndertaker && !entry.wasCleaned) {
        out.undertaker.push({ actorId: a.playerId, targetId: a.targetId, role: entry.trueRole });
      }
      return;
    }
    const eff = effTargets.find(function (e) { return e.playerId === a.playerId; });
    if (!eff) return;
    const t = state.players[eff.targetId - 1];
    if (!t) return;
    if (a.roleId === 'sheriff' || (a.roleId === 'deputy' && actor.inheritedRole === 'sheriff')) {
      let r = t.framed ? 'SUSPICIOUS' : (engine._sheriffSuspicious(state, t) ? 'SUSPICIOUS' : 'INNOCENT');
      if (actor.isDrunk) r = r === 'SUSPICIOUS' ? 'INNOCENT' : 'SUSPICIOUS';
      out.sheriff.push({ actorId: a.playerId, targetId: eff.targetId, result: r });
    } else if (a.roleId === 'consigliere') {
      let learned = t.assignedRole;
      if (actor.isDrunk) {
        const aligned = engine._alignmentOf(state, t);
        const pool = Object.keys(engine.ROLES).filter(function (id) { return engine.ROLES[id].team !== aligned; });
        learned = pool[Math.floor(Math.random() * pool.length)];
      }
      out.consigliere.push({ actorId: a.playerId, targetId: eff.targetId, role: learned });
    }
  });
  return out;
}

rl.on('line', function (line) {
  let req;
  try {
    req = JSON.parse(line);
  } catch (e) {
    respondError('bad request: ' + e.message);
    return;
  }
  try {
    const cmd = req.cmd;
    const args = req.args || [];
    switch (cmd) {
      case 'createGame': {
        const opts = args[0] || {};
        state = engine.createGame(opts);
        if (opts.names) engine.setPlayerNames(state, opts.names);
        engine.dealRoles(state);
        state.phase = 'NIGHT';
        respond({ state: state });
        return;
      }
      case 'getNightSteps': respond(engine.getNightSteps(state)); return;
      case 'recordActions': {
        const list = args[0] || [];
        const accepted = [];
        list.forEach(function (a) { accepted.push(engine.recordNightAction(state, a)); });
        respond(accepted);
        return;
      }
      case 'resolveNight': {
        const result = engine.resolveNight(state);
        const knowledge = morningKnowledge(args[0] || []);
        respond({ result: result, knowledge: knowledge });
        return;
      }
      case 'getMorningAnnouncement': respond(engine.getMorningAnnouncement(state)); return;
      case 'beginDay': respond(engine.beginDay(state)); return;
      case 'startTrial': respond(engine.startTrial(state, args[0], args[1])); return;
      case 'castVotes': {
        const list = args[0] || [];
        const accepted = [];
        list.forEach(function (v) { accepted.push(engine.castVote(state, v)); });
        respond(accepted);
        return;
      }
      case 'resolveTrial': respond(engine.resolveTrial(state)); return;
      case 'vigilanteShoot': respond(engine.vigilanteShoot(state, args[0], args[1])); return;
      case 'deputyShoot': respond(engine.deputyShoot(state, args[0], args[1])); return;
      case 'mayorReveal': respond(engine.mayorReveal(state, args[0])); return;
      case 'checkVictory': respond(engine.checkVictory(state)); return;
      case 'endGame': respond(engine.endGame(state)); return;
      case 'setPhase': state.phase = args[0]; respond(true); return;
      case 'getState': respond(state); return;
      case 'serialize': respond(engine.serialize(state)); return;
      case 'deserialize': state = engine.deserialize(args[0]); respond(true); return;
      case 'quit': process.exit(0); return;
      default: respondError('unknown command: ' + cmd);
    }
  } catch (e) {
    respondError(e);
  }
});
'''


def pick_accused(votes):
    tally = {}
    for v in votes:
        if v.get('verdict') == 'GUILTY' and not v.get('ghost_token'):
            tally[v['voter_id']] = tally.get(v['voter_id'], 0) + 1
    if not tally:
        return None
    return max(tally, key=lambda k: (tally[k], -k))


class GameEnv:
    def __init__(self, node_bin='node', project_root=None):
        root = str(Path(project_root) if project_root else Path(__file__).resolve().parent.parent)
        self._proc = subprocess.Popen(
            [node_bin, '-e', _BRIDGE_JS],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            cwd=root, text=True, bufsize=1,
        )

    def _call(self, cmd, *args):
        if self._proc.poll() is not None:
            raise RuntimeError('engine process exited with code %s' % self._proc.returncode)
        self._proc.stdin.write(json.dumps({'cmd': cmd, 'args': list(args)}) + '\n')
        self._proc.stdin.flush()
        line = self._proc.stdout.readline()
        if not line:
            raise RuntimeError('engine process closed the pipe unexpectedly')
        msg = json.loads(line)
        if not msg.get('ok'):
            raise RuntimeError(msg.get('error', 'engine error'))
        return msg.get('result')

    def create_game(self, config, names=None):
        opts = {'playerCount': config.player_count, 'presetId': config.preset_id}
        if names:
            opts['names'] = [{'seat': i + 1, 'name': names[i]} for i in range(len(names))]
        return self._call('createGame', opts)['state']

    def night_steps(self):
        return self._call('getNightSteps')

    def run_night(self, actions):
        return self._call('recordActions', list(actions))

    def resolve_night(self, recorded=None):
        return self._call('resolveNight', list(recorded or []))

    def get_morning(self):
        return self._call('getMorningAnnouncement')

    def begin_day(self):
        return self._call('beginDay')

    def run_day(self, votes):
        votes = list(votes)
        accused = pick_accused(votes)
        if accused is None:
            return self._call('getState')
        nominator = None
        for v in votes:
            if v.get('verdict') == 'GUILTY' and not v.get('ghost_token') and v['voter_id'] != accused:
                nominator = v['voter_id']
                break
        if nominator is None:
            return self._call('getState')
        if not self._call('startTrial', accused, nominator):
            return self._call('getState')
        self._call('castVotes', votes)
        self._call('resolveTrial')
        return self._call('getState')

    def set_phase(self, phase):
        return self._call('setPhase', phase)

    def get_state(self):
        return self._call('getState')

    def check_victory(self):
        return self._call('checkVictory')

    def end_game(self):
        return self._call('endGame')

    def mayor_reveal(self, player_id):
        return self._call('mayorReveal', player_id)

    def vigilante_shoot(self, shooter_id, target_id):
        return self._call('vigilanteShoot', shooter_id, target_id)

    def deputy_shoot(self, deputy_id, target_id):
        return self._call('deputyShoot', deputy_id, target_id)

    def serialize(self):
        return self._call('serialize')

    def deserialize(self, payload):
        return self._call('deserialize', payload)

    def close(self):
        try:
            self._proc.stdin.close()
            self._proc.wait(timeout=5)
        except Exception:
            self._proc.kill()
