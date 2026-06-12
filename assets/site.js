/* ===================== CALCULADORA ITCMD =====================
   >>> EDITAR ALÍQUOTAS: objeto ALIQUOTAS_ITCMD. "prog:true" = estado progressivo
   (valor é alíquota representativa única). PERCENTUAL_BASE_PADRAO = base do
   planejamento quando o DIRPF não é informado. */
const ALIQUOTAS_ITCMD = {
  AC:{nome:"Acre",aliquota:4,prog:true}, AL:{nome:"Alagoas",aliquota:4,prog:false},
  AP:{nome:"Amapá",aliquota:4,prog:false}, AM:{nome:"Amazonas",aliquota:2,prog:false},
  BA:{nome:"Bahia",aliquota:8,prog:true}, CE:{nome:"Ceará",aliquota:6,prog:true},
  DF:{nome:"Distrito Federal",aliquota:6,prog:true}, ES:{nome:"Espírito Santo",aliquota:4,prog:false},
  GO:{nome:"Goiás",aliquota:4,prog:true}, MA:{nome:"Maranhão",aliquota:4,prog:false},
  MT:{nome:"Mato Grosso",aliquota:4,prog:true}, MS:{nome:"Mato Grosso do Sul",aliquota:6,prog:false},
  MG:{nome:"Minas Gerais",aliquota:5,prog:false}, PA:{nome:"Pará",aliquota:4,prog:false},
  PB:{nome:"Paraíba",aliquota:8,prog:true}, PR:{nome:"Paraná",aliquota:4,prog:false},
  PE:{nome:"Pernambuco",aliquota:5,prog:false}, PI:{nome:"Piauí",aliquota:4,prog:false},
  RJ:{nome:"Rio de Janeiro",aliquota:8,prog:true}, RN:{nome:"Rio Grande do Norte",aliquota:4,prog:false},
  RS:{nome:"Rio Grande do Sul",aliquota:6,prog:true}, RO:{nome:"Rondônia",aliquota:4,prog:true},
  RR:{nome:"Roraima",aliquota:4,prog:false}, SC:{nome:"Santa Catarina",aliquota:8,prog:true},
  SP:{nome:"São Paulo",aliquota:4,prog:false}, SE:{nome:"Sergipe",aliquota:4,prog:false},
  TO:{nome:"Tocantins",aliquota:4,prog:true}
};
const UF_PADRAO = "MG";
const PHONE = "553599667294";

// Parâmetros de custo
const HONORARIOS_PCT = 0.10;
const CUSTAS_EXTRA_PCT = 0.03;
const CUSTAS_JUD_PCT = 0.05;
const GANHO_CAPITAL_PCT = 0.15;
const BASE_IR_PADRAO_PCT = 0.20;
const ESTRUTURACAO_PCT = 0.025;
const LITIGIO_BOOST = 1.25;
const PLAN_ITCMD_FRAC = 2/3;

const fmtBRL = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtBRLnice = v => Math.round(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const fmtPct = v => (Number.isInteger(v)? v : v.toFixed(1).replace(".",",")) + "%";
const soDig = s => (s||"").replace(/\D/g,"");
const num = s => { const d=soDig(s); return d?parseInt(d,10)/100:0; };
function mask(el){el.addEventListener("input",()=>{const n=num(el.value);el.value=n>0?fmtBRL(n):"";calc();});}

const selUF=document.getElementById("cuf");
Object.keys(ALIQUOTAS_ITCMD).sort((a,b)=>ALIQUOTAS_ITCMD[a].nome.localeCompare(ALIQUOTAS_ITCMD[b].nome,"pt-BR")).forEach(uf=>{
  const o=document.createElement("option");
  o.value=uf;o.textContent=`${ALIQUOTAS_ITCMD[uf].nome} (${uf}) — ${fmtPct(ALIQUOTAS_ITCMD[uf].aliquota)}`;
  selUF.appendChild(o);
});
selUF.value=UF_PADRAO;

const cv=document.getElementById("cv"),co=document.getElementById("co"),cd=document.getElementById("cd");
mask(cv);mask(co);mask(cd);
selUF.addEventListener("change",calc);
document.getElementById("ch").addEventListener("change",calc);
document.querySelectorAll('input[name=proc]').forEach(r=>r.addEventListener("change",calc));
const chkConf=document.getElementById("conflito");
chkConf.addEventListener("change",()=>{
  document.getElementById("chkConf").classList.toggle("on",chkConf.checked);
  if(chkConf.checked){document.querySelector('input[name=proc][value=jud]').checked=true;}
  calc();
});

const set=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t;};

