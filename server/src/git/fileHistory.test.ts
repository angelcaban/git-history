import { parseFileLog, parseRenameSource } from './fileHistory.js';

const header = (sha: string, parents: string, summary: string) =>
  `\x1e${[sha, parents, 'Ann', 'ann@example.com', '2024-01-02T03:04:05+02:00', 'Cy', 'cy@example.com', '2024-01-02T03:04:05+02:00', summary].join('\x1f')}\n`;

const [A, B, C, D, E] = ['a', 'b', 'c', 'd', 'e'].map((ch) => ch.repeat(40)) as [string, string, string, string, string];

describe('parseFileLog', () => {
  it('reads commits, rewritten parents, and the path in each commit', () => {
    const output =
      header(A, B, 'Edit') +
      '\nM\tsrc/main.ts\n' +
      header(B, C, 'Rename') +
      '\nR100\tsrc/app.ts\tsrc/main.ts\n' +
      header(C, '', 'Start') +
      '\nA\tsrc/app.ts\n';

    expect(parseFileLog(output, ['src/main.ts', 'src/app.ts'])).toEqual([
      {
        sha: A,
        parents: [B],
        author: { name: 'Ann', email: 'ann@example.com', date: '2024-01-02T01:04:05.000Z' },
        committer: { name: 'Cy', email: 'cy@example.com', date: '2024-01-02T01:04:05.000Z' },
        summary: 'Edit',
        path: 'src/main.ts',
        added: false,
      },
      expect.objectContaining({ sha: B, parents: [C], path: 'src/main.ts', added: false }),
      expect.objectContaining({ sha: C, parents: [], path: 'src/app.ts', added: true }),
    ]);
  });

  it("gives merges their first parent's path", () => {
    const output =
      header(A, `${B} ${C}`, 'Merge') +
      '\n' +
      header(B, D, 'Main side') +
      '\nM\tnew.txt\n' +
      header(C, D, 'Feature side') +
      '\nM\tnew.txt\n' +
      header(D, '', 'Start') +
      '\nA\tnew.txt\n';

    const entries = parseFileLog(output, ['new.txt']);

    expect(entries.map((entry) => [entry.sha, entry.parents, entry.path])).toEqual([
      [A, [B, C], 'new.txt'],
      [B, [D], 'new.txt'],
      [C, [D], 'new.txt'],
      [D, [], 'new.txt'],
    ]);
  });

  it('ignores other files a commit changed with a tracked one', () => {
    const output = header(E, '', 'Both') + '\nA\tother.txt\nA\t"caf\\303\\251.txt"\n';

    expect(parseFileLog(output, ['café.txt'])[0]).toMatchObject({ path: 'café.txt', added: true });
  });
});

describe('parseRenameSource', () => {
  it('finds the path a file was renamed from', () => {
    const output = 'M\tREADME.md\nR087\tsrc/app.ts\tsrc/main.ts\n';

    expect(parseRenameSource(output, 'src/main.ts')).toBe('src/app.ts');
    expect(parseRenameSource(output, 'README.md')).toBeNull();
  });
});
