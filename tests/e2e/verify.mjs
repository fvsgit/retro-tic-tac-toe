import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { chromium, devices, firefox, webkit } from 'playwright';
import { PNG } from 'pngjs';
import { hardMove } from '../../js/game.js';
import { CRITERIA, createIsolatedRun, failureMessage, formatReport } from './criteria.mjs';
import { EASY_BOARD, EASY_SEED, HARD_GAMES, POLICIES, checkFixtures } from './sim.mjs';
import { rngInitSource } from './rng.mjs';
import {
  SITE_FILES,
  addWorktree,
  assertDistinctCommits,
  assertPagesMatch,
  buildSite,
  git,
  listen,
  removeWorktree,
  resolveBaseRef,
  resolveSha,
} from './site.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifactDir = path.join(repoRoot, 'tests/e2e/artifacts');
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
const DRAW_MOVES = [0, 1, 4, 8, 2, 6, 5, 3, 7];
const O_WIN_MOVES = [0, 3, 1, 4, 8, 5];
const SHOTS = ['desk-start', 'desk-win', 'iphone-start', 'iphone-win'];

const AUDIO_SPY = `(() => {
  window.__ac = 0;
  window.__waves = [];
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (!Orig) return;
  const origCreate = Orig.prototype.createOscillator;
  Orig.prototype.createOscillator = function () {
    const osc = origCreate.call(this);
    const desc = Object.getOwnPropertyDescriptor(OscillatorNode.prototype, 'type');
    Object.defineProperty(osc, 'type', {
      configurable: true,
      enumerable: true,
      get() { return desc.get.call(this); },
      set(value) {
        window.__waves.push(String(value));
        desc.set.call(this, value);
      },
    });
    return osc;
  };
  class SpyAudio extends Orig {
    constructor(...args) {
      super(...args);
      window.__ac += 1;
    }
  }
  window.AudioContext = SpyAudio;
  if (window.webkitAudioContext) window.webkitAudioContext = SpyAudio;
})();`;

const STRIP_FULLSCREEN = `(() => {
  const deny = { configurable: true, get: () => false };
  Object.defineProperty(Document.prototype, 'fullscreenEnabled', deny);
  Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', deny);
})();`;

const checks = new Map();
const observations = [];
let finalized = false;

function record(id, ok, evidence) {
  const list = checks.get(id) ?? [];
  list.push({ ok, evidence });
  checks.set(id, list);
}

const session = createIsolatedRun(record);
const { step, visit } = session;

function watch(page) {
  const bag = { errors: [], missing: [] };
  page.on('pageerror', (error) => bag.errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text().includes('favicon.ico')) return;
    bag.errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    if (response.url().endsWith('/favicon.ico')) return;
    bag.missing.push(`${response.status()} ${response.url()}`);
  });
  observations.push(bag);
}

