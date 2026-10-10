export const CRITERIA = [
  { id: 1, human: false, title: 'Single PRESS START link, pixel font, neon on black, scanlines' },
  { id: 2, human: false, title: '1P easy, 1P hard, and 2P on the same screen' },
  { id: 3, human: false, title: 'Hard never loses and easy is beatable' },
  { id: 4, human: false, title: 'Every line wins and a full board draws' },
  { id: 5, human: false, title: 'No moves after the end until one restart' },
  { id: 6, human: true, title: 'Fullscreen, Esc, square board, iPhone install' },
  { id: 7, human: false, title: 'Sound only after the first gesture, mute persists' },
  { id: 8, human: false, title: 'Mouse, touch, and keyboard' },
  { id: 9, human: false, title: 'No console errors in Chromium, Firefox, WebKit, or Edge' },
  { id: 10, human: false, title: 'Both themes pass 1 to 9 and RETRO matches the base branch' },
  { id: 11, human: false, title: 'Theme toggle on the start screen and in the corner' },
  { id: 12, human: false, title: 'Theme switch keeps the match' },
  { id: 13, human: false, title: 'Theme switch is instant, stored, and does not flash' },
  { id: 14, human: false, title: 'SCI-FI glass, glow, Orbitron, and still win lines' },
  { id: 15, human: true, title: 'Per-theme sounds with the same mute and first-gesture rule' },
  { id: 16, human: false, title: 'X and O are distinct and text is readable' },
];

export function verdict(criterion, checks) {
  if (!checks?.length || checks.some((check) => !check.ok)) return 'FAIL';
  if (criterion.human) return 'HUMAN';
  return 'PASS';
}

export function failureMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function guardCall(run) {
  try {
    const extra = await run();
    return { ok: true, extra };
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
}

export function createIsolatedRun(record) {
  let active = 1;
  return {
    get active() {
      return active;
    },
    async step(id, evidence, run) {
      active = id;
      const outcome = await guardCall(run);
      if (outcome.ok) {
        record(id, true, outcome.extra ? `${evidence} ${outcome.extra}` : evidence);
        return;
      }
      record(id, false, `${evidence} ${outcome.message}`);
    },
    async visit(id, run) {
      active = id;
      const outcome = await guardCall(run);
      if (!outcome.ok) record(active, false, outcome.message);
    },
  };
}

export function formatReport(checksById, meta) {
  const lines = [
    'Neon Tac verification',
    `head ${meta.head}`,
    `base ${meta.base}`,
  ];
  let pass = 0;
  let fail = 0;
  let human = 0;
  for (const criterion of CRITERIA) {
    const checks = checksById.get(criterion.id) ?? [];
    const status = verdict(criterion, checks);
    if (status === 'PASS') pass += 1;
    if (status === 'FAIL') fail += 1;
    if (status === 'HUMAN') human += 1;
    const id = String(criterion.id).padStart(2, '0');
    lines.push(`${id}  ${status.padEnd(5)}  ${criterion.title}`);
    for (const check of checks) lines.push(`    ${check.evidence}`);
  }
  lines.push(`${pass} PASS, ${fail} FAIL, ${human} HUMAN`);
  return { text: `${lines.join('\n')}\n`, fail };
}
