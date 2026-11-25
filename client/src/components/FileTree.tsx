import { useState } from 'react';
import { ancestors, type TreeEntry } from '../tree';

type Props = {
  entries: TreeEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
};

export function FileTree({ entries, selectedPath, onSelect }: Props) {
  // Open the directories leading to a file selected before the tree loaded.
  const [expanded, setExpanded] = useState(() => new Set(selectedPath ? ancestors(selectedPath) : []));

  const toggle = (path: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  };

  const renderEntries = (items: TreeEntry[], depth: number) => (
    <ul role={depth === 0 ? 'tree' : 'group'} aria-label={depth === 0 ? 'Files' : undefined}>
      {items.map((entry) => {
        const indent = { paddingLeft: `${depth * 12 + 8}px` };
        const rowClass = 'flex w-full items-center gap-1 truncate py-0.5 pr-2 text-left';

        if (entry.kind === 'directory') {
          const isOpen = expanded.has(entry.path);
          return (
            <li key={entry.path} role="treeitem" aria-expanded={isOpen}>
              <button
                type="button"
                onClick={() => toggle(entry.path)}
                className={`${rowClass} hover:bg-zinc-200 dark:hover:bg-zinc-800`}
                style={indent}
              >
                <span aria-hidden className="w-3 shrink-0 text-zinc-500">
                  {isOpen ? '▾' : '▸'}
                </span>
                <span className="truncate">{entry.name}</span>
              </button>
              {isOpen && renderEntries(entry.children, depth + 1)}
            </li>
          );
        }

        if (entry.kind === 'submodule') {
          return (
            <li key={entry.path} role="treeitem" title="Submodule">
              <span className={`${rowClass} text-zinc-500`} style={indent}>
                <span aria-hidden className="w-3 shrink-0">⇲</span>
                <span className="truncate">{entry.name}</span>
              </span>
            </li>
          );
        }

        const isSelected = entry.path === selectedPath;
        return (
          <li key={entry.path} role="treeitem" aria-selected={isSelected}>
            <button
              type="button"
              onClick={() => onSelect(entry.path)}
              className={`${rowClass} ${
                isSelected
                  ? 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
              style={indent}
            >
              <span aria-hidden className="w-3 shrink-0" />
              <span className="truncate">{entry.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return <nav className="py-1 text-sm">{renderEntries(entries, 0)}</nav>;
}
