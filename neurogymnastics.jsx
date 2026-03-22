import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// GESTURES
// ─────────────────────────────────────────────────────────────────────────────
const ALL_GESTURES = [
  { id:"rock",     label:"🤘", name:"Рок"       },
  { id:"paper",    label:"🖐", name:"Ладонь"    },
  { id:"scissors", label:"✌", name:"Ножницы"   },
  { id:"point",    label:"☝", name:"Указатель" },
  { id:"ok",       label:"👌", name:"ОК"        },
  { id:"fist",     label:"✊", name:"Кулак"     },
  { id:"shaka",    label:"🤙", name:"Шака"      },
];

// These are forward-aliases — real defs come after LEVELS block
let COLOR_MAP, SHAPE_ICONS, SHAPE_NAMES;

// ─────────────────────────────────────────────────────────────────────────────
// LEVELS
// gestureCnt = число кубиков/поз:
//   ур.1 → 3,  ур.2-3 → 4,  ур.4-6 → 5,  ур.7-9 → 6,  ур.10 → 7
// poseBy:"color" → gestureCnt цветов используется как ключи
// poseBy:"shape" → gestureCnt форм используется как ключи
// Для поз по форме нужно 5-7 форм — добавляем "diamond" и "star"
// ─────────────────────────────────────────────────────────────────────────────

// Расширенный список форм (для высоких уровней с poseBy:"shape")
// Дополнительные цвета для высоких уровней с poseBy:"color" (5-7 цветов)
// Мы используем 4 базовых цвета + добавляем red, yellow, teal для 5,6,7
const COLOR_MAP_EXT = {
  orange: { bg:"#FF8C42", label:"Оранжевый" },
  blue:   { bg:"#4DBDE8", label:"Синий"     },
  green:  { bg:"#5DC86B", label:"Зелёный"   },
  purple: { bg:"#8B6FCE", label:"Фиолетовый"},
  red:    { bg:"#E85454", label:"Красный"   },
  yellow: { bg:"#F5C842", label:"Жёлтый"    },
  teal:   { bg:"#3ECFB2", label:"Бирюзовый" },
};

const SHAPE_ICONS_EXT = { circle:"●", square:"■", pentagon:"⬠", triangle:"▲", diamond:"◆", star:"★", hexagon:"⬡" };
const SHAPE_NAMES_EXT = { circle:"Круг", square:"Квадрат", pentagon:"Пятиугол.", triangle:"Треугольник", diamond:"Ромб", star:"Звезда", hexagon:"Шестиугол." };

const LEVELS = [
  // Ур.1 — 3 позы по цвету (3 цвета), форма одна декоративная
  { id:1,  poseBy:"color", colors:["orange","blue","green"],                         shapes:["circle"],                               gridW:3, gridH:2, gestureCnt:3 },
  // Ур.2 — 4 позы по цвету (4 цвета)
  { id:2,  poseBy:"color", colors:["orange","blue","green","purple"],                shapes:["circle","square"],                      gridW:3, gridH:3, gestureCnt:4 },
  // Ур.3 — 4 позы по форме (4 формы)
  { id:3,  poseBy:"shape", colors:["orange","blue","green"],                         shapes:["circle","square","triangle","pentagon"], gridW:4, gridH:3, gestureCnt:4 },
  // Ур.4 — 5 поз по цвету (5 цветов)
  { id:4,  poseBy:"color", colors:["orange","blue","green","purple","red"],          shapes:["circle","square","triangle"],           gridW:4, gridH:3, gestureCnt:5 },
  // Ур.5 — 5 поз по форме (5 форм)
  { id:5,  poseBy:"shape", colors:["orange","blue","green","purple"],                shapes:["circle","square","pentagon","triangle","diamond"], gridW:4, gridH:4, gestureCnt:5 },
  // Ур.6 — 5 поз по цвету (5 цветов)
  { id:6,  poseBy:"color", colors:["orange","blue","green","purple","yellow"],       shapes:["circle","square","pentagon","triangle"], gridW:4, gridH:4, gestureCnt:5 },
  // Ур.7 — 6 поз по форме (6 форм)
  { id:7,  poseBy:"shape", colors:["orange","blue","green","purple"],                shapes:["circle","square","pentagon","triangle","diamond","star"], gridW:5, gridH:4, gestureCnt:6 },
  // Ур.8 — 6 поз по цвету (6 цветов)
  { id:8,  poseBy:"color", colors:["orange","blue","green","purple","red","yellow"], shapes:["circle","square","pentagon","triangle"], gridW:5, gridH:5, gestureCnt:6 },
  // Ур.9 — 6 поз по форме (6 форм)
  { id:9,  poseBy:"shape", colors:["orange","blue","green","purple"],                shapes:["circle","square","pentagon","triangle","diamond","star"], gridW:5, gridH:5, gestureCnt:6 },
  // Ур.10 — 7 поз по цвету (7 цветов)
  { id:10, poseBy:"color", colors:["orange","blue","green","purple","red","yellow","teal"], shapes:["circle","square","pentagon","triangle","diamond"], gridW:6, gridH:6, gestureCnt:7 },
];

