// §5 — description → structured blocks (text | bullet | table).
// Design Ref: §3.4 — compatible with frontend formatBlocks. Plan SC: SC-3.
const BULLET = /[∙•]/;

function isTableRow(line) {
  return line.split(/[|│]/).length >= 3;
}

function tableCells(line) {
  const cells = line.split(/[|│]/).map(s => s.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

// Returns blocks[] (text/bullet/table) or null when description is empty.
function buildBlocks(description) {
  if (description === null || description === undefined || !String(description).trim()) return null;
  const blocks = [];
  let bullets = [];
  let table = [];
  const flushBullets = () => { if (bullets.length) { blocks.push({ type: 'bullet', content: bullets }); bullets = []; } };
  const flushTable = () => { if (table.length) { blocks.push({ type: 'table', content: table }); table = []; } };

  const lines = String(description).split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (BULLET.test(line)) {
      flushTable();
      const segs = line.split(BULLET).map(s => s.trim());
      const lead = segs[0];
      if (lead) { flushBullets(); blocks.push({ type: 'text', content: lead }); }
      for (const b of segs.slice(1)) if (b) bullets.push(b);
    } else if (isTableRow(line)) {
      flushBullets();
      table.push(tableCells(line));
    } else {
      flushBullets();
      flushTable();
      blocks.push({ type: 'text', content: line });
    }
  }
  flushBullets();
  flushTable();
  return blocks.length ? blocks : null;
}

module.exports = { buildBlocks };
