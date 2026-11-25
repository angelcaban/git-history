/**
 * Lays out a commit graph in lanes, like `git log --graph`. Commits must be listed
 * children before parents (newest first). Each row is drawn independently:
 *
 * - `through`: a lane passing this row from top to bottom
 * - `top`:     a lane arriving at this row's commit from above (from -> column)
 * - `bottom`:  a line leaving the commit towards a parent below (column -> to)
 */
export type GraphEdge = { part: 'through' | 'top' | 'bottom'; from: number; to: number };

export type GraphRow = { column: number; edges: GraphEdge[] };

export type GraphLayout = { rows: GraphRow[]; lanes: number };

export function layoutGraph(commits: { sha: string; parents: string[] }[]): GraphLayout {
  // The commit each lane is heading towards; null for a free lane.
  const lanes: (string | null)[] = [];
  const rows: GraphRow[] = [];
  let maxLanes = 0;

  const freeLane = () => {
    const free = lanes.indexOf(null);
    if (free !== -1) return free;
    lanes.push(null);
    return lanes.length - 1;
  };

  for (const commit of commits) {
    // A commit with no child in the list (a branch tip) starts in a free lane.
    let column = lanes.indexOf(commit.sha);
    if (column === -1) column = freeLane();

    const edges: GraphEdge[] = [];
    lanes.forEach((sha, lane) => {
      if (sha === commit.sha) edges.push({ part: 'top', from: lane, to: column });
      else if (sha !== null) edges.push({ part: 'through', from: lane, to: lane });
    });
    for (let lane = 0; lane < lanes.length; lane++) {
      if (lanes[lane] === commit.sha) lanes[lane] = null;
    }

    commit.parents.forEach((parent, index) => {
      let lane = lanes.indexOf(parent);
      if (lane === -1) {
        // The first parent continues the commit's own lane; others branch off.
        lane = index === 0 ? column : freeLane();
        lanes[lane] = parent;
      }
      edges.push({ part: 'bottom', from: column, to: lane });
    });

    while (lanes.length > 0 && lanes.at(-1) === null) lanes.pop();
    maxLanes = Math.max(maxLanes, column + 1, ...edges.map((edge) => Math.max(edge.from, edge.to) + 1));
    rows.push({ column, edges });
  }

  return { rows, lanes: maxLanes };
}
