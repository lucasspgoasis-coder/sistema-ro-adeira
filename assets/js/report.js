/* Fixed A4 scenes shared by PDF and JPEG. No screenshots of dashboard cards. */
const REPORT = {width:1120,height:1584,margin:80,bottom:1430,ink:'#18382d',muted:'#52645e',accent:'#15803d'};
const reportMeasure = document.createElement('canvas').getContext('2d');
async function reportLoadLogo(){
    const image=new Image();image.src='assets/images/logo.png';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    canvas.getContext('2d').drawImage(image,0,0);
    return canvas.toDataURL('image/png');
}
function reportIdentity(){
    const value=id=>document.getElementById(id)?.value.trim()||'';
    return {title:value('reportTitle')||'Relatório de operação',unit:value('reportUnit')||'Não informada',notes:value('reportNotes')};
}
function reportWrap(value,width,size=20,bold=false) {
    reportMeasure.font=(bold?'bold ':'')+size+'px Arial';
    const lines=[];
    for(const paragraph of String(value??'—').split(/\r?\n/)) {
        let line='';
        for(const word of paragraph.split(/\s+/)) {
            const proposed=line?line+' '+word:word;
            if(reportMeasure.measureText(proposed).width<=width*.92){line=proposed;continue;}
            if(line){lines.push(line);line='';}
            let part='';
            for(const character of word){if(part&&reportMeasure.measureText(part+character).width>width*.92){lines.push(part);part='';}part+=character;}
            line=part;
        }
        lines.push(line);
    }
    return lines.length?lines:[''];
}
function reportText(page,text,x,y,{size=20,bold=false,color=REPORT.ink,width=960,lineHeight=size*1.45}={}){
    const lines=Array.isArray(text)?text:reportWrap(text,width,size,bold);
    for(const line of lines){page.commands.push({type:'text',text:line,x,y,size,bold,color});y+=lineHeight;}
    return y;
}
function reportRect(page,x,y,w,h,color){page.commands.push({type:'rect',x,y,w,h,color});}
function reportNewPage(pages,meta,title,continued=false){
    const page={commands:[],y:0};pages.push(page);
    reportRect(page,0,0,1120,10,'#12372a');
    page.commands.push({type:'image',image:meta.logo,x:80,y:30,w:115,h:115});
    reportText(page,'CONTROLE DE EQUIPAMENTOS',220,55,{size:15,bold:true,color:REPORT.accent,width:820});
    reportText(page,meta.title,220,91,{size:28,bold:true,width:800,lineHeight:34});
    reportRect(page,80,170,960,2,'#cbd9d0');
    reportRect(page,80,170,100,4,'#15803d');
    let y=reportText(page,title+(continued?' · continuação':''),80,222,{size:30,bold:true,width:960,lineHeight:38});
    y=reportText(page,'UNIDADE / PROPRIEDADE',80,y+8,{size:13,bold:true,color:REPORT.accent,lineHeight:23});
    y=reportText(page,meta.unit,80,y,{size:19,bold:true,width:960,lineHeight:27});
    y=reportText(page,'Período: '+meta.period+'  |  Emissão: '+meta.generated,80,y+7,{size:17,color:REPORT.muted,lineHeight:25});
    y=reportText(page,meta.filters,80,y+4,{size:17,color:REPORT.muted,lineHeight:25});
    const summaryLines=reportWrap(meta.summary,912,18,true);
    reportRect(page,80,y+6,960,summaryLines.length*27+28,'#eaf3ed');
    reportRect(page,80,y+6,5,summaryLines.length*27+28,'#15803d');
    y=reportText(page,summaryLines,104,y+33,{size:18,bold:true,lineHeight:27});
    page.y=y+43;
    return page;
}
function reportNextText(pages,page,meta,title,text,style={}){
    const lines=reportWrap(text,style.width||960,style.size||20,style.bold);
    for(const line of lines){if(page.y+32>REPORT.bottom)page=reportNewPage(pages,meta,title,true);page.y=reportText(page,[line],80,page.y,style);}
    return page;
}
function reportMeta(rows){
    const summary=reportSummary(rows),dates=rows.map(row=>row.DateIso).filter(Boolean).sort();
    const br=value=>value?value.split('-').reverse().join('/'):'sem data';
    const names=[['filterDataInicio','Início'],['filterDataFim','Fim'],['filterBloco','Bloco'],['filterSemana','Semana'],['filterEquipamento','Roçadeira']];
    const filters=names.map(([id,label])=>{const value=document.getElementById(id).value;return value?label+': '+(id.includes('Data')?br(value):value):'';}).filter(Boolean).join(' · ');
    return {period:br(dates[0])+' a '+br(dates.at(-1)),generated:new Date().toLocaleString('pt-BR'),filters:'Filtros: '+(filters||'todos os blocos, semanas e equipamentos'),summary:summary.count+' registros · '+summary.blocks+' blocos · '+summary.equipment+' equipamentos · '+formatDuration(summary.minutes),withoutTime:summary.withoutTime};
}
function reportClone(value){return Array.isArray(value)?value.map(reportClone):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,reportClone(item)])):value;}
function reportChartGroups(chart){
    const horizontal=chart.config.options.indexAxis==='y';
    const size=horizontal?8:7,groups=[];
    for(let start=0;start<chart.data.labels.length;start+=size)groups.push({start,end:Math.min(start+size,chart.data.labels.length)});
    return groups.length?groups:[{start:0,end:0}];
}
async function reportChartImage(source,group){
    // Render a fresh chart so hidden tabs, small screens and dashboard clipping cannot affect exports.
    const host=document.createElement('div');host.style.cssText='position:fixed;left:-20000px;top:0;width:960px;height:650px;overflow:visible;background:#fff;';
    const canvas=document.createElement('canvas');canvas.id='report-'+source.canvas.id;canvas.width=960;canvas.height=650;host.append(canvas);document.body.append(host);
    let chart;
    try{
        const data=reportClone(source.data);data.labels=data.labels.slice(group.start,group.end);
        data.datasets=data.datasets.map((dataset,index)=>({...dataset,hidden:!source.isDatasetVisible(index),data:dataset.data.slice(group.start,group.end),backgroundColor:Array.isArray(dataset.backgroundColor)?dataset.backgroundColor.slice(group.start,group.end):dataset.backgroundColor,borderColor:Array.isArray(dataset.borderColor)?dataset.borderColor.slice(group.start,group.end):dataset.borderColor}));
        const options=reportClone(source.config.options);
        chart=new Chart(canvas,{type:source.config.type,data,options,plugins:[{id:'reportLayout',beforeInit(instance){
            const opts=instance.config.options;
            opts.responsive=false;opts.maintainAspectRatio=false;opts.animation=false;opts.devicePixelRatio=2;
            opts.layout={padding:{left:20,right:120,top:40,bottom:35}};
            opts.plugins.legend={display:false};opts.plugins.tooltip={enabled:false};
            opts.plugins.datalabels={...opts.plugins.datalabels,display:'auto',clamp:true,clip:false,font:{size:14,weight:'600'},padding:5,offset:6};
            const axis=opts.indexAxis==='y'?'y':'x';
            if(opts.scales?.[axis])opts.scales[axis].ticks={...opts.scales[axis].ticks,autoSkip:false,minRotation:0,maxRotation:0,font:{size:14},callback:function(value){return reportWrap(this.getLabelForValue(value),axis==='y'?190:100,14);}};
            const valuesAxis=axis==='y'?'x':'y';if(opts.scales?.[valuesAxis]){opts.scales[valuesAxis].grace='28%';opts.scales[valuesAxis].ticks={...opts.scales[valuesAxis].ticks,font:{size:13}};}
        }}]});
        chart.update('none');
        return chart.toBase64Image('image/png',1);
    }finally{chart?.destroy();host.remove();}
}
function reportLegend(pages,page,meta,title,datasets){
    for(const dataset of datasets.filter(dataset=>!dataset.hidden)){
        const lines=reportWrap(dataset.label||'Tempo de operação',920,17);
        for(let index=0;index<lines.length;index++){
            if(page.y+32>REPORT.bottom)page=reportNewPage(pages,meta,title,true);
            if(index===0){const color=Array.isArray(dataset.backgroundColor)?dataset.backgroundColor[0]:dataset.backgroundColor;reportRect(page,80,page.y-13,13,13,typeof color==='string'?color:'#ea580c');}
            reportText(page,[lines[index]],103,page.y,{size:17});page.y+=27;
        }
        page.y+=7;
    }
    page.y+=18;return page;
}
function reportTable(pages,meta,rows){
    const title='Registros de operação',widths=[105,115,115,175,110,85,85,170],labels=['Data','Bloco','Roçadeira','Operador','Turno','Início','Fim','Duração'];
    let page;
    const newPage=()=>{page=reportNewPage(pages,meta,title,Boolean(page));const y=page.y;let x=80;for(let i=0;i<labels.length;i++){reportRect(page,x,y-20,widths[i],49,'#12372a');reportText(page,labels[i],x+9,y,{size:16,bold:true,color:'#ffffff',width:widths[i]-18,lineHeight:23});x+=widths[i];}page.y+=52;};
    newPage();
    rows.forEach((row,rowIndex)=>{
        const values=[row.Data,row.Local,row.Equipamento,row.Operador,row.Periodo,row.Inicio,row.Fim,formatDuration(row.DurationMinutes)];
        const wrapped=values.map((value,i)=>reportWrap(value,widths[i]-18,17));
        let offset=0,max=Math.max(...wrapped.map(lines=>lines.length));
        while(offset<max){
            const capacity=Math.floor((REPORT.bottom-page.y-16)/25);if(capacity<1){newPage();continue;}
            const count=Math.min(capacity,max-offset),height=count*25+16;
            let x=80;for(let column=0;column<widths.length;column++){reportRect(page,x,page.y-19,widths[column],height,rowIndex%2?'#f5f7fa':'#fff');reportText(page,wrapped[column].slice(offset,offset+count),x+9,page.y,{size:17,lineHeight:25,width:widths[column]-18});x+=widths[column];}
            page.y+=height;offset+=count;
            if(offset<max)newPage();
        }
    });
}
async function reportBuildPages(rows){
    const meta={...reportMeta(rows),...reportIdentity(),logo:await reportLoadLogo()},pages=[];
    if(reportWrap(meta.filters,960,17).length>3){const fullFilters=meta.filters;meta.filters='Filtros completos na seção de filtros do relatório.';let page=reportNewPage(pages,meta,'Filtros do relatório');reportNextText(pages,page,meta,'Filtros do relatório',fullFilters,{size:20});}
    for(const [check,panel,title] of [['chk_kpi_gerais','gerais','Indicadores gerais'],['chk_kpi_comp','comparativo','Comparativo de períodos'],['chk_kpi_man','manuseio','Operadores e turnos'],['chk_kpi_roc','rocadeiras','Indicadores por roçadeira']]){
        if(!document.getElementById(check).checked)continue;
        const source=document.querySelector('#tabContent-'+panel+' .grid');if(!source)continue;
        let page=reportNewPage(pages,meta,title);
        for(const card of source.children){
            const texts=card.innerText.split(/\r?\n/).map(text=>text.trim()).filter(Boolean);
            if(!texts.length)continue;
            const lines=texts.flatMap((text,index)=>reportWrap(text,900,index===1?28:19,index===1));
            if(page.y+Math.min(lines.length*36+48,250)>REPORT.bottom)page=reportNewPage(pages,meta,title,true);
            reportRect(page,80,page.y-22,960,6,'#15803d');
            page.y+=12;
            for(let index=0;index<texts.length;index++){page=reportNextText(pages,page,meta,title,texts[index],{size:index===1?28:19,bold:index===1,color:index===1?REPORT.ink:REPORT.muted,width:900});page.y+=9;}
            page.y+=15;reportRect(page,80,page.y,960,1,'#e2e8f0');page.y+=32;
        }
    }
    for(const [check,id,title] of reportChartItems){
        if(!document.getElementById(check).checked)continue;
        const chart=chartList().find(item=>item.canvas.id===id);if(!chart)continue;
        const groups=reportChartGroups(chart);
        for(let index=0;index<groups.length;index++){
            let page=reportNewPage(pages,meta,title+(groups.length>1?' · parte '+(index+1)+'/'+groups.length:''));
            const datasets=chart.data.datasets.map((dataset,i)=>({...dataset,hidden:!chart.isDatasetVisible(i)}));
            page=reportLegend(pages,page,meta,title,datasets);
            if(page.y+680>REPORT.bottom)page=reportNewPage(pages,meta,title,true);
            const image=await reportChartImage(chart,groups[index]);
            page.commands.push({type:'image',image,x:80,y:page.y,w:960,h:650});page.y+=680;
            page=reportNextText(pages,page,meta,title,'Tempo em horas e minutos. Os filtros do relatório são aplicados. Gráficos extensos continuam nas páginas seguintes.',{size:17,color:REPORT.muted});
        }
    }
    if(document.getElementById('chk_records').checked)reportTable(pages,meta,rows);
    if(!pages.length)throw Error('Selecione pelo menos um conteúdo disponível.');
    if(meta.notes){let page=reportNewPage(pages,meta,'Observações');reportNextText(pages,page,meta,'Observações',meta.notes,{size:20});}
    pages.forEach((page,index)=>{
        reportRect(page,80,1448,960,2,'#cbd9d0');
        reportText(page,'Relatório de operação · '+(index+1)+' / '+pages.length,80,1473,{size:16,color:REPORT.muted});
        reportText(page,meta.withoutTime+' registros sem duração válida. Tempo por uso não mede área roçada.',80,1498,{size:15,color:REPORT.muted});
    });
    return pages;
}
function reportPdf(pages,name){
    const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),scale=210/REPORT.width;
    pages.forEach((page,index)=>{
        if(index)pdf.addPage();
        for(const cmd of page.commands){
            if(cmd.type==='rect'){pdf.setFillColor(cmd.color);pdf.rect(cmd.x*scale,cmd.y*scale,cmd.w*scale,cmd.h*scale,'F');}
            else if(cmd.type==='text'){pdf.setFont('helvetica',cmd.bold?'bold':'normal');pdf.setFontSize(cmd.size*scale*72/25.4);pdf.setTextColor(cmd.color);pdf.text(cmd.text,cmd.x*scale,cmd.y*scale);}
            else if(cmd.type==='image')pdf.addImage(cmd.image,'PNG',cmd.x*scale,cmd.y*scale,cmd.w*scale,cmd.h*scale);
        }
    });pdf.save(name+'.pdf');
}
async function reportJpegPage(page){
    const canvas=document.createElement('canvas');canvas.width=REPORT.width*1.5;canvas.height=REPORT.height*1.5;const ctx=canvas.getContext('2d');ctx.scale(1.5,1.5);ctx.fillStyle='#fff';ctx.fillRect(0,0,REPORT.width,REPORT.height);
    for(const cmd of page.commands){
        if(cmd.type==='rect'){ctx.fillStyle=cmd.color;ctx.fillRect(cmd.x,cmd.y,cmd.w,cmd.h);}
        else if(cmd.type==='text'){ctx.fillStyle=cmd.color;ctx.font=(cmd.bold?'bold ':'')+cmd.size+'px Arial';ctx.fillText(cmd.text,cmd.x,cmd.y);}
        else if(cmd.type==='image'){const img=new Image();img.src=cmd.image;await img.decode();ctx.drawImage(img,cmd.x,cmd.y,cmd.w,cmd.h);}
    }
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));canvas.width=canvas.height=1;if(!blob)throw Error('Não foi possível gerar a página JPEG.');return blob;
}
async function exportReport(format){
    if(reportBusy)return;
    if(!validData.length){alert('Não há registros para exportar. Ajuste os filtros.');return;}
    const rows=validData.map(row=>({...row})),name='relatorio_rocadeiras_'+new Date().toLocaleDateString('sv-SE');
    const controls=[...document.querySelectorAll('#exportModal button, #exportModal input, #exportModal textarea')];
    reportBusy=true;controls.forEach(control=>control.disabled=true);
    try{
        if(format==='csv'){
            const identity=reportIdentity();
            const fields=['Data','Operador','Periodo','Local','Equipamento','Inicio','Fim','DurationMinutes'];
            const labels=['Data','Operador','Turno','Bloco','Roçadeira','Início','Fim','Duração em minutos','Título do relatório','Unidade','Observações'];
            const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
            const csv=[labels.map(cell).join(';'),...rows.map(row=>[...fields.map(key=>row[key]),identity.title,identity.unit,identity.notes].map(cell).join(';'))].join('\r\n');
            downloadReportBlob(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),name+'.csv');
        }else{
            await document.fonts.ready;updateStatusBadge('syncing','Preparando páginas…');
            const pages=await reportBuildPages(rows);
            if(format==='pdf')reportPdf(pages,name);
            else{
                for(let index=0;index<pages.length;index++){
                    updateStatusBadge('syncing','Gerando imagem '+(index+1)+'/'+pages.length);
                    const blob=await reportJpegPage(pages[index]);
                    const filename=pages.length===1?name+'.jpg':name+'_pagina_'+String(index+1).padStart(3,'0')+'.jpg';
                    downloadReportBlob(blob,filename);
                }
            }
        }
        reportBusy=false;closeExportModal();
    }catch(error){console.error(error);alert('Não foi possível gerar o arquivo: '+error.message);}
    finally{reportBusy=false;controls.forEach(control=>control.disabled=false);updateStatusBadge('online');}
}
