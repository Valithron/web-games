/*
 * GREENHOLD: The Quiet Ledger runtime
 *
 * Story contract:
 * export const GREENHOLD_STORY = {
 *   start: "intro",
 *   nodes: {
 *     id: {
 *       title: "Scene title",
 *       text: ["Paragraph one", "Paragraph two"],
 *       choices: [{ text, next, effects?, requires? }],
 *       terminal?: true
 *     }
 *   }
 * };
 *
 * Supported effects:
 * effects.flags: string[]                 Set flags.
 * effects.rel: { character: integer }    Add to hidden relationship values.
 * effects.vars: { key: number }           Add numeric variables.
 * effects.set: { key: value }             Set arbitrary hidden values.
 * effects.journal: string[]               Add discovered facts to the journal.
 *
 * Supported requirements:
 * requires.flags, notFlags, vars, sex, romanceAvailable.
 */

const $ = selector => document.querySelector(selector);

const homeScreen = $('#homeScreen');
const creationScreen = $('#creationScreen');
const storyScreen = $('#storyScreen');
const journalDrawer = $('#journalDrawer');
const playerForm = $('#playerForm');
const playerNameInput = $('#playerName');
const formStatus = $('#formStatus');
const homeStatus = $('#homeStatus');
const storyStatus = $('#storyStatus');
const sceneKicker = $('#sceneKicker');
const sceneTitle = $('#sceneTitle');
const sceneBody = $('#sceneBody');
const choiceList = $('#choiceList');
const chapterStatus = $('#chapterStatus');
const sceneStatus = $('#sceneStatus');
const journalButton = $('#journalButton');
const journalList = $('#journalList');
const journalEmpty = $('#journalEmpty');

const SAVE_KEY = 'escapee:greenhold-quiet-ledger:save:v1';
const STORY_VERSION = 1;
// Keep the story request cache-busted when the story asset changes. This also
// avoids reusing a malformed CDN-compressed response from an earlier deploy.
const STORY_MODULE_URL = './story.js?release=3';
const HISTORY_LIMIT = 80;
const ROMANCE_BY_SEX = Object.freeze({
  male: ['Cydney', 'Gabi', 'Ashley', 'Kenly'],
  female: ['Sterling', 'Ryan', 'Cooper']
});

let story = null;
let storyError = '';
let storyUsesJournal = false;
let state = null;
let paused = false;
let muted = false;
let lastFocusedElement = null;

function freshState(name = '', sex = 'male') {
  return {
    player: { name, sex },
    nodeId: null,
    flags: [],
    rel: {},
    vars: {},
    values: {},
    journal: [],
    history: [],
    sceneNumber: 0,
    screen: 'home'
  };
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    try { return JSON.parse(JSON.stringify(value)); }
    catch { return value; }
  }
}

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 32);
}

function normalizeSex(value) {
  return String(value).toLowerCase() === 'female' ? 'female' : 'male';
}

function hasFlag(flag) {
  const value = String(flag);
  if (value === 'genderMale') return state?.player?.sex === 'male';
  if (value === 'genderFemale') return state?.player?.sex === 'female';
  return Array.isArray(state?.flags) && state.flags.includes(value);
}

function setFlag(flag) {
  const value = String(flag || '').trim();
  if (value && !state.flags.includes(value)) state.flags.push(value);
}

function getValue(key) {
  if (Object.prototype.hasOwnProperty.call(state.values, key)) return state.values[key];
  if (Object.prototype.hasOwnProperty.call(state.vars, key)) return state.vars[key];
  return 0;
}

function replaceProse(value) {
  const pronouns = state?.player?.sex === 'female'
    ? { 'he/she': 'she', 'him/her': 'her', 'his/her': 'her' }
    : { 'he/she': 'he', 'him/her': 'him', 'his/her': 'his' };
  return String(value ?? '')
    .replaceAll('{{name}}', state?.player?.name || 'the newcomer')
    .replaceAll('{{he/she}}', pronouns['he/she'])
    .replaceAll('{{him/her}}', pronouns['him/her'])
    .replaceAll('{{his/her}}', pronouns['his/her']);
}

