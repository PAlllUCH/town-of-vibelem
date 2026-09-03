import argparse
import json
import random

from config import MAX_DAYS, build_config
from game_env import GameEnv, pick_accused
from agent import Agent


def make_memories(state, cfg):
    mafia_ids = [p['id'] for p in state['players'] if cfg.role_team.get(p['assignedRole']) == 'MAFIA']
    memories = {}
    for p in state['players']:
        role = p['assignedRole']
        team = cfg.role_team.get(role, 'NEUTRAL')
        if role == 'witch':
            team = state.get('witchSide', 'MAFIA')
        memories[p['id']] = {
            'player_id': p['id'],
            'role_id': role,
            'team': team,
            'sheriff_results': {},
            'consigliere_results': {},
            'claims': {},
            'dead_roles_known': {},
            'mafia_teammates': set(m for m in mafia_ids if m != p['id']) if team == 'MAFIA' else set(),
            'inherited_sheriff': p.get('inheritedRole') == 'sheriff',
        }
    return memories


def living_ids(state):
    return [p['id'] for p in state['players'] if p['isAlive']]


def dead_ids(state):
    return [p['id'] for p in state['players'] if not p['isAlive']]


def latest_grave_entry(state, pid):
    for e in reversed(state.get('graveyard', [])):
        if e['playerId'] == pid:
            return e
    return None


def mafia_leader(state):
    for role in ('godfather', 'mafioso'):
        for p in state['players']:
            if p['isAlive'] and p['assignedRole'] == role:
                return p
    return None


def mafia_targets(state, memories, leader):
    blocked = set(memories[leader['id']]['mafia_teammates'])
    blocked.add(leader['id'])
    return [p['id'] for p in state['players'] if p['isAlive'] and p['id'] not in blocked]


def valid_targets(state, memories, actor, pos, role_id):
    ids = living_ids(state)
    if pos == 3:
        last = state['night'].get('lastJailTarget')
        return [x for x in ids if x != actor['id'] and x != last]
    if role_id == 'doctor':
        return ids
    if pos == 7 and role_id == 'janitor':
        return dead_ids(state)
    if pos == 7 and role_id == 'forger':
        team = memories[actor['id']]['mafia_teammates']
        return [x for x in ids if x != actor['id'] and x not in team]
    if role_id == 'undertaker':
        out = []
        for p in state['players']:
            if p['isAlive']:
                continue
            e = latest_grave_entry(state, p['id'])
            if e and not e.get('wasCleaned') and not e.get('inspectedByUndertaker'):
                out.append(p['id'])
        return out
    if role_id in ('retributionist', 'amnesiac'):
        return dead_ids(state)
    if pos == 13 and role_id == 'medium' and actor['isAlive']:
        return []
    if role_id == 'blackmailer':
        last = state['night'].get('lastBlackmailTarget')
        return [x for x in ids if x != actor['id'] and x != last]
    return [x for x in ids if x != actor['id']]


def jailor_decision(state, mem, target_id, cfg):
    if state['night']['number'] <= 1:
        return 'SPARE'
    if mem['sheriff_results'].get(target_id) == 'SUSPICIOUS':
        return 'EXECUTE'
    if mem['consigliere_results'].get(target_id) in cfg.mafia_roles:
        return 'EXECUTE'
    return 'SPARE'


def suspicious_target(state, memories, pid):
    for target, result in memories[pid]['sheriff_results'].items():
        if result == 'SUSPICIOUS' and state['players'][target - 1]['isAlive']:
            return target
    return None


