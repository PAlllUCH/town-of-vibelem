'use strict';
(function (root) {
  var E = root.VillageEngine;

  E._applyJesterHaunt = function (state, actions, alive, applyAttack) {
    if (state.jester.haunted) {
      var hauntAction = actions.find(function (a) { return a.position === 0 && a.roleId === 'jester'; });
      if (hauntAction && hauntAction.targetId) {
        var votedGuilty = (state.trial.votes || []).some(function (v) {
          return v.voterId === hauntAction.targetId && v.verdict === 'GUILTY';
        });
        if (votedGuilty && alive(hauntAction.targetId)) {
          if (applyAttack(hauntAction.targetId, 'unstoppable', 'haunted by the Jester')) {
            state.jester.hauntTarget = hauntAction.targetId;
            E._logPlayer(state, hauntAction.targetId, E._logAt(state), 'haunted', 'Was haunted by the Jester ghost.');
          }
        }
      }
      state.jester.haunted = false;
    }
  };

  E._spendGhostVote = function (voter, verdict, ghostToken) {
    if (verdict === 'ABSTAIN') return false;
    if (!ghostToken) return false;
    if (!voter.hasGhostVote || voter.ghostVoteSpent) return false;
    voter.ghostVoteSpent = true;
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
