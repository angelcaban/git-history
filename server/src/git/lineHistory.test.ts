import { parseLineLog } from './lineHistory.js';

const header = (sha: string, parents: string, summary: string) =>
  `\x1e${[sha, parents, 'Ann', 'ann@example.com', '2024-01-02T03:04:05+02:00', 'Cy', 'cy@example.com', '2024-01-02T03:04:05+02:00', summary].join('\x1f')}\n`;

describe('parseLineLog', () => {
  it('parses commits, file headers, and numbered hunk lines', () => {
    const output =
      header('a'.repeat(40), 'b'.repeat(40), 'Change it') +
      '\n' +
      'diff --git a/old.txt b/new.txt\n' +
      '--- a/old.txt\n' +
      '+++ b/new.txt\n' +
      '@@ -3,2 +3,2 @@\n' +
      ' keep\n' +
      '--- looks like a header\n' +
      '+replacement\n' +
      '\\ No newline at end of file\n' +
      header('b'.repeat(40), '', 'Start') +
      '\n' +
      'diff --git a/old.txt b/old.txt\n' +
      '--- /dev/null\n' +
      '+++ b/old.txt\n' +
      '@@ -0,0 +3 @@\n' +
      '+keep\n';

    const [first, second] = parseLineLog(output);

    expect(first).toMatchObject({
      sha: 'a'.repeat(40),
      parents: ['b'.repeat(40)],
      summary: 'Change it',
      author: { name: 'Ann', email: 'ann@example.com', date: '2024-01-02T01:04:05.000Z' },
      path: 'new.txt',
      previousPath: 'old.txt',
    });
    expect(first!.hunks).toEqual([
      {
        oldStart: 3,
        oldLines: 2,
        newStart: 3,
        newLines: 2,
        lines: [
          { type: 'context', content: 'keep', oldLineNumber: 3, newLineNumber: 3 },
          { type: 'removed', content: '-- looks like a header', oldLineNumber: 4, newLineNumber: null },
          { type: 'added', content: 'replacement', oldLineNumber: null, newLineNumber: 4 },
        ],
      },
    ]);
    expect(second).toMatchObject({ parents: [], path: 'old.txt', previousPath: null });
    expect(second!.hunks[0]).toMatchObject({ newStart: 3, newLines: 1 });
  });

  it('unquotes paths with special characters', () => {
    const output = header('c'.repeat(40), '', 'Accents') + '--- a/"caf\\303\\251 \\"x\\".txt"\n+++ "b/caf\\303\\251 \\"x\\".txt"\n';

    expect(parseLineLog(output)[0]).toMatchObject({ path: 'café "x".txt' });
  });
});
