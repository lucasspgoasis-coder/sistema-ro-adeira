const reportEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chartList = () => [chartBlocoInst,chartEquipInst,chartMesInst,chartBlocoSemanaInst,chartOperadorInst,chartPeriodoMesInst,chartPeriodoSemInst,chartRocBlocoInst,chartRocRendimentoInst].filter(Boolean);
const reportChartItems = [
 ['chk_chart_bloco','chartBloco','Tempo por bloco'],['chk_chart_equip','chartEquipamento','Tempo por roçadeira'],['chk_chart_mes','chartMes','Tempo por mês'],['chk_chart_roc_bloco','chartRocBloco','Roçadeiras por bloco'],['chk_chart_roc_rend','chartRocRendimento','Tempo médio e total por roçadeira'],['chk_chart_op','chartOperador','Tempo por operador'],['chk_chart_semana','chartBlocoSemana','Equipamentos por semana'],['chk_chart_turnomes','chartPeriodoMes','Turnos por mês'],['chk_chart_turnosemana','chartPeriodoSemana','Turnos por semana']
];
for (const [id,label] of Object.entries({filterDataInicio:'Data inicial',filterDataFim:'Data final',filterBloco:'Bloco',filterSemana:'Semana',filterEquipamento:'Roçadeira'})) document.getElementById(id).setAttribute('aria-label',label);
document.querySelector('[onclick="openExportModal()"]').classList.add('report-action');
document.querySelectorAll('main canvas').forEach(canvas=>{const card=canvas.parentElement.parentElement;card.classList.add('chart-panel');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',card.querySelector('h2')?.textContent.trim()||'Gráfico de tempo de trabalho');});
document.querySelectorAll('[id^=kpi]').forEach(el=>{if(el.tagName==='SPAN')el.parentElement.classList.add('metric-card');});
document.querySelector('[onclick="exportReport(\'pdf\')"]').parentElement.classList.add('report-buttons');
Chart.defaults.font.family='Inter, Arial, sans-serif';Chart.defaults.color='#5e7468';Chart.defaults.locale='pt-BR';
Chart.register({id:'clearWorkCharts',beforeInit(chart){
 const copyOptions=value=>Array.isArray(value)?value.map(copyOptions):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copyOptions(item)])):value;
 const opts=copyOptions(chart.config.options);chart.config.options=opts;opts.animation=false;opts.responsive=true;opts.layout={padding:{top:24,right:22,bottom:8,left:8}};
 opts.plugins??={};opts.plugins.tooltip??={};Object.assign(opts.plugins.tooltip,{backgroundColor:'#431407',padding:12,cornerRadius:9});
 opts.plugins.tooltip.callbacks??={};opts.plugins.tooltip.callbacks.label=ctx=>ctx.dataset.label+': '+formatDuration(Math.round(Number(ctx.raw)*60));
 if(opts.plugins.legend?.display)opts.plugins.legend={...opts.plugins.legend,position:'bottom',labels:{usePointStyle:true,boxWidth:9,padding:16,font:{size:11}}};
 if(opts.plugins.datalabels){opts.plugins.datalabels={...opts.plugins.datalabels,display:'auto',clamp:true,offset:5,font:{size:10,weight:'600'},formatter:value=>value>0?formatHMM(Math.round(value*60)):''};}
 const horizontal=['chartBloco','chartEquipamento','chartOperador'].includes(chart.canvas.id);
 if(horizontal){opts.indexAxis='y';opts.plugins.datalabels.align='right';opts.scales={x:{beginAtZero:true,grace:'22%',title:{display:true,text:'Tempo de operação · horas'},grid:{color:'#edf2ee'}},y:{grid:{display:false},ticks:{autoSkip:false,font:{size:11}}}};chart.canvas.parentElement.style.height=Math.max(340,chart.data.labels.length*40+80)+'px';}
 else if(opts.scales){opts.scales.x.ticks={...opts.scales.x.ticks,maxRotation:35,autoSkip:true};}
 chart.data.datasets.forEach(dataset=>{dataset.maxBarThickness=42;dataset.borderRadius=5;});
 },afterDraw(chart){if(!chart.data.datasets.some(ds=>ds.data.some(value=>Number(value)>0))){const ctx=chart.ctx;ctx.save();ctx.fillStyle='#6a8073';ctx.textAlign='center';ctx.font='13px Arial';ctx.fillText('Sem tempo registrado para os filtros selecionados',chart.width/2,chart.height/2);ctx.restore();}}});
