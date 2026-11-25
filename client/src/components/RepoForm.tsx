import type { FormEvent } from 'react';

type Props = {
  initialUrl: string;
  onSubmit: (url: string) => void;
};

export function RepoForm({ initialUrl, onSubmit }: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = String(new FormData(event.currentTarget).get('url') ?? '').trim();
    if (url) onSubmit(url);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 gap-2">
      <input
        // Remount when the URL changes through navigation so the field shows it.
        key={initialUrl}
        name="url"
        type="text"
        defaultValue={initialUrl}
        placeholder="https://github.com/owner/repo.git"
        aria-label="Repository URL"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-700"
      >
        Open
      </button>
    </form>
  );
}
