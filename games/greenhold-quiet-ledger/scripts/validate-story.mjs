import { GREENHOLD_STORY } from '../story.js';

const allowedEndings = new Set(['good', 'fine', 'unresolved', 'death']);
const nodes = GREENHOLD_STORY?.nodes || {};
const start = GREENHOLD_STORY?.start;
const errors = [];

const visibleStoryText = Object.values(nodes).flatMap(node => [
  ...(node?.text || []),
  ...(node?.choices || []).map(choice => choice?.text || ''),
]);
const forbiddenPhrases = [
  /\ba gender\b/i,
  /temporary category of useful stranger/i,
  /sound pair of boots/i,
];
for (const phrase of forbiddenPhrases) {
  if (visibleStoryText.some(text => phrase.test(text))) errors.push(`Artificial player-setup phrasing remains in story text: ${phrase}`);
}

if (!start || !nodes[start]) errors.push(`Missing valid start node: ${start}`);
if (Object.keys(nodes).length < 35) errors.push(`Story graph is too small: ${Object.keys(nodes).length} nodes`);

for (const [id, node] of Object.entries(nodes)) {
  if (!node || typeof node !== 'object') {
    errors.push(`${id}: node must be an object`);
    continue;
  }
  if (!Array.isArray(node.text) || node.text.length === 0) errors.push(`${id}: missing text paragraphs`);
  if (node.terminal !== undefined) {
    if (!allowedEndings.has(node.terminal)) errors.push(`${id}: invalid terminal class ${node.terminal}`);
    if (Array.isArray(node.choices) && node.choices.length) errors.push(`${id}: terminal node has choices`);
    continue;
  }
  if (!Array.isArray(node.choices) || node.choices.length === 0) errors.push(`${id}: nonterminal node has no choices`);
  for (const [index, choice] of (node.choices || []).entries()) {
    if (!choice?.text) errors.push(`${id}[${index}]: choice has no text`);
    if (!choice?.next || !nodes[choice.next]) errors.push(`${id}[${index}]: missing target ${choice?.next}`);
  }
}

const reachable = new Set();
const queue = start && nodes[start] ? [start] : [];
while (queue.length) {
  const id = queue.shift();
  if (reachable.has(id)) continue;
  reachable.add(id);
  for (const choice of nodes[id]?.choices || []) if (nodes[choice.next]) queue.push(choice.next);
}

for (const id of Object.keys(nodes)) if (!reachable.has(id)) errors.push(`Unreachable node: ${id}`);
for (const ending of allowedEndings) {
  if (!Object.values(nodes).some(node => node.terminal === ending)) errors.push(`Missing ending class: ${ending}`);
}

const romanceTargets = {
  commitCydney: 'genderMale', commitGabi: 'genderMale', commitAshley: 'genderMale', commitKenly: 'genderMale',
  commitSterling: 'genderFemale', commitRyan: 'genderFemale', commitCooper: 'genderFemale'
};
const romanceTargetSet = new Set(Object.keys(romanceTargets));
for (const [id, node] of Object.entries(nodes)) {
  for (const [index, choice] of (node.choices || []).entries()) {
    const genderGates = (choice.requires?.flags || []).filter(flag => flag === 'genderMale' || flag === 'genderFemale');
    const hasSexGate = choice.requires?.sex !== undefined;
    if ((genderGates.length || hasSexGate) && !romanceTargetSet.has(choice.next)) {
      errors.push(`${id}[${index}]: gender/sex gate is only allowed on a romance commitment choice (targets ${choice.next})`);
    }
    if (genderGates.length > 1) errors.push(`${id}[${index}]: choice has multiple gender gates`);
  }
}
for (const [target, genderFlag] of Object.entries(romanceTargets)) {
  if (!nodes[target]) errors.push(`Missing romance scene: ${target}`);
  const incoming = Object.values(nodes).flatMap(node => node.choices || []).filter(choice => choice.next === target);
  if (!incoming.some(choice => choice.requires?.flags?.includes(genderFlag))) errors.push(`${target}: missing gender gate ${genderFlag}`);
  if (incoming.some(choice => !(choice.requires?.flags || []).includes(genderFlag))) errors.push(`${target}: romance choice has incorrect or missing gender gate`);
}

function requirementPasses(requires = {}, state) {
  if (requires.sex !== undefined) {
    const sexes = Array.isArray(requires.sex) ? requires.sex : [requires.sex];
    if (!sexes.includes(state.sex)) return false;
  }
  if ((requires.flags || []).some(flag => flag === 'genderMale' ? state.sex !== 'male' : flag === 'genderFemale' ? state.sex !== 'female' : !state.flags.has(flag))) return false;
  if ((requires.notFlags || []).some(flag => state.flags.has(flag))) return false;
  for (const [key, expected] of Object.entries(requires.vars || {})) {
    const current = Number(state.vars[key] || 0);
    if (typeof expected === 'number' && current < expected) return false;
    if (expected && typeof expected === 'object') {
      if ('min' in expected && current < Number(expected.min)) return false;
      if ('max' in expected && current > Number(expected.max)) return false;
    }
  }
  return true;
}

function applyStoryEffects(state, effects = {}) {
  const next = { sex: state.sex, nodeId: state.nodeId, flags: new Set(state.flags), vars: { ...state.vars } };
  for (const flag of effects.flags || []) next.flags.add(flag);
  for (const [key, amount] of Object.entries(effects.vars || {})) next.vars[key] = Number(next.vars[key] || 0) + Number(amount || 0);
  next.nodeId = effects.nextNode || next.nodeId;
  return next;
}

function canReachTerminal(sex, ending, romanceRequired) {
  const seen = new Set();
  let steps = 0;
  function visit(current) {
    if (++steps > 100000) return false;
    const signature = `${current.nodeId}|${current.sex}|${[...current.flags].sort()}|${JSON.stringify(current.vars)}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    const node = nodes[current.nodeId];
    if (!node) return false;
    if (node.terminal) return node.terminal === ending && current.flags.has('romanceCommit') === romanceRequired;
    return (node.choices || []).some(choice => {
      if (!requirementPasses(choice.requires, current)) return false;
      const next = applyStoryEffects(current, choice.effects);
      next.nodeId = choice.next;
      return visit(next);
    });
  }
  return visit({ sex, nodeId: start, flags: new Set(), vars: {} });
}

for (const sex of ['male', 'female']) {
  for (const [ending, romanceRequired] of [['good', true], ['fine', false], ['unresolved', false], ['death', false]]) {
    if (!canReachTerminal(sex, ending, romanceRequired)) errors.push(`${sex}: stateful traversal cannot reach ${ending}${romanceRequired ? ' with romance' : ''}`);
  }
}

if (errors.length) {
  console.error(errors.map(error => `✗ ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated Greenhold story graph: ${Object.keys(nodes).length} reachable nodes, all four ending classes, seven gender-gated romance scenes, and stateful routes for both genders.`);
}
