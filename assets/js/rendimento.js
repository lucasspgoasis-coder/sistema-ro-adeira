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
 const pct=value=>value.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%',time=value=>Math.floor(Math.round(value)/60)+' h '+(Math.round(value)%60)+' min';
 const colors=['#047857','#2563eb','#b45309','#7c3aed','#be185d','#0e7490','#4d7c0f','#c2410c'];
 const names=[...new Set(result.blocks.flatMap(b=>b.equipment.map(e=>e[0])))].sort(),color=name=>colors[names.indexOf(name)%colors.length];
 const metrics=[['Tempo registrado',time(result.total)],['Usos válidos',result.count],['Colaboradores',result.people.length],['Blocos atendidos',result.blocks.length]];
 document.getElementById('yieldSummary').innerHTML=metrics.map(([label,value])=>'<div class="yield-metric"><span>'+label+'</span><strong>'+value+'</strong></div>').join('');
 document.getElementById('yieldBlocks').innerHTML=result.blocks.map(block=>{
  const ordered=[...block.equipment].sort((a,b)=>b[1]-a[1]);
  return '<article class="yield-block-card"><header><div><span class="yield-eyebrow">DISTRIBUIÇÃO POR EQUIPAMENTO</span><h3>'+escape(block.name)+'</h3></div><strong>'+time(block.total)+'</strong></header><div class="yield-scale"><span>0%</span><span>50%</span><span>100%</span></div><div class="yield-track" aria-hidden="true">'+ordered.map(([name,m])=>'<span title="'+escape(name)+' · '+pct(m/block.total*100)+'" style="width:'+m/block.total*100+'%;background:'+color(name)+'">'+(m/block.total>=0.1?pct(m/block.total*100):'')+'</span>').join('')+'</div><div class="yield-equipment-list">'+ordered.map(([name,m])=>'<div><span><i class="yield-dot" style="background:'+color(name)+'"></i>'+escape(name)+'</span><span>'+time(m)+'</span><strong>'+pct(m/block.total*100)+'</strong></div>').join('')+'</div></article>';
 }).join('')||'<div class="yield-empty">Nenhum uso com duração válida para os filtros.</div>';
 document.getElementById('yieldPeople').innerHTML=result.people.map((person,index)=>'<article class="yield-person"><div class="yield-person-top"><span class="yield-rank">'+String(index+1).padStart(2,'0')+'</span><div class="yield-person-name"><strong>'+escape(person.name)+'</strong><span>'+time(person.minutes)+' · '+person.count+' usos</span></div><strong class="yield-percent">'+pct(person.percent)+'</strong></div><div class="yield-track yield-person-track" aria-hidden="true"><span style="width:'+person.percent+'%"></span></div><div class="yield-person-foot"><span>Participação no tempo total</span><span>Média por uso: '+time(person.minutes/person.count)+'</span></div></article>').join('')||'<div class="yield-empty">Nenhum colaborador com duração válida para os filtros.</div>';
}