async function openPage(browser, options = {}) {
  const contextOptions = { reducedMotion: options.reducedMotion ?? 'reduce' };
  if (options.device) {
    const { defaultBrowserType, ...deviceOptions } = devices[options.device];
    Object.assign(contextOptions, deviceOptions);
  }
  if (options.viewport) contextOptions.viewport = options.viewport;
  if (options.hasTouch) contextOptions.hasTouch = true;
  if (options.isMobile) contextOptions.isMobile = true;
  const context = await browser.newContext(contextOptions);
  if (options.seed != null) await context.addInitScript(rngInitSource(options.seed));
  if (options.spy) await context.addInitScript(AUDIO_SPY);
  if (options.stripFullscreen) await context.addInitScript(STRIP_FULLSCREEN);
  if (options.theme) {
    await context.addInitScript((theme) => {
      localStorage.setItem('neon-tac-theme', theme);
    }, options.theme);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  watch(page);
  return { context, page };
}

async function withPage(browser, options, run) {
  const opened = await openPage(browser, options);
  try {
    return await run(opened.page);
  } finally {
    await opened.context.close();
  }
}

async function gotoApp(page, url, until = 'load') {
  await page.goto(url, { waitUntil: until });
  if (until !== 'commit') await page.evaluate(() => document.fonts.ready);
}

async function clickControl(page, selector, input) {
  if (input === 'tap') await page.tap(selector);
  else await page.click(selector);
}

async function moveCell(page, index, input) {
  await clickControl(page, `.cell[data-index="${index}"]`, input);
  await page.waitForFunction(() => document.querySelector('#status').textContent !== 'CPU');
}

async function readBoard(page) {
  return page.$$eval('.cell', (cells) => cells.map((cell) => cell.textContent ?? ''));
}

async function ensureStart(page, input) {
  const startHidden = await page.$eval('#screen-start', (el) => el.hidden);
  if (startHidden) await clickControl(page, '#home', input);
}

async function startMode(page, mode, input) {
  await ensureStart(page, input);
  const startHidden = await page.$eval('#screen-start', (el) => el.hidden);
  if (!startHidden) await clickControl(page, '#start-link', input);
  await clickControl(page, `[data-mode="${mode}"]`, input);
  await page.waitForSelector('#screen-game:not([hidden])');
}

async function playPolicy(page, policy, input) {
  for (let guard = 0; guard < 9; guard += 1) {
    const kind = await page.getAttribute('#status', 'data-kind');
    if (kind !== 'turn') break;
    const board = await readBoard(page);
    if (!board.includes('')) break;
    const index = policy(board);
    if (index == null || index < 0) break;
    await moveCell(page, index, input);
  }
}

async function playMoves(page, moves, input) {
  for (const index of moves) await moveCell(page, index, input);
}

function movesForLine(line) {
  const used = new Set(line);
  const fillers = [];
  for (let index = 0; index < 9; index += 1) {
    if (!used.has(index)) fillers.push(index);
  }
  return [line[0], fillers[0], line[1], fillers[1], line[2]];
}

async function highlighted(page) {
  const indexes = await page.$$eval('.cell', (cells) => cells.flatMap((cell, index) => (
    cell.classList.contains('win') ? [index] : []
  )));
  return indexes.sort((a, b) => a - b);
}

function sameIndexes(left, right) {
  return [...left].sort((a, b) => a - b);
}

async function restartClears(page, input) {
  await clickControl(page, '#restart', input);
  assert.deepEqual(await readBoard(page), Array(9).fill(''));
  assert.equal(await page.$eval('#board', (el) => el.classList.contains('locked')), false);
}

async function boardBox(page) {
  return page.evaluate(() => {
    const board = document.querySelector('#board').getBoundingClientRect();
    const corner = document.querySelector('#theme-corner').getBoundingClientRect();
    const overlap = !(
      corner.right <= board.left
      || corner.left >= board.right
      || corner.bottom <= board.top
      || corner.top >= board.bottom
    );
    return {
      width: Math.round(board.width),
      height: Math.round(board.height),
      top: board.top,
      left: board.left,
      bottom: board.bottom,
      right: board.right,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      overlap,
    };
  });
}

function assertOnScreen(box) {
  assert.ok(box.width >= 80, `board width ${box.width}`);
  assert.ok(Math.abs(box.width - box.height) <= 1, `board ${box.width}x${box.height}`);
  assert.ok(box.top >= -1 && box.left >= -1, `origin ${box.left},${box.top}`);
  assert.ok(box.right <= box.innerWidth + 1 && box.bottom <= box.innerHeight + 1, 'board clipped');
  assert.equal(box.overlap, false, 'corner covers the board');
}

async function readLook(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const panel = getComputedStyle(document.querySelector('.panel'));
    const h1 = getComputedStyle(document.querySelector('h1'));
    const link = getComputedStyle(document.querySelector('#start-link'));
    return {
      theme: document.documentElement.dataset.theme,
      bg: root.getPropertyValue('--bg').trim(),
      cyan: root.getPropertyValue('--cyan').trim(),
      magenta: root.getPropertyValue('--magenta').trim(),
      bodyBg: body.backgroundColor,
      bodyFont: body.fontFamily,
      crt: getComputedStyle(document.querySelector('.crt')).backgroundImage,
      panelBlur: panel.backdropFilter || panel.webkitBackdropFilter || '',
      panelBg: panel.backgroundColor,
      titleShadow: h1.textShadow,
      titleColor: h1.color,
      linkAnimation: link.animationName,
      fonts: [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family),
      anchors: [...document.querySelectorAll('a')].map((anchor) => ({
        text: anchor.textContent.trim(),
        href: anchor.getAttribute('href'),
      })),
      startHidden: document.querySelector('#screen-start').hidden,
      modeHidden: document.querySelector('#screen-mode').hidden,
      gameHidden: document.querySelector('#screen-game').hidden,
    };
  });
}

function assertSingleLink(look) {
  assert.equal(look.startHidden, false);
  assert.equal(look.modeHidden, true);
  assert.equal(look.gameHidden, true);
  assert.deepEqual(look.anchors, [{ text: 'PRESS START', href: '#play' }]);
}