function playerRomanceAvailable(character) {
  const available = ROMANCE_BY_SEX[state?.player?.sex] || [];
  if (character === true) return available.length > 0;
  if (Array.isArray(character)) return character.some(item => available.includes(String(item)));
  return available.includes(String(character));
}

function compareRequirement(current, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if ('eq' in expected && current !== expected.eq) return false;
    if ('min' in expected && Number(current) < Number(expected.min)) return false;
    if ('max' in expected && Number(current) > Number(expected.max)) return false;
    if ('gt' in expected && Number(current) <= Number(expected.gt)) return false;
    if ('gte' in expected && Number(current) < Number(expected.gte)) return false;
    if ('lt' in expected && Number(current) >= Number(expected.lt)) return false;
    if ('lte' in expected && Number(current) > Number(expected.lte)) return false;
    return true;
  }
  if (typeof expected === 'number') return Number(current) >= expected;
  return current === expected;
}

function meetsRequirements(requires = {}) {
  if (!requires || typeof requires !== 'object') return true;
  if (Array.isArray(requires.flags) && !requires.flags.every(hasFlag)) return false;
  if (Array.isArray(requires.notFlags) && requires.notFlags.some(hasFlag)) return false;
  if (requires.sex !== undefined) {
    const sexes = Array.isArray(requires.sex) ? requires.sex : [requires.sex];
    if (!sexes.map(normalizeSex).includes(state.player.sex)) return false;
  }
  if (requires.romanceAvailable !== undefined && !playerRomanceAvailable(requires.romanceAvailable)) return false;
  if (requires.vars && typeof requires.vars === 'object') {
    for (const [key, expected] of Object.entries(requires.vars)) {
      if (!compareRequirement(getValue(key), expected)) return false;
    }
  }
  return true;
}

function applyEffects(effects = {}) {
  if (!effects || typeof effects !== 'object') return;
  if (Array.isArray(effects.flags)) effects.flags.forEach(setFlag);
  if (effects.rel && typeof effects.rel === 'object') {
    for (const [character, amount] of Object.entries(effects.rel)) {
      state.rel[character] = Number(state.rel[character] || 0) + (Number(amount) || 0);
    }
  }
  if (effects.vars && typeof effects.vars === 'object') {
    for (const [key, amount] of Object.entries(effects.vars)) {
      state.vars[key] = Number(state.vars[key] || 0) + (Number(amount) || 0);
    }
  }
  if (effects.set && typeof effects.set === 'object') {
    for (const [key, value] of Object.entries(effects.set)) state.values[key] = clone(value);
  }
  if (effects.journal !== undefined) {
    const facts = Array.isArray(effects.journal) ? effects.journal : [effects.journal];
    for (const fact of facts) {
      const text = replaceProse(typeof fact === 'string' ? fact : fact?.text);
      if (text && !state.journal.includes(text)) state.journal.push(text);
    }
  }
}

function snapshot() {
  return clone({
    player: state.player,
    nodeId: state.nodeId,
    flags: state.flags,
    rel: state.rel,
    vars: state.vars,
    values: state.values,
    journal: state.journal,
    sceneNumber: state.sceneNumber,
    screen: state.screen
  });
}