// Assign aliases after extended defs
COLOR_MAP   = COLOR_MAP_EXT;
SHAPE_ICONS = SHAPE_ICONS_EXT;
SHAPE_NAMES = SHAPE_NAMES_EXT;

// ─────────────────────────────────────────────────────────────────────────────
// SNAKE PATH — generates a winding board path across gridW×gridH
// Returns array of {col, row} in visit order (snake + random bends)
// ─────────────────────────────────────────────────────────────────────────────
function buildSnakePath(gridW, gridH, lvId) {
  const total = gridW * gridH;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  const visited = Array.from({length:gridH}, ()=>Array(gridW).fill(false));

  // Count unvisited neighbours — used for Warnsdorff heuristic
  const freeNeighbours = (col, row) => {
    let cnt = 0;
    for (const [dc,dr] of dirs) {
      const nc=col+dc, nr=row+dr;
      if (nc>=0&&nc<gridW&&nr>=0&&nr<gridH&&!visited[nr][nc]) cnt++;
    }
    return cnt;
  };

  // Choose start corner
  const corners = [[0,0],[gridW-1,0],[0,gridH-1],[gridW-1,gridH-1]];
  const [startC, startR] = lvId >= 6
    ? corners[Math.floor(Math.random()*corners.length)]
    : [0, 0];

  const path = [];
  let col = startC, row = startR;
  visited[row][col] = true;
  path.push({col, row});

  while (path.length < total) {
    // Gather unvisited neighbours, shuffle, then sort by Warnsdorff score
    // (prefer cells with fewer onward options — creates winding paths)
    let nbrs = [];
    for (const [dc,dr] of dirs) {
      const nc=col+dc, nr=row+dr;
      if (nc>=0&&nc<gridW&&nr>=0&&nr<gridH&&!visited[nr][nc]) {
        nbrs.push({col:nc,row:nr,score:freeNeighbours(nc,nr)});
      }
    }
    if (nbrs.length === 0) break; // dead end — shouldn't happen with Warnsdorff on grid

    // Shuffle first (for randomness among equal scores), then stable sort by score asc
    nbrs.sort(()=>Math.random()-0.5);
    nbrs.sort((a,b)=>a.score-b.score);

    // On lower levels pick lowest score (most winding); on higher levels add randomness
    let chosen;
    if (lvId <= 3) {
      chosen = nbrs[0];
    } else {
      // Pick among the 1-2 lowest-score options randomly for more chaos
      const minScore = nbrs[0].score;
      const candidates = nbrs.filter(n=>n.score<=minScore+1);
      chosen = candidates[Math.floor(Math.random()*candidates.length)];
    }

    col = chosen.col; row = chosen.row;
    visited[row][col] = true;
    path.push({col, row});
  }

  // Fallback: boustrophedon if path incomplete (safety net)
  if (path.length < total) {
    path.length = 0;
    for (let r=0;r<gridH;r++) {
      if (r%2===0) for (let c=0;c<gridW;c++) path.push({col:c,row:r});
      else         for (let c=gridW-1;c>=0;c--) path.push({col:c,row:r});
    }
  }

  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLL DICE
// ─────────────────────────────────────────────────────────────────────────────
function rollDice(level) {
  const keys = level.poseBy==="color" ? level.colors : level.shapes;
  const shuffled = [...ALL_GESTURES].sort(()=>Math.random()-0.5);
  const map = {};
  keys.forEach((k,i)=>{ map[k]=shuffled[i%shuffled.length]; });
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CELLS — no same gesture > maxConsec in a row along the path
// ─────────────────────────────────────────────────────────────────────────────
function buildCells(level, diceMap) {
  const { colors, shapes, gridW, gridH, poseBy, id } = level;
  const total = gridW * gridH;
  const maxConsec = id <= 3 ? 2 : 1;
  const gidOf = (c,s) => (poseBy==="color" ? diceMap[c] : diceMap[s])?.id ?? "x";

  const cells = [];
  let lastGid=null, consec=0;
  for (let i=0;i<total;i++) {
    let c,s,gid,tries=0;
    do {
      c = colors[Math.floor(Math.random()*colors.length)];
      s = shapes[Math.floor(Math.random()*shapes.length)];
      gid = gidOf(c,s);
      tries++;
    } while (gid===lastGid && consec>=maxConsec && tries<60);
    consec = gid===lastGid ? consec+1 : 1;
    lastGid = gid;
    cells.push({color:c,shape:s});
  }
  return cells;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHAPE CELL SVG — with number label
// ─────────────────────────────────────────────────────────────────────────────
function ShapeCell({ color, shape, size=52, tapped, stepNum, isNext, onClick }) {
  const c = COLOR_MAP[color]||{bg:"#ccc"};
  const s = size, a = tapped ? 0.28 : 1;

  const polyPts = (n, rot=0) => Array.from({length:n},(_,i)=>{
    const ang=(Math.PI*2/n)*i+rot;
    return `${(s/2+(s/2-3)*Math.cos(ang)).toFixed(1)},${(s/2+(s/2-3)*Math.sin(ang)).toFixed(1)}`;
  }).join(" ");

  const inner = () => {
    if (shape==="circle")
      return <circle cx={s/2} cy={s/2} r={s/2-2} fill={c.bg} fillOpacity={a}/>;
    if (shape==="square")
      return <rect x={2} y={2} width={s-4} height={s-4} rx={7} fill={c.bg} fillOpacity={a}/>;
    if (shape==="pentagon")
      return <polygon points={polyPts(5,-Math.PI/2)} fill={c.bg} fillOpacity={a}/>;
    if (shape==="triangle")
      return <polygon points={`${s/2},2 ${s-2},${s-2} 2,${s-2}`} fill={c.bg} fillOpacity={a}/>;
    if (shape==="diamond")
      return <polygon points={`${s/2},2 ${s-2},${s/2} ${s/2},${s-2} 2,${s/2}`} fill={c.bg} fillOpacity={a}/>;
    if (shape==="star") {
      const pts = Array.from({length:10},(_,i)=>{
        const ang=(Math.PI*2/10)*i-Math.PI/2;
        const r2 = i%2===0 ? s/2-2 : s/4;
        return `${(s/2+r2*Math.cos(ang)).toFixed(1)},${(s/2+r2*Math.sin(ang)).toFixed(1)}`;
      }).join(" ");
      return <polygon points={pts} fill={c.bg} fillOpacity={a}/>;
    }
    if (shape==="hexagon")
      return <polygon points={polyPts(6,0)} fill={c.bg} fillOpacity={a}/>;
    return <circle cx={s/2} cy={s/2} r={s/2-2} fill={c.bg} fillOpacity={a}/>;
  };

  const numSize = Math.max(9, s*0.22);
  const ringColor = isNext ? "#fff" : "rgba(255,255,255,0.85)";
  const ringBg = isNext ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.32)";

  return (
    <svg width={s} height={s} onClick={onClick}
      style={{
        cursor: tapped?"default":"pointer",
        transition:"all 0.18s",
        filter: tapped
          ? "grayscale(0.5) brightness(0.85)"
          : isNext
            ? `drop-shadow(0 0 7px #fff) drop-shadow(0 0 12px ${c.bg})`
            : `drop-shadow(0 2px 4px ${c.bg}88)`,
        outline: isNext ? "2.5px solid white" : "none",
        borderRadius: 8,
      }}>
      {inner()}
      {/* step number badge */}
      <circle cx={s*0.82} cy={s*0.18} r={numSize*0.9} fill={ringBg}/>
      <text x={s*0.82} y={s*0.18+numSize*0.34}
        textAnchor="middle" fontSize={numSize} fill={ringColor} fontWeight="900"
        fontFamily="Nunito,Arial,sans-serif">
        {stepNum}
      </text>
      {/* done checkmark */}
      {tapped && (
        <text x={s/2} y={s/2+s*0.14} textAnchor="middle" fontSize={s*0.42}
          fill="white" fontWeight="bold" opacity="0.95">✓</text>
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARROW between two adjacent cells on the snake path
// ─────────────────────────────────────────────────────────────────────────────
function Arrow({ fromCol, fromRow, toCol, toRow, cellSize, gap }) {
  const step = cellSize + gap;
  const fx = fromCol*step + cellSize/2;
  const fy = fromRow*step + cellSize/2;
  const tx = toCol*step + cellSize/2;
  const ty = toRow*step + cellSize/2;

  const dx = tx-fx, dy = ty-fy;
  const len = Math.sqrt(dx*dx+dy*dy);
  const margin = cellSize/2 - 2;
  const sx = fx + dx/len*margin;
  const sy = fy + dy/len*margin;
  const ex = tx - dx/len*margin;
  const ey = ty - dy/len*margin;

  const angle = Math.atan2(dy,dx)*180/Math.PI;

  return (
    <g opacity="0.55">
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#7bc8f0" strokeWidth="2.5" strokeDasharray="4 3"/>
      {/* arrowhead */}
      <polygon
        points={`0,-4 8,0 0,4`}
        fill="#4DBDE8"
        transform={`translate(${ex},${ey}) rotate(${angle})`}
      />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAKE BOARD — renders cells + arrows on an SVG canvas
// ─────────────────────────────────────────────────────────────────────────────
function SnakeBoard({ level, cells, path, tapped, tapCell, nextIdx }) {
  const { gridW, gridH } = level;
  const maxW = Math.min(340, window.innerWidth - 160);
  const cellSize = Math.max(38, Math.floor(maxW / gridW));
  const gap = Math.max(4, Math.floor(cellSize * 0.12));
  const step = cellSize + gap;
  const svgW = gridW * step - gap;
  const svgH = gridH * step - gap;

  return (
    <div style={{ position:"relative", overflowX:"auto", overflowY:"auto" }}>
      <svg width={svgW} height={svgH}
        style={{ display:"block", overflow:"visible" }}>
        {/* Arrows first (behind cells) */}
        {path.map((pos, i) => {
          if (i === 0) return null;
          const prev = path[i-1];
          return <Arrow key={`arr${i}`}
            fromCol={prev.col} fromRow={prev.row}
            toCol={pos.col} toRow={pos.row}
            cellSize={cellSize} gap={gap}/>;
        })}
        {/* Cells */}
        {path.map((pos, i) => {
          const cell = cells[i];
          if (!cell) return null;
          const x = pos.col * step;
          const y = pos.row * step;
          return (
            <foreignObject key={i} x={x} y={y} width={cellSize} height={cellSize}>
              <div xmlns="http://www.w3.org/1999/xhtml">
                <ShapeCell
                  color={cell.color} shape={cell.shape}
                  size={cellSize} tapped={tapped[i]}
                  stepNum={i+1} isNext={i===nextIdx}
                  onClick={()=>!tapped[i] && i===nextIdx && tapCell(i)}
                />
              </div>
            </foreignObject>
          );
        })}
        {/* START / END labels */}
        {path.length > 0 && (() => {
          const s0 = path[0], sE = path[path.length-1];
          return <>
            <text x={s0.col*step+cellSize/2} y={s0.row*step-5}
              textAnchor="middle" fontSize={10} fill="#5DC86B" fontWeight="900">СТАРТ</text>
            <text x={sE.col*step+cellSize/2} y={sE.row*step+cellSize+13}
              textAnchor="middle" fontSize={10} fill="#FF8C42" fontWeight="900">ФИНИШ</text>
          </>;
        })()}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DICE FACE — size prop scales the card
// ─────────────────────────────────────────────────────────────────────────────
function DiceFace({ attrKey, gesture, poseBy, size=64 }) {
  const isColor = poseBy==="color";
  const borderColor = isColor ? (COLOR_MAP[attrKey]?.bg??"#ccc") : "#b0cfe8";
  const dotSize  = Math.round(size * 0.42);
  const emojiSz  = Math.round(size * 0.36);
  const labelSz  = Math.max(6, Math.round(size * 0.13));
  const nameSz   = Math.max(5, Math.round(size * 0.115));
  const pad      = Math.round(size * 0.10);
  const radius   = Math.round(size * 0.20);

  return (
    <div style={{
      background:"white", borderRadius:radius, padding:`${pad}px ${Math.round(pad*1.2)}px`,
      display:"flex", flexDirection:"column", alignItems:"center", gap:Math.round(size*0.04),
      boxShadow:"0 4px 12px rgba(0,0,0,0.11)", minWidth:size,
      border:`${size>50?3:2}px solid ${borderColor}`,
    }}>
      {isColor ? (
        <div style={{width:dotSize,height:dotSize,borderRadius:"50%",background:COLOR_MAP[attrKey]?.bg??"#ccc", flexShrink:0}}/>
      ) : (
        <div style={{width:dotSize,height:dotSize,borderRadius:Math.round(dotSize*0.22),background:"#e0edf7",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:Math.round(dotSize*0.6),color:"#555",fontWeight:900, flexShrink:0}}>
          {SHAPE_ICONS[attrKey]??attrKey}
        </div>
      )}
      <div style={{fontSize:emojiSz,lineHeight:1}}>{gesture?.label}</div>
      <div style={{fontSize:labelSz,color:"#777",fontWeight:700,textAlign:"center",lineHeight:1.2}}>
        {isColor?(COLOR_MAP[attrKey]?.label??attrKey):(SHAPE_NAMES[attrKey]??attrKey)}
      </div>
      <div style={{fontSize:nameSz,color:"#aaa",textAlign:"center"}}>{gesture?.name}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RULES MODAL
// ─────────────────────────────────────────────────────────────────────────────
function RulesModal({ onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,60,120,0.45)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,
      backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:24,padding:"24px 20px",
        maxWidth:360,width:"90%",boxShadow:"0 12px 48px rgba(0,0,0,0.22)"}}
        onClick={e=>e.stopPropagation()}>
        <h2 style={{margin:"0 0 10px",color:"#2d7ab5",fontSize:20,fontWeight:900}}>📖 Правила</h2>
        <div style={{fontSize:12.5,color:"#444",lineHeight:1.75}}>
          <p style={{margin:"0 0 7px"}}>🎲 <b>Бросаются кубики</b> — они показывают позу для каждого цвета или формы.</p>
          <p style={{margin:"0 0 7px"}}>🐍 <b>Путь змейкой</b> — клетки пронумерованы. Нажимай строго по порядку: 1, 2, 3…</p>
          <p style={{margin:"0 0 7px"}}>🎨 На одних уровнях поза по <b>цвету</b>, на других — по <b>форме</b>.</p>
          <p style={{margin:"0 0 7px"}}>☜☞ <b>Активная рука</b> держит позу. Другая рука тычет в клетки.</p>
          <p style={{margin:0}}>🏆 <b>Уровень пройден</b>, когда все клетки отмечены!</p>
        </div>
        <button style={{marginTop:14,width:"100%",
          background:"linear-gradient(90deg,#4DBDE8,#5DC86B)",
          border:"none",borderRadius:20,padding:"10px",color:"white",
          fontWeight:900,fontSize:13,cursor:"pointer"}} onClick={onClose}>
          Понятно! ✓
        </button>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
      <span style={{fontSize:14}}>🤖</span>
      <span style={{fontSize:9.5,color:"#bbb",fontWeight:700,letterSpacing:1}}>Котвицкая</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,    setScreen]    = useState("menu");
  const [levelIdx,  setLevelIdx]  = useState(0);
  const [hand,      setHand]      = useState("left");
  const [diceMap,   setDiceMap]   = useState({});
  const [cells,     setCells]     = useState([]);
  const [path,      setPath]      = useState([]);
  const [tapped,    setTapped]    = useState([]);
  const [nextIdx,   setNextIdx]   = useState(0);
  const [rolling,   setRolling]   = useState(false);
  const [rollDone,  setRollDone]  = useState(false);
  const [showRules, setShowRules] = useState(false);

  const level = LEVELS[levelIdx];

  const startPrep = useCallback((idx, h) => {
    setLevelIdx(idx); setHand(h); setScreen("prep");
    setRollDone(false); setRolling(false);
  }, []);

  const doRoll = useCallback(() => {
    setRolling(true);
    setTimeout(() => {
      const lv  = LEVELS[levelIdx];
      const map = rollDice(lv);
      const p   = buildSnakePath(lv.gridW, lv.gridH, lv.id);
      const c   = buildCells(lv, map);
      setDiceMap(map); setPath(p); setCells(c);
      setTapped(new Array(lv.gridW*lv.gridH).fill(false));
      setNextIdx(0);
      setRolling(false); setRollDone(true);
    }, 900);
  }, [levelIdx]);

  const tapCell = i => {
    if (i !== nextIdx) return;
    setTapped(prev => { const n=[...prev]; n[i]=true; return n; });
    setNextIdx(i+1);
  };

  useEffect(() => {
    if (screen==="game" && tapped.length>0 && tapped.every(Boolean))
      setTimeout(()=>setScreen("win"), 400);
  }, [tapped, screen]);

  // ── MENU ──────────────────────────────────────────────────────────────────
  if (screen==="menu") return (
    <div style={S.root}>
      {showRules&&<RulesModal onClose={()=>setShowRules(false)}/>}
      <div style={S.menuWrap}>
        <div style={{fontSize:48}}>🧠</div>
        <h1 style={S.title}>Нейрогимнастика</h1>
        <div style={S.subtitle}>Тренируй координацию и реакцию!</div>
        <button style={S.rulesBtn} onClick={()=>setShowRules(true)}>📖 Правила игры</button>
        <div style={S.levelGrid}>
          {LEVELS.map((lv,i)=>(
            <button key={lv.id}
              style={{...S.lvBtn,background:i<3?"#5DC86B":i<6?"#4DBDE8":i<9?"#FF8C42":"#8B6FCE"}}
              onClick={()=>startPrep(i,"left")}>
              <div style={S.lvNum}>{lv.id}</div>
              <div style={S.lvSub}>{lv.poseBy==="color"?"🎨":"⬠"} {lv.gestureCnt}🎲</div>
            </button>
          ))}
        </div>
        <Brand/>
      </div>
    </div>
  );

  // ── PREP ──────────────────────────────────────────────────────────────────
  if (screen==="prep") {
    const poseKeys = level.poseBy==="color" ? level.colors : level.shapes;
    const diceSize = Math.round(64 - (level.gestureCnt - 3) * (28 / 4));
    return (
      <div style={S.root}>
        {showRules&&<RulesModal onClose={()=>setShowRules(false)}/>}
        <div style={S.prepWrap}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%"}}>
            <h2 style={S.prepTitle}>Уровень {level.id}</h2>
            <button style={S.rulesBtn} onClick={()=>setShowRules(true)}>📖</button>
          </div>

          <div style={S.poseByBadge}>
            {level.poseBy==="color"?"🎨 Поза зависит от ЦВЕТА":"⬠ Поза зависит от ФОРМЫ"}
          </div>

          <div style={S.handToggle}>
            <span style={S.handLabel}>Активная рука (показывает позу):</span>
            <div style={S.toggle}>
              <button style={{...S.toggleBtn,...(hand==="left"?S.toggleActive:{})}} onClick={()=>setHand("left")}>☜ Левая</button>
              <button style={{...S.toggleBtn,...(hand==="right"?S.toggleActive:{})}} onClick={()=>setHand("right")}>Правая ☞</button>
            </div>
          </div>

          <div style={S.rollArea}>
            {!rollDone ? (
              rolling ? (
                <div style={S.rollingAnim}>
                  {poseKeys.map((_,i)=>(
                    <div key={i} style={{...S.diceSpin,animationDelay:`${i*0.1}s`}}>🎲</div>
                  ))}
                </div>
              ) : (
                <button style={S.rollBtn} onClick={doRoll}>🎲 Бросить кубики</button>
              )
            ) : (
              <>
                <div style={S.diceRow}>
                  {poseKeys.map(k=>(
                    <DiceFace key={k} attrKey={k} gesture={diceMap[k]} poseBy={level.poseBy} size={diceSize}/>
                  ))}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={S.rollBtn} onClick={doRoll}>🔄 Перебросить</button>
                  <button style={S.goBtn} onClick={()=>setScreen("game")}>▶ Старт</button>
                </div>
              </>
            )}
          </div>

          <button style={S.backBtn} onClick={()=>setScreen("menu")}>← Меню</button>
          <Brand/>
        </div>
      </div>
    );
  }

  // ── GAME ──────────────────────────────────────────────────────────────────
  if (screen==="game") {
    const { poseBy, colors, shapes, gestureCnt } = level;
    const poseKeys = poseBy==="color" ? colors : shapes;
    const isLeft   = hand==="left";
    const doneCount = tapped.filter(Boolean).length;

    // Scale dice cards: 3 poses→64px, 7 poses→36px, linear between
    const diceSize = Math.round(64 - (gestureCnt - 3) * (28 / 4));

    const DicePanel = () => (
      <div style={{...S.dicePanel, minWidth: diceSize + 8}}>
        <div style={{fontSize:9,fontWeight:800,color:"#4DBDE8",marginBottom:3,
          textTransform:"uppercase",letterSpacing:1,textAlign:"center"}}>
          {isLeft?"☜ Левая":"Правая ☞"}
        </div>
        {poseKeys.map(k=>(
          <DiceFace key={k} attrKey={k} gesture={diceMap[k]} poseBy={poseBy} size={diceSize}/>
        ))}
      </div>
    );

    return (
      <div style={S.root}>
        {showRules&&<RulesModal onClose={()=>setShowRules(false)}/>}
        <div style={S.gameHeader}>
          <span style={S.gameTitle}>Ур. {level.id}</span>
          <span style={S.poseBySmall}>{poseBy==="color"?"🎨 цвет":"⬠ форма"}</span>
          <span style={S.progress}>{doneCount}/{cells.length}</span>
          <button style={{...S.backBtn,padding:"3px 9px",fontSize:11}} onClick={()=>setShowRules(true)}>📖</button>
        </div>

        <div style={S.handHint}>
          {isLeft
            ? "☜ Левая держит позу · Правая ☞ тычет по порядку"
            : "☞ Правая держит позу · Левая ☜ тычет по порядку"}
        </div>

        <div style={S.gameRow}>
          {isLeft && <DicePanel/>}
          <div style={{flex:1,display:"flex",justifyContent:"center",overflowX:"auto"}}>
            <SnakeBoard
              level={level} cells={cells} path={path}
              tapped={tapped} tapCell={tapCell} nextIdx={nextIdx}
            />
          </div>
          {!isLeft && <DicePanel/>}
        </div>

        <div style={{display:"flex",gap:9,marginTop:10}}>
          <button style={S.backBtn} onClick={()=>setScreen("prep")}>← Назад</button>
          <button style={S.backBtn} onClick={()=>setScreen("menu")}>☰ Меню</button>
        </div>
        <Brand/>
      </div>
    );
  }

  // ── WIN ───────────────────────────────────────────────────────────────────
  if (screen==="win") {
    const nextIdx2 = levelIdx<LEVELS.length-1 ? levelIdx+1 : null;
    return (
      <div style={S.root}>
        <div style={S.winWrap}>
          <div style={{fontSize:64}}>🏆</div>
          <h2 style={S.winTitle}>Уровень пройден!</h2>
          <div style={S.winSub}>Уровень {level.id} завершён! Отлично!</div>
          <div style={S.winBtns}>
            {nextIdx2!==null&&(
              <button style={S.playBtn} onClick={()=>startPrep(nextIdx2,hand)}>▶ Следующий уровень</button>
            )}
            <button style={S.goBtn} onClick={()=>setScreen("menu")}>☰ Все уровни</button>
          </div>
          <Brand/>
        </div>
      </div>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  root:{
    minHeight:"100vh",
    background:"linear-gradient(135deg,#d0eeff 0%,#e8f8ff 55%,#c5f0d8 100%)",
    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
    fontFamily:"'Nunito','Comic Sans MS',cursive,sans-serif",
    padding:"12px 8px",boxSizing:"border-box",
  },
  menuWrap:{
    display:"flex",flexDirection:"column",alignItems:"center",gap:11,
    background:"white",borderRadius:28,padding:"22px 18px",
    boxShadow:"0 8px 40px rgba(77,189,232,0.18)",maxWidth:400,width:"100%",
  },
  title:{ margin:0,fontSize:24,color:"#2d7ab5",fontWeight:900,letterSpacing:1 },
  subtitle:{ color:"#5DC86B",fontWeight:700,fontSize:12,textAlign:"center" },
  rulesBtn:{
    background:"#f0f8ff",border:"2px solid #c0e0f8",borderRadius:18,
    padding:"6px 14px",color:"#4DBDE8",fontWeight:800,fontSize:12,cursor:"pointer",
  },
  levelGrid:{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,width:"100%" },
  lvBtn:{
    border:"none",borderRadius:11,padding:"8px 2px",cursor:"pointer",
    color:"white",fontWeight:800,display:"flex",flexDirection:"column",alignItems:"center",gap:2,
    boxShadow:"0 3px 10px rgba(0,0,0,0.13)",
  },
  lvNum:{ fontSize:18,lineHeight:1 },
  lvSub:{ fontSize:7,opacity:0.9,textAlign:"center" },

  prepWrap:{
    display:"flex",flexDirection:"column",alignItems:"center",gap:12,
    background:"white",borderRadius:28,padding:"20px 16px",
    boxShadow:"0 8px 40px rgba(77,189,232,0.18)",maxWidth:440,width:"100%",
  },
  prepTitle:{ margin:0,color:"#2d7ab5",fontSize:20,fontWeight:900 },
  poseByBadge:{
    background:"linear-gradient(90deg,#e8f8ff,#eaffef)",
    border:"2px solid #b0dff0",borderRadius:13,
    padding:"6px 14px",fontSize:12.5,fontWeight:800,color:"#2d7ab5",textAlign:"center",
  },
  handLabel:{ color:"#888",fontSize:11.5,fontWeight:700 },
  handToggle:{ display:"flex",flexDirection:"column",alignItems:"center",gap:5 },
  toggle:{ display:"flex",gap:6 },
  toggleBtn:{
    border:"2px solid #4DBDE8",borderRadius:20,padding:"5px 13px",
    background:"white",color:"#4DBDE8",fontWeight:800,cursor:"pointer",fontSize:12,
    transition:"all 0.2s",
  },
  toggleActive:{ background:"#4DBDE8",color:"white" },
  rollArea:{ display:"flex",flexDirection:"column",alignItems:"center",gap:10,width:"100%" },
  rollBtn:{
    background:"linear-gradient(90deg,#FF8C42,#FFB347)",border:"none",
    borderRadius:22,padding:"10px 24px",color:"white",fontWeight:900,
    fontSize:15,cursor:"pointer",boxShadow:"0 4px 14px rgba(255,140,66,0.28)",
  },
  rollingAnim:{ display:"flex",gap:9,fontSize:30 },
  diceSpin:{ animation:"spin 0.5s linear infinite",display:"inline-block" },
  diceRow:{ display:"flex",flexWrap:"wrap",gap:7,justifyContent:"center" },
  goBtn:{
    background:"linear-gradient(90deg,#5DC86B,#4DBDE8)",border:"none",
    borderRadius:22,padding:"10px 22px",color:"white",fontWeight:900,
    fontSize:14,cursor:"pointer",boxShadow:"0 4px 14px rgba(77,189,232,0.26)",
  },
  backBtn:{
    background:"#f0f8ff",border:"2px solid #c0e0f8",borderRadius:16,
    padding:"5px 12px",color:"#4DBDE8",fontWeight:700,fontSize:11,cursor:"pointer",
  },

  gameHeader:{
    display:"flex",alignItems:"center",justifyContent:"space-between",
    width:"100%",maxWidth:660,marginBottom:4,gap:5,
  },
  gameTitle:{ fontSize:15,fontWeight:900,color:"#2d7ab5" },
  poseBySmall:{
    fontSize:10,fontWeight:800,color:"#2d7ab5",
    background:"#e8f4ff",borderRadius:9,padding:"2px 7px",
  },
  progress:{
    fontSize:12,fontWeight:800,color:"#FF8C42",
    background:"#fff3e6",borderRadius:11,padding:"2px 9px",
  },
  gameRow:{
    display:"flex",alignItems:"flex-start",gap:8,width:"100%",maxWidth:660,
    justifyContent:"center",
  },
  dicePanel:{
    display:"flex",flexDirection:"column",gap:5,alignItems:"center",
    background:"rgba(255,255,255,0.8)",borderRadius:16,padding:"7px 5px",
    boxShadow:"0 4px 16px rgba(77,189,232,0.11)",minWidth:72,flexShrink:0,
  },
  handHint:{
    fontSize:10.5,color:"#5a8aaa",fontWeight:700,textAlign:"center",
    background:"rgba(255,255,255,0.65)",borderRadius:9,padding:"3px 9px",
    marginBottom:4,maxWidth:380,
  },

  winWrap:{
    display:"flex",flexDirection:"column",alignItems:"center",gap:11,
    background:"white",borderRadius:28,padding:"30px 22px",
    boxShadow:"0 8px 40px rgba(93,198,107,0.22)",maxWidth:340,width:"100%",
  },
  winTitle:{ margin:0,fontSize:24,color:"#5DC86B",fontWeight:900 },
  winSub:{ color:"#888",fontSize:12.5,textAlign:"center" },
  winBtns:{ display:"flex",flexDirection:"column",gap:8,width:"100%" },
  playBtn:{
    background:"linear-gradient(90deg,#5DC86B,#4DBDE8)",border:"none",
    borderRadius:22,padding:"11px",color:"white",fontWeight:900,
    fontSize:13,cursor:"pointer",boxShadow:"0 4px 14px rgba(93,198,107,0.28)",
  },
};

const _st = document.createElement("style");
_st.textContent=`
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  button:active{transform:scale(0.96)!important}
`;
document.head.appendChild(_st);
