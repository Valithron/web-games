const sourceUrl = new URL('./game.js', import.meta.url);
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`Unable to load Hivefront: ${response.status}`);

let source = await response.text();

function replaceRequired(find, replacement, label) {
  if (!source.includes(find)) throw new Error(`Hivefront patch target missing: ${label}`);
  source = source.replace(find, replacement);
}

const marker = "const LEVELS=Array.from({length:60},(_,i)=>makeLevel(i));";
replaceRequired(
  marker,
  `${marker}\nLEVELS[0]={id:0,stage:1,slot:1,title:TITLES[0],factions:['yellow'],nodes:[{id:'n0',type:'hive',owner:'yellow',units:20,x:.26,y:.55},{id:'n1',type:'hive',owner:'neutral',units:5,x:.74,y:.45}],routes:[{key:'0-1',a:0,b:1}],par:30,expert:15,hint:'Drag from the yellow hive to the gray hive. One order sends half your bees.'};`,
  'level 1 tutorial'
);

replaceRequired(
  "orders:[],ended:false,aiClock:0",
  "orders:[],ended:false,aiClock:3+Math.random()",
  'initial AI delay'
);

replaceRequired(
  "const hostileStructures=state.nodes.some(n=>n.owner!=='yellow');const hostileTransit=state.routes.some(r=>r.units.some(u=>u.owner!=='yellow'))||state.orders.some(o=>o.owner!=='yellow');",
  "const hostileStructures=state.nodes.some(n=>n.owner!=='yellow'&&n.owner!=='neutral');const hostileTransit=state.routes.some(r=>r.units.some(u=>u.owner!=='yellow'&&u.owner!=='neutral'))||state.orders.some(o=>o.owner!=='yellow'&&o.owner!=='neutral');",
  'neutral-safe victory condition'
);

replaceRequired(
  "ctx.arc(p.x,p.y,4.2,0,Math.PI*2)",
  "ctx.arc(p.x,p.y,5.6,0,Math.PI*2)",
  'larger troop rendering'
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