function restoreSnapshot(snapshotValue) {
  if (!snapshotValue || typeof snapshotValue !== 'object') return false;
  state = {
    ...freshState(),
    ...clone(snapshotValue),
    player: {
      name: normalizeName(snapshotValue.player?.name),
      sex: normalizeSex(snapshotValue.player?.sex)
    },
    flags: Array.isArray(snapshotValue.flags) ? snapshotValue.flags.map(String) : [],
    rel: snapshotValue.rel && typeof snapshotValue.rel === 'object' ? snapshotValue.rel : {},
    vars: snapshotValue.vars && typeof snapshotValue.vars === 'object' ? snapshotValue.vars : {},
    values: snapshotValue.values && typeof snapshotValue.values === 'object' ? snapshotValue.values : {},
    journal: Array.isArray(snapshotValue.journal) ? snapshotValue.journal.map(String) : [],
    history: [],
    nodeId: typeof snapshotValue.nodeId === 'string' ? snapshotValue.nodeId : null,
    sceneNumber: Number.isFinite(Number(snapshotValue.sceneNumber)) ? Number(snapshotValue.sceneNumber) : 0,
    screen: snapshotValue.screen === 'ending' ? 'ending' : 'story'
  };
  return Boolean(state.nodeId && story?.nodes?.[state.nodeId]);
}

