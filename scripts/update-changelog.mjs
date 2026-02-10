import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const CHANGELOG_PATH = 'changelog.ts';

function parseArgs(argv) {
  const args = {
    messagesFile: '',
    fromGit: false,
    limit: 20,
    offset: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--messages-file') args.messagesFile = argv[i + 1] || '';
    if (arg === '--from-git') args.fromGit = true;
    if (arg === '--limit') args.limit = Number(argv[i + 1] || 20);
    if (arg === '--offset') args.offset = Number(argv[i + 1] || 0);
  }

  return args;
}

function cleanMessage(raw) {
  return String(raw || '').split('\n')[0].trim();
}

function normalizeMessage(message) {
  if (!message) return '';
  let value = message.trim();
  if (!/[.!?]$/.test(value)) value = `${value}.`;
  return value;
}

function isSkippable(message) {
  const lower = message.toLowerCase();
  return (
    !message ||
    lower.startsWith('merge ') ||
    lower.startsWith('chore(changelog):') ||
    lower.includes('[skip changelog]')
  );
}

function getMessagesFromGit(limit, offset) {
  const cmd = `git log --skip ${offset} -n ${limit} --pretty=format:'%H%x09%s'`;
  const output = execSync(cmd, { encoding: 'utf8' }).trim();
  if (!output) return [];

  return output
    .split('\n')
    .map((line) => {
      const [hash, ...rest] = line.split('\t');
      return { id: hash, message: cleanMessage(rest.join('\t')) };
    })
    .filter((item) => !isSkippable(item.message));
}

async function getMessagesFromFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      if (typeof item === 'string') {
        return { id: '', message: cleanMessage(item) };
      }
      return {
        id: String(item.id || ''),
        message: cleanMessage(item.message || ''),
      };
    })
    .filter((item) => !isSkippable(item.message));
}

function getNextVersion(content) {
  const match = content.match(/version:\s*'v(\d+)\.(\d+)\.(\d+)'/);
  if (!match) return 'v1.0.0';
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `v${major}.${minor}.${patch}`;
}

function getTodayTR() {
  const formatter = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(new Date()).replace(/\//g, '.');
}

function buildEntry(version, dateStr, notes) {
  const notesBlock = notes.map((n) => `      '${n.replace(/'/g, "\\'")}'`).join(',\n');
  return [
    '  {',
    `    version: '${version}',`,
    `    date: '${dateStr}',`,
    '    notes: [',
    notesBlock,
    '    ]',
    '  },',
  ].join('\n');
}

function insertEntry(content, entry) {
  const marker = 'export const changelog: Version[] = [';
  const index = content.indexOf(marker);
  if (index < 0) {
    throw new Error('changelog array marker not found in changelog.ts');
  }

  const insertPos = index + marker.length;
  return `${content.slice(0, insertPos)}\n${entry}${content.slice(insertPos)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let commits = [];

  if (args.messagesFile) {
    commits = await getMessagesFromFile(args.messagesFile);
  } else if (args.fromGit) {
    commits = getMessagesFromGit(args.limit, args.offset);
  } else {
    console.log('No input provided. Use --messages-file or --from-git.');
    process.exit(0);
  }

  const seen = new Set();
  const uniqueMessages = commits
    .map((c) => normalizeMessage(c.message))
    .filter((m) => {
      if (!m || seen.has(m)) return false;
      seen.add(m);
      return true;
    });

  if (uniqueMessages.length === 0) {
    console.log('No eligible commit messages found.');
    process.exit(0);
  }

  const changelog = await readFile(CHANGELOG_PATH, 'utf8');
  const version = getNextVersion(changelog);
  const dateStr = getTodayTR();
  const entry = buildEntry(version, dateStr, uniqueMessages);
  const updated = insertEntry(changelog, entry);

  await writeFile(CHANGELOG_PATH, updated, 'utf8');
  console.log(`Updated ${CHANGELOG_PATH} with ${version} (${uniqueMessages.length} notes).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