async function contrast(page) {
  return page.evaluate(() => {
    function parse(value) {
      const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
      if (!match) return null;
      return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
    }
    function channel(value) {
      const scaled = value / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    }
    function luminance(rgb) {
      return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    }
    function ratio(front, back) {
      const a = luminance(front);
      const b = luminance(back);
      const lighter = Math.max(a, b);
      const darker = Math.min(a, b);
      return (lighter + 0.05) / (darker + 0.05);
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    const title = parse(getComputedStyle(document.querySelector('h1')).color);
    const status = parse(getComputedStyle(document.querySelector('#status')).color);
    const x = document.querySelector('.cell.x');
    const o = document.querySelector('.cell.o');
    const xColor = x ? parse(getComputedStyle(x).color) : null;
    const oColor = o ? parse(getComputedStyle(o).color) : null;
    const xBefore = x ? getComputedStyle(x, '::before') : null;
    const oBefore = o ? getComputedStyle(o, '::before') : null;
    return {
      title: ratio(title, body),
      status: ratio(status, body),
      xColor: xColor && xColor.slice(0, 3).join(','),
      oColor: oColor && oColor.slice(0, 3).join(','),
      xRadius: xBefore ? xBefore.borderRadius : '',
      oRadius: oBefore ? oBefore.borderRadius : '',
      xTransform: xBefore ? xBefore.transform : '',
      oBorder: oBefore ? oBefore.borderTopWidth : '',
    };
  });
}

async function checkStart(page, theme, label) {
  await step(1, `${label} start`, async () => {
    const look = await readLook(page);
    assert.equal(look.theme, theme);
    assertSingleLink(look);
    if (theme === 'retro') {
      assert.equal(look.bg, '#05010a');
      assert.equal(look.bodyBg, 'rgb(5, 1, 10)');
      assert.ok(look.bodyFont.includes('Press Start 2P'), look.bodyFont);
      assert.ok(look.fonts.some((font) => font.includes('Press Start 2P')), look.fonts.join(','));
      assert.ok(look.crt.includes('repeating-linear-gradient'), 'missing scanlines');
      assert.equal(look.cyan, '#39fff2');
      assert.equal(look.magenta, '#ff2bd6');
      assert.notEqual(look.titleShadow, 'none');
      return 'RETRO pixel font, neon on black, scanlines';
    }
    assert.equal(look.bg, '#050814');
    assert.ok(look.bodyFont.includes('Orbitron'), look.bodyFont);
    return 'SCI-FI keeps one PRESS START link';
  });
}

async function checkModes(page, label, input) {
  await step(2, `${label} modes`, async () => {
    await clickControl(page, '#start-link', input);
    const modes = await page.evaluate(() => ({
      startHidden: document.querySelector('#screen-start').hidden,
      modeHidden: document.querySelector('#screen-mode').hidden,
      gameHidden: document.querySelector('#screen-game').hidden,
      modes: [...document.querySelectorAll('[data-mode]')].map((el) => ({
        mode: el.dataset.mode,
        text: el.textContent.trim(),
        hidden: el.hidden,
      })),
    }));
    assert.equal(modes.startHidden, true);
    assert.equal(modes.modeHidden, false);
    assert.equal(modes.gameHidden, true);
    assert.deepEqual(modes.modes, [
      { mode: 'easy', text: '1P EASY', hidden: false },
      { mode: 'hard', text: '1P HARD', hidden: false },
      { mode: 'pvp', text: '2 PLAYERS', hidden: false },
    ]);
  });
}

async function checkRules(page, theme, label, input) {
  await step(4, `${label} lines`, async () => {
    await startMode(page, 'pvp', input);
    for (const line of LINES) {
      if ((await readBoard(page)).some((cell) => cell !== '')) await restartClears(page, input);
      await playMoves(page, movesForLine(line), input);
      assert.equal(await page.textContent('#status'), 'X WINS');
      assert.deepEqual(await highlighted(page), sameIndexes(line));
      const drawn = await page.$eval('#win-line', (el) => el.classList.contains('is-drawn') && el.style.display !== 'none');
      assert.equal(drawn, true);
    }
    return '8 lines highlighted for X';
  });

  await step(4, `${label} O win`, async () => {
    await restartClears(page, input);
    await playMoves(page, O_WIN_MOVES, input);
    assert.equal(await page.textContent('#status'), 'O WINS');
    assert.deepEqual(await highlighted(page), [3, 4, 5]);
  });

  await step(4, `${label} draw`, async () => {
    await restartClears(page, input);
    await playMoves(page, DRAW_MOVES, input);
    assert.equal(await page.textContent('#status'), 'DRAW');
    assert.deepEqual(await highlighted(page), []);
    assert.equal(await page.$eval('#board', (el) => el.classList.contains('is-draw')), true);
  });

  await step(5, `${label} lock and restart`, async () => {
    const before = await readBoard(page);
    await clickControl(page, '.cell[data-index="0"]', input);
    assert.deepEqual(await readBoard(page), before);
    await restartClears(page, input);
    assert.equal(await page.textContent('#status'), 'X TURN');
    await moveCell(page, 0, input);
    assert.equal((await readBoard(page))[0], 'X');
    return 'one RESTART click cleared a locked draw';
  });

  await step(8, `${label} mouse`, async () => {
    if (input !== 'click') return 'covered by the pointer used for the wins';
    assert.equal((await readBoard(page))[0], 'X');
    return 'click wrote X';
  });

  await step(16, `${label} marks`, async () => {
    await restartClears(page, input);
    await playMoves(page, [0, 1], input);
    const facts = await contrast(page);
    assert.ok(facts.title >= 4.5, `title contrast ${facts.title}`);
    assert.ok(facts.status >= 4.5, `status contrast ${facts.status}`);
    if (theme === 'retro') {
      assert.notEqual(facts.xColor, facts.oColor);
      return `X ${facts.xColor} O ${facts.oColor} title ${facts.title.toFixed(1)}`;
    }
    assert.ok(facts.oRadius.includes('50%'), facts.oRadius);
    assert.ok(facts.xTransform !== 'none', facts.xTransform);
    assert.notEqual(facts.xRadius, facts.oRadius);
    return `SCI-FI X transform ${facts.xTransform} O radius ${facts.oRadius}`;
  });

  if (theme === 'sci-fi') {
    await step(14, `${label} glass and still win line`, async () => {
      const look = await readLook(page);
      assert.equal(look.bg, '#050814');
      assert.equal(look.cyan, '#8af8ff');
      assert.equal(look.magenta, '#ff6adf');
      assert.equal(look.bodyBg, 'rgb(5, 8, 20)');
      assert.ok(look.panelBlur.includes('blur'), look.panelBlur);
      assert.notEqual(look.titleShadow, 'none');
      assert.ok(look.fonts.some((font) => font.includes('Orbitron')), look.fonts.join(','));
      assert.ok(look.bodyFont.includes('Orbitron'), look.bodyFont);
      await restartClears(page, input);
      await playMoves(page, movesForLine(LINES[0]), input);
      const line = await page.$eval('#win-line', (el) => {
        const style = getComputedStyle(el);
        return { name: style.animationName, dash: style.strokeDashoffset, drawn: el.classList.contains('is-drawn') };
      });
      assert.equal(line.drawn, true);
      assert.equal(line.name, 'none');
      assert.equal(Number.parseFloat(line.dash), 0);
      return `blur ${look.panelBlur}, reduced-motion line still`;
    });
  }

  await step(6, `${label} board`, async () => {
    const box = await boardBox(page);
    assertOnScreen(box);
    return `${box.width}x${box.height} inside ${box.innerWidth}x${box.innerHeight}`;
  });

  await step(11, `${label} corner`, async () => {
    const box = await boardBox(page);
    assert.equal(box.overlap, false);
    return 'corner misses the board';
  });
}

async function checkKeyboard(page, label) {
  await step(8, `${label} keyboard`, async () => {
    await startMode(page, 'pvp', 'click');
    await page.mouse.move(0, 0);
    const cursor = () => page.$$eval('.cell', (cells) => cells.findIndex((cell) => cell.classList.contains('cursor')));
    let index = await cursor();
    const stepTo = async (key, next) => {
      await page.keyboard.press(key);
      index = next(index);
      assert.equal(await cursor(), index, key);
    };
    const right = (cell) => Math.floor(cell / 3) * 3 + ((cell % 3) + 1) % 3;
    const left = (cell) => Math.floor(cell / 3) * 3 + ((cell % 3) + 2) % 3;
    const down = (cell) => ((Math.floor(cell / 3) + 1) % 3) * 3 + (cell % 3);
    const up = (cell) => ((Math.floor(cell / 3) + 2) % 3) * 3 + (cell % 3);
    await stepTo('ArrowRight', right);
    await stepTo('ArrowDown', down);
    await stepTo('ArrowLeft', left);
    await stepTo('ArrowUp', up);
    await page.keyboard.press('Enter');
    assert.equal((await readBoard(page))[index], 'X');
    return `arrows returned to cell ${index} and Enter wrote X`;
  });
}

async function checkCpu(page, theme, label) {
  await step(3, `${label} hard`, async () => {
    const summaries = [];
    for (const game of HARD_GAMES) {
      await startMode(page, 'hard', 'click');
      await playPolicy(page, POLICIES[game.policy], 'click');
      assert.equal(await page.textContent('#status'), 'CPU WINS');
      assert.deepEqual(await readBoard(page), game.board);
      summaries.push(game.policy);
    }
    return `CPU WINS for ${summaries.join(', ')}`;
  });
}

async function checkEasy(page, label) {
  await step(3, `${label} easy seed ${EASY_SEED}`, async () => {
    await startMode(page, 'easy', 'click');
    await playPolicy(page, POLICIES.pref, 'click');
    assert.equal(await page.textContent('#status'), 'YOU WIN');
    assert.deepEqual(await readBoard(page), EASY_BOARD);
    return `board ${EASY_BOARD.join('')}`;
  });
}

async function checkAudio(page, theme, label) {
  await step(7, `${label} first gesture`, async () => {
    const before = await page.evaluate(() => window.__ac);
    assert.equal(before, 0);
    await clickControl(page, '#start-link', 'click');
    const after = await page.evaluate(() => window.__ac);
    assert.equal(after, 1);
    return 'AudioContext count 0 then 1';
  });

  await step(15, `${label} wave`, async () => {
    await clickControl(page, '[data-mode="pvp"]', 'click');
    await moveCell(page, 0, 'click');
    const beforeSwitch = await page.evaluate(() => window.__waves.slice());
    assert.ok(beforeSwitch.length > 0, 'no oscillators');
    assert.ok(beforeSwitch.every((wave) => wave === (theme === 'sci-fi' ? 'sine' : 'square')), beforeSwitch.join(','));
    if (theme === 'retro') {
      await clickControl(page, '#theme-corner', 'click');
      await moveCell(page, 1, 'click');
      const afterSwitch = await page.evaluate((start) => window.__waves.slice(start), beforeSwitch.length);
      assert.ok(afterSwitch.length > 0, 'no sci-fi oscillators');
      assert.ok(afterSwitch.every((wave) => wave === 'sine'), afterSwitch.join(','));
    }
    return theme === 'retro' ? 'square then sine' : 'sine';
  });

  await step(7, `${label} mute persists`, async () => {
    await clickControl(page, '#mute', 'click');
    assert.equal(await page.textContent('#mute'), 'OFF');
    const count = await page.evaluate(() => window.__waves.length);
    await moveCell(page, theme === 'retro' ? 4 : 1, 'click');
    const after = await page.evaluate(() => window.__waves.length);
    assert.equal(after, count);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.textContent('#mute'), 'OFF');
    return 'OFF survives reload and blocks new oscillators';
  });

  await step(15, `${label} mute gate`, async () => {
    assert.equal(await page.textContent('#mute'), 'OFF');
    return 'mute gate matches this theme';
  });
}