function validSave(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  if (candidate.version !== STORY_VERSION || candidate.story !== 'greenhold-quiet-ledger') return false;
  if (!candidate.state || !candidate.state.player || typeof candidate.state.nodeId !== 'string') return false;
  if (!story?.nodes?.[candidate.state.nodeId]) return false;
  return true;
}

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!validSave(parsed)) {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveGame(showMessage = true) {
  if (!state?.nodeId || !story) return false;
  const payload = {
    version: STORY_VERSION,
    story: 'greenhold-quiet-ledger',
    savedAt: new Date().toISOString(),
    state: snapshot(),
    history: clone(state.history).slice(-HISTORY_LIMIT)
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    if (showMessage) setStoryStatus('Story saved to this device.');
    updateHomeSaveButton();
    return true;
  } catch {
    if (showMessage) setStoryStatus('This device would not allow a local save. The story can still continue.');
    return false;
  }
}

function loadGame(showMessage = true) {
  const saved = readSave();
  if (!saved || !restoreSnapshot(saved.state)) {
    if (showMessage) setStoryStatus('No usable saved story was found on this device.');
    updateHomeSaveButton();
    return false;
  }
  state.history = Array.isArray(saved.history) ? saved.history.filter(item => item && typeof item.nodeId === 'string').slice(-HISTORY_LIMIT) : [];
  state.screen = story.nodes[state.nodeId]?.terminal ? 'ending' : 'story';
  showStory();
  renderCurrentNode();
  if (showMessage) setStoryStatus('Saved story loaded.');
  return true;
}

function updateHomeSaveButton() {
  const button = $('#loadHomeButton');
  if (!button) return;
  const available = Boolean(story && readSave());
  button.hidden = !available;
}

function setScreen(screen) {
  homeScreen.hidden = screen !== 'home';
  creationScreen.hidden = screen !== 'creation';
  storyScreen.hidden = screen !== 'story' && screen !== 'ending';
  state.screen = screen;
}

function setStoryStatus(message) {
  storyStatus.textContent = message || '';
}

function beginCreation() {
  if (!story) {
    homeStatus.textContent = storyError || 'The story module is still loading.';
    return;
  }
  formStatus.textContent = '';
  playerNameInput.value = state?.player?.name || '';
  setScreen('creation');
  requestAnimationFrame(() => playerNameInput.focus());
}

function beginStory(name, sex) {
  state = freshState(normalizeName(name), normalizeSex(sex));
  state.nodeId = story.start;
  state.sceneNumber = 1;
  state.screen = 'story';
  setScreen('story');
  renderCurrentNode();
  setStoryStatus('');
}

function renderText(text) {
  const paragraph = document.createElement('p');
  paragraph.textContent = replaceProse(text);
  return paragraph;
}

function renderCurrentNode() {
  if (!story || !state?.nodeId) return;
  const node = story.nodes[state.nodeId];
  if (!node) {
    storyError = 'This story scene is missing or malformed.';
    showErrorInStory(storyError);
    return;
  }
  const isEnding = Boolean(node.terminal);
  state.screen = isEnding ? 'ending' : 'story';
  setScreen(state.screen);
  sceneKicker.textContent = replaceProse(node.kicker || (isEnding ? 'The ledger is closed' : 'A Greenhold story'));
  sceneTitle.textContent = replaceProse(node.title || (isEnding ? 'The end' : 'Greenhold'));
  sceneBody.replaceChildren(...(Array.isArray(node.text) ? node.text : [node.text]).filter(text => text !== undefined && text !== null).map(renderText));
  const chapter = node.chapter || node.act || 'The Road East';
  chapterStatus.textContent = replaceProse(chapter);
  sceneStatus.textContent = isEnding ? 'Ending' : `Scene ${Math.max(1, state.sceneNumber)}`;
  renderChoices(node, isEnding);
  renderJournal();
  updateTools(isEnding);
  storyScreen.querySelector('.story-layout').scrollTop = 0;
}

function renderChoices(node, isEnding) {
  choiceList.replaceChildren();
  const choices = Array.isArray(node.choices) ? node.choices : [];
  if (isEnding) {
    appendActionButton('Replay this story', () => replayStory());
    appendActionButton('Return to title', () => returnHome());
    return;
  }
  choices.forEach((choice, index) => {
    if (!choice || typeof choice !== 'object') return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.dataset.choiceIndex = String(index);
    const label = document.createElement('span');
    label.textContent = replaceProse(choice.text || 'Continue');
    button.appendChild(label);
    const available = meetsRequirements(choice.requires);
    button.disabled = !available;
    if (!available) {
      const note = document.createElement('small');
      note.className = 'unavailable-note';
      note.textContent = 'Not available yet';
      label.appendChild(note);
      button.setAttribute('aria-disabled', 'true');
    }
    if (available) button.addEventListener('click', () => choose(choice));
    choiceList.appendChild(button);
  });
  if (!choices.length) appendActionButton('Continue', () => replayStory());
}

function appendActionButton(label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'choice-button';
  const text = document.createElement('span');
  text.textContent = label;
  button.appendChild(text);
  button.addEventListener('click', action);
  choiceList.appendChild(button);
}

function choose(choice) {
  if (paused || !story || !state || !meetsRequirements(choice.requires)) return;
  if (!story.nodes[choice.next]) {
    setStoryStatus('That path is not available because its next scene is missing.');
    return;
  }
  state.history.push(snapshot());
  state.history = state.history.slice(-HISTORY_LIMIT);
  applyEffects(choice.effects);
  state.nodeId = choice.next;
  state.sceneNumber += 1;
  setStoryStatus('');
  renderCurrentNode();
}

function rewindScene() {
  if (!state?.history?.length) {
    setStoryStatus('There is no earlier scene to return to.');
    return;
  }
  const previous = state.history.pop();
  const history = state.history.slice();
  if (!restoreSnapshot(previous)) {
    setStoryStatus('The earlier scene could not be restored.');
    return;
  }
  state.history = history;
  renderCurrentNode();
  setStoryStatus('You returned to the previous scene.');
}

function updateTools(isEnding = false) {
  $('#rewindButton').disabled = !state?.history?.length;
  $('#saveButton').disabled = isEnding;
  $('#loadButton').disabled = !readSave();
  $('#restartButton').disabled = false;
}

function renderJournal() {
  journalButton.hidden = !storyUsesJournal;
  journalButton.disabled = !state?.journal?.length;
  journalList.replaceChildren();
  journalEmpty.hidden = Boolean(state?.journal?.length);
  for (const fact of state?.journal || []) {
    const item = document.createElement('li');
    item.textContent = replaceProse(fact);
    journalList.appendChild(item);
  }
}

function openJournal() {
  if (!storyUsesJournal || !state?.journal?.length) return;
  lastFocusedElement = document.activeElement;
  journalDrawer.hidden = false;
  $('#closeJournalButton').focus();
}

function closeJournal() {
  journalDrawer.hidden = true;
  lastFocusedElement?.focus?.();
  lastFocusedElement = null;
}

function restartStory() {
  if (!story) return;
  state = freshState();
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  updateHomeSaveButton();
  setScreen('creation');
  formStatus.textContent = '';
  playerNameInput.value = '';
  requestAnimationFrame(() => playerNameInput.focus());
}

function replayStory() {
  if (!state?.player?.name || !story) return beginCreation();
  beginStory(state.player.name, state.player.sex);
}

function returnHome() {
  closeJournal();
  state = freshState();
  setScreen('home');
  updateHomeSaveButton();
  $('#beginButton').focus();
}

function showStory() {
  setScreen(state.screen === 'ending' ? 'ending' : 'story');
}

function showErrorInStory(message) {
  setScreen('story');
  sceneKicker.textContent = 'Story unavailable';
  sceneTitle.textContent = 'The ledger is quiet';
  sceneBody.replaceChildren(renderText(message));
  choiceList.replaceChildren();
  appendActionButton('Return to title', returnHome);
  $('#rewindButton').disabled = true;
  $('#saveButton').disabled = true;
  $('#loadButton').disabled = true;
  journalButton.hidden = true;
}

function scanJournalUsage() {
  storyUsesJournal = Object.values(story?.nodes || {}).some(node =>
    (Array.isArray(node?.choices) ? node.choices : []).some(choice => choice?.effects && choice.effects.journal !== undefined)
  );
}

async function loadStoryModule() {
  try {
    const module = await import(STORY_MODULE_URL);
    story = module.GREENHOLD_STORY;
    if (!story || typeof story.start !== 'string' || !story.nodes || typeof story.nodes !== 'object' || !story.nodes[story.start]) {
      throw new Error('GREENHOLD_STORY does not match the story contract.');
    }
    scanJournalUsage();
    updateHomeSaveButton();
  } catch (error) {
    storyError = 'The story module could not be loaded. Please make sure ./story.js is present.';
    homeStatus.textContent = storyError;
    $('#beginButton').disabled = true;
    $('#loadHomeButton').hidden = true;
    console.warn('[Greenhold] Story module unavailable:', error);
  }
}

playerForm.addEventListener('submit', event => {
  event.preventDefault();
  const name = normalizeName(playerNameInput.value);
  if (!name) {
    formStatus.textContent = 'Please enter a name before entering Greenhold.';
    playerNameInput.focus();
    return;
  }
  const sex = playerForm.elements.sex.value;
  beginStory(name, sex);
});

$('#beginButton').addEventListener('click', beginCreation);
$('#loadHomeButton').addEventListener('click', () => loadGame());
$('#creationBackButton').addEventListener('click', returnHome);
$('#rewindButton').addEventListener('click', rewindScene);
$('#saveButton').addEventListener('click', () => saveGame());
$('#loadButton').addEventListener('click', () => loadGame());
$('#journalButton').addEventListener('click', openJournal);
$('#closeJournalButton').addEventListener('click', closeJournal);
$('#restartButton').addEventListener('click', () => {
  if (window.confirm('Restart this story? Your current path will be replaced.')) restartStory();
});

journalDrawer.addEventListener('click', event => {
  if (event.target === journalDrawer) closeJournal();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !journalDrawer.hidden) {
    event.preventDefault();
    closeJournal();
  }
});

window.addEventListener('pagehide', () => { paused = true; });

window.EscapeeGame = {
  pause() { paused = true; },
  resume() { paused = false; },
  restart() { restartStory(); },
  setMuted(value) { muted = Boolean(value); },
  getMuted() { return muted; },
  getStatus() {
    if (paused) return 'paused';
    if (state?.screen === 'story') return 'playing';
    if (state?.screen === 'ending') return 'between-rounds';
    return 'menu';
  }
};

state = freshState();
setScreen('home');
loadStoryModule();