function calc(){
  const imoveis=num(cv.value), outros=num(co.value), ir=num(cd.value);
  const pat = imoveis+outros;
  const uf=selUF.value, aPct=ALIQUOTAS_ITCMD[uf].aliquota, a=aPct/100;
  const proc=document.querySelector('input[name=proc]:checked').value;
  const conf=chkConf.checked;
  const procEff = conf ? "jud" : proc;

  if(pat<=0){
    ["rmin","rmax","invItcmd","invHon","invCust","invGc","invTot","planItcmd","planEst","planTot","ecoVal"].forEach(id=>set(id,"—"));
    set("aliqLabel","—");set("ecoPct","");set("rnote","Preencha o patrimônio para ver a estimativa.");
    window._calcState = null;
    return;
  }

  const itcmdInv = pat * a;
  const baseIR = ir>0 ? ir : pat * BASE_IR_PADRAO_PCT;
  const gcBase = Math.max(0, pat - baseIR);

  let totMin = itcmdInv + (pat * CUSTAS_EXTRA_PCT) + (gcBase * 0.15);
  let totMax = itcmdInv + (pat * HONORARIOS_PCT) + (pat * CUSTAS_JUD_PCT) + (gcBase * 0.225);
  if(conf) totMax *= LITIGIO_BOOST;

  const hon = procEff==="jud" ? pat * HONORARIOS_PCT : 0;
  const cust = procEff==="jud" ? pat * CUSTAS_JUD_PCT : pat * CUSTAS_EXTRA_PCT;
  const gc = gcBase * GANHO_CAPITAL_PCT;
  let totBd = itcmdInv + hon + cust + gc;
  if(conf) totBd *= LITIGIO_BOOST;

  const itcmdPlan = baseIR * PLAN_ITCMD_FRAC * a;
  const estrut = pat * ESTRUTURACAO_PCT;
  const totPlan = itcmdPlan + estrut;

  const eco = Math.max(0, totBd - totPlan);
  const ecoPct = totBd>0 ? eco/totBd*100 : 0;

  set("aliqLabel", fmtPct(aPct));
  set("rmin", fmtBRLnice(totMin));
  set("rmax", fmtBRLnice(totMax));
  set("rnote", `Faixa baseada em patrimônio total de ${fmtBRLnice(pat)} em ${ALIQUOTAS_ITCMD[uf].nome} (${uf}). Mínimo = extrajudicial sem litígio. Máximo = ${procEff==="jud"?"judicial":"extrajudicial"} com todos os custos${conf?" + conflito familiar":""}.`);

  set("invItcmd", fmtBRLnice(itcmdInv));
  set("invHon", procEff==="jud" ? fmtBRLnice(hon) : "Não se aplica");
  set("invCust", fmtBRLnice(cust));
  set("invGc", fmtBRLnice(gc));
  set("invTot", fmtBRLnice(totBd));

  set("planItcmd", fmtBRLnice(itcmdPlan));
  set("planEst", fmtBRLnice(estrut));
  set("planTot", fmtBRLnice(totPlan));

  set("ecoVal", fmtBRLnice(eco));
  set("ecoPct", ecoPct>0 ? `≈ ${fmtPct(Math.round(ecoPct))} menos que o inventário` : "");

  window._calcState = {
    pat, uf, ufNome: ALIQUOTAS_ITCMD[uf].nome,
    totMin, totMax, totBd, eco, proc: procEff, conf,
    imoveis, outros, ir
  };
}

cv.value=fmtBRL(4000000);
co.value=fmtBRL(0);
cd.value=fmtBRL(800000);
calc();

/* ===================== POPUP QUALIFICAÇÃO ===================== */
function patrimonioBracket(pat){
  if(pat < 500000) return "menos500k";
  if(pat < 1000000) return "500k1M";
  if(pat <= 10000000) return "1M10M";
  return "acima10M";
}