const showOriginalTab=switchTab;
switchTab=function(name){showOriginalTab(name);requestAnimationFrame(()=>{const panel=document.getElementById('tabContent-'+name);chartList().forEach(chart=>{if(panel?.contains(chart.canvas)){chart.resize();chart.update('none');}});});};
let reportBusy=false;
const openOriginalReport=openExportModal;
openExportModal=function(){openOriginalReport();document.querySelector('#exportModal input').focus();};
const closeOriginalReport=closeExportModal;
closeExportModal=function(){if(reportBusy)return;closeOriginalReport();document.querySelector('[onclick="openExportModal()"]').focus();};
document.addEventListener('keydown',event=>{const modal=document.getElementById('exportModal');if(modal.classList.contains('hidden'))return;if(event.key==='Escape')closeExportModal();if(event.key==='Tab'){const elements=[...modal.querySelectorAll('input,button')].filter(el=>!el.disabled);const first=elements[0],last=elements[elements.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
function downloadReportBlob(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function reportSummary(rows){return{count:rows.length,minutes:rows.reduce((sum,row)=>sum+(Number(row.DurationMinutes)||0),0),blocks:new Set(rows.map(row=>row.Local)).size,equipment:new Set(rows.map(row=>row.Equipamento)).size,withoutTime:rows.filter(row=>!row.DurationMinutes).length};}
async function exportReport(format){
 if(reportBusy)return;
 if(!validData.length){alert('Não há registros para exportar. Ajuste os filtros.');return;}
 if(format!=='csv'&&!document.querySelector('#exportModal input:checked')){alert('Selecione pelo menos um conteúdo para o relatório.');return;}
 const root=document.getElementById('exportCanvasContainer'), saved=root.innerHTML, savedStyle=root.getAttribute('style');
 const buttons=[...document.querySelectorAll('#exportModal button')];reportBusy=true;buttons.forEach(button=>button.disabled=true);
 const date=new Date().toLocaleDateString('sv-SE'),name='relatorio_rocadeiras_'+date;
 try{
 if(format==='csv'){
  const fields=['Data','Operador','Periodo','Local','Equipamento','Inicio','Fim','DurationMinutes'];
  const labels=['Data','Operador','Turno','Bloco','Roçadeira','Início','Fim','Duração em minutos'];
  const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
  const csv=[labels.map(cell).join(';'),...validData.map(row=>fields.map(key=>cell(row[key])).join(';'))].join('\r\n');
  downloadReportBlob(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),name+'.csv');return;
 }
 await document.fonts.ready;
 const summary=reportSummary(validData);
 const dates=validData.map(row=>row.DateIso).filter(Boolean).sort();const dateBR=value=>value?value.split('-').reverse().join('/'):'Não informado';
 const filterNames=[['filterDataInicio','Data inicial'],['filterDataFim','Data final'],['filterBloco','Bloco'],['filterSemana','Semana'],['filterEquipamento','Roçadeira']];
 const filterText=filterNames.map(([id,label])=>{const value=document.getElementById(id).value;return value?label+': '+(id.includes('Data')?dateBR(value):value):'';}).filter(Boolean).join(' · ')||'Todos os blocos, semanas e equipamentos';
 const header='<header style="border-bottom:3px solid #ea580c;padding-bottom:18px;margin-bottom:24px"><p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#c2410c">GESTÃO DE ROÇADEIRAS</p><h1 style="font-size:27px;font-weight:700;margin:10px 0">Relatório de operação</h1><p style="font-size:13px;color:#4d685a">Registros de '+dateBR(dates[0])+' a '+dateBR(dates.at(-1))+' · Gerado em '+new Date().toLocaleString('pt-BR')+'</p><p style="font-size:12px;color:#4d685a;margin-top:8px">Filtros: '+reportEscape(filterText)+'</p><p style="font-size:12px;color:#4d685a;margin-top:8px">'+summary.count+' registros · '+summary.blocks+' blocos · '+summary.equipment+' equipamentos · '+formatDuration(summary.minutes)+'</p></header>';
 const note='<p style="font-size:11px;color:#697e71;margin:20px 0 0">Tempos calculados entre início e fim. '+summary.withoutTime+' registros sem duração válida. Os gráficos de tempo consideram apenas durações positivas. Tempo médio por uso não mede área roçada.</p>';
 const blocks=[];
 for(const [check,panel,title] of [['chk_kpi_gerais','gerais','Indicadores gerais'],['chk_kpi_comp','comparativo','Comparativo de períodos'],['chk_kpi_man','manuseio','Operadores e turnos'],['chk_kpi_roc','rocadeiras','Indicadores por roçadeira']]){
 if(!document.getElementById(check).checked)continue;
 const source=document.querySelector('#tabContent-'+panel+' .grid');
 if(source){const cards=[...source.children].map(card=>{const copy=card.cloneNode(true);copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));copy.querySelectorAll('.truncate').forEach(el=>{el.style.whiteSpace='normal';el.style.overflowWrap='anywhere';});copy.style.cssText='padding:22px;border:1px solid #dbe7df;border-radius:12px;background:#f5f9f6;min-width:0';return copy.outerHTML;});blocks.push('<h2 style="font-size:20px;font-weight:700;margin-bottom:20px">'+title+'</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'+cards.join('')+'</div>');}
 }
 for(const [check,id,title] of reportChartItems){if(!document.getElementById(check).checked)continue;const chart=chartList().find(item=>item.canvas.id===id);if(!chart)continue;let image;try{chart.resize(1120,560);chart.update('none');image=chart.toBase64Image();}finally{chart.resize();chart.update('none');}blocks.push('<h2 style="font-size:20px;font-weight:700;margin-bottom:24px">'+title+'</h2><p style="font-size:12px;color:#697e71;margin-bottom:16px">Duração em horas e minutos · filtros do relatório aplicados</p><img style="width:100%;height:auto" src="'+image+'">');}
 if(document.getElementById('chk_records').checked){const fields=['Data','Local','Equipamento','Operador','Inicio','Fim'];for(let offset=0;offset<validData.length;offset+=20){blocks.push('<h2 style="font-size:20px;font-weight:700;margin-bottom:18px">Registros '+(offset+1)+' a '+Math.min(offset+20,validData.length)+'</h2><table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px"><thead><tr>'+['Data','Bloco','Roçadeira','Operador','Início','Fim','Duração'].map(label=>'<th style="padding:9px;border:1px solid #dce7df;background:#fff4e8;text-align:left">'+label+'</th>').join('')+'</tr></thead><tbody>'+validData.slice(offset,offset+20).map(row=>'<tr>'+[...fields.map(key=>row[key]),formatDuration(row.DurationMinutes)].map(value=>'<td style="padding:9px;border:1px solid #dce7df;overflow-wrap:anywhere">'+reportEscape(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table>');}}
 if(!blocks.length)throw Error('Nenhum conteúdo disponível.');
 if(format==='jpeg'&&blocks.length>12)throw Error('Relatório longo: escolha PDF ou CSV para incluir todos os registros.');
 root.style.cssText='position:fixed;left:-9999px;top:0;width:1240px;padding:44px;background:white;color:#183d2c;z-index:-10;display:block;height:auto;min-height:0';
 const capture=async content=>{root.innerHTML=content;await Promise.all([...root.querySelectorAll('img')].map(img=>img.decode()));return html2canvas(root,{scale:1.5,useCORS:true,allowTaint:false,backgroundColor:'#fff',logging:false});};
 if(format==='pdf'){
 const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 for(let index=0;index<blocks.length;index++){updateStatusBadge('syncing','Gerando página '+(index+1)+'/'+blocks.length);const canvas=await capture(header+blocks[index]+note);if(index)pdf.addPage();const w=182,h=canvas.height*w/canvas.width,ratio=Math.min(1,253/h);pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',14,14,w*ratio,h*ratio);pdf.setFontSize(9);pdf.setTextColor(95,116,102);pdf.text('Gestao de Rocadeiras | '+(index+1)+' / '+blocks.length,14,283);}pdf.save(name+'.pdf');
 }else{
 const canvas=await capture(header+blocks.map(block=>'<section style="padding:26px 0;border-bottom:1px solid #e1ebe4">'+block+'</section>').join('')+note);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!blob)throw Error('Imagem muito grande. Escolha PDF.');downloadReportBlob(blob,name+'.jpg');
 }
 reportBusy=false;closeExportModal();
 }catch(error){console.error(error);alert('Não foi possível gerar o arquivo: '+error.message);}finally{root.innerHTML=saved;root.setAttribute('style',savedStyle);reportBusy=false;buttons.forEach(button=>button.disabled=false);updateStatusBadge('online');}
}