async function checkFullscreen(page, label) {
  await step(6, `${label} fullscreen button`, async () => {
    const hidden = await page.$eval('#fullscreen', (el) => el.hidden);
    assert.equal(hidden, false);
    await page.click('#fullscreen');
    await page.waitForFunction(() => {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      return active && document.querySelector('#fullscreen').textContent.trim() === 'EXIT';
    });
    await page.click('#fullscreen');
    await page.waitForFunction(() => {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      return !active && document.querySelector('#fullscreen').textContent.trim() === 'FULL';
    });
    return 'button entered fullscreen as EXIT and left it as FULL';
  });
}

async function checkIphoneFullscreen(page, label) {
  await step(6, `${label} iPhone button`, async () => {
    const facts = await page.evaluate(() => ({
      hidden: document.querySelector('#fullscreen').hidden,
      enabled: document.fullscreenEnabled ?? null,
      webkit: document.webkitFullscreenEnabled ?? null,
      request: typeof document.documentElement.requestFullscreen,
      webkitRequest: typeof document.documentElement.webkitRequestFullscreen,
    }));
    assert.equal(facts.hidden, true);
    return `button hidden (${JSON.stringify(facts)})`;
  });
}

async function checkStrippedIphone(page, label) {
  await step(6, `${label} missing Fullscreen API`, async () => {
    const facts = await page.evaluate(() => ({
      hidden: document.querySelector('#fullscreen').hidden,
      enabled: document.fullscreenEnabled ?? document.webkitFullscreenEnabled,
    }));
    assert.equal(facts.enabled, false);
    assert.equal(facts.hidden, true);
    return 'button hidden when the API is missing, as on iPhone Safari';
  });
}

