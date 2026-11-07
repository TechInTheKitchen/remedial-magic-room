'use strict';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.hash.slice(1));
let role, socket, hostId = params.get('host'), token = params.get('token'), myPeer;
let iceServers = [], players = {}, active = false, signalSent = 0, signalReceived = 0, gameMessages = 0;
const peers = new Map();
let localId;try{localId=sessionStorage.getItem('rooms-character-id');if(!localId){localId=crypto.randomUUID();sessionStorage.setItem('rooms-character-id',localId);}}catch{localId=crypto.randomUUID();}
let SAVE_KEY='remedial-magic-rooms-v2-'+localId;
const GM_SAVE_KEY='remedial-magic-rooms-gm-v3';
let gmSaved;try{gmSaved=JSON.parse(localStorage.getItem(GM_SAVE_KEY));}catch{}
let saveChoiceMade=false;
let saved;try{saved=JSON.parse(localStorage.getItem(SAVE_KEY));}catch{}
let ownCharacter=null,suspicion=0,tableName='',lastRoomName=saved?.lastRoomName||saved?.tableName||'';
function studentSaves(){
 const records=new Map();
 try{for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key?.startsWith('remedial-magic-rooms-v2-')||key.endsWith('-previous'))continue;
  try{const data=JSON.parse(localStorage.getItem(key));if(data?.role==='gm'||typeof data?.clientId!=='string'||!data.players)continue;
   const student=data.ownCharacter||data.players[data.clientId];if(!student)continue;cleanCharacter(student);
   const old=records.get(data.clientId);if(!old||(data.savedAt||'')>(old.savedAt||''))records.set(data.clientId,{...data,ownCharacter:student});
  }catch{}
 }}catch{}
 return [...records.values()].sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||''));
}
function selectStudentIdentity(id){localId=id;SAVE_KEY='remedial-magic-rooms-v2-'+id;try{sessionStorage.setItem('rooms-character-id',id);}catch{}}
function savePrompt(nextRole,data,candidates=[]){
 return new Promise(resolve=>{
  let selected=data;
  const dialog=document.createElement('dialog');dialog.className='save-dialog';
  const title=document.createElement('h2');title.textContent='Saved '+(nextRole==='host'?'table':'student record')+' found';dialog.append(title);
  if(nextRole!=='host'){
   const name=document.createElement('p'),room=document.createElement('p');
   function showRecord(){const student=selected.ownCharacter||selected.players?.[selected.clientId];name.textContent='Character: '+(student?.name||'Unnamed student');room.textContent='Last connected room: '+(selected.lastRoomName||selected.tableName||'No room recorded');}
   if(candidates.length>1){title.textContent='Choose a saved student record';const label=document.createElement('label');label.textContent='Saved character';const select=document.createElement('select');
    candidates.forEach((record,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=(record.ownCharacter?.name||'Unnamed student')+' — '+(record.lastRoomName||record.tableName||'No room recorded');select.append(option);});select.value=String(Math.max(0,candidates.indexOf(data)));select.onchange=()=>{selected=candidates[Number(select.value)];showRecord();};label.append(select);dialog.append(label);
   }
   showRecord();dialog.append(name,room);
  }
  const text=document.createElement('p');text.textContent='Load your saved progress, or start fresh. Existing characters remain saved.';dialog.append(text);
  let input;
  if(nextRole==='host'){const label=document.createElement('label');label.textContent='Table name';input=document.createElement('input');input.maxLength=80;input.value=$('room-name').value.trim()||data.tableName||'New table';label.append(input);dialog.append(label);}
  function finish(load){if(input){if(!input.value.trim()){input.focus();return;}$('room-name').value=input.value.trim().slice(0,80);}dialog.close();dialog.remove();resolve(load?selected:null);}
  const actions=document.createElement('div');actions.className='actions';const load=document.createElement('button');load.textContent='Load save';load.className='primary';load.onclick=()=>finish(true);const fresh=document.createElement('button');fresh.textContent='Start fresh';fresh.onclick=()=>finish(false);actions.append(load,fresh);dialog.append(actions);
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});document.body.append(dialog);dialog.showModal();
 });
}
async function chooseSaved(nextRole){
 if(saveChoiceMade)return;
 const candidates=nextRole==='host'?[]:studentSaves();
 let data=nextRole==='host'?gmSaved:(candidates.find(record=>record.clientId===localId)||candidates[0]||saved);
 const loaded=data?.players?await savePrompt(nextRole,data,candidates):null;
 const load=!!loaded;if(loaded)data=loaded;
 saveChoiceMade=true;
 if(load){
  tableName=nextRole==='host'?$('room-name').value.trim():typeof data.tableName==='string'?data.tableName.slice(0,80):'';
  players=Object.fromEntries(Object.entries(data.players).map(([id,p])=>[id,cleanCharacter(p)]));suspicion=data.suspicion||0;
  if(nextRole!=='host'){selectStudentIdentity(data.clientId);saved=data;ownCharacter=data.ownCharacter?cleanCharacter(data.ownCharacter):null;lastRoomName=data.lastRoomName||data.tableName||'';}
 }else{if(nextRole!=='host'&&data?.players)selectStudentIdentity(crypto.randomUUID());players={};ownCharacter=null;suspicion=0;tableName='';lastRoomName='';}
}
const colors=['Red','Blue','Green','Brown','White','Purple','Black'];
const schools={
 Evocation:'Release and direct magical force.',
 Conjuration:'Summon, transport, bind, or bring something to hand.',
 Restoration:'Heal, encourage growth, and reshape living things.',
 Transmutation:'Change nonliving forms, materials, and physical properties.',
 Abjuration:'Protect, contain, cleanse, and dispel magic.',
 Enchantment:'Influence minds, create illusions, and reveal hidden information.',
 Necromancy:'Work with death, decay, ghosts, and lingering presences.'
};
const fields={address:'Preferred form of address',school:'Specialty school',color:'Favored starting color',knack:'Background knack',business:'Outstanding business',expedition:'Expedition',notes:'Notes and unfinished business',learned:'What did you learn?',assignment:'Faculty remarks / next assignment'};
function character(name='Student'){return {name,composure:10,level:1,shield:0,components:Object.fromEntries(colors.map(c=>[c,{own:0,loan:0,found:0,extra:0}]))};}
function cleanCharacter(p){
 if(!p||typeof p!=='object'||typeof p.name!=='string')throw Error('Invalid character in save.');
 const r=character(p.name.slice(0,80));
 r.schoolLocked=p.schoolLocked===true;
 if(p.lastRoll&&['ordinary','specialty'].includes(p.lastRoll.kind)&&Array.isArray(p.lastRoll.dice)&&p.lastRoll.dice.length<=12&&p.lastRoll.dice.every(d=>colors.includes(d.color)&&Number.isInteger(d.face)&&d.face>=1&&d.face<=6))r.lastRoll={kind:p.lastRoll.kind,dice:p.lastRoll.dice.map(d=>({color:d.color,face:d.face})),at:typeof p.lastRoll.at==='string'?p.lastRoll.at.slice(0,40):''};
 for(const k of Object.keys(fields))r[k]=typeof p[k]==='string'?p[k].slice(0,4000):'';
 for(const [k,max]of [['composure',10],['level',5],['shield',999]]){const n=p[k]??r[k];if(!Number.isInteger(n)||n<(k==='level'?1:0)||n>max)throw Error('Invalid '+k);r[k]=n;}
 for(const c of colors)for(const k of ['own','loan','found','extra']){const n=p.components?.[c]?.[k]??0;if(!Number.isInteger(n)||n<0||n>999)throw Error('Invalid component count');r.components[c][k]=n;}
 return r;
}
function saveState(){
 if(role==='player'||role==='demo'){if(players[localId])ownCharacter=players[localId];}
 const data={version:3,tableName,lastRoomName,role:role==='host'?'gm':'player',clientId:localId,ownCharacter:role==='host'?null:ownCharacter,players,suspicion,savedAt:new Date().toISOString()};
 const key=role==='host'?GM_SAVE_KEY:SAVE_KEY;
 try{const previous=localStorage.getItem(key);if(previous){const old=JSON.parse(previous);if(JSON.stringify(old.players)!==JSON.stringify(data.players)||old.suspicion!==data.suspicion)localStorage.setItem(key+'-previous',previous);}localStorage.setItem(key,JSON.stringify(data));if(role==='host')gmSaved=data;else saved=data;$('save-status').textContent='Saved on this device · '+new Date().toLocaleTimeString();}catch{$('save-status').textContent='Browser storage unavailable or full. Export a JSON save.';}
 return data;
}
function editCharacter(id,update){if(role==='host'||(role==='player'&&id!==localId))return;if(players[id]?.schoolLocked && ((update.school!==undefined&&update.school!==players[id].school)||update.schoolLocked===false)){status('Your confirmed specialty school is locked.');return;}const next=cleanCharacter({...players[id],...update});if(role==='player'){ownCharacter=next;players[id]=next;saveState();gameSend(peers.get(hostId)?.channel,{type:'sheet',character:next});}else{players[id]=next;snapshot();}}