def play_game(env, agents, cfg, rng):
    state = env.create_game(cfg)
    memories = make_memories(state, cfg)
    last_guilty_voters = []
    jester_win_pids = []

    for _ in range(MAX_DAYS):
        state = env.get_state()
        if state['phase'] == 'END':
            break

        env.set_phase('NIGHT')
        steps = env.night_steps()
        recorded = []
        for step in steps:
            pos = step['position']
            roles = step['roles']
            if pos >= 14:
                continue
            if pos == 6:
                leader = mafia_leader(state)
                if leader:
                    targets = mafia_targets(state, memories, leader)
                    t = agents[leader['id']].decide_night_target(state, memories, leader['id'], targets)
                    if t is not None:
                        recorded.append({
                            'position': 6, 'roleId': leader['assignedRole'],
                            'playerId': leader['id'], 'targetId': t,
                        })
                continue
            for role_id in roles:
                if pos == 0 and role_id == 'veteran':
                    for a in [p for p in state['players'] if p['isAlive'] and p['assignedRole'] == 'veteran']:
                        alert = state['night']['number'] == 1 or rng.random() < 0.3
                        if alert:
                            recorded.append({
                                'position': 0, 'roleId': 'veteran',
                                'playerId': a['id'], 'targetId': None, 'extra': {'alert': True},
                            })
                    continue
                if pos == 0 and role_id == 'jester':
                    if state['jester']['haunted'] and state['jester'].get('hauntTarget') is None:
                        jes = next((p for p in state['players'] if p['assignedRole'] == 'jester'), None)
                        if jes:
                            targets = [v for v in last_guilty_voters if state['players'][v - 1]['isAlive']]
                            t = agents[jes['id']].decide_night_target(state, memories, jes['id'], targets)
                            if t is not None:
                                recorded.append({
                                    'position': 0, 'roleId': 'jester',
                                    'playerId': jes['id'], 'targetId': t,
                                })
                    continue
                actors = [
                    p for p in state['players']
                    if p['assignedRole'] == role_id and (p['isAlive'] or (pos == 13 and role_id == 'medium'))
                ]
                for a in actors:
                    if pos == 13 and role_id == 'medium' and a['isAlive']:
                        recorded.append({'position': 13, 'roleId': 'medium', 'playerId': a['id'], 'targetId': None})
                        continue
                    targets = valid_targets(state, memories, a, pos, role_id)
                    if not targets:
                        continue
                    t = agents[a['id']].decide_night_target(state, memories, a['id'], targets)
                    if t is None:
                        continue
                    action = {'position': pos, 'roleId': role_id, 'playerId': a['id'], 'targetId': t}
                    if pos == 3:
                        action['extra'] = {'jailorDecision': jailor_decision(state, memories[a['id']], t, cfg)}
                    recorded.append(action)

        env.run_night(recorded)
        night_res = env.resolve_night(recorded)
        knowledge = night_res.get('knowledge', {})
        for k in knowledge.get('sheriff', []):
            memories[k['actorId']]['sheriff_results'][k['targetId']] = k['result']
        for k in knowledge.get('consigliere', []):
            memories[k['actorId']]['consigliere_results'][k['targetId']] = k['role']
        for k in knowledge.get('undertaker', []):
            memories[k['actorId']]['dead_roles_known'][k['targetId']] = k['role']

        state = env.get_state()
        if state['amnesiac']['used'] and state['amnesiac'].get('rememberedRole'):
            for p in state['players']:
                if p['assignedRole'] == 'amnesiac':
                    memories[p['id']]['team'] = cfg.role_team.get(state['amnesiac']['rememberedRole'], 'NEUTRAL')
        for p in state['players']:
            if p.get('inheritedRole') == 'sheriff':
                memories[p['id']]['inherited_sheriff'] = True
        if state['phase'] == 'END':
            break

        env.begin_day()
        state = env.get_state()
        if state['phase'] == 'END':
            break

        claims = {}
        for pid in living_ids(state):
            if state['players'][pid - 1].get('blackmailed'):
                claims[pid] = None
            else:
                claims[pid] = agents[pid].decide_claim(state, memories, pid)
        for mem in memories.values():
            mem['claims'] = dict(claims)

        mayor = next(
            (p for p in state['players'] if p['isAlive'] and p['assignedRole'] == 'mayor' and not p.get('revealed')),
            None,
        )
        if mayor and state['dayNumber'] >= 2:
            env.mayor_reveal(mayor['id'])
            state = env.get_state()
            if state['phase'] == 'END':
                break

        vig = next(
            (p for p in state['players'] if p['isAlive'] and p['assignedRole'] == 'vigilante' and p['shotsFired'] < 3),
            None,
        )
        vt = suspicious_target(state, memories, vig['id']) if vig else None
        if vig and vt:
            env.vigilante_shoot(vig['id'], vt)
            state = env.get_state()
            if state['phase'] == 'END':
                break

        dep = next(
            (p for p in state['players'] if p['isAlive'] and p['assignedRole'] == 'deputy' and not p.get('usedOncePerGame')),
            None,
        )
        dt = suspicious_target(state, memories, dep['id']) if dep else None
        if dep and dt:
            env.deputy_shoot(dep['id'], dt)
            state = env.get_state()
            if state['phase'] == 'END':
                break

        living = living_ids(state)
        votes = []
        for pid in living:
            candidates = [x for x in living if x != pid]
            pick = agents[pid].decide_vote(state, memories, pid, candidates)
            votes.append({'voter_id': pid, 'verdict': 'GUILTY' if pick is not None else 'ABSTAIN'})

        accused = pick_accused(votes)
        if accused is not None:
            for p in state['players']:
                if not p['isAlive'] and p.get('hasGhostVote') and not p.get('ghostVoteSpent'):
                    v = agents[p['id']].vote_verdict(state, memories, p['id'], accused)
                    if v != 'ABSTAIN':
                        votes.append({'voter_id': p['id'], 'verdict': v, 'ghost_token': True})

        state = env.run_day(votes)
        last_guilty_voters = [v['voter_id'] for v in votes if v['verdict'] == 'GUILTY']

        lynched_role = memories.get(accused, {}).get('role_id') if accused else None
        if accused and not state['players'][accused - 1]['isAlive']:
            if lynched_role == 'jester' or (lynched_role == 'executioner' and state.get('executionerConverted')):
                jester_win_pids.append(accused)
        if state['phase'] == 'END':
            break

    if state['phase'] != 'END':
        env.end_game()
        state = env.get_state()
    return fitness(state, memories, jester_win_pids)


