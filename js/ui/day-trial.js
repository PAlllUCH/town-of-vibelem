'use strict';

(function () {
  var UI = window.UI;

  function tallyChips(state) {
    var votes = (state.trial && state.trial.votes) || [];
    var g = 0, i = 0, a = 0;
    votes.forEach(function (v) {
      var voter = UI.findPlayer(state, v.voterId);
      var weight = 1;
      if (voter && voter.isAlive && voter.revealed && voter.assignedRole === 'mayor') weight = 3;
      if (v.verdict === 'GUILTY') g += weight;
      else if (v.verdict === 'INNOCENT') i += weight;
      else a += weight;
    });
    return '<div class="tally">' +
      '<span class="tally-chip g">GUILTY ' + g + '</span>' +
      '<span class="tally-chip i">INNOCENT ' + i + '</span>' +
      '<span class="tally-chip a">ABSTAIN ' + a + '</span></div>';
  }

  function ghostTokens(state) {
    var holders = UI.dead(state.players).filter(function (p) {
      return p.hasGhostVote && !p.ghostVoteSpent;
    });
    if (!holders.length) return '';
    return '<p class="muted small">Ghost tokens: ' +
      holders.map(function (p) { return UI.esc(p.name); }).join(', ') +
      '. Ghost votes spend the token; a revealed Mayor counts as 3.</p>';
  }

  function secondsTally(state) {
    var tr = state.trial || {};
    var needed = Math.floor(UI.living(state.players).length / 2) + 1;
    var agree = 0;
    (tr.seconds || []).forEach(function (s) {
      if (String(s.voterId) === String(tr.accusedId)) return;
      if (s.agree) agree += 1;
    });
    return { agree: agree, needed: needed };
  }

  function trialView(state, cfg, app) {
    var tr = state.trial;
    var body = '';
    if (app.lastTrialResult) {
      var r = app.lastTrialResult;
      var msg;
      if (r.result === 'CANCELLED') {
        msg = '<strong>Not enough support</strong> &mdash; nomination fell.';
      } else if (r.result === 'SPARED') {
        msg = '<strong>Spared:</strong> the accused was saved by the spare vote.';
      } else if (r.result === 'SENTENCED') {
        msg = '<strong>Guilty majority</strong> &mdash; proceed to the spare vote.';
      } else if (r.result === 'SURVIVES') {
        if (r.reason === 'no-lynch-day-1') {
          msg = '<strong>No lynch on Day 1</strong> (house rule).';
        } else if (r.reason === 'accused-dead') {
          msg = '<strong>No lynch:</strong> the accused is dead.';
        } else if (r.reason === 'not-guilty') {
          msg = '<strong>Not guilty</strong> &mdash; more Innocent votes, the accused survives.';
        } else {
          msg = '<strong>Tie vote</strong> &mdash; the accused survives.';
        }
      } else if (r.lynchedId) {
        msg = '<strong>Lynched:</strong> ' + UI.esc(UI.nameOf(state, r.lynchedId));
      } else {
        msg = '<strong>Acquitted:</strong> no one was lynched';
      }
      body += '<div class="notice' + (r.result === 'LYNCHED' ? ' notice-critical' : ' ok') + '">' + msg +
        (r.jesterWin ? '<br><strong>The Jester wins!</strong>' : '') +
        (r.executionerWin ? '<br><strong>The Executioner wins!</strong>' : '') +
        (r.victory ? '<br>' + UI.esc(r.victory.winner || 'Victory!') : '') +
        '</div>';
      body += '<button class="btn btn-block" data-action="clear-trial">OK</button>';
      return UI.card('Trial', body, 'trial', app);
    }
    if (!tr || !tr.active) {
      if (app.trialStage === 'nominator') {
        body += '<p class="wizard-label">Who nominates?</p>' + UI.livingBtns(state, 'pick-nom');
      } else if (app.trialStage === 'accused') {
        body += '<p class="wizard-label">Who is accused?</p>' + UI.livingBtns(state, 'pick-acc', app.trialNom);
      } else {
        body += '<button class="btn btn-block" data-action="start-trial">Start Trial</button>';
        body += '<p class="muted small">At most one lynch per day. A nomination needs a majority of living players to second it.</p>';
      }
    } else if (tr.stage === 'SECONDS') {
      body += '<p><strong>Accused:</strong> ' + UI.esc(UI.nameOf(state, tr.accusedId)) +
        ' &nbsp;<strong>Nominated by:</strong> ' + UI.esc(UI.nameOf(state, tr.nominatorId)) + '</p>';
      var tally = secondsTally(state);
      var pct = tally.needed > 0 ? Math.round((tally.agree / tally.needed) * 100) : 0;
      body += '<div class="tally tally-progress" style="--p:' + pct + '">' +
        '<span class="tally-chip g">SECONDS ' + tally.agree + ' of ' +
        tally.needed + '</span></div>';
      body += '<p class="muted small">Every living player, including the nominator, must second. The nomination needs ' + tally.needed +
        ' agreeing votes to proceed.</p>';
      UI.living(state.players).forEach(function (p) {
        if (String(p.id) === String(tr.accusedId)) return;
        var rec = null;
        (tr.seconds || []).forEach(function (s) {
          if (String(s.voterId) === String(p.id)) rec = s;
        });
        var agree = !!(rec && rec.agree);
        var disagree = !!rec && !rec.agree;
        body += '<div class="voter-row">' +
          '<span class="voter-name">' + UI.esc(p.name) + '</span><span class="vote-btns">' +
          '<button class="btn btn-vote' + (agree ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
          UI.esc(p.id) + '" data-verdict="AGREE" data-ghost="0">Agree</button>' +
          '<button class="btn btn-vote' + (disagree ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
          UI.esc(p.id) + '" data-verdict="DISAGREE" data-ghost="0">Disagree</button>' +
          '</span></div>';
      });
      body += '<button class="btn btn-primary btn-block" data-action="resolve-trial">Resolve Nomination</button>';
    } else if (tr.stage === 'SENTENCE') {
      body += '<p><strong>Accused:</strong> ' + UI.esc(UI.nameOf(state, tr.accusedId)) +
        ' &nbsp;<strong>Nominated by:</strong> ' + UI.esc(UI.nameOf(state, tr.nominatorId)) + '</p>';
      body += tallyChips(state);
      body += '<div class="notice accent">The accused may give a last speech before the spare vote. ' +
        'Innocent votes spare them; a strict majority of living players is required (the accused does not vote).</div>';
      UI.living(state.players).forEach(function (p) {
        if (String(p.id) === String(tr.accusedId)) return;
        var cur = null;
        (tr.sentenceVotes || []).forEach(function (sv) {
          if (String(sv.voterId) === String(p.id)) cur = sv.verdict;
        });
        body += '<div class="voter-row">' +
          '<span class="voter-name">' + UI.esc(p.name) + '</span><span class="vote-btns">' +
          '<button class="btn btn-vote' + (cur === 'GUILTY' ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
          UI.esc(p.id) + '" data-verdict="GUILTY" data-ghost="0">Guilty</button>' +
          '<button class="btn btn-vote' + (cur === 'INNOCENT' ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
          UI.esc(p.id) + '" data-verdict="INNOCENT" data-ghost="0">Innocent</button>' +
          '<button class="btn btn-vote' + (cur === 'ABSTAIN' ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
          UI.esc(p.id) + '" data-verdict="ABSTAIN" data-ghost="0">Abstain</button>' +
          '</span></div>';
      });
      body += '<button class="btn btn-primary btn-block" data-action="resolve-sentence">Resolve Sentence</button>';
    } else {
      body += '<div class="notice ok">Nomination accepted &mdash; voting begins.</div>';
      body += '<p><strong>Accused:</strong> ' + UI.esc(UI.nameOf(state, tr.accusedId)) +
        ' &nbsp;<strong>Nominated by:</strong> ' + UI.esc(UI.nameOf(state, tr.nominatorId)) + '</p>';
      var t2 = secondsTally(state);
      body += '<p class="muted small">Nomination seconded (' + t2.agree + ' of ' + t2.needed +
        ') - the trial proceeds to a vote.</p>';
      body += tallyChips(state);
      body += ghostTokens(state);
      var voters = [];
      UI.living(state.players).forEach(function (p) {
        voters.push({ p: p, ghost: false });
      });
      UI.dead(state.players).forEach(function (p) {
        if (p.hasGhostVote && !p.ghostVoteSpent) voters.push({ p: p, ghost: true });
      });
      var votesBy = {};
      (tr.votes || []).forEach(function (v) {
        votesBy[String(v.voterId) + (v.ghostToken ? 'g' : 'l')] = v.verdict;
      });
      voters.forEach(function (v) {
        if (String(v.p.id) === String(tr.accusedId)) return;
        var key = String(v.p.id) + (v.ghost ? 'g' : 'l');
        var cur = votesBy[key];
        body += '<div class="voter-row' + (v.ghost ? ' ghost-voter' : '') + '">' +
          '<span class="voter-name">' + UI.esc(v.p.name) + (v.ghost ? ' <span class="muted small">(ghost &middot; G/I only)</span>' : '') + '</span>' +
          '<span class="vote-btns">' +
          '<button class="btn btn-vote' + (cur === 'GUILTY' ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
          UI.esc(v.p.id) + '" data-verdict="GUILTY" data-ghost="' + (v.ghost ? '1' : '0') + '">Guilty</button>' +
          '<button class="btn btn-vote' + (cur === 'INNOCENT' ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
          UI.esc(v.p.id) + '" data-verdict="INNOCENT" data-ghost="' + (v.ghost ? '1' : '0') + '">Innocent</button>' +
          (v.ghost ? '' :
            '<button class="btn btn-vote' + (cur === 'ABSTAIN' ? ' on' : '') + '" data-action="cast-vote" data-voter="' +
            UI.esc(v.p.id) + '" data-verdict="ABSTAIN" data-ghost="0">Abstain</button>') +
          '</span></div>';
      });
    }
    return UI.card('Trial', body, 'trial', app);
  }

  UI.trialView = trialView;
})();