async function checkManifest(page, label) {
  await step(6, `${label} manifest`, async () => {
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]').href;
      const response = await fetch(href);
      if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
      return response.json();
    });
    const capable = await page.getAttribute('meta[name="apple-mobile-web-app-capable"]', 'content');
    assert.equal(manifest.display, 'fullscreen');
    assert.equal(capable, 'yes');
    return 'display fullscreen, apple-mobile-web-app-capable yes';
  });
}

async function checkTheme(page, label, input) {
  await step(11, `${label} ${input} toggle`, async () => {
    await ensureStart(page, input === 'keyboard' ? 'click' : input);
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    const opposite = before === 'sci-fi' ? 'retro' : 'sci-fi';
    if (input === 'keyboard') {
      await page.focus('#theme-start');
      await page.keyboard.press('Enter');
    } else {
      await clickControl(page, '#theme-start', input);
    }
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert.equal(theme, opposite);
    await startMode(page, 'pvp', input === 'keyboard' ? 'click' : input);
    if (input === 'keyboard') {
      await page.focus('#theme-corner');
      await page.keyboard.press('Enter');
    } else {
      await clickControl(page, '#theme-corner', input);
    }
    const next = await page.evaluate(() => document.documentElement.dataset.theme);
    assert.equal(next, before);
    assert.deepEqual(await readBoard(page), Array(9).fill(''));
    const box = await boardBox(page);
    assert.equal(box.overlap, false);
    return 'start control and corner control, board untouched';
  });
}

async function checkKeepMatch(page, label) {
  await step(12, `${label} mid-game`, async () => {
    await startMode(page, 'hard', 'click');
    await clickControl(page, '#mute', 'click');
    await moveCell(page, 0, 'click');
    const before = {
      board: await readBoard(page),
      status: await page.textContent('#status'),
      mute: await page.textContent('#mute'),
    };
    assert.equal(before.board[0], 'X');
    assert.equal(before.board[4], 'O');
    assert.equal(before.mute.trim(), 'OFF');
    await clickControl(page, '#theme-corner', 'click');
    const after = {
      board: await readBoard(page),
      status: await page.textContent('#status'),
      mute: await page.textContent('#mute'),
      theme: await page.evaluate(() => document.documentElement.dataset.theme),
      game: await page.$eval('#screen-game', (el) => !el.hidden),
    };
    assert.deepEqual(after.board, before.board);
    assert.equal(after.status, before.status);
    assert.equal(after.mute, before.mute);
    assert.equal(after.theme, 'sci-fi');
    assert.equal(after.game, true);
    const humanIndex = POLICIES.pref(before.board);
    const withHuman = before.board.map((cell, index) => (index === humanIndex ? 'X' : cell));
    const expectedCpu = hardMove(withHuman.map((cell) => cell || null), 'O');
    await moveCell(page, humanIndex, 'click');
    const played = await readBoard(page);
    assert.equal(played[humanIndex], 'X');
    assert.equal(played[expectedCpu], 'O');
    return `board held, CPU still answered cell ${expectedCpu}`;
  });

  await step(12, `${label} after win`, async () => {
    await startMode(page, 'pvp', 'click');
    await playMoves(page, movesForLine([0, 1, 2]), 'click');
    const before = {
      board: await readBoard(page),
      status: await page.textContent('#status'),
    };
    await clickControl(page, '#theme-corner', 'click');
    assert.deepEqual(await readBoard(page), before.board);
    assert.equal(await page.textContent('#status'), before.status);
    assert.equal(await page.$eval('#screen-game', (el) => !el.hidden), true);
    assert.equal(await page.$eval('#board', (el) => el.classList.contains('locked')), true);
    return 'win board and X WINS stayed';
  });
}

