const MIN_PARTICIPANTS = 3;
const MAX_PARTICIPANTS = 21;
const MAX_WORD_LEN = 40;
const MAX_USERNAME_LEN = 20;
const MAX_CONTENT_BYTES = 2 * 1024 * 1024; // 2MB cap for base64 image payloads

function isOddParticipantCount(n) {
  return (
    Number.isInteger(n) &&
    n >= MIN_PARTICIPANTS &&
    n <= MAX_PARTICIPANTS &&
    n % 2 === 1
  );
}

function isValidUsername(name) {
  return (
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.trim().length <= MAX_USERNAME_LEN
  );
}

function isValidWord(word) {
  return (
    typeof word === 'string' &&
    word.trim().length > 0 &&
    word.trim().length <= MAX_WORD_LEN
  );
}

function isValidContentPayload(content, type) {
  if (typeof content !== 'string' || content.length === 0) return false;
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) return false;
  if (type === 'drawing') {
    return content.startsWith('data:image/png;base64,');
  }
  // word type
  return content.length <= MAX_WORD_LEN;
}

// Autosave is more permissive than final submit: an empty word draft (user hasn't
// typed anything yet) is a valid thing to persist, it just means "no answer yet".
function isValidAutosavePayload(content, type) {
  if (typeof content !== 'string') return false;
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) return false;
  if (type === 'drawing') {
    return content.length === 0 || content.startsWith('data:image/png;base64,');
  }
  return content.length <= MAX_WORD_LEN;
}

module.exports = {
  MIN_PARTICIPANTS,
  MAX_PARTICIPANTS,
  isOddParticipantCount,
  isValidUsername,
  isValidWord,
  isValidContentPayload,
  isValidAutosavePayload,
};
