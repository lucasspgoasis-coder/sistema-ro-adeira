function calculateUsage(rows) {
 const blocks=new Map(), people=new Map();let total=0,count=0;
 for(const row of rows){const minutes=Number(row.DurationMinutes);if(!Number.isFinite(minutes)||minutes<=0)continue;
  total+=minutes;count++;
  const block=row.Local||'Não informado',equipment=row.Equipamento||'Não informado',person=row.Operador||'Não informado';
  if(!blocks.has(block))blocks.set(block,new Map());const group=blocks.get(block);group.set(equipment,(group.get(equipment)||0)+minutes);
  if(!people.has(person))people.set(person,{minutes:0,count:0});people.get(person).minutes+=minutes;people.get(person).count++;
 }
 return {total,count,blocks:[...blocks].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR',{numeric:true})).map(([name,equipment])=>({name,total:[...equipment.values()].reduce((a,b)=>a+b,0),equipment:[...equipment]})),people:[...people].map(([name,value])=>({name,...value,percent:value.minutes/total*100})).sort((a,b)=>b.minutes-a.minutes)};
}
function renderRendimento(rows){
 const result=calculateUsage(rows),escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pct=value=>value.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%',time=value=>Math.floor(value/60)+' h '+Math.round(value%60)+' min';
 const colors=['#047857','#2563eb','#b45309','#7c3aed','#be185d','#0e7490','#4d7c0f','#c2410c'];
 const names=[...new Set(result.blocks.flatMap(b=>b.equipment.map(e=>e[0])))].sort(),color=name=>colors[names.indexOf(name)%colors.length];
 document.getElementById('yieldSummary').innerHTML=`<strong>${time(result.total)}</strong><span>${result.count} usos com duração válida</span><span>${result.people.length} colaboradores</span><span>${result.blocks.length} blocos</span>`;
 document.getElementById('yieldBlocks').innerHTML=result.blocks.map(block=>`<div class="yield-row"><div class="yield-label"><strong>${escape(block.name)}</strong><span>${time(block.total)}</span></div><div class="yield-track" aria-hidden="true">${block.equipment.map(([name,m])=>`<span style="width:${m/block.total*100}%;background:${color(name)}"></span>`).join('')}</div><div class="yield-legend">${block.equipment.map(([name,m])=>`<span><i class="yield-dot" style="background:${color(name)}"></i>${escape(name)} · <strong>${pct(m/block.total*100)}</strong> · ${time(m)}</span>`).join('')}</div></div>`).join('')||'<div class="yield-empty">Nenhum uso com duração válida para os filtros.</div>';
 document.getElementById('yieldPeople').innerHTML=result.people.map(person=>`<div class="yield-row"><div class="yield-label"><strong>${escape(person.name)}</strong><span>${pct(person.percent)} · ${time(person.minutes)} · ${person.count} usos</span></div><div class="yield-track" aria-hidden="true"><span style="width:${person.percent}%;background:#047857"></span></div></div>`).join('')||'<div class="yield-empty">Nenhum colaborador com duração válida para os filtros.</div>';
}
