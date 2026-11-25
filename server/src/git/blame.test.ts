import { parseBlamePorcelain } from './blame.js';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

function commitFields(name: string, summary: string, filename: string) {
  return [
    `author ${name}`,
    `author-mail <${name.toLowerCase()}@example.com>`,
    'author-time 1700000000',
    'author-tz +0000',
    `committer ${name}`,
    `committer-mail <${name.toLowerCase()}@example.com>`,
    'committer-time 1700000000',
    'committer-tz +0000',
    `summary ${summary}`,
    `filename ${filename}`,
  ];
}

describe('parseBlamePorcelain', () => {
  it('gives every line in a group the filename printed on its first line', () => {
    const output = [
      `${A} 5 1 2`,
      ...commitFields('Ann', 'first', 'old/main.ts'),
      '\tkeep5',
      `${A} 6 2`,
      '\tkeep6',
      `${B} 3 3 1`,
      ...commitFields('Bob', 'moved', 'src/main.ts'),
      '\tnew',
      '',
    ].join('\n');

    const { lines, commits } = parseBlamePorcelain(output);

    expect(lines).toEqual([
      { lineNumber: 1, content: 'keep5', sha: A, originalLineNumber: 5, originalPath: 'old/main.ts' },
      { lineNumber: 2, content: 'keep6', sha: A, originalLineNumber: 6, originalPath: 'old/main.ts' },
      { lineNumber: 3, content: 'new', sha: B, originalLineNumber: 3, originalPath: 'src/main.ts' },
    ]);
    expect(Object.keys(commits)).toEqual([A, B]);
    expect(commits[A]).toMatchObject({ summary: 'first', author: { name: 'Ann', email: 'ann@example.com' } });
  });

  it('takes the filename from a later group of an already-seen commit', () => {
    const output = [
      `${A} 1 1 1`,
      ...commitFields('Ann', 'first', 'a.ts'),
      '\tone',
      `${B} 2 2 1`,
      ...commitFields('Bob', 'second', 'b.ts'),
      '\ttwo',
      `${A} 9 3 1`,
      'filename a.ts',
      '\tthree',
      '',
    ].join('\n');

    expect(parseBlamePorcelain(output).lines.map((line) => line.originalPath)).toEqual(['a.ts', 'b.ts', 'a.ts']);
  });
});
