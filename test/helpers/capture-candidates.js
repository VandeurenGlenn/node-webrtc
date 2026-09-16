'use strict';

function captureCandidates(pc) {
  var candidates = [];
  return new Promise(function(resolve) {
    pc.onicecandidate = function(evt) {
      if (evt.candidate) {

        console.log(evt);
        candidates.push(evt.candidate);
      } else {
        resolve(candidates);
      }
    };
  });
}

module.exports = captureCandidates;