def fitness(state, memories, jester_win_pids):
    winner = (state.get('winner') or {}).get('winner')
    alive = {p['id'] for p in state['players'] if p['isAlive']}
    scores = {}
    for pid, mem in memories.items():
        s = 0.0
        team = mem['team']
        role = mem['role_id']
        if winner == 'TOWN' and team == 'TOWN':
            s += 1.0
        elif winner == 'MAFIA' and team == 'MAFIA':
            s += 1.0
        elif winner == 'SERIAL_KILLER' and role == 'serialkiller':
            s += 1.0
        elif winner in ('DEMON', 'EVIL') and team == 'EVIL':
            s += 1.0
        elif winner == 'EXECUTIONER' and role == 'executioner':
            s += 1.0
        if role in ('survivor', 'drunk') and pid in alive:
            s += 0.5
        if role == 'amnesiac' and team == 'NEUTRAL' and pid in alive:
            s += 0.5
        if pid in jester_win_pids:
            s += 1.0
        if pid in alive:
            s += 0.1
        scores[pid] = s
    return scores


def main():
    ap = argparse.ArgumentParser(description='Town of Vibelm self-play GA trainer')
    ap.add_argument('--population-size', type=int, default=20)
    ap.add_argument('--generations', type=int, default=8)
    ap.add_argument('--games-per-eval', type=int, default=3)
    ap.add_argument('--mutation-rate', type=float, default=0.15)
    ap.add_argument('--player-count', type=int, default=11)
    ap.add_argument('--preset-id', default='p1')
    ap.add_argument('--seed', type=int, default=None)
    ap.add_argument('--node', default='node')
    ap.add_argument('--out', default='best_agent.json')
    args = ap.parse_args()

    rng = random.Random(args.seed)
    cfg = build_config(args.player_count, args.preset_id, node_bin=args.node)
    population = [Agent(cfg) for _ in range(args.population_size)]
    best = None

    for gen in range(args.generations):
        for a in population:
            a.fitness = 0.0
            a.games_played = 0
        env = GameEnv(node_bin=args.node)
        try:
            for _ in range(args.population_size * args.games_per_eval):
                agents = {pid: rng.choice(population) for pid in range(1, cfg.player_count + 1)}
                scores = play_game(env, agents, cfg, rng)
                for pid, s in scores.items():
                    agents[pid].fitness += s
                    agents[pid].games_played += 1
        finally:
            env.close()

        population.sort(key=lambda a: a.avg_fitness(), reverse=True)
        gen_best = population[0]
        avg = sum(a.avg_fitness() for a in population) / len(population)
        print('gen %d best %.3f avg %.3f games %d' % (
            gen, gen_best.avg_fitness(), avg, gen_best.games_played))
        if best is None or gen_best.avg_fitness() > best[1]:
            best = (gen_best.clone(), gen_best.avg_fitness())

        elite = population[:max(2, args.population_size // 2)]
        children = [a.clone() for a in elite]
        while len(children) < args.population_size:
            p1 = rng.choice(elite)
            p2 = rng.choice(elite)
            child = p1.crossover(p2)
            child.mutate(args.mutation_rate)
            children.append(child)
        population = children

    final_agent = best[0] if best else population[0]
    payload = {
        'player_count': cfg.player_count,
        'preset_id': cfg.preset_id,
        'role_list': cfg.role_list,
        'team_counts': cfg.team_counts,
        'fitness': best[1] if best else 0.0,
        'agent': final_agent.to_dict(),
    }
    with open(args.out, 'w') as f:
        json.dump(payload, f, indent=2)
    print('exported best agent to %s' % args.out)


if __name__ == '__main__':
    main()
