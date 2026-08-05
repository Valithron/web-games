const sourceUrl = new URL('./game.js', import.meta.url);
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`Unable to load Hivefront: ${response.status}`);

let source = await response.text();
const marker = "const LEVELS=Array.from({length:60},(_,i)=>makeLevel(i));";
const replacement = `${marker}\nLEVELS[0]={id:0,stage:1,slot:1,title:TITLES[0],factions:['yellow'],nodes:[{id:'n0',type:'hive',owner:'yellow',units:20,x:.26,y:.55},{id:'n1',type:'hive',owner:'neutral',units:5,x:.74,y:.45}],routes:[{key:'0-1',a:0,b:1}],par:30,expert:15,hint:'Drag from the yellow hive to the gray hive. One order sends half your bees.'};`;

if (!source.includes(marker)) throw new Error('Hivefront level marker was not found.');
source = source.replace(marker, replacement);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