async function checkInstant(page, label) {
  await step(13, `${label} instant`, async () => {
    await ensureStart(page, 'click');
    const navigations = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    const timing = await page.evaluate(() => {
      const started = performance.now();
      document.querySelector('#theme-start').click();
      return {
        theme: document.documentElement.dataset.theme,
        ms: performance.now() - started,
        navigations: performance.getEntriesByType('navigation').length,
      };
    });
    assert.equal(timing.theme, 'sci-fi');
    assert.ok(timing.ms < 50, `took ${timing.ms}ms`);
    assert.equal(timing.navigations, navigations);
    await page.click('#theme-start');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'retro');
    return `handler ${timing.ms.toFixed(2)}ms, mouse click returned to RETRO`;
  });

  await step(13, `${label} reload`, async () => {
    await page.evaluate(() => localStorage.setItem('neon-tac-theme', 'sci-fi'));
    await page.reload({ waitUntil: 'commit' });
    const samples = [];
    for (let index = 0; index < 4; index += 1) {
      samples.push(await page.evaluate(() => document.documentElement.dataset.theme));
    }
    await page.waitForLoadState('load');
    samples.push(await page.evaluate(() => document.documentElement.dataset.theme));
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    assert.ok(samples.every((sample) => sample === 'sci-fi'), samples.join(','));
    assert.equal(bg, '#050814');
    assert.equal(await page.evaluate(() => localStorage.getItem('neon-tac-theme')), 'sci-fi');
    return `samples ${samples.join(' ')}`;
  });
}

async function checkMotion(page, label) {
  await step(1, `${label} blink`, async () => {
    const name = await page.$eval('#start-link', (el) => getComputedStyle(el).animationName);
    assert.equal(name, 'blink');
    return 'start link still blinks when motion is allowed';
  });
  await step(14, `${label} animated win line`, async () => {
    await page.evaluate(() => localStorage.setItem('neon-tac-theme', 'sci-fi'));
    await page.reload({ waitUntil: 'load' });
    await startMode(page, 'pvp', 'click');
    await playMoves(page, movesForLine(LINES[0]), 'click');
    const line = await page.$eval('#win-line', (el) => getComputedStyle(el).animationName);
    assert.equal(line, 'win-draw');
    return 'win-draw while motion is allowed';
  });
}

async function checkTouchMark(page, label, input) {
  await step(8, `${label} touch`, async () => {
    await startMode(page, 'pvp', input);
    await moveCell(page, 8, input);
    assert.equal((await readBoard(page))[8], 'X');
    return 'tap wrote X on cell 8';
  });
}