function status(text) { $('status').textContent = text; }
function counters() { if(!$('counts'))return; $('counts').textContent = `Signaling sent: ${signalSent} · received: ${signalReceived} · game messages: ${gameMessages}`; }
function signaling(message) {
  if (socket?.readyState !== WebSocket.OPEN) throw Error('Signaling is disconnected. Leave and reconnect.');
  socket.send(JSON.stringify(message)); signalSent++; counters();
}
function gameSend(channel, message) {
  if(channel?.readyState === 'open') { channel.send(JSON.stringify(message)); gameMessages++; counters(); }
}
function snapshot() {
  render();
  for (const peer of peers.values()) gameSend(peer.channel, {type:'state', players, suspicion, tableName});
}
function startTable() {
  active = true; $('setup').hidden = true; $('session').hidden = false;
  $('mode').textContent = role === 'demo' ? 'LOCAL TEST · NO NETWORK' : role === 'host' ? 'GM SESSION' : 'PLAYER SESSION';
  $('invite').hidden = role !== 'host';$('invite-qr').hidden=role!=='host'||socket?.readyState!==WebSocket.OPEN;
  $('table-title').textContent=tableName||(role==='host'?'Party tracker':'Your student record');
  render();
}
function bagMix(player){
 const parts=colors.map(color=>{
  const counts=player.components?.[color]||{};
  const total=['own','loan','found','extra'].reduce((sum,key)=>sum+(counts[key]||0),0);
  return total>0?color+' '+total:null;
 }).filter(Boolean);
 return parts.length?'{'+parts.join(' | ')+'}':'Empty bag';
}
function randomBelow(max){
 const limit=Math.floor(4294967296/max)*max,buffer=new Uint32Array(1);let n;
 do{crypto.getRandomValues(buffer);n=buffer[0];}while(n>=limit);return n%max;
}
function drawDice(player,kind){
 const bag=[];
 for(const color of colors)for(const source of ['own','loan','found','extra'])for(let n=0;n<(player.components?.[color]?.[source]||0);n++)bag.push(color);
 const count=Math.min(bag.length,kind==='specialty'?player.level+6:5),dice=[];
 for(let n=0;n<count;n++){const index=randomBelow(bag.length);dice.push({color:bag.splice(index,1)[0],face:randomBelow(6)+1});}
 return {kind,dice,at:new Date().toISOString()};
}
function rollSummary(roll){
 if(!roll?.dice?.length)return 'No dice rolled yet.';
 const faces=Array(6).fill(0),counts={};for(const die of roll.dice){faces[die.face-1]++;counts[die.color]=(counts[die.color]||0)+1;}
 const lead=Math.max(...Object.values(counts)),leaders=Object.keys(counts).filter(c=>counts[c]===lead);
 return `${roll.kind==='specialty'?'Specialty':'Ordinary'}: ${roll.dice.length} dice · Largest match: ${Math.max(...faces)} · ${Object.entries(counts).map(([c,n])=>c+' '+n).join(' | ')} · ${leaders.length>1?'Wild tie: ':'Leading color: '}${leaders.join(' / ')}`;
}
const pipPositions={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function diceView(dice){const tray=document.createElement('div');tray.className='dice-tray';for(const die of dice){const cube=document.createElement('div');cube.className='die die-'+die.color.toLowerCase();cube.setAttribute('role','img');cube.setAttribute('aria-label',die.color+' '+die.face);for(let i=0;i<9;i++){const pip=document.createElement('span');pip.className='pip';if(!pipPositions[die.face].includes(i))pip.style.visibility='hidden';cube.append(pip);}tray.append(cube);}return tray;}
const settledTrays=new Map();
function diceWindow(label){
 const dialog=document.createElement('dialog');dialog.className='dice-window';
 const head=document.createElement('div');head.className='dice-window-head';const title=document.createElement('h2');title.textContent=label;title.id='dice-window-title';dialog.setAttribute('aria-labelledby',title.id);
 const close=document.createElement('button');close.textContent='Close';const stage=document.createElement('div');stage.className='dice-stage';const message=document.createElement('p');message.className='roll-summary';message.setAttribute('aria-live','polite');message.textContent='Preparing dice…';
 let rolling=true;close.disabled=true;
 close.onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{if(rolling)event.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());
 head.append(title,close);dialog.append(head,stage,message);document.body.append(dialog);dialog.showModal();
 return {stage,message,finish(text){rolling=false;close.disabled=false;message.textContent=text;}};
}
function roller(card,id,p,editable){
 const section=document.createElement('section');section.className='roller';const title=document.createElement('h4');title.textContent='Casting dice';section.append(title);
 const result=document.createElement('div');result.setAttribute('aria-live','polite');if(p.lastRoll){result.append(diceView(p.lastRoll.dice));const retained=settledTrays.get(id);if(retained?.at===p.lastRoll.at){const view=document.createElement('button');view.textContent='View settled tray';view.onclick=()=>{const popup=diceWindow('Settled dice');popup.stage.append(retained.canvas);popup.finish(rollSummary(p.lastRoll));};result.append(view);}}const summary=document.createElement('p');summary.className='roll-summary';summary.textContent=rollSummary(p.lastRoll);result.append(summary);
 if(editable){const actions=document.createElement('div');actions.className='actions';
  const buttons=[];for(const kind of ['ordinary','specialty']){const button=document.createElement('button');button.textContent=kind==='ordinary'?'Roll ordinary · 5':'Roll specialty · '+(p.level+6);button.disabled=kind==='specialty'&&!p.schoolLocked;buttons.push(button);button.onclick=async()=>{
   const roll=drawDice(players[id],kind);if(!roll.dice.length){status('Add dice to your bag before rolling.');return;}
   buttons.forEach(b=>b.disabled=true);const popup=diceWindow(kind==='specialty'?'Specialty roll':'Ordinary roll');popup.message.textContent='Rolling…';
   let fallback=false;
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    try{const module=await import('./dice-3d.js');roll.dice=await module.roll3D(popup.stage,roll.dice);const canvas=popup.stage.querySelector('canvas');if(canvas)settledTrays.set(id,{at:roll.at,canvas});}
    catch(error){fallback=true;console.warn('3D dice unavailable:',error.message);}
   }
   if(!popup.stage.querySelector('canvas'))popup.stage.replaceChildren(diceView(roll.dice));
   popup.finish(rollSummary(roll)+(fallback?' · Simple roller fallback.':''));
   if(!active||!players[id])return;
   editCharacter(id,{lastRoll:roll});render();status((fallback?'3D unavailable; used the simple roller. ':'')+'Roll saved. All dice return to your bag.');
  };actions.append(button);}section.append(actions);
  const help=document.createElement('p');help.className='roll-note';help.textContent='Draws blindly from all bag colors. Uses the whole bag if smaller than the allowance. Dice return after each roll.';section.append(help);
 }
 section.append(result);card.append(section);
}
function render(){
 const expandedInventories=new Set([...$('cards').querySelectorAll('details[data-character-id][open]')].map(detail=>detail.dataset.characterId));
 $('cards').replaceChildren();$('suspicion').value=suspicion;$('suspicion').disabled=role==='player';
 if(role==='host'&&Object.keys(players).length===0){const empty=document.createElement('p');empty.textContent='Waiting for students. Copy an invitation link to bring your players to the table.';$('cards').append(empty);}
 for(const [id,p]of Object.entries(players)){
  if(role==='player'&&id!==localId)continue;
  if(role==='host'){
   const card=document.createElement('article');card.className='card gm-card';
   const h=document.createElement('h3');h.textContent=p.name;card.append(h);
   for(const [label,value]of [['Composure',p.composure+'/10'+(p.composure===0?' · DAZED':'')],['Specialty',p.school||'—'],['Level',p.level],['Outstanding business',p.business||'—'],['Bag mix',bagMix(p)],['Last roll',rollSummary(p.lastRoll)]]){const row=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+': ';row.append(strong,document.createTextNode(String(value)));card.append(row);}
   $('cards').append(card);continue;
  }
  const editable=role!=='player'||id===localId,card=document.createElement('article');card.className='card';
  const h=document.createElement('h3');h.textContent=p.name;card.append(h);
  const tag=document.createElement('small');tag.textContent=id===localId?'Your student record':'Student record';card.append(tag);
  function field(key,label,type='text',max){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=p[key]??'';input.disabled=!editable;if(type==='number'){input.min=key==='level'?1:0;input.max=max;}else input.maxLength=key==='name'?80:4000;input.onchange=()=>{try{editCharacter(id,{[key]:type==='number'?Number(input.value):input.value});}catch(e){status(e.message);render();}};wrap.append(input);card.append(wrap);}
  field('name','Student name');
  const schoolLabel=document.createElement('label');schoolLabel.textContent='Specialty school';
  const select=document.createElement('select');select.disabled=!editable;
  const blank=document.createElement('option');blank.value='';blank.textContent='Choose your specialty…';select.append(blank);
  for(const [name,description]of Object.entries(schools)){const option=document.createElement('option');option.value=name;option.textContent=name+' — '+description;select.append(option);}
  const existing=Object.keys(schools).find(name=>name.toLowerCase()===(p.school||'').trim().toLowerCase());
  if(p.school&&!existing){const legacy=document.createElement('option');legacy.value=p.school;legacy.textContent=p.school+' (saved specialty)';select.append(legacy);}
  select.value=existing||p.school||'';
  
  select.onchange=()=>{
   const choice=select.value;
   if(!Object.hasOwn(schools,choice)){select.value=existing||p.school||'';return;}
   if(!confirm('Choose '+choice+' as your specialty? This locks your school choice for this character.')){select.value=existing||p.school||'';return;}
   // Replace the control immediately, before any network acknowledgement.
   const fixed=document.createElement('p');fixed.className='locked-school';fixed.textContent=choice+(schools[choice]?' - '+schools[choice]:'');
   select.replaceWith(fixed);
   editCharacter(id,{school:choice,schoolLocked:true});
   render();
  };
  if(p.schoolLocked){const fixed=document.createElement('p');fixed.className='locked-school';fixed.textContent=(p.school||'Unspecified')+(schools[existing]?' - '+schools[existing]:'');schoolLabel.append(fixed);}
  else schoolLabel.append(select);
  card.append(schoolLabel);
  for(const k of ['knack','business'])field(k,fields[k]);field('level','Level','number',5);
  const draw=document.createElement('p');draw.className='draw';draw.textContent=`Ordinary draw: 5 · Specialty draw: ${p.level+6} · Permanent dice: ${10+p.level*2}`;card.append(draw);
  const score=document.createElement('p');score.className='composure';score.textContent='COMPOSURE · '+p.composure+'/10'+(p.composure===0?' · DAZED':'');card.append(score);
  const marks=document.createElement('div');marks.className='marks';for(let n=1;n<=10;n++){const dot=document.createElement('span');dot.className='composure-dot'+(n<=p.composure?' is-filled':'');dot.setAttribute('aria-hidden','true');marks.append(dot);}card.append(marks);
  if(editable)for(const delta of [-1,1]){const btn=document.createElement('button');btn.textContent=delta<0?'− Composure':'+ Composure';btn.onclick=()=>editCharacter(id,{composure:Math.max(0,Math.min(10,p.composure+delta))});card.append(btn);}
  field('shield','Shield','number',999);
  roller(card,id,p,editable);
  const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Component allowance & notes';detail.dataset.characterId=id;detail.open=expandedInventories.has(id);detail.append(summary);card.append(detail);const inner=document.createElement('div');detail.append(inner);
  field('expedition','Expedition');inner.append(card.lastChild);
  const scroll=document.createElement('div');scroll.className='table-scroll';const table=document.createElement('table'),head=document.createElement('tr');for(const t of ['Color','Own','Loan','Found','Extra','Total']){const th=document.createElement('th');th.textContent=t;head.append(th);}table.append(head);
  let pouch=0;const totals=[];
  for(const color of colors){const row=document.createElement('tr'),label=document.createElement('th');label.textContent=color;row.append(label);let total=0;for(const kind of ['own','loan','found','extra']){const td=document.createElement('td'),input=document.createElement('input');input.type='number';input.min=0;input.max=999;input.value=p.components[color][kind];input.disabled=!editable;input.setAttribute('aria-label',color+' '+kind);input.onchange=()=>{try{const components=JSON.parse(JSON.stringify(p.components));components[color][kind]=Number(input.value);editCharacter(id,{components});}catch(e){status(e.message);render();}};total+=p.components[color][kind];td.append(input);row.append(td);}const td=document.createElement('td');td.textContent=total;row.append(td);table.append(row);pouch+=total;totals.push(total);}
  scroll.append(table);inner.append(scroll);const note=document.createElement('p');note.textContent='Pouch total: '+pouch+(totals.some(n=>n>Math.floor(pouch/2))?' · A color exceeds half the pouch.':'');inner.append(note);
  for(const k of ['notes','learned','assignment']){field(k,fields[k],'textarea');inner.append(card.lastChild);}
  $('cards').append(card);
 }
 saveState();
}
function gathered(pc) {
  return new Promise((resolve, reject) => {
    let timer;
    function cleanup() {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
    }
    function check() {
      if(pc.iceGatheringState === 'complete') { cleanup(); resolve(); }
    }
    pc.addEventListener('icegatheringstatechange', check);
    timer = setTimeout(() => {
      cleanup();
      // Slow/unreachable ICE servers must not discard candidates already gathered.
      if (/(?:^|\r?\n)a=candidate:/m.test(pc.localDescription?.sdp || '')) {
        status('Some ICE servers are slow. Trying the connection addresses already gathered…');
        resolve();
      } else {
        reject(Error('No connection addresses were gathered. Check browser WebRTC permissions or network restrictions, then reload to retry.'));
      }
    }, 12000);
    check();
  });
}
function makePeer(id) {
  const pc = new RTCPeerConnection({iceServers});
  const peer = {pc, channel:null}; peers.set(id, peer);
  pc.onconnectionstatechange = () => {
    if(['failed','disconnected','closed'].includes(pc.connectionState) && active) status('A peer disconnected. Leave and rejoin to reconnect; no automatic signaling retries.');
  };
  return peer;
}
function attach(peer, channel, id) {
  peer.channel = channel;
  channel.onopen = () => {
    status('Connected. Character changes now travel over WebRTC.');
    if(role === 'player') { gameSend(channel, {type:'hello',clientId:localId,character:ownCharacter||character($('name').value.trim()||'Student')}); socket.close(1000, 'Peer connection ready'); }
  };
  channel.onmessage = event => {
    if(typeof event.data !== 'string' || event.data.length > 1000000) return;
    try {
      const message = JSON.parse(event.data); gameMessages++; counters();
      if(role === 'host') {
        if(message.type==='hello'&&typeof message.clientId==='string'&&/^[a-f0-9-]{36}$/.test(message.clientId)&&message.clientId!==localId){if([...peers.values()].some(other=>other!==peer&&other.clientId===message.clientId&&other.channel?.readyState==='open')){gameSend(channel,{type:'identity-conflict'});return;}peer.clientId=message.clientId;if(!Object.hasOwn(players,peer.clientId))players[peer.clientId]=cleanCharacter(message.character);snapshot();}
        if(message.type==='sheet'&&peer.clientId){const next=cleanCharacter(message.character);const current=players[peer.clientId];if(current?.schoolLocked){next.school=current.school;next.schoolLocked=true;}players[peer.clientId]=next;snapshot();}
      }else if(message.type==='identity-conflict'){status('This student is already connected in another tab. Use a separate browser profile for a different student.');channel.close();
      }else if(message.type==='state'&&message.players&&typeof message.players==='object'){
        const next=Object.create(null);for(const [key,value]of Object.entries(message.players))next[key]=cleanCharacter(value);if(ownCharacter?.schoolLocked&&next[localId]){next[localId].school=ownCharacter.school;next[localId].schoolLocked=true;}players=next;tableName=typeof message.tableName==='string'?message.tableName.slice(0,80):'';if(tableName)lastRoomName=tableName;$('table-title').textContent=tableName||'Your student record';suspicion=Number.isInteger(message.suspicion)?Math.max(0,Math.min(6,message.suspicion)):0;render();
      }
    } catch { status('An invalid peer message was ignored.'); }
  };
  channel.onclose = () => { if(active) status('Peer connection closed. Leave and rejoin to reconnect.'); };
}
async function handleSignal(message) {
  signalReceived++; counters();
  if(message.type === 'error') throw Error(message.message || message.code || 'Signaling error');
  if(message.type === 'welcome') {
    myPeer = message.peerId; iceServers = message.metadata?.iceServers || [];
    if(role === 'host') {
      hostId=myPeer;token=crypto.randomUUID();ownCharacter=null;
      startTable(); status('Room ready. Copy an invitation link for your players.');
    } else {
      const peer = makePeer(hostId); attach(peer, peer.pc.createDataChannel('table'), hostId);
      await peer.pc.setLocalDescription(await peer.pc.createOffer()); await gathered(peer.pc);
      signaling({type:'send', to:hostId, data:{kind:'offer', token, description:peer.pc.localDescription}});
      status('Invitation sent. Waiting for the GM…');
    }
  }
  if(message.type !== 'direct') return;
  const data = message.data;
  if(role === 'host' && data?.kind === 'offer' && data.token === token && !peers.has(message.from)) {
    if(peers.size >= 12) return;
    const peer = makePeer(message.from);
    peer.pc.ondatachannel = event => attach(peer, event.channel, message.from);
    await peer.pc.setRemoteDescription(data.description);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer()); await gathered(peer.pc);
    signaling({type:'send', to:message.from, data:{kind:'answer', description:peer.pc.localDescription}});
  } else if(role === 'player' && message.from === hostId && data?.kind === 'answer') {
    await peers.get(hostId).pc.setRemoteDescription(data.description); startTable();
  }
}
async function connect(nextRole) {
  const key = $('key').value.trim();
  if(!key.startsWith('pk_')) return status('Enter a Metered publishable key under Connection settings first.');
  if(nextRole === 'player' && (!hostId || !token)) return status('Open a complete invitation link from the GM.');
  await chooseSaved(nextRole);
  if(nextRole==='host'){tableName=$('room-name').value.trim().slice(0,80);if(!tableName){status('Give your table a name before creating the room.');$('room-name').focus();return;}}
  role = nextRole; $('host').disabled = $('join').disabled = $('demo').disabled = true;
  status('Connecting to Metered for session setup…');
  socket = new WebSocket(`wss://rms.metered.ca/v1?key=${encodeURIComponent(key)}`);
  socket.onmessage = event => { try { handleSignal(JSON.parse(event.data)).catch(error => status(error.message)); } catch { status('Invalid signaling response.'); } };
  socket.onerror = () => status('Could not reach signaling. Check your key and network, then reload to retry.');
  socket.onclose = () => { if(!active) { status('Signaling closed before joining. Reload to retry.'); $('host').disabled = $('join').disabled = $('demo').disabled = false; } else if(role === 'host') status('Signaling disconnected. Existing peers can keep playing; new players need a new room.'); };
}
$('key').value = window.ROOMS_CONFIG?.meteredPublishableKey || '';
$('join').hidden = !hostId; $('host').hidden = !!hostId;
if(hostId) status('You have an invitation. Enter your character name and join.');
$('host').onclick = () => connect('host'); $('join').onclick = () => connect('player');
$('demo').onclick=async()=>{await chooseSaved('player');role='demo';if(!players[localId])players[localId]=ownCharacter||character($('name').value.trim()||'Rowan');startTable();status('Local student sheet. No signaling messages are sent.');};
$('restore').onclick=async()=>{saveChoiceMade=false;await chooseSaved(hostId?'player':'host');role=hostId?'demo':'host';startTable();$('invite').hidden=true;status('Saved data opened offline. Leave and create/join a room to connect.');};
$('suspicion').onchange=()=>{if(role==='player')return;suspicion=Math.max(0,Math.min(6,Number($('suspicion').value)||0));snapshot();};
function invitationURL(){const url=new URL(location.href);url.hash=new URLSearchParams({host:hostId,token}).toString();return url;}
$('invite').onclick = async () => {
  const url=invitationURL();
  try { await navigator.clipboard.writeText(url.href); status('Invitation copied. Players need the same publishable key configured.'); } catch { prompt('Copy this invitation link',url.href); }
};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(saveState(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='remedial-magic-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function chooseImport(){if(role==='player'&&active)return status('Leave the live room before importing a save.');$('save-file').click();}
$('import').onclick=chooseImport;$('import-setup').onclick=chooseImport;
$('save-file').onchange=async()=>{
 const file=$('save-file').files[0];if(!file)return;
 try{
  if(file.size>1000000)throw Error('Save file exceeds 1 MB.');const data=JSON.parse(await file.text());
  if(![1,2,3].includes(data.version)||!data.players||Array.isArray(data.players)||typeof data.players!=='object')throw Error('Not a supported Rooms save.');
  const entries=Object.entries(data.players);if(entries.length>30)throw Error('Too many characters.');const next=Object.create(null);
  for(const [id,p]of entries){if(['__proto__','constructor','prototype'].includes(id))throw Error('Invalid character ID');next[id]=cleanCharacter(p);}
  const own=data.ownCharacter?cleanCharacter(data.ownCharacter):null;
  const importingGM=role==='host'||(!active&&data.role==='gm');
  if(importingGM&&data.version<3&&data.clientId)delete next[data.clientId];
  if(!confirm('Replace the current table with this save? A previous local snapshot will be retained.'))return;
  tableName=typeof data.tableName==='string'?data.tableName.slice(0,80):'';players=next;ownCharacter=importingGM?null:own;if(own&&!importingGM){if(data.clientId)delete players[data.clientId];players[localId]=own;}suspicion=Math.max(0,Math.min(6,Number(data.suspicion)||0));
  if(!active){role=importingGM?'host':'demo';saveChoiceMade=true;startTable();$('invite').hidden=true;}else snapshot();saveState();status('JSON save imported and saved on this device.');
 }catch(e){status('Import failed: '+e.message);}finally{$('save-file').value='';}
};
$('leave').onclick=()=>{saveState();active=false;for(const peer of peers.values())peer.pc.close();socket?.close();location.hash='';location.reload();};
function applyTheme(theme){document.documentElement.dataset.theme=theme;try{localStorage.setItem('prisms-handbook',theme);}catch{}}
$('theme').onclick=()=>applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light');
try{applyTheme(localStorage.getItem('prisms-handbook')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));}catch{applyTheme('dark');}
$('name-label').hidden=!hostId;
$('room-name-label').hidden=!!hostId;
$('host').textContent='Create GM room';$('demo').textContent='Try student sheet locally';
if((hostId?saved:gmSaved)?.players)status('Saved data detected. You will be asked whether to load it when you continue.');






let qrEncoderPromise;
function loadQREncoder(){
 if(!qrEncoderPromise)qrEncoderPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/vendor/qrcode-generator/qrcode.js';script.onload=resolve;script.onerror=()=>{qrEncoderPromise=null;script.remove();reject(Error('Could not load QR encoder.'));};document.head.append(script);});
 return qrEncoderPromise;
}
$('invite-qr').onclick=async()=>{
 if(role!=='host'||!hostId||!token||socket?.readyState!==WebSocket.OPEN)return status('Create a connected GM room before sharing a QR code.');
 try{
  await loadQREncoder();const url=invitationURL();const code=window.qrcode(0,'M');code.addData(url.href);code.make();
  const dialog=document.createElement('dialog');dialog.className='save-dialog qr-dialog';const title=document.createElement('h2');title.textContent='Join '+(tableName||'this table');
  const canvas=document.createElement('canvas'),modules=code.getModuleCount(),scale=6,margin=4;canvas.width=canvas.height=(modules+margin*2)*scale;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Scan to join '+(tableName||'the GM session'));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(code.isDark(row,col))ctx.fillRect((col+margin)*scale,(row+margin)*scale,scale,scale);
  const note=document.createElement('p');note.textContent=['localhost','127.0.0.1'].includes(url.hostname)?'This is a local preview link. A phone cannot join your computer through localhost. Use the deployed custom domain for mobile joining.':'Scan with your phone camera to join. Keep the GM session open.';
  const link=document.createElement('a');link.href=url.href;link.textContent='Open invitation link';const close=document.createElement('button');close.textContent='Close';close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.append(title,canvas,note,link,close);document.body.append(dialog);dialog.showModal();
 }catch(error){status(error.message);}
};
