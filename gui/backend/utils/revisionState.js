// Workflow state machine for item revision status.
// States: none → draft → review → final (locked)

const VALID_TRANSITIONS = {
  none: ['draft'],
  draft: ['review', 'none'],    // none = cancel edit
  review: ['final', 'draft'],   // draft = send back
  final: [],                    // locked; admin unlock handled separately
};

function isValidTransition(from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

// Returns the $set fields to apply when transitioning to `toStatus`.
function getStatusUpdates(toStatus) {
  const updates = { 'revision.status': toStatus };
  if (toStatus === 'final') {
    updates['revision.locked'] = true;
    updates['revision.revised'] = true;
  }
  if (toStatus === 'none') {
    updates['revision.locked'] = false;
    // Keep revised=true once set — history is permanent
  }
  return updates;
}

module.exports = { VALID_TRANSITIONS, isValidTransition, getStatusUpdates };