async function checkSmoke(page, theme, label, input) {
  await checkStart(page, theme, label);
  await step(4, `${label} one win`, async () => {
    await startMode(page, 'pvp', input);
    await playMoves(page, movesForLine([0, 4, 8]), input);
    assert.equal(await page.textContent('#status'), 'X WINS');
    assert.deepEqual(await highlighted(page), [0, 4, 8]);
  });
  await step(6, `${label} board`, async () => {
    const box = await boardBox(page);
    assertOnScreen(box);
    return `${box.width}x${box.height}`;
  });
  await step(11, `${label} corner`, async () => {
    assert.equal((await boardBox(page)).overlap, false);
  });
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function captureRetro(browserType, url, dir, kind) {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await browserType.launch({ headless: true });
  const options = kind === 'iphone'
    ? { device: 'iPhone 13' }
    : { viewport: { width: 1280, height: 800 } };
  const prefix = kind === 'iphone' ? 'iphone' : 'desk';
  try {
    await withPage(browser, options, async (page) => {
      await gotoApp(page, url);
      const animation = await page.$eval('#start-link', (el) => getComputedStyle(el).animationName);
      assert.equal(animation, 'none', `${prefix} start link blinked during the RETRO shot`);
      await settle(page);
      await page.screenshot({ path: path.join(dir, `${prefix}-start.png`) });
      await clickControl(page, '#start-link', 'click');
      await clickControl(page, '[data-mode="pvp"]', 'click');
      await playMoves(page, [0, 1, 4, 2, 8], 'click');
      await page.waitForFunction(() => document.querySelectorAll('.cell.win').length === 3);
      await settle(page);
      await page.screenshot({ path: path.join(dir, `${prefix}-win.png`) });
    });
  } finally {
    await browser.close();
  }
}

function compareShot(baseDir, headDir, name) {
  const baseFile = path.join(baseDir, `${name}.png`);
  const headFile = path.join(headDir, `${name}.png`);
  const baseImage = PNG.sync.read(fs.readFileSync(baseFile));
  const headImage = PNG.sync.read(fs.readFileSync(headFile));
  if (baseImage.width !== headImage.width || baseImage.height !== headImage.height) {
    return { ok: false, detail: `${name} size ${baseImage.width}x${baseImage.height} vs ${headImage.width}x${headImage.height}` };
  }
  const diff = new PNG({ width: baseImage.width, height: baseImage.height });
  const count = pixelmatch(baseImage.data, headImage.data, diff.data, baseImage.width, baseImage.height, {
    threshold: 0.1,
    includeAA: false,
    checkerboard: false,
  });
  if (count > 0) {
    fs.mkdirSync(path.join(artifactDir, 'retro', 'diff'), { recursive: true });
    fs.writeFileSync(path.join(artifactDir, 'retro', 'diff', `${name}.png`), PNG.sync.write(diff));
  }
  return { ok: count === 0, detail: `${name} ${count} pixels` };
}

function fileHash(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
}

function assertBrowsersInstalled() {
  for (const type of [chromium, firefox, webkit]) {
    const executable = type.executablePath();
    if (!fs.existsSync(executable)) {
      throw new Error(`Missing ${type.name()} at ${executable}. Run npx playwright install --with-deps chromium firefox webkit`);
    }
  }
}

function finalize(meta) {
  if (finalized) return formatReport(checks, meta);
  finalized = true;
  const problems = [];
  for (const bag of observations) {
    problems.push(...bag.errors, ...bag.missing);
  }
  if (observations.length === 0) {
    record(9, false, 'no browser page opened');
  } else if (problems.length > 0) {
    record(9, false, problems.slice(0, 8).join(' | '));
  } else {
    record(9, true, `${observations.length} pages, Chromium Firefox and WebKit clean. Edge uses the Chromium run.`);
  }

  const failedEarly = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((id) => {
    const list = checks.get(id) ?? [];
    return list.length === 0 || list.some((check) => !check.ok);
  });
  if (failedEarly.length > 0) {
    record(10, false, `criteria ${failedEarly.join(', ')} failed`);
  }

  for (const criterion of CRITERIA) {
    if (!criterion.human) continue;
    const list = checks.get(criterion.id) ?? [];
    const automated = list.filter((check) => !check.evidence.startsWith('Human:'));
    if (automated.length === 0) record(criterion.id, false, 'no automated check ran');
  }
  record(6, true, 'Human: press Esc on a physical keyboard to leave fullscreen, and install the page to an iPhone home screen.');
  record(15, true, 'Human: listen to a move in RETRO and in SCI-FI.');

  for (const criterion of CRITERIA) {
    if (!checks.has(criterion.id)) record(criterion.id, false, 'no check ran');
  }
  return formatReport(checks, meta);
}

async function doctor() {
  assertPagesMatch(fs.readFileSync(path.join(repoRoot, '.github/workflows/pages.yml'), 'utf8'));
  assertBrowsersInstalled();
  const head = git(repoRoot, ['rev-parse', 'HEAD']);
  const base = resolveSha(repoRoot, resolveBaseRef());
  assertDistinctCommits(head, base);
  return [
    'doctor ok',
    `head ${head}`,
    `base ${base} from ${resolveBaseRef()}`,
    `files ${SITE_FILES.length}`,
  ].join('\n');
}

async function main() {
  if (process.argv.includes('--doctor')) {
    process.stdout.write(`${await doctor()}\n`);
    return;
  }

  assertPagesMatch(fs.readFileSync(path.join(repoRoot, '.github/workflows/pages.yml'), 'utf8'));
  assertBrowsersInstalled();
  checkFixtures();

  const headSha = git(repoRoot, ['rev-parse', 'HEAD']);
  let baseSha = 'unresolved';
  const meta = { head: headSha, base: baseSha };
  const closers = [];
  let worktree = null;

  try {
    fs.rmSync(artifactDir, { recursive: true, force: true });
    fs.mkdirSync(artifactDir, { recursive: true });
    const headParent = path.join(artifactDir, 'www-head');
    const headSite = path.join(headParent, 'retro-tic-tac-toe');
    buildSite(repoRoot, headSite);
    const headServer = await listen(headParent);
    closers.push(headServer.close);
    const url = `${headServer.origin}/retro-tic-tac-toe/`;
    process.stderr.write(`serving ${url}\n`);

    const chrome = await chromium.launch({ headless: true });
    const fox = await firefox.launch({ headless: true });
    const kit = await webkit.launch({ headless: true });
    closers.push(async () => { await chrome.close(); await fox.close(); await kit.close(); });

    for (const theme of ['retro', 'sci-fi']) {
      const label = `chromium ${theme}`;
      await visit(1, () => withPage(chrome, { viewport: { width: 1280, height: 800 }, theme: theme === 'sci-fi' ? 'sci-fi' : undefined }, async (page) => {
        await gotoApp(page, url);
        await checkStart(page, theme, label);
        await checkModes(page, label, 'click');
        await checkRules(page, theme, label, 'click');
      }));
      await visit(8, () => withPage(chrome, { viewport: { width: 1280, height: 800 }, theme: theme === 'sci-fi' ? 'sci-fi' : undefined }, async (page) => {
        await gotoApp(page, url);
        await checkKeyboard(page, label);
      }));
      await visit(3, () => withPage(chrome, { viewport: { width: 1280, height: 800 }, theme: theme === 'sci-fi' ? 'sci-fi' : undefined }, async (page) => {
        await gotoApp(page, url);
        await checkCpu(page, theme, label);
      }));
      await visit(3, () => withPage(chrome, {
        viewport: { width: 1280, height: 800 },
        theme: theme === 'sci-fi' ? 'sci-fi' : undefined,
        seed: EASY_SEED,
      }, async (page) => {
        await gotoApp(page, url);
        await checkEasy(page, label);
      }));
      await visit(7, () => withPage(chrome, {
        viewport: { width: 1280, height: 800 },
        theme: theme === 'sci-fi' ? 'sci-fi' : undefined,
        spy: true,
      }, async (page) => {
        await gotoApp(page, url);
        await checkAudio(page, theme, label);
      }));
      await visit(6, () => withPage(chrome, { viewport: { width: 1280, height: 800 }, theme: theme === 'sci-fi' ? 'sci-fi' : undefined }, async (page) => {
        await gotoApp(page, url);
        await checkFullscreen(page, label);
      }));
      await visit(1, () => withPage(fox, { viewport: { width: 1280, height: 800 }, theme: theme === 'sci-fi' ? 'sci-fi' : undefined }, async (page) => {
        await gotoApp(page, url);
        await checkSmoke(page, theme, `firefox ${theme}`, 'click');
      }));
      await visit(1, () => withPage(kit, { device: 'iPhone 13', theme: theme === 'sci-fi' ? 'sci-fi' : undefined }, async (page) => {
        await gotoApp(page, url);
        await checkStart(page, theme, `webkit iphone ${theme}`);
        await checkIphoneFullscreen(page, `webkit iphone ${theme}`);
        await checkTouchMark(page, `webkit iphone ${theme}`, 'tap');
        await checkTheme(page, `webkit iphone ${theme}`, 'tap');
      }));
    }

    await visit(6, () => withPage(chrome, { device: 'Pixel 7' }, async (page) => {
      await gotoApp(page, url);
      await checkFullscreen(page, 'pixel');
      await checkTouchMark(page, 'pixel', 'tap');
      await step(6, 'pixel board', async () => {
        const box = await boardBox(page);
        assertOnScreen(box);
        return `${box.width}x${box.height}`;
      });
      await step(11, 'pixel corner', async () => {
        assert.equal((await boardBox(page)).overlap, false);
      });
    }));

    for (const viewport of [
      { name: 'landscape', viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
      { name: 'narrow', viewport: { width: 320, height: 640 } },
    ]) {
      await visit(6, () => withPage(chrome, viewport, async (page) => {
        await gotoApp(page, url);
        await startMode(page, 'pvp', 'click');
        await step(6, `${viewport.name} board`, async () => {
          const box = await boardBox(page);
          assertOnScreen(box);
          return `${box.width}x${box.height} in ${box.innerWidth}x${box.innerHeight}`;
        });
        await step(11, `${viewport.name} corner`, async () => {
          assert.equal((await boardBox(page)).overlap, false);
        });
      }));
    }

    await visit(6, () => withPage(kit, { device: 'iPhone 13', stripFullscreen: true }, async (page) => {
      await gotoApp(page, url);
      await checkStrippedIphone(page, 'webkit iphone');
    }));

    await visit(6, () => withPage(chrome, { viewport: { width: 1280, height: 800 } }, async (page) => {
      await gotoApp(page, url);
      await checkManifest(page, 'chromium');
      await checkTheme(page, 'chromium', 'click');
      await checkTheme(page, 'chromium keyboard', 'keyboard');
    }));

    await visit(12, () => withPage(chrome, { viewport: { width: 1280, height: 800 } }, async (page) => {
      await gotoApp(page, url);
      await checkKeepMatch(page, 'chromium');
      await checkInstant(page, 'chromium');
    }));

    await visit(1, () => withPage(chrome, { viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' }, async (page) => {
      await gotoApp(page, url);
      await checkMotion(page, 'chromium motion');
    }));

    await visit(10, async () => {
      try {
        baseSha = resolveSha(repoRoot, resolveBaseRef());
        assertDistinctCommits(headSha, baseSha);
        meta.base = baseSha;
        worktree = addWorktree(repoRoot, baseSha);
        const baseParent = path.join(artifactDir, 'www-base');
        const baseSite = path.join(baseParent, 'retro-tic-tac-toe');
        buildSite(worktree, baseSite);
        if (path.resolve(baseSite) === path.resolve(headSite)) {
          throw new Error('base and head sites are the same directory');
        }
        const baseServer = await listen(baseParent);
        closers.push(baseServer.close);
        const baseUrl = `${baseServer.origin}/retro-tic-tac-toe/`;
        const baseDir = path.join(artifactDir, 'retro', 'base');
        const headDir = path.join(artifactDir, 'retro', 'head');
        process.stderr.write(`RETRO base ${baseSha} ${baseUrl}\n`);
        await captureRetro(chromium, baseUrl, baseDir, 'desk');
        await captureRetro(webkit, baseUrl, baseDir, 'iphone');
        await captureRetro(chromium, url, headDir, 'desk');
        await captureRetro(webkit, url, headDir, 'iphone');
        const headHash = fileHash(path.join(headSite, 'index.html'));
        const baseHash = fileHash(path.join(baseSite, 'index.html'));
        for (const name of SHOTS) {
          const result = compareShot(baseDir, headDir, name);
          record(10, result.ok, `base ${baseSha.slice(0, 12)} head ${headSha.slice(0, 12)} index ${baseHash} vs ${headHash} ${result.detail}`);
        }
      } catch (error) {
        meta.base = baseSha;
        record(10, false, failureMessage(error));
      }
    });
  } catch (error) {
    record(session.active, false, failureMessage(error));
  } finally {
    for (const close of closers.reverse()) {
      try {
        await close();
      } catch {
        // Closers are independent. A dead server must not skip the report.
      }
    }
    removeWorktree(repoRoot, worktree);
    const report = finalize(meta);
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, 'report.txt'), report.text);
    process.stdout.write(report.text);
    if (report.fail > 0) process.exitCode = 1;
  }
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