function openModal(){
  const s = window._calcState;
  const prefill = document.getElementById('qPrefillSummary');
  if(s && s.pat > 0){
    const bracket = patrimonioBracket(s.pat);
    const radio = document.querySelector(`input[name=patrimonio][value="${bracket}"]`);
    if(radio) radio.checked = true;
    prefill.style.display = 'flex';
    prefill.innerHTML = '<span><strong>Sua simulação:</strong> patrimônio de '+fmtBRLnice(s.pat)+' em '+s.ufNome+' · estimativa '+fmtBRLnice(s.totMin)+' a '+fmtBRLnice(s.totMax)+'</span>';
  } else {
    prefill.style.display = 'none';
  }
  document.getElementById('qpopup').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeModal(){
  document.getElementById('qpopup').classList.remove('open');
  document.body.style.overflow='';
  document.getElementById('qform-wrap').style.display='';
  document.getElementById('qthanks-padrao').style.display='none';
  document.getElementById('qthanks-ebook').style.display='none';
  document.querySelectorAll('.qerr').forEach(e=>e.style.display='none');
  document.querySelectorAll('.qfield input').forEach(i=>i.classList.remove('err'));
  document.getElementById('qbtn').disabled=false;
  document.getElementById('qbtn').textContent='Quero meu diagnóstico gratuito →';
}
document.getElementById('qpopup').addEventListener('click', e=>{if(e.target.id==='qpopup') closeModal();});
document.addEventListener('keydown', e=>{if(e.key==='Escape') closeModal();});

document.getElementById('qtel').addEventListener('input', function(){
  let v=this.value.replace(/\D/g,'').slice(0,11);
  if(v.length>10) v=v.replace(/^(\d{2})(\d{5})(\d{4}).*/,'($1) $2-$3');
  else if(v.length>6) v=v.replace(/^(\d{2})(\d{4})(\d*)/,'($1) $2-$3');
  else if(v.length>2) v=v.replace(/^(\d{2})(\d*)/,'($1) $2');
  this.value=v;
});

document.getElementById('qform').addEventListener('submit', function(ev){
  ev.preventDefault();
  const nome=document.getElementById('qnome').value.trim();
  const tel=document.getElementById('qtel').value.trim();
  const email=document.getElementById('qemail').value.trim();
  const pat=document.querySelector('input[name=patrimonio]:checked');
  let ok=true;
  document.querySelectorAll('.qerr').forEach(e=>e.style.display='none');
  document.querySelectorAll('.qfield input').forEach(i=>i.classList.remove('err'));

  if(!nome){document.getElementById('qnome-err').style.display='block';document.getElementById('qnome').classList.add('err');ok=false;}
  const td=tel.replace(/\D/g,'');
  if(td.length<10||td.length>11){document.getElementById('qtel-err').style.display='block';document.getElementById('qtel').classList.add('err');ok=false;}
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){document.getElementById('qemail-err').style.display='block';document.getElementById('qemail').classList.add('err');ok=false;}
  if(!pat){document.getElementById('qpatrimonio-err').style.display='block';ok=false;}
  if(!ok) return;

  const btn=document.getElementById('qbtn');
  btn.disabled=true; btn.textContent='Enviando...';

  const pv=pat.value;
  const s=window._calcState;
  const ctxLines=['Faixa patrimônio: '+pat.parentElement.textContent.trim()];
  if(s && s.pat>0){
    ctxLines.push('Simulação: patrimônio '+fmtBRLnice(s.pat)+' em '+s.ufNome+' ('+s.uf+')');
    ctxLines.push('Estimativa de custo: '+fmtBRLnice(s.totMin)+' a '+fmtBRLnice(s.totMax));
    ctxLines.push('Economia possível: '+fmtBRLnice(s.eco));
    ctxLines.push('Cenário: '+(s.proc==='jud'?'judicial':'extrajudicial')+(s.conf?' com conflito familiar':''));
  }
  const ctx=ctxLines.join(' | ');

  // Pixel/CAPI só pra leads qualificados
  if(pv!=='menos500k'){
    sendCapi('Lead',{});
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({event:'lead_qualified',patrimonio_faixa:pv});
  } else {
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({event:'lead_ebook',patrimonio_faixa:'menos500k'});
  }

  fetch('https://crm.mck.agenciaever.cloud/api/leads/publico',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      formulario_slug: pv==='menos500k' ? 'dna_pps_ebook' : 'dna_pps',
      nome, whatsapp:tel, email, contexto:ctx,
      landing_page: window.location.href
    })
  }).catch(()=>{}).finally(()=>{
    document.getElementById('qform-wrap').style.display='none';

    if(pv==='menos500k'){
      document.getElementById('qthanks-ebook').style.display='block';
    } else {
      let msg='Olá, vim do site, quero fazer uma simulação com especialistas da DNA.';
      if(s && s.pat>0){
        msg += ' Simulei: patrimônio '+fmtBRLnice(s.pat)+' em '+s.ufNome+', estimativa de custo entre '+fmtBRLnice(s.totMin)+' e '+fmtBRLnice(s.totMax)+'.';
      }
      window.open('https://api.whatsapp.com/send?phone='+PHONE+'&text='+encodeURIComponent(msg), '_blank');
      document.getElementById('qthanks-padrao').style.display='block';
    }
  });
});

/* ===================== ANIMAÇÕES REMOVIDAS — site estático ===================== */
