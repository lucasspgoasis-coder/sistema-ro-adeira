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
