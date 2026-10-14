/*!
 * PopPopMake paycheck engine \u2014 the ONE shared 2026 US payroll-tax model.
 *
 * Used by /paycheck-calculator, all 51 state pages and the embeddable widget,
 * so a rate change is made here, once, and this single file is uploaded.
 * (sw.js and _headers keep this file from going stale in anyone's browser.)
 *
 * What is modelled
 *   Federal income tax (single, married jointly, married separately, head of household),
 *   Social Security / Medicare / Additional Medicare, state income tax for all 50 states + DC
 *   (rates, standard deductions / exemptions, the state-specific rules such as MO's federal-tax
 *   deduction, OH's zero bracket, CT's credit table, NJ's no-tax threshold and the two-earner
 *   married rules in AR, DC, DE, KY, MD, MA, MN, MO, MS, ND, OH, SC, VA and WI),
 *   the employee's share of state payroll programs (CA SDI, CO FAMLI, CT Paid Leave, DE Paid Leave,
 *   MA PFML, ME PFML, MN Paid Leave, NJ UI/workforce/TDI/FLI, NY SDI + PFL, OR Paid Leave + transit tax,
 *   PA UC, RI TDI, VT child care contribution, WA Cares + PFML), pre-tax and after-tax payroll
 *   deductions, a one-time bonus, hourly pay with overtime (incl. the 2025-2028 federal overtime
 *   deduction), a spouse's / second job's pay, and the child tax credit.
 *
 * Not modelled: local (city / county) taxes, state refundable and low-income credits, state dependent
 *   exemptions and credits, itemized deductions, HI TDI and AK unemployment premiums, and the
 *   Minnesota AMT. Where a state has not yet published its 2026 amounts, the latest published
 *   (2025) amounts are used (CA, ID, UT, VT, MD, ND, the DC standard deduction, the MN marriage credit cap).
 *
 * Sources: federal brackets, standard deductions and credits - IRS Rev. Proc. 2025-32;
 *          Social Security wage base - SSA; 401(k) limits - IRS Notice 2025-67;
 *          state figures - each state's tax agency (forms, instructions, rate notices), with the state
 *          rules cross-checked against the open-source PolicyEngine US model; where the two disagreed,
 *          the state's own publication decided.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.PPMPaycheck = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '2026.10.1';
  var DATA_CHECKED = 'October 2026';

  // =====================================================================
  //  DATA  (edit here when rates change)
  // =====================================================================
  var INF = Infinity;

  var FED = {
    statuses: ['single', 'mfj', 'mfs', 'hoh'],
    statusLabels: { single: 'Single', mfj: 'Married filing jointly', mfs: 'Married filing separately', hoh: 'Head of household' },
    brackets: {
      single: [[0,12400,.10],[12400,50400,.12],[50400,105700,.22],[105700,201775,.24],[201775,256225,.32],[256225,640600,.35],[640600,INF,.37]],
      mfj:    [[0,24800,.10],[24800,100800,.12],[100800,211400,.22],[211400,403550,.24],[403550,512450,.32],[512450,768700,.35],[768700,INF,.37]],
      hoh:    [[0,17700,.10],[17700,67450,.12],[67450,105700,.22],[105700,201750,.24],[201750,256200,.32],[256200,640600,.35],[640600,INF,.37]],
      mfs:    [[0,12400,.10],[12400,50400,.12],[50400,105700,.22],[105700,201775,.24],[201775,256225,.32],[256225,384350,.35],[384350,INF,.37]]
    },
    stdDeduction: { single: 16100, mfj: 32200, hoh: 24150, mfs: 16100 },
    ssRate: 0.062,
    ssWageBase: 184500,
    medicareRate: 0.0145,
    addlMedicareRate: 0.009,
    addlMedicareThreshold: { single: 200000, mfj: 250000, hoh: 200000, mfs: 125000 },
    // flat withholding on bonuses and other supplemental pay
    supplemental: { rate: 0.22, highRate: 0.37, highThreshold: 1000000 },
    // traditional 401(k) / 403(b) employee-deferral limits (informational warning only)
    k401: { limit: 24500, catchup50: 8000, catchup6063: 11250 },
    // child tax credit / credit for other dependents (treated as non-refundable here)
    credits: { child: 2200, other: 500, phaseStep: 50, phasePer: 1000,
      phaseStart: { single: 200000, mfj: 400000, hoh: 200000, mfs: 200000 } },
    // 2025-2028 federal deduction for the "half" premium part of overtime pay (IRC 225).
    // A married person must file jointly to claim it, so married-filing-separately gets none.
    overtime: { cap: { single: 12500, mfj: 25000, hoh: 12500, mfs: 0 }, eligible: { single: true, mfj: true, hoh: true, mfs: false },
      phaseStart: { single: 150000, mfj: 300000, hoh: 150000, mfs: 150000 }, phaseRate: 0.10, premiumShare: 0.5 }
  };

  // State income tax, 2026. Each entry may carry per-filing-status values
  // {single, mfj, hoh, mfs}; a missing hoh / mfs value falls back to single.
  // modeled: filing statuses whose state rules are exact (no separate schedule or fully listed).
  // no401k: the state taxes 401(k) deferrals as wages.
  var STATES = {
    AK: {name:"Alaska",type:"none"},
    AL: {name:"Alabama",type:"calc",rule:"AL",brackets:{single:[[0,500,0.02],[500,3000,0.04],[3000,Infinity,0.05]],mfj:[[0,1000,0.02],[1000,6000,0.04],[6000,Infinity,0.05]]},std:{single:{max:3000,min:2500,rate:25,inc:500,thr:25500},mfj:{max:8500,min:5000,rate:175,inc:500,thr:25500},hoh:{max:5200,min:2500,rate:135,inc:500,thr:25500},mfs:{max:4250,min:2500,rate:88,inc:250,thr:12750}},exemption:{single:1500,mfj:3000,hoh:3000,mfs:1500},modeled:["hoh","mfs"]},
    AR: {name:"Arkansas",type:"calc",rule:"AR",brackets:[[0,5600,0],[5600,11200,0.02],[11200,16000,0.03],[16000,26400,0.034],[26400,Infinity,0.037]],stdPerson:2470,credit:29,highFrom:94700,modeled:["mfs"]},
    AZ: {name:"Arizona",type:"calc",baseType:"gross",rate:0.025,stdDed:{single:16100,mfj:32200,hoh:24150,mfs:16100},modeled:["hoh","mfs"]},
    CA: {name:"California",type:"calc",rule:"CA",brackets:{single:[[0,11079,0.01],[11079,26264,0.02],[26264,41452,0.04],[41452,57542,0.06],[57542,72724,0.08],[72724,371479,0.093],[371479,445771,0.103],[445771,742953,0.113],[742953,Infinity,0.123]],mfj:[[0,22158,0.01],[22158,52528,0.02],[52528,82904,0.04],[82904,115084,0.06],[115084,145448,0.08],[145448,742958,0.093],[742958,891542,0.103],[891542,1485906,0.113],[1485906,Infinity,0.123]]},stdDed:{single:5706,mfj:11412},exCredit:153,exPhaseStart:{single:252203,mfj:504411},surchargeThreshold:1000000,surchargeRate:0.01,addon:{rate:0.013,label:"California SDI (1.3%)",short:"SDI (1.3%, uncapped)"},modeled:["mfs"]},
    CO: {name:"Colorado",type:"calc",rule:"CO",rate:0.044,addbackFrom:300000,addbackKeep:{single:1000,mfj:2000,hoh:1000,mfs:1000},addon:{rate:0.0044,label:"Colorado FAMLI (0.44%)",short:"FAMLI (0.44%)",cap:184500},modeled:["hoh","mfs"]},
    CT: {name:"Connecticut",type:"calc",rule:"CT",brackets:{single:[[0,10000,0.02],[10000,50000,0.045],[50000,100000,0.055],[100000,200000,0.06],[200000,250000,0.065],[250000,500000,0.069],[500000,Infinity,0.0699]],mfj:[[0,20000,0.02],[20000,100000,0.045],[100000,200000,0.055],[200000,400000,0.06],[400000,500000,0.065],[500000,1000000,0.069],[1000000,Infinity,0.0699]],hoh:[[0,16000,0.02],[16000,80000,0.045],[80000,160000,0.055],[160000,320000,0.06],[320000,400000,0.065],[400000,800000,0.069],[800000,Infinity,0.0699]]},exempt:{single:[15000,30000],mfj:[24000,48000],hoh:[19000,38000],mfs:[12000,24000]},addBack:{single:[56500,5000,25,250],mfj:[100500,5000,50,500],hoh:[78500,4000,40,400],mfs:[50250,2500,25,250]},recapture:{single:[[105000,5000,25,250],[200000,5000,90,2700],[500000,5000,50,450]],mfj:[[210000,10000,50,500],[400000,10000,180,5400],[1000000,10000,100,900]],hoh:[[168000,8000,40,400],[320000,8000,140,4200],[800000,8000,80,720]],mfs:[[105000,5000,25,250],[200000,5000,90,2700],[500000,5000,50,450]]},credit:{single:[[15000,0.75],[18800,0.7],[19300,0.65],[19800,0.6],[20300,0.55],[20800,0.5],[21300,0.45],[21800,0.4],[22300,0.35],[25000,0.3],[25500,0.25],[26000,0.2],[26500,0.15],[31300,0.14],[31800,0.13],[32300,0.12],[32800,0.11],[33300,0.1],[60000,0.09],[60500,0.08],[61000,0.07],[61500,0.06],[62000,0.05],[62500,0.04],[63000,0.03],[63500,0.02],[64000,0.01],[64500,0]],mfj:[[24000,0.75],[30000,0.7],[30500,0.65],[31000,0.6],[31500,0.55],[32000,0.5],[32500,0.45],[33000,0.4],[33500,0.35],[40000,0.3],[40500,0.25],[41000,0.2],[41500,0.15],[50000,0.14],[50500,0.13],[51000,0.12],[51500,0.11],[52000,0.1],[96000,0.09],[96500,0.08],[97000,0.07],[97500,0.06],[98000,0.05],[98500,0.04],[99000,0.03],[99500,0.02],[100000,0.01],[100500,0]],hoh:[[19000,0.75],[24000,0.7],[24500,0.65],[25000,0.6],[25500,0.55],[26000,0.5],[26500,0.45],[27000,0.4],[27500,0.35],[34000,0.3],[34500,0.25],[35000,0.2],[35500,0.15],[44000,0.14],[44500,0.13],[45000,0.12],[45500,0.11],[46000,0.1],[74000,0.09],[74500,0.08],[75000,0.07],[75500,0.06],[76000,0.05],[76500,0.04],[77000,0.03],[77500,0.02],[78000,0.01],[78500,0]],mfs:[[12000,0.75],[15000,0.7],[15500,0.65],[16000,0.6],[16500,0.55],[17000,0.5],[17500,0.45],[18000,0.4],[18500,0.35],[20000,0.3],[20500,0.25],[21000,0.2],[21500,0.15],[25000,0.14],[25500,0.13],[26000,0.12],[26500,0.11],[27000,0.1],[48000,0.09],[48500,0.08],[49000,0.07],[49500,0.06],[50000,0.05],[50500,0.04],[51000,0.03],[51500,0.02],[52000,0.01],[52500,0]]},addon:{rate:0.005,label:"Connecticut Paid Leave (0.5%)",short:"Paid Leave (0.5%)",cap:184500},modeled:["hoh","mfs"]},
    DC: {name:"Washington DC",type:"calc",rule:"DC",brackets:{single:[[0,10000,0.04],[10000,40000,0.06],[40000,60000,0.065],[60000,250000,0.085],[250000,500000,0.0925],[500000,1000000,0.0975],[1000000,Infinity,0.1075]],mfj:[[0,10000,0.04],[10000,40000,0.06],[40000,60000,0.065],[60000,250000,0.085],[250000,500000,0.0925],[500000,1000000,0.0975],[1000000,Infinity,0.1075]]},stdDed:{single:15000,mfj:30000,hoh:22500,mfs:15000},modeled:["hoh","mfs"]},
    DE: {name:"Delaware",type:"calc",splitOK:true,baseType:"gross",brackets:{single:[[0,2000,0],[2000,5000,0.022],[5000,10000,0.039],[10000,20000,0.048],[20000,25000,0.052],[25000,60000,0.0555],[60000,Infinity,0.066]],mfj:[[0,2000,0],[2000,5000,0.022],[5000,10000,0.039],[10000,20000,0.048],[20000,25000,0.052],[25000,60000,0.0555],[60000,Infinity,0.066]]},stdDed:{single:3250,mfj:6500},credit:{single:110,mfj:220},addon:{rate:0.004,label:"Delaware Paid Leave (0.4%)",short:"Paid Leave (0.4%)",cap:184500},modeled:["hoh","mfs"]},
    FL: {name:"Florida",type:"none"},
    GA: {name:"Georgia",type:"calc",baseType:"gross",rate:0.0499,stdDed:{single:15000,mfj:30000},modeled:["hoh","mfs"]},
    HI: {name:"Hawaii",type:"calc",baseType:"gross",brackets:{single:[[0,9600,0.014],[9600,14400,0.032],[14400,19200,0.055],[19200,24000,0.064],[24000,36000,0.068],[36000,48000,0.072],[48000,125000,0.076],[125000,175000,0.079],[175000,225000,0.0825],[225000,275000,0.09],[275000,325000,0.1],[325000,Infinity,0.11]],mfj:[[0,19200,0.014],[19200,28800,0.032],[28800,38400,0.055],[38400,48000,0.064],[48000,72000,0.068],[72000,96000,0.072],[96000,250000,0.076],[250000,350000,0.079],[350000,450000,0.0825],[450000,550000,0.09],[550000,650000,0.1],[650000,Infinity,0.11]]},stdDed:{single:8000,mfj:16000},exemption:{single:1144,mfj:2288},modeled:["mfs"]},
    IA: {name:"Iowa",type:"calc",baseType:"fedTaxable",rate:0.038,credit:{single:40,mfj:80},modeled:["mfs"]},
    ID: {name:"Idaho",type:"calc",rule:"ID",rate:0.053,zero:{single:4811,mfj:9622,hoh:9622},pbf:10,grocery:155,modeled:["hoh","mfs"]},
    IL: {name:"Illinois",type:"calc",rule:"IL",rate:0.0495,exemption:{single:2925,mfj:5850},exLimit:{single:250000,mfj:500000},modeled:["hoh","mfs"]},
    IN: {name:"Indiana",type:"calc",baseType:"gross",rate:0.0295,stdDed:{single:1000,mfj:2000},modeled:["hoh","mfs"]},
    KS: {name:"Kansas",type:"calc",baseType:"gross",brackets:{single:[[0,23000,0.052],[23000,Infinity,0.0558]],mfj:[[0,46000,0.052],[46000,Infinity,0.0558]]},stdDed:{single:3605,mfj:8240,mfs:4120},exemption:{single:9160,mfj:18320},modeled:["mfs"]},
    KY: {name:"Kentucky",type:"calc",splitOK:true,baseType:"gross",rate:0.035,stdDed:{single:3360,mfj:3360},modeled:["hoh","mfs"]},
    LA: {name:"Louisiana",type:"calc",baseType:"gross",rate:0.03,stdDed:{single:12875,mfj:25750,hoh:25750},modeled:["hoh","mfs"]},
    MA: {name:"Massachusetts",type:"calc",rule:"MA",brackets:[[0,1107750,0.05],[1107750,Infinity,0.09]],exemption:{single:4400,mfj:8800,hoh:6800,mfs:4400},ficaCap:2000,addon:{rate:0.0046,label:"Massachusetts PFML (0.46%)",short:"PFML (0.46%)",cap:184500},modeled:["hoh","mfs"]},
    MD: {name:"Maryland",type:"calc",rule:"MD",brackets:{single:[[0,1000,0.02],[1000,2000,0.03],[2000,3000,0.04],[3000,100000,0.0475],[100000,125000,0.05],[125000,150000,0.0525],[150000,250000,0.055],[250000,500000,0.0575],[500000,1000000,0.0625],[1000000,Infinity,0.065]],mfj:[[0,1000,0.02],[1000,2000,0.03],[2000,3000,0.04],[3000,150000,0.0475],[150000,175000,0.05],[175000,225000,0.0525],[225000,300000,0.055],[300000,600000,0.0575],[600000,1200000,0.0625],[1200000,Infinity,0.065]]},stdDed:{single:3350,mfj:6700},exemption:{single:3200,mfj:3200},exPhase:{single:[100000,125000,150000],mfj:[150000,175000,200000]},twoIncome:1200,modeled:["mfs"]},
    ME: {name:"Maine",type:"calc",rule:"ME",brackets:{single:[[0,27400,0.058],[27400,64850,0.0675],[64850,Infinity,0.0715]],mfj:[[0,54850,0.058],[54850,129750,0.0675],[129750,Infinity,0.0715]],hoh:[[0,41100,0.058],[41100,97300,0.0675],[97300,Infinity,0.0715]]},stdDed:{single:15700,mfj:31400,hoh:23550,mfs:15700},stdPhase:{single:[102250,75000],mfj:[204550,150000],hoh:[153400,112500],mfs:[102250,75000]},exemption:{single:5300,mfj:10600,hoh:5300,mfs:5300},exPhase:{single:[341000,125000],mfj:[409150,125000],hoh:[375050,125000],mfs:[204575,62500]},surcharge:{single:1000000,mfj:1500000,hoh:1500000,mfs:750000},surchargeRate:0.02,addon:{rate:0.005,label:"Maine Paid Family & Medical Leave (0.5%)",short:"Paid Leave (0.5%)",cap:184500},modeled:["hoh","mfs"]},
    MI: {name:"Michigan",type:"calc",baseType:"gross",rate:0.0425,stdDed:{single:5900,mfj:11800},modeled:["hoh","mfs"]},
    MN: {name:"Minnesota",type:"calc",rule:"MN",brackets:{single:[[0,33310,0.0535],[33310,109430,0.068],[109430,203150,0.0785],[203150,Infinity,0.0985]],mfj:[[0,48700,0.0535],[48700,193480,0.068],[193480,337930,0.0785],[337930,Infinity,0.0985]]},stdDed:{single:15300,mfj:30600},redLow:{single:244400,mfj:244400,hoh:244400,mfs:122200},redHigh:{single:337800,mfj:337800,hoh:337800,mfs:168900},lowRate:0.03,highRate:0.1,altRate:0.8,altFrom:1107750,marriage:{minIncome:31000,minTaxable:48000,max:1851},addon:{rate:0.0044,label:"Minnesota Paid Leave (0.44%)",short:"Paid Leave (0.44%)",cap:185000}},
    MO: {name:"Missouri",type:"calc",rule:"MO",brackets:[[0,1348,0],[1348,2696,0.02],[2696,4044,0.025],[4044,5392,0.03],[5392,6740,0.035],[6740,8088,0.04],[8088,9436,0.045],[9436,Infinity,0.047]],fedDedRates:[[25000,0.35],[50000,0.25],[100000,0.15],[125000,0.05]],fedDedCap:{single:5000,mfj:10000,hoh:5000,mfs:5000},hohExemption:1400,modeled:["hoh","mfs"]},
    MS: {name:"Mississippi",type:"calc",splitOK:true,baseType:"gross",rate:0.04,stdDed:{single:2300,mfj:4600,hoh:3400},exemption:{single:6000,mfj:12000,hoh:8000},zeroBracket:10000,modeled:["hoh","mfs"]},
    MT: {name:"Montana",type:"calc",baseType:"fedTaxable",brackets:{single:[[0,47500,0.047],[47500,Infinity,0.0565]],mfj:[[0,95000,0.047],[95000,Infinity,0.0565]]},modeled:["mfs"]},
    NC: {name:"North Carolina",type:"calc",baseType:"gross",rate:0.0399,stdDed:{single:12750,mfj:25500,hoh:19125},modeled:["hoh","mfs"]},
    ND: {name:"North Dakota",type:"calc",rule:"ND",brackets:{single:[[0,48475,0],[48475,244825,0.0195],[244825,Infinity,0.025]],mfj:[[0,80975,0],[80975,298075,0.0195],[298075,Infinity,0.025]]},mpc:{base:15750,max:312}},
    NE: {name:"Nebraska",type:"calc",baseType:"gross",brackets:{single:[[0,4130,0.0246],[4130,24760,0.0351],[24760,Infinity,0.0455]],mfj:[[0,8250,0.0246],[8250,49530,0.0351],[49530,Infinity,0.0455]],hoh:[[0,7700,0.0246],[7700,39620,0.0351],[39620,Infinity,0.0455]]},stdDed:{single:8850,mfj:17700,hoh:12950},credit:{single:176,mfj:352,hoh:176},modeled:["hoh","mfs"]},
    NH: {name:"New Hampshire",type:"none"},
    NJ: {name:"New Jersey",type:"calc",baseType:"gross",brackets:{single:[[0,20000,0.014],[20000,35000,0.0175],[35000,40000,0.035],[40000,75000,0.05525],[75000,500000,0.0637],[500000,1000000,0.0897],[1000000,Infinity,0.1075]],mfj:[[0,20000,0.014],[20000,50000,0.0175],[50000,70000,0.0245],[70000,80000,0.035],[80000,150000,0.05525],[150000,500000,0.0637],[500000,1000000,0.0897],[1000000,Infinity,0.1075]],hoh:[[0,20000,0.014],[20000,50000,0.0175],[50000,70000,0.0245],[70000,80000,0.035],[80000,150000,0.05525],[150000,500000,0.0637],[500000,1000000,0.0897],[1000000,Infinity,0.1075]]},exemption:{single:1000,mfj:2000,hoh:1000},freeUpTo:{single:10000,mfj:20000,hoh:20000,mfs:10000},no401k:true,addon:{parts:[{rate:0.00425,cap:44800},{rate:0.0042,cap:171100}],label:"New Jersey payroll taxes (UI, workforce, disability, family leave)",short:"UI, workforce, TDI & FLI"},modeled:["hoh","mfs"]},
    NM: {name:"New Mexico",type:"calc",baseType:"fedTaxable",brackets:{single:[[0,5500,0.015],[5500,16500,0.032],[16500,33500,0.043],[33500,66500,0.047],[66500,210000,0.049],[210000,Infinity,0.059]],mfj:[[0,8000,0.015],[8000,25000,0.032],[25000,50000,0.043],[50000,100000,0.047],[100000,315000,0.049],[315000,Infinity,0.059]]}},
    NV: {name:"Nevada",type:"none"},
    NY: {name:"New York",type:"calc",rule:"NY",brackets:{single:[[0,8500,0.039],[8500,11700,0.044],[11700,13900,0.0515],[13900,80650,0.054],[80650,215400,0.059],[215400,1077550,0.0685],[1077550,5000000,0.0965],[5000000,25000000,0.103],[25000000,Infinity,0.109]],mfj:[[0,17150,0.039],[17150,23600,0.044],[23600,27900,0.0515],[27900,161550,0.054],[161550,323200,0.059],[323200,2155350,0.0685],[2155350,5000000,0.0965],[5000000,25000000,0.103],[25000000,Infinity,0.109]],hoh:[[0,12800,0.039],[12800,17650,0.044],[17650,20900,0.0515],[20900,107650,0.054],[107650,269300,0.059],[269300,1616450,0.0685],[1616450,5000000,0.0965],[5000000,25000000,0.103],[25000000,Infinity,0.109]]},stdDed:{single:8000,mfj:16050,hoh:11200,mfs:8000},recapture:{single:{base:[[0,0],[215400,567],[1077550,2614],[5000000,32786]],inc:[[0,567],[215400,2047],[1077550,30172],[5000000,32500]]},mfj:{base:[[0,0],[161550,333],[323200,1140],[2155350,4211],[5000000,64561]],inc:[[0,333],[161550,807],[323200,3071],[2155350,60350],[5000000,32500]]},hoh:{base:[[0,0],[269300,787],[1616450,3346],[5000000,48606]],inc:[[0,787],[269300,2559],[1616450,45260],[5000000,32500]]}},recapStart:107650,recapWidth:50000,flatAbove:25000000,flatRate:0.109,addon:{parts:[{rate:0.005,max:31.2},{rate:0.00432,max:411.91}],label:"New York SDI + Paid Family Leave",short:"SDI + Paid Family Leave"},modeled:["hoh","mfs"]},
    OH: {name:"Ohio",type:"calc",rule:"OH",zero:26050,base:332,rate:0.0275,exemption:[[0,2400],[40001,2150],[80001,1900],[500000,0]],exCredit:20,exCreditLimit:30000,jointCredit:{cap:650,min:500,rates:[[0,0.2],[25000,0.15],[50000,0.1],[75000,0.05],[500000,0]]},modeled:["hoh","mfs"]},
    OK: {name:"Oklahoma",type:"calc",baseType:"gross",brackets:{single:[[0,3750,0],[3750,4900,0.025],[4900,7200,0.035],[7200,Infinity,0.045]],mfj:[[0,7500,0],[7500,9800,0.025],[9800,14400,0.035],[14400,Infinity,0.045]],hoh:[[0,7500,0],[7500,9800,0.025],[9800,14400,0.035],[14400,Infinity,0.045]]},stdDed:{single:6350,mfj:12700,hoh:9350},exemption:{single:1000,mfj:2000},modeled:["hoh","mfs"]},
    OR: {name:"Oregon",type:"calc",rule:"OR",brackets:{single:[[0,4550,0.0475],[4550,11400,0.0675],[11400,125000,0.0875],[125000,Infinity,0.099]],mfj:[[0,9100,0.0475],[9100,22800,0.0675],[22800,250000,0.0875],[250000,Infinity,0.099]]},stdDed:{single:2910,mfj:5820},credit:{single:263,mfj:526},creditLimit:{single:100000,mfj:200000},fedCap:8750,fedCapPhase:{single:[125000,145000],mfj:[250000,290000]},addon:{parts:[{rate:0.006,cap:184500},{rate:0.001}],label:"Oregon Paid Leave + transit tax",short:"Paid Leave + transit tax"}},
    PA: {name:"Pennsylvania",type:"calc",baseType:"gross",rate:0.0307,no401k:true,addon:{rate:0.0007,label:"Pennsylvania UC withholding (0.07%)",short:"UC withholding (0.07%)"},modeled:["hoh","mfs"]},
    RI: {name:"Rhode Island",type:"calc",rule:"RI",brackets:{single:[[0,82050,0.0375],[82050,186450,0.0475],[186450,Infinity,0.0599]],mfj:[[0,82050,0.0375],[82050,186450,0.0475],[186450,Infinity,0.0599]]},stdDed:{single:11200,mfj:22400},exemption:{single:5250,mfj:10500},phaseStart:261000,phaseInc:7450,phaseStep:0.2,addon:{rate:0.011,label:"Rhode Island TDI (1.1%)",short:"TDI (1.1%)",cap:100000},modeled:["mfs"]},
    SC: {name:"South Carolina",type:"calc",rule:"SC",brackets:[[0,30000,0.0199],[30000,Infinity,0.0521]],sciad:{single:15000,mfj:30000,hoh:22500,mfs:15000},sciadStart:{single:40000,mfj:80000,hoh:60000,mfs:40000},sciadWidth:{single:55000,mfj:110000,hoh:82500,mfs:55000},twoEarner:{rate:0.007,cap:50000},modeled:["hoh","mfs"]},
    SD: {name:"South Dakota",type:"none"},
    TN: {name:"Tennessee",type:"none"},
    TX: {name:"Texas",type:"none"},
    UT: {name:"Utah",type:"calc",rule:"UT",rate:0.0445,creditRate:0.06,phaseStart:{single:18213,mfj:36426,hoh:27320,mfs:18213},phaseRate:0.013,modeled:["hoh","mfs"]},
    VA: {name:"Virginia",type:"calc",rule:"VA",brackets:{single:[[0,3000,0.02],[3000,5000,0.03],[5000,17000,0.05],[17000,Infinity,0.0575]],mfj:[[0,3000,0.02],[3000,5000,0.03],[5000,17000,0.05],[17000,Infinity,0.0575]]},stdDed:{single:8750,mfj:17500},exemption:{single:930,mfj:1860},spouseCap:259,modeled:["hoh","mfs"]},
    VT: {name:"Vermont",type:"calc",baseType:"gross",brackets:{single:[[0,49400,0.0335],[49400,119700,0.066],[119700,249700,0.076],[249700,Infinity,0.0875]],mfj:[[0,82500,0.0335],[82500,199450,0.066],[199450,304000,0.076],[304000,Infinity,0.0875]]},stdDed:{single:7650,mfj:15300},exemption:{single:5300,mfj:10600},addon:{rate:0.0011,label:"Vermont child care contribution (0.11%)",short:"child care contribution (0.11%)"}},
    WA: {name:"Washington",type:"none",addon:{parts:[{rate:0.0058},{rate:0.00807159,cap:184500}],label:"WA Cares + Paid Family & Medical Leave",short:"WA Cares + Paid Leave"}},
    WI: {name:"Wisconsin",type:"calc",rule:"WI",brackets:{single:[[0,15110,0.035],[15110,51950,0.044],[51950,332720,0.053],[332720,Infinity,0.0765]],mfj:[[0,20150,0.035],[20150,69260,0.044],[69260,443630,0.053],[443630,Infinity,0.0765]]},stdMax:{single:13960,mfj:25840},stdPhase:{single:[[20120,0.12]],mfj:[[29040,0.19778]]},exemption:{single:700,mfj:1400},marriedCredit:{rate:0.03,max:480}},
    WV: {name:"West Virginia",type:"calc",baseType:"gross",brackets:{single:[[0,10000,0.0211],[10000,25000,0.0281],[25000,40000,0.0316],[40000,60000,0.0422],[60000,Infinity,0.0458]],mfj:[[0,10000,0.0211],[10000,25000,0.0281],[25000,40000,0.0316],[40000,60000,0.0422],[60000,Infinity,0.0458]],mfs:[[0,5000,0.0211],[5000,12500,0.0281],[12500,20000,0.0316],[20000,30000,0.0422],[30000,Infinity,0.0458]]},exemption:{single:2000,mfj:4000},modeled:["hoh","mfs"]},
    WY: {name:"Wyoming",type:"none"}
  };

  // =====================================================================
  //  MATH
  // =====================================================================
  var MAX_MONEY = 1e10;
  var PERIODS = [52, 26, 24, 12, 1];

  function pt(income, brackets) {
    if (income <= 0) return 0;
    var tax = 0;
    for (var i = 0; i < brackets.length; i++) {
      var lo = brackets[i][0], hi = brackets[i][1], rate = brackets[i][2];
      if (income > lo) { tax += (Math.min(income, hi) - lo) * rate; } else { break; }
    }
    return tax;
  }

  function marginalRateOf(income, brackets) {
    var rate = brackets[0][2];
    for (var i = 0; i < brackets.length; i++) {
      if (income > brackets[i][0]) rate = brackets[i][2];
    }
    return rate;
  }

  // value for a filing status, falling back to the single-filer value
  function sv(obj, status) { var v = obj[status]; return v !== undefined ? v : obj.single; }

  // ---------------------------------------------------------------------
  //  State rules the plain "deduction -> brackets" model can't express: phase-outs of the
  //  standard deduction / exemptions, deductions for federal income tax or FICA paid, a husband
  //  and wife taxed on their own shares, tax recapture, credits that shrink with income...
  //  A state with  rule:"XX"  in the table above is figured by RULES.XX(state, status, x) and
  //  returns the HOUSEHOLD's state income tax before the $0 floor, where
  //    x.wages      state wages of the household (your pay + spouse / second job), after 401(k) etc.
  //    x.you, x.other   the two pieces of x.wages (x.other is a spouse only when status is 'mfj')
  //    x.fedTaxable federal taxable income (before the overtime deduction)
  //    x.fedTax     the household's federal income tax after credits
  //    x.fica, x.ficaYou, x.ficaOther   Social Security + Medicare the household / you / the other earner pay
  // ---------------------------------------------------------------------
  function steps(v, start, inc) { return v > start ? Math.ceil((v - start) / inc - 1e-9) : 0; }   // "each $inc or fraction of $inc over start"
  function lastBelow(rows, v) { var r = 0; for (var i = 0; i < rows.length; i++) { if (v >= rows[i][0]) r = rows[i][1]; } return r; }   // [from, value] rows, from <= v
  function upTo(rows, v) { for (var i = 0; i < rows.length; i++) { if (v <= rows[i][0]) return rows[i][1]; } return 0; }          // [limit, value] rows, "$limit or less"
  function persons(status) { return status === 'mfj' ? 2 : 1; }
  function twoEarners(status, x) { return status === 'mfj' && x.you > 0 && x.other > 0; }

  var RULES = {
    // Alabama: federal income tax and FICA are deductible; the standard deduction shrinks with income
    AL: function (s, st, x) {
      var p = sv(s.std, st);
      var std = Math.max(p.min, p.max - Math.floor(Math.max(0, x.wages - p.thr) / p.inc + 1e-9) * p.rate);
      var ded = Math.max(std, x.fica) + x.fedTax + sv(s.exemption, st);
      return pt(Math.max(0, x.wages - ded), sv(s.brackets, st));
    },
    // Arkansas: a couple pays the lower of one joint figure and two separate ones; high incomes use a flat-rate table
    AR: function (s, st, x) {
      function main(ti) {
        if (ti <= 0) return 0;
        if (ti <= s.highFrom) return pt(ti, s.brackets);
        var adj = Math.max(0, 290 - 10 * (Math.ceil((ti - s.highFrom) / 100 - 1e-9) - 1));
        return 0.02 * 4700 + 0.037 * (ti - 4700) - adj;
      }
      function one(w, n) { return Math.max(0, main(Math.max(0, w - s.stdPerson * n)) - s.credit * n); }
      var joint = one(x.wages, persons(st));
      return twoEarners(st, x) ? Math.min(joint, one(x.you, 1) + one(x.other, 1)) : joint;
    },
    // California: exemption credits shrink with income; 1% mental-health surcharge above $1 million
    CA: function (s, st, x) {
      var ti = Math.max(0, x.wages - sv(s.stdDed, st));
      var tax = pt(ti, sv(s.brackets, st));
      if (ti > s.surchargeThreshold) tax += (ti - s.surchargeThreshold) * s.surchargeRate;
      var per = Math.max(0, s.exCredit - 6 * steps(x.wages, sv(s.exPhaseStart, st), st === 'mfs' ? 1250 : 2500));
      return tax - per * persons(st);
    },
    // Connecticut: exemption phase-out, add-back and recapture steps, then a personal credit that falls to 0
    CT: function (s, st, x) {
      var agi = x.wages, ex = sv(s.exempt, st);
      var exemption = Math.max(0, ex[0] - 1000 * steps(agi, ex[1], 1000));
      var tax = pt(Math.max(0, agi - exemption), sv(s.brackets, st));
      var ab = sv(s.addBack, st);
      tax += Math.min(ab[3], steps(agi, ab[0], ab[1]) * ab[2]);
      var rc = sv(s.recapture, st);
      for (var i = 0; i < rc.length; i++) tax += Math.min(rc[i][3], steps(agi, rc[i][0], rc[i][1]) * rc[i][2]);
      return tax * (1 - lastBelow(sv(s.credit, st), agi));
    },
    // Colorado: flat rate on federal taxable income; from $300,000 of income the federal standard deduction is added back (less $1,000 / $2,000)
    CO: function (s, st, x) {
      var back = x.wages >= s.addbackFrom ? Math.max(0, FED.stdDeduction[st] - sv(s.addbackKeep, st)) : 0;
      return s.rate * (x.fedTaxable + back);
    },
    // District of Columbia: a couple may file jointly or "separately on the same return" - each spouse taxed alone, with the one
    // joint deduction split between them in whatever way gives the lowest tax. The lower of the two is used.
    DC: function (s, st, x) {
      var br = sv(s.brackets, st), D = sv(s.stdDed, st);
      var joint = pt(Math.max(0, x.wages - D), br);
      if (!twoEarners(st, x)) return joint;
      function split(a) { return pt(Math.max(0, x.you - a), br) + pt(Math.max(0, x.other - (D - a)), br); }
      var best = Math.min(split(0), split(D));
      for (var i = 0; i < br.length; i++) {      // the best split always puts one spouse exactly on a bracket edge
        var t = br[i][0];
        best = Math.min(best, split(Math.min(D, Math.max(0, x.you - t))), split(Math.min(D, Math.max(0, D - (x.other - t)))));
      }
      return Math.min(joint, best);
    },
    // Idaho: starts from federal taxable income, a zero bracket, a $10 building-fund tax per return and a grocery credit per person
    ID: function (s, st, x) {
      var tax = s.rate * Math.max(0, x.fedTaxable - sv(s.zero, st));
      return tax > 0 ? tax + s.pbf - persons(st) * s.grocery : 0;
    },
    // Illinois: flat rate on income less exemptions, and no exemption above an income limit
    IL: function (s, st, x) {
      var ex = x.wages <= sv(s.exLimit, st) ? sv(s.exemption, st) : 0;
      return s.rate * Math.max(0, x.wages - ex);
    },
    // Massachusetts: exemption plus a Social Security / Medicare deduction of up to $2,000 per earner
    MA: function (s, st, x) {
      var fica = (st === 'mfj') ? Math.min(s.ficaCap, x.ficaYou) + Math.min(s.ficaCap, x.ficaOther) : Math.min(s.ficaCap, x.fica);
      return pt(Math.max(0, x.wages - sv(s.exemption, st) - fica), s.brackets);
    },
    // Maryland: personal exemptions phase out, and a two-income couple subtracts up to $1,200
    MD: function (s, st, x) {
      var ph = sv(s.exPhase, st), agi = x.wages;
      var per = sv(s.exemption, st) * (agi <= ph[0] ? 1 : agi <= ph[1] ? 0.5 : agi <= ph[2] ? 0.25 : 0);
      var sub = twoEarners(st, x) ? Math.min(s.twoIncome, x.you, x.other) : 0;
      return pt(Math.max(0, agi - sub - sv(s.stdDed, st) - per * persons(st)), sv(s.brackets, st));
    },
    // Maine: the standard deduction and the exemption each phase out; 2% surcharge on very high incomes
    ME: function (s, st, x) {
      var agi = x.wages, sp = sv(s.stdPhase, st), ep = sv(s.exPhase, st);
      var std = sv(s.stdDed, st) * (1 - Math.min(1, Math.max(0, agi - sp[0]) / sp[1]));
      var exm = sv(s.exemption, st) * (1 - Math.min(1, Math.max(0, agi - ep[0]) / ep[1]));
      var ti = Math.max(0, agi - std - exm);
      var tax = pt(ti, sv(s.brackets, st));
      var th = sv(s.surcharge, st);
      return ti > th ? tax + (ti - th) * s.surchargeRate : tax;
    },
    // Minnesota: the standard deduction is cut for high incomes (3% of AGI over the first limit, 10% over the second, at most 80%)
    MN: function (s, st, x) {
      var agi = x.wages, base = sv(s.stdDed, st), lo = sv(s.redLow, st), hi = sv(s.redHigh, st);
      var cut = agi > s.altFrom ? s.altRate * base
        : Math.min(s.altRate * base, s.lowRate * Math.min(Math.max(0, agi - lo), hi - lo) + s.highRate * Math.max(0, agi - hi));
      var ti = Math.max(0, agi - Math.max(0, base - cut)), tax = pt(ti, sv(s.brackets, st)), m = s.marriage;
      // marriage credit (Schedule M1MA): a joint couple where both earn at least $31,000 and taxable income is at least $48,000 gets back the
      // marriage penalty - the joint tax less the tax on the lower paycheck and on the rest at single rates - up to $1,851
      if (twoEarners(st, x) && Math.min(x.you, x.other) >= m.minIncome && ti >= m.minTaxable) {
        var low = Math.max(0, Math.min(x.you, x.other) - 0.5 * s.stdDed.mfj);
        var apart = pt(low, s.brackets.single) + pt(Math.max(0, ti - low), s.brackets.single);
        tax -= Math.min(m.max, Math.max(0, tax - apart));
      }
      return tax;
    },
    // Missouri: a share of federal income tax is deductible; spouses are taxed on their own share of taxable income
    MO: function (s, st, x) {
      var agi = x.wages;
      var fedDed = Math.min(sv(s.fedDedCap, st), x.fedTax * upTo(s.fedDedRates, agi));
      var ti = Math.max(0, agi - FED.stdDeduction[st] - fedDed - (st === 'hoh' ? s.hohExemption : 0));
      if (twoEarners(st, x)) return pt(ti * x.you / agi, s.brackets) + pt(ti * x.other / agi, s.brackets);
      return pt(ti, s.brackets);
    },
    // North Dakota: tax on federal taxable income; a joint couple where both earn gets a credit that cancels the marriage penalty
    // (Form ND-1 line 22: the joint tax less the tax on the lower paycheck and on the rest, each at single rates; at most $312)
    ND: function (s, st, x) {
      var br = sv(s.brackets, st), tax = pt(x.fedTaxable, br);
      if (twoEarners(st, x)) {
        var low = Math.max(0, Math.min(x.you, x.other) - s.mpc.base);
        var apart = pt(low, s.brackets.single) + pt(Math.max(0, x.fedTaxable - low), s.brackets.single);
        tax -= Math.min(s.mpc.max, Math.max(0, tax - apart));
      }
      return tax;
    },
    // New York: ordinary brackets plus the "tax benefit recapture" that claws back the lower rates at higher incomes
    NY: function (s, st, x) {
      var agi = x.wages, ti = Math.max(0, agi - sv(s.stdDed, st)), br = sv(s.brackets, st);
      if (agi > s.flatAbove) return ti * s.flatRate;
      var prev = 0;
      for (var i = 0; i < br.length; i++) { if (br[i][0] <= ti) prev = br[i][0]; }
      var frac = Math.min(1, Math.max(0, agi - Math.max(prev, s.recapStart)) / s.recapWidth);
      var rc = sv(s.recapture, st);
      return pt(ti, br) + lastBelow(rc.base, ti) + frac * lastBelow(rc.inc, ti);
    },
    // Ohio: no tax on the first $26,050, exemptions by income, a small exemption credit and a joint-filing credit
    OH: function (s, st, x) {
      var n = persons(st), agi = x.wages;
      var ti = Math.max(0, agi - lastBelow(s.exemption, agi) * n);
      if (ti <= s.zero) return 0;
      var tax = s.base + s.rate * (ti - s.zero);
      if (ti <= s.exCreditLimit) tax = Math.max(0, tax - s.exCredit * n);
      if (twoEarners(st, x) && x.you >= s.jointCredit.min && x.other >= s.jointCredit.min) {
        tax -= Math.min(s.jointCredit.cap, tax * lastBelow(s.jointCredit.rates, ti));
      }
      return tax;
    },
    // Oregon: a capped deduction for federal income tax paid, and an exemption credit that disappears at higher incomes
    OR: function (s, st, x) {
      var agi = x.wages, ph = sv(s.fedCapPhase, st), width = (ph[1] - ph[0]) / 4;
      var cap = agi < ph[0] ? s.fedCap : (agi >= ph[1] ? 0 : s.fedCap - (s.fedCap / 5) * (Math.floor((agi - ph[0]) / width) + 1));
      var ti = Math.max(0, agi - Math.min(x.fedTax, cap) - sv(s.stdDed, st));
      var tax = pt(ti, sv(s.brackets, st));
      return agi <= sv(s.creditLimit, st) ? tax - sv(s.credit, st) : tax;
    },
    // Rhode Island: the standard deduction and the exemptions both shrink by 20% for each $7,450 of income over $261,000
    RI: function (s, st, x) {
      var keep = Math.max(0, 1 - s.phaseStep * steps(x.wages, s.phaseStart, s.phaseInc));
      return pt(Math.max(0, x.wages - (sv(s.stdDed, st) + sv(s.exemption, st)) * keep), sv(s.brackets, st));
    },
    // South Carolina: a deduction that phases out between two income levels (reduction rounded down to $10);
    // a couple with two earners gets a credit of 0.7% of the lower paycheck (up to the first $50,000 of it)
    SC: function (s, st, x) {
      var base = sv(s.sciad, st);
      var red = Math.floor(base * Math.min(1, Math.max(0, x.wages - sv(s.sciadStart, st)) / sv(s.sciadWidth, st)) / 10 + 1e-9) * 10;
      var tax = pt(Math.max(0, x.wages - (base - red)), s.brackets);
      if (twoEarners(st, x)) tax -= s.twoEarner.rate * Math.min(s.twoEarner.cap, x.you, x.other);
      return tax;
    },
    // Utah: flat rate, less a taxpayer credit that shrinks as income grows
    UT: function (s, st, x) {
      var credit = Math.max(0, s.creditRate * FED.stdDeduction[st] - s.phaseRate * Math.max(0, x.wages - sv(s.phaseStart, st)));
      return s.rate * x.wages - credit;
    },
    // Virginia: a couple with two earners gets the "spouse tax adjustment" (Form 760 worksheet, at most $259)
    VA: function (s, st, x) {
      var br = sv(s.brackets, st);
      var ti = Math.max(0, x.wages - sv(s.stdDed, st) - sv(s.exemption, st));
      var tax = pt(ti, br);
      if (twoEarners(st, x)) {
        var low = Math.max(0, Math.min(x.you, x.other) - s.exemption.single), half = pt(ti / 2, br);
        var already = Math.min(pt(low, br), half) + Math.max(pt(Math.max(0, ti - low), br), half);
        tax -= Math.min(s.spouseCap, Math.max(0, tax - already));
      }
      return tax;
    },
    // Wisconsin: the standard deduction shrinks with income; a couple with two earners gets a credit of 3% of the lower paycheck (up to $480)
    WI: function (s, st, x) {
      var tiers = sv(s.stdPhase, st), red = 0;
      for (var i = 0; i < tiers.length; i++) {
        var hi = (i + 1 < tiers.length) ? tiers[i + 1][0] : INF;
        red += Math.max(0, Math.min(x.wages, hi) - tiers[i][0]) * tiers[i][1];
      }
      var std = Math.max(0, sv(s.stdMax, st) - red);
      var tax = pt(Math.max(0, x.wages - std - sv(s.exemption, st)), sv(s.brackets, st));
      if (twoEarners(st, x)) tax -= Math.min(s.marriedCredit.max, s.marriedCredit.rate * Math.min(x.you, x.other));
      return tax;
    }
  };

  // taxes for a caller that only knows the wages (the pages always pass the full set)
  function defaultCtx(status, wages, fedTaxable) {
    var fedTax = pt(fedTaxable, FED.brackets[status]);
    var fica = Math.min(wages, FED.ssWageBase) * FED.ssRate + wages * FED.medicareRate;
    return { wages: wages, you: wages, other: 0, fedTaxable: fedTaxable, fedTax: fedTax, fica: fica, ficaYou: fica, ficaOther: 0 };
  }

  // the plain model: deductions -> brackets (or a flat rate with an optional zero bracket) -> credit
  function plainTax(s, status, wages, fedTaxable) {
    if (s.freeUpTo && wages <= sv(s.freeUpTo, status)) return 0;      // e.g. New Jersey: no tax at all at very low incomes
    var base = (s.baseType === 'fedTaxable') ? fedTaxable : wages;
    if (s.stdDed) base = Math.max(0, base - sv(s.stdDed, status));
    if (s.exemption) base = Math.max(0, base - sv(s.exemption, status));
    if (s.extra) base = Math.max(0, base - sv(s.extra, status));
    var tax;
    if (s.brackets) {
      tax = pt(base, sv(s.brackets, status));
    } else {
      var taxableForRate = s.zeroBracket ? Math.max(0, base - s.zeroBracket) : base;
      tax = taxableForRate * s.rate;
    }
    if (s.credit) tax -= sv(s.credit, status);
    if (s.surchargeThreshold && base > s.surchargeThreshold) tax += (base - s.surchargeThreshold) * s.surchargeRate;
    return Math.max(0, tax);
  }

  function stateIncomeTax(code, status, wages, fedTaxable, x) {
    var s = STATES[code];
    if (s.type === 'none') return 0;
    if (s.rule) return Math.max(0, RULES[s.rule](s, status, x || defaultCtx(status, wages, fedTaxable)));
    var tax = plainTax(s, status, wages, fedTaxable);
    // splitOK: a couple where both earn may also file "separately on the same return" (each spouse as a single filer); the lower figure is used
    if (s.splitOK && x && twoEarners(status, x)) {
      tax = Math.min(tax, plainTax(s, 'single', x.you, fedTaxable) + plainTax(s, 'single', x.other, fedTaxable));
    }
    return tax;
  }

  // The employee's share of a state's payroll programs (disability / paid-leave / care-fund contributions that come out of a paycheck
  // next to FICA). A program is { rate, cap?, max? }: rate x wages up to the wage cap, never more than max dollars a year.
  // A state with several programs lists them under `parts`.
  function stateAddon(code, wages) {
    var s = STATES[code];
    if (!s.addon) return 0;
    var parts = s.addon.parts || [s.addon], total = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var amount = (p.cap ? Math.min(wages, p.cap) : wages) * p.rate;
      total += (p.max !== undefined) ? Math.min(amount, p.max) : amount;
    }
    return total;
  }

  function stateHint(code) {
    var s = STATES[code];
    if (s.type === 'none') return s.name + ' has no state income tax.' + (s.addon ? ' It has a small ' + s.addon.short + ' payroll tax.' : '');
    return s.name + ' state income tax' + (s.addon ? ', plus ' + s.addon.short : '') + '.';
  }

  // ---------------------------------------------------------------------
  //  inputs -> a clean, bounded set of numbers
  // ---------------------------------------------------------------------
  function normalize(inp) {
    inp = inp || {};
    var adj = [];
    function money(v, label) {
      var n = (typeof v === 'number') ? v : parseFloat(v);
      if (n !== n) return 0;                       // blank / not a number
      if (n < 0) { adj.push(label + ' can\u2019t be negative, so 0 was used.'); return 0; }
      if (n > MAX_MONEY) { adj.push(label + ' was limited to $10,000,000,000.'); return MAX_MONEY; }
      return n;
    }
    function bounded(v, lo, hi, dflt, label) {
      var n = (typeof v === 'number') ? v : parseFloat(v);
      if (n !== n) return dflt;
      if (n < lo) { adj.push(label + ' was raised to ' + lo + '.'); return lo; }
      if (n > hi) { adj.push(label + ' was limited to ' + hi + '.'); return hi; }
      return n;
    }
    var c = {};
    c.mode = inp.mode === 'hourly' ? 'hourly' : 'salary';
    c.status = FED.stdDeduction.hasOwnProperty(inp.status) ? inp.status : 'single';
    c.state = STATES.hasOwnProperty(inp.state) ? inp.state : 'TX';
    var p = parseInt(inp.periods, 10);
    c.periods = PERIODS.indexOf(p) >= 0 ? p : 26;

    c.bonus = money(inp.bonus, 'The bonus');
    c.pretaxOther = money(inp.pretaxOther, 'Pre-tax health/FSA/HSA');
    c.afterTax = money(inp.afterTax, 'After-tax deductions');
    c.otherIncome = money(inp.otherIncome, 'The spouse\u2019s / second-job pay');
    c.kids = Math.floor(bounded(inp.kids, 0, 20, 0, 'Children'));
    c.otherDeps = Math.floor(bounded(inp.otherDeps, 0, 20, 0, 'Other dependents'));

    var k = inp.k401 || {};
    c.k401 = { unit: k.unit === 'amt' ? 'amt' : 'pct', value: 0 };
    c.k401.value = (c.k401.unit === 'pct') ? bounded(k.value, 0, 100, 0, 'The 401(k) percentage') : money(k.value, 'The 401(k) amount');

    if (c.mode === 'hourly') {
      c.rate = money(inp.rate, 'The hourly rate');
      c.hours = bounded(inp.hours, 0, 168, 40, 'Hours per week');
      c.otHours = bounded(inp.otHours, 0, 168, 0, 'Overtime hours');
      if (c.hours + c.otHours > 168) { c.otHours = 168 - c.hours; adj.push('Hours per week can\u2019t add up to more than 168.'); }
      c.otMult = bounded(inp.otMult, 1, 3, 1.5, 'The overtime multiplier');
      c.weeks = bounded(inp.weeks, 0, 52, 52, 'Weeks per year');
      c.regular = c.rate * c.hours * c.weeks;
      c.ot = c.rate * c.otMult * c.otHours * c.weeks;
      var premiumShare = Math.min(c.otMult - 1, FED.overtime.premiumShare);
      c.qualOT = c.rate * premiumShare * c.otHours * c.weeks;     // the FLSA "half" premium
    } else {
      c.regular = money(inp.salary, 'The salary');
      c.ot = 0; c.qualOT = 0; c.rate = 0; c.hours = 0; c.otHours = 0; c.otMult = 1.5; c.weeks = 52;
    }
    if (c.regular > MAX_MONEY) c.regular = MAX_MONEY;
    if (c.ot > MAX_MONEY) c.ot = MAX_MONEY;
    c.adjustments = adj;
    return c;
  }

  // ---------------------------------------------------------------------
  //  one full-year calculation
  //    parts = { regular, ot, qualOT, bonus }   opts = { noOtDeduction, p401Max }
  // ---------------------------------------------------------------------
  function scenarioRaw(c, parts, opts) {
    opts = opts || {};
    var st = STATES[c.state];
    var status = c.status;
    var G = parts.regular + parts.ot + parts.bonus;               // gross pay
    var E = parts.regular + parts.ot;                              // regular earnings (basis for a % 401(k))
    var other = (status === 'mfs') ? 0 : c.otherIncome;           // a separate filer's return ignores the spouse

    var pOther = Math.min(c.pretaxOther, G);
    var want401 = (c.k401.unit === 'pct') ? E * c.k401.value / 100 : c.k401.value;
    var p401 = Math.min(want401, G - pOther);
    if (opts.p401Max !== undefined) p401 = Math.min(p401, opts.p401Max);
    var ficaWages = G - pOther;                                    // 401(k) deferrals are still FICA wages
    var wi = G - p401 - pOther;                                    // wages for income tax

    // ---- federal income tax (household, then your share) ----
    var agi = wi + other;
    var std = FED.stdDeduction[status];
    var otDed = 0;
    if (!opts.noOtDeduction && parts.qualOT > 0 && FED.overtime.eligible[status]) {
      var capped = Math.min(parts.qualOT, FED.overtime.cap[status]);
      otDed = Math.max(0, capped - Math.max(0, agi - FED.overtime.phaseStart[status]) * FED.overtime.phaseRate);
    }
    var fedTaxable = Math.max(0, agi - std - otDed);
    var taxBeforeCredits = pt(fedTaxable, FED.brackets[status]);
    var credit = c.kids * FED.credits.child + c.otherDeps * FED.credits.other;
    if (credit > 0) {
      var over = Math.max(0, agi - FED.credits.phaseStart[status]);
      credit = Math.max(0, credit - Math.ceil(over / FED.credits.phasePer - 1e-9) * FED.credits.phaseStep);
    }
    var creditUsed = Math.min(credit, taxBeforeCredits);
    var fedHH = taxBeforeCredits - creditUsed;
    var incShare = (wi + other) > 0 ? wi / (wi + other) : 1;
    var fed = fedHH * incShare;
    var marginal = marginalRateOf(fedTaxable, FED.brackets[status]);

    // ---- FICA (your own wages; a second job shares one Social Security wage base) ----
    var ss;
    if (other > 0 && status !== 'mfj') {
      var tot = Math.min(ficaWages + other, FED.ssWageBase) * FED.ssRate;
      ss = (ficaWages + other) > 0 ? tot * ficaWages / (ficaWages + other) : 0;
    } else {
      ss = Math.min(ficaWages, FED.ssWageBase) * FED.ssRate;
    }
    var medicare = ficaWages * FED.medicareRate;
    var combined = ficaWages + other;
    var addlHH = Math.max(0, combined - FED.addlMedicareThreshold[status]) * FED.addlMedicareRate;
    var addl = combined > 0 ? addlHH * (ficaWages / combined) : 0;
    // the household's total, for the states that let FICA be deducted
    var ssHH = (other > 0 && status !== 'mfj') ? Math.min(ficaWages + other, FED.ssWageBase) * FED.ssRate
                                              : ss + Math.min(other, FED.ssWageBase) * FED.ssRate;
    var ficaHH = ssHH + medicare + other * FED.medicareRate + addlHH;
    var ficaMine = ss + medicare + addl;

    // ---- state ----
    var stWages = G - pOther - (st.no401k ? 0 : p401);
    var stHH = stWages + other;
    var stFedTaxable = Math.max(0, (wi + other) - std);           // states that start from federal taxable income
    var stateHHTax = stateIncomeTax(c.state, status, stHH, stFedTaxable, {
      wages: stHH, you: stWages, other: other, fedTaxable: stFedTaxable, fedTax: fedHH,
      fica: ficaHH, ficaYou: ficaMine, ficaOther: ficaHH - ficaMine
    });
    var stShare = stHH > 0 ? stWages / stHH : 1;
    var stateTax = stateHHTax * stShare;
    var addon = stateAddon(c.state, ficaWages);

    var taxes = fed + ss + medicare + addl + stateTax + addon;
    var afterTax = Math.min(c.afterTax, Math.max(0, G - pOther - p401 - taxes));
    var net = G - pOther - p401 - taxes - afterTax;

    return {
      gross: G, regular: parts.regular, ot: parts.ot, bonus: parts.bonus,
      pOther: pOther, p401: p401, want401: want401, afterTax: afterTax, afterTaxWanted: c.afterTax,
      ficaWages: ficaWages, wagesForIncomeTax: wi, otherIncome: other,
      agi: agi, std: std, otDeduction: otDed, fedTaxable: fedTaxable, creditUsed: creditUsed, creditAvailable: credit,
      fedHousehold: fedHH, fed: fed, marginal: marginal, incomeShare: incShare,
      ss: ss, medicare: medicare, addl: addl,
      stateWages: stWages, stateTax: stateTax, stateHousehold: stateHHTax, addon: addon,
      taxes: taxes, net: net, effective: G > 0 ? taxes / G : 0
    };
  }

  // A paycheck can't go below zero: if the 401(k) entered is more than the pay can carry once
  // tax comes out, use the largest deferral that still leaves nothing negative (what payroll does).
  function scenario(c, parts, opts) {
    var r = scenarioRaw(c, parts, opts);
    if (r.net >= 0 || r.p401 <= 0) return r;
    var o = {};
    for (var k in (opts || {})) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    var lo = 0, hi = r.p401;                    // lo always fits, hi never does
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      o.p401Max = mid;
      if (scenarioRaw(c, parts, o).net >= 0) lo = mid; else hi = mid;
    }
    o.p401Max = lo;
    return scenarioRaw(c, parts, o);
  }

  function supplementalWithholding(bonus) {
    var sp = FED.supplemental;
    return Math.min(bonus, sp.highThreshold) * sp.rate + Math.max(0, bonus - sp.highThreshold) * sp.highRate;
  }

  // ---------------------------------------------------------------------
  //  compute(): the base year, plus the effect of the bonus / overtime
  // ---------------------------------------------------------------------
  function compute(inp) {
    var c = normalize(inp);
    var parts = { regular: c.regular, ot: c.ot, qualOT: c.qualOT, bonus: 0 };
    var base = scenario(c, parts);
    var res = { input: c, periods: c.periods, base: base, year: base, bonus: null, overtime: null, keep: 0, notes: [] };

    if (c.bonus > 0) {
      var yr = scenario(c, { regular: c.regular, ot: c.ot, qualOT: c.qualOT, bonus: c.bonus });
      res.year = yr;
      res.bonus = {
        gross: c.bonus,
        fed: yr.fed - base.fed,
        ss: yr.ss - base.ss, medicare: yr.medicare - base.medicare, addl: yr.addl - base.addl,
        state: yr.stateTax - base.stateTax, addon: yr.addon - base.addon,
        p401: yr.p401 - base.p401, pOther: yr.pOther - base.pOther,
        afterTax: yr.afterTax - base.afterTax,
        net: yr.net - base.net,
        withheld: supplementalWithholding(c.bonus)
      };
    }

    if (c.mode === 'hourly' && c.ot > 0) {
      var noOt = scenario(c, { regular: c.regular, ot: 0, qualOT: 0, bonus: 0 });
      var noDed = scenario(c, parts, { noOtDeduction: true });
      res.overtime = {
        hoursPerYear: c.otHours * c.weeks,
        gross: c.ot,
        net: base.net - noOt.net,
        fed: base.fed - noOt.fed,
        deduction: base.otDeduction,
        deductionSavings: noDed.fed - base.fed,
        eligible: FED.overtime.eligible[c.status]
      };
    }

    // of each extra $1,000 you earn on top of today's pay, how much stays with you?
    var a = scenario(c, { regular: c.regular, ot: c.ot, qualOT: c.qualOT, bonus: c.bonus });
    var b = scenario(c, { regular: c.regular, ot: c.ot, qualOT: c.qualOT, bonus: c.bonus + 1000 });
    res.keep = Math.max(0, Math.min(1, (b.net - a.net) / 1000));

    res.notes = buildNotes(c, res);
    return res;
  }

  function stateNeedsNote(code, status) {
    var s = STATES[code];
    if (s.type === 'none') return false;
    if (status !== 'hoh' && status !== 'mfs') return false;
    return !(s.modeled && s.modeled.indexOf(status) >= 0);
  }

  function buildNotes(c, res) {
    var notes = [];
    var st = STATES[c.state];
    var base = res.base;
    var i;
    for (i = 0; i < c.adjustments.length; i++) notes.push({ kind: 'warn', text: c.adjustments[i] });

    if (stateNeedsNote(c.state, c.status)) {
      notes.push({ kind: 'info', text: st.name + ' has its own ' + (c.status === 'hoh' ? 'head-of-household' : 'separate-filer') +
        ' rules that this calculator doesn\u2019t model yet \u2014 the state line uses ' + st.name + '\u2019s single-filer rates and deductions, so treat the state figure as a rough estimate.' });
    }
    if (st.type !== 'none' && (c.kids + c.otherDeps) > 0) {
      notes.push({ kind: 'info', text: 'Children and other dependents lower the federal credit here, but ' + st.name + '\u2019s own dependent exemptions or credits (where it has them) aren\u2019t included, so the state tax line may be a little high.' });
    }

    if (c.otherIncome > 0 && c.status === 'mfs') {
      notes.push({ kind: 'info', text: 'Married filing separately: your spouse\u2019s pay doesn\u2019t affect your return, so it was left out.' });
    } else if (c.otherIncome > 0) {
      notes.push({ kind: 'info', text: 'Income tax is figured on your combined pay (' + fmt(base.wagesForIncomeTax) + ' + ' + fmt(base.otherIncome) +
        ' ' + (c.status === 'mfj' ? 'from your spouse' : 'from the second job') + '). The amounts here are your share, split by pay.' });
    }

    var k = FED.k401;
    if (base.p401 > k.limit + 1e-9) {
      notes.push({ kind: 'warn', text: 'A 401(k) contribution of ' + fmt(base.p401) + ' is above the 2026 IRS limit of ' + fmt(k.limit) + ' (' +
        fmt(k.limit + k.catchup50) + ' if you\u2019re 50+, ' + fmt(k.limit + k.catchup6063) + ' at ages 60\u201363). Check your plan \u2014 the amount you entered was used.' });
    }
    if (base.want401 > base.p401 + 0.005) {
      notes.push({ kind: 'warn', text: 'The 401(k) contribution you entered (' + fmt(base.want401) + ') is more than your pay can cover after tax, so ' + fmt(base.p401) + ' was used instead.' });
    }
    if (base.p401 > 0 && st.no401k) {
      notes.push({ kind: 'info', text: st.name + ' doesn\u2019t give a state tax break for 401(k) contributions, so state tax is figured on your pay before the contribution.' });
    }
    if (base.pOther > 0 && (c.state === 'CA' || c.state === 'NJ')) {
      notes.push({ kind: 'info', text: st.name + ' taxes HSA contributions at the state level. If part of your pre-tax amount goes to an HSA, state tax here is slightly low.' });
    }
    if (c.pretaxOther > base.pOther + 0.005) {
      notes.push({ kind: 'warn', text: 'Your pre-tax health/FSA/HSA amount is more than your pay, so it was reduced to fit.' });
    }
    if (base.afterTaxWanted > base.afterTax + 0.005) {
      notes.push({ kind: 'warn', text: 'Your after-tax deductions are more than your take-home pay, so they were reduced to fit.' });
    }
    if (c.mode === 'hourly' && c.otHours > 0) {
      if (!FED.overtime.eligible[c.status]) {
        notes.push({ kind: 'info', text: 'Married filing separately isn\u2019t eligible for the 2025\u20132028 federal overtime deduction, so overtime is taxed like regular pay.' });
      }
      if (c.hours < 40) {
        notes.push({ kind: 'info', text: 'Federal overtime rules apply to hours beyond 40 a week. Pay for fewer hours may not qualify for the overtime deduction.' });
      }
    }
    return notes;
  }

  // =====================================================================
  //  FORMATTING
  // =====================================================================
  function fmt(n) {
    if (!isFinite(n)) n = 0;
    var r = Math.round(Math.abs(n));
    var sign = (n < 0 && r !== 0) ? '-' : '';
    return sign + '$' + r.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  function fmt2(n) {
    if (!isFinite(n)) n = 0;
    return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // =====================================================================
  //  THE BREAKDOWN AS SHOWN
  //  Every line is rounded to whole dollars on its own, and take-home is the rounded gross minus the
  //  rounded deductions, so each column of a table adds up when you check it with a calculator.
  //  The same rule feeds the headline, the "per year" line, the bonus box, the comparison tool and the
  //  worked examples, so the same household gets the same figure everywhere.
  // =====================================================================
  function signedWhole(n) {
    if (!isFinite(n)) return 0;
    var r = Math.round(Math.abs(n));
    return r === 0 ? 0 : (n < 0 ? -r : r);
  }

  // exact = deduction amounts (positive numbers); returns each one rounded and the take-home that follows.
  // A paycheck is never shown as negative: if the rounded lines overshoot, the line rounded up the most gives it back.
  function addUp(grossShown, exact) {
    var shown = [], total = 0, i;
    for (i = 0; i < exact.length; i++) { shown.push(signedWhole(exact[i])); total += shown[i]; }
    var net = grossShown - total;
    while (net < 0) {
      var pick = -1, best = -Infinity;
      for (i = 0; i < exact.length; i++) {
        if (shown[i] > 0 && shown[i] - exact[i] > best) { best = shown[i] - exact[i]; pick = i; }
      }
      if (pick < 0) break;
      shown[pick] -= 1; net += 1;
    }
    return { shown: shown, net: net };
  }

  function breakdownLines(b, c) {
    var st = STATES[c.state], L = [];
    var split = c.mode === 'hourly' && b.ot > 0 && Math.abs(b.regular + b.ot - b.gross) < 0.005;
    if (split) {
      L.push({ key: 'regular', label: 'Regular pay', value: b.regular, role: 'part', kind: '' });
      L.push({ key: 'overtime', label: 'Overtime pay', value: b.ot, role: 'part', kind: '' });
      L.push({ key: 'gross', label: 'Gross pay', value: b.gross, role: 'gross', kind: 'sum' });
    } else {
      L.push({ key: 'gross', label: 'Gross pay', value: b.gross, role: 'gross', kind: '' });
    }
    if (b.p401 > 0) L.push({ key: 'p401', label: '401(k) / 403(b), pre-tax', value: b.p401, role: 'ded', kind: 'ded' });
    if (b.pOther > 0) L.push({ key: 'pOther', label: 'Health / FSA / HSA, pre-tax', value: b.pOther, role: 'ded', kind: 'ded' });
    L.push({ key: 'fed', label: 'Federal income tax', value: b.fed, role: 'ded', kind: 'tax', tax: true });
    L.push({ key: 'ss', label: 'Social Security (6.2%)', value: b.ss, role: 'ded', kind: 'tax', tax: true });
    L.push({ key: 'medicare', label: 'Medicare (1.45%)', value: b.medicare, role: 'ded', kind: 'tax', tax: true });
    if (b.addl > 0) L.push({ key: 'addl', label: 'Additional Medicare (0.9%)', value: b.addl, role: 'ded', kind: 'tax', tax: true });
    if (b.stateTax > 0 || st.type !== 'none') L.push({ key: 'state', label: st.name + ' state tax', value: b.stateTax, role: 'ded', kind: 'tax', tax: true });
    if (b.addon > 0) L.push({ key: 'addon', label: st.addon ? st.addon.label : (st.name + ' payroll addon'), value: b.addon, role: 'ded', kind: 'tax', tax: true });
    if (b.afterTax > 0) L.push({ key: 'afterTax', label: 'After-tax deductions', value: b.afterTax, role: 'ded', kind: 'ded' });
    L.push({ key: 'net', label: 'Take-home pay', value: b.net, role: 'net', kind: 'net' });
    return L;
  }

  // one column of the table (div = 1 for the year, the number of paychecks for "per paycheck"): signed whole dollars
  function shownColumn(L, div) {
    var out = [], parts = [], deds = [], gr = -1, nt = -1, i;
    for (i = 0; i < L.length; i++) {
      out.push(0);
      if (L[i].role === 'part') { out[i] = signedWhole(L[i].value / div); parts.push(i); }
      else if (L[i].role === 'ded') deds.push(i);
      else if (L[i].role === 'gross') gr = i;
      else nt = i;
    }
    if (parts.length) { for (i = 0; i < parts.length; i++) out[gr] += out[parts[i]]; }
    else out[gr] = signedWhole(L[gr].value / div);
    var exact = [];
    for (i = 0; i < deds.length; i++) exact.push(L[deds[i]].value / div);
    var r = addUp(out[gr], exact);
    for (i = 0; i < deds.length; i++) out[deds[i]] = r.shown[i] === 0 ? 0 : -r.shown[i];
    out[nt] = r.net;
    return out;
  }

  // The breakdown for any scenario result b (res.base, or res.year for the whole year with a bonus).
  // lines[i] = { key, label, kind, year, per } with deductions negative; gross / taxes / net as the table adds them.
  function breakdownOf(b, c, per) {
    var L = breakdownLines(b, c), yr = shownColumn(L, 1), pp = shownColumn(L, per > 0 ? per : 1);
    var lines = [], gross = {}, net = {}, taxes = { year: 0, per: 0 }, i;
    for (i = 0; i < L.length; i++) {
      lines.push({ key: L[i].key, label: L[i].label, kind: L[i].kind, year: yr[i], per: pp[i] });
      if (L[i].tax) { taxes.year -= yr[i]; taxes.per -= pp[i]; }
      if (L[i].role === 'gross') gross = { year: yr[i], per: pp[i] };
      if (L[i].role === 'net') net = { year: yr[i], per: pp[i] };
    }
    return { lines: lines, gross: gross, taxes: taxes, net: net };
  }

  function breakdown(res) { return breakdownOf(res.base, res.input, res.periods); }

  // "Your bonus" box: the same rule, one line per kind of deduction
  function bonusBreakdown(res) {
    var bn = res.bonus;
    if (!bn) return null;
    var st = STATES[res.input.state], rows = [], exact = [];
    function add(label, v) { rows.push(label); exact.push(v); }
    add('Federal income tax', bn.fed);
    add('Social Security + Medicare', bn.ss + bn.medicare + bn.addl);
    if (st.type !== 'none' || st.addon) add(st.name + ' state tax' + (bn.addon > 0 ? ' & payroll tax' : ''), bn.state + bn.addon);
    if (bn.p401 > 0) add('Extra 401(k) contribution', bn.p401);
    if (signedWhole(bn.pOther + bn.afterTax) >= 1) add('Other deductions', bn.pOther + bn.afterTax);
    var gross = signedWhole(bn.gross), r = addUp(gross, exact), lines = [], i;
    for (i = 0; i < rows.length; i++) lines.push({ label: rows[i], amount: r.shown[i] === 0 ? 0 : -r.shown[i] });
    return { gross: gross, lines: lines, keep: r.net, keepPct: gross > 0 ? Math.round(r.net / gross * 100) : 0 };
  }

  // =====================================================================
  //  USER INTERFACE
  // =====================================================================
  var CSS = [
    '#ppmInputs [hidden],#ppmResults [hidden]{display:none !important}',
    '.layout > #ppmInputs,.layout > .results{min-width:0}',
    '#ppmInputs input[type=number],#ppmInputs select{min-width:0}',
    '.field .ppm-seg label{flex:1 1 0;margin:0;position:relative;font-weight:600;font-size:.9rem}',
    '.ppm-seg{display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}',
    '.ppm-seg input{position:absolute;opacity:0;width:1px;height:1px;margin:0}',
    '.ppm-seg span{display:block;text-align:center;padding:10px 8px;cursor:pointer;color:var(--ink-soft);background:#fff;user-select:none}',
    '.ppm-seg label + label span{border-left:1px solid var(--line)}',
    '.ppm-seg input:checked + span{background:var(--ink);color:#fff}',
    '.ppm-seg input:focus-visible + span{outline:3px solid var(--teal);outline-offset:-3px}',
    '.ppm-row2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 12px;align-items:end}',
    '.ppm-row2 > .field{min-width:0}',
    '.ppm-inline{display:flex;gap:8px}',
    '.ppm-inline input[type=number]{flex:1 1 auto;min-width:0;width:auto}',
    '.ppm-inline select{flex:0 0 auto;width:auto;max-width:48%}',
    '.ppm-more{margin:2px 0 0;border-top:1px solid var(--line);padding-top:4px}',
    '.ppm-more > summary{cursor:pointer;font-weight:600;font-size:.9rem;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;margin-bottom:6px}',
    '.ppm-more > summary::-webkit-details-marker{display:none}',
    '.ppm-more > summary::after{content:"+";font-size:1.2rem;line-height:1;color:var(--teal)}',
    '.ppm-more[open] > summary::after{content:"\\2212"}',
    '.ppm-more .ppm-used{font-weight:500;font-size:.78rem;color:var(--teal);margin-left:auto;margin-right:4px}',
    '.ppm-more > summary:focus-visible{outline:3px solid var(--teal);outline-offset:3px;border-radius:4px}',
    '.ppm-notes:empty{display:none}',
    '.ppm-notes{margin-bottom:14px}',
    '.ppm-note{margin:0 0 8px;padding:10px 14px;border-radius:8px;font-size:.85rem;border:1px solid var(--line);background:var(--card);color:var(--ink-soft)}',
    '.ppm-note-warn{border-left:4px solid var(--orange)}',
    '.ppm-note-info{border-left:4px solid var(--teal)}',
    '.ppm-box{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;margin-top:18px}',
    '.ppm-box h3{font-family:"Space Grotesk",sans-serif;font-size:1rem;margin:0 0 10px}',
    '.ppm-box p{font-size:.88rem;color:var(--ink-soft);margin:10px 0 0}',
    '.ppm-box p strong{color:var(--ink)}',
    '.ppm-box table.breakdown th,.ppm-box table.breakdown td{padding:9px 14px}',
    'table.breakdown tr.sum td{font-weight:600}',
    '#ppmResults .rate-strip{gap:10px 12px}'
  ].join('\n');

  function injectCss(doc) {
    if (doc.getElementById('ppm-paycheck-css')) return;
    var st = doc.createElement('style');
    st.id = 'ppm-paycheck-css';
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  function stateOptionsHtml() {
    var codes = Object.keys(STATES).sort(function (a, b) { return STATES[a].name.localeCompare(STATES[b].name); });
    return codes.map(function (code) { return '<option value="' + code + '">' + esc(STATES[code].name) + '</option>'; }).join('');
  }

  function moneyField(id, label, value, extra) {
    return '<div class="field"><label for="' + id + '">' + label + '</label>' +
      '<div class="salary-wrap"><span>$</span><input type="number" inputmode="decimal" id="' + id + '" value="' + value + '" min="0" step="' + ((extra && extra.step) || 100) + '"></div>' +
      ((extra && extra.hint) ? '<div class="hint" id="' + id + 'Hint">' + extra.hint + '</div>' : '') + '</div>';
  }

  function buildInputs(variant) {
    var statusOpts = ['single', 'mfj', 'mfs', 'hoh'].map(function (k) { return '<option value="' + k + '">' + FED.statusLabels[k] + '</option>'; }).join('');
    var freq = '<option value="52">Weekly</option><option value="26" selected>Biweekly</option><option value="24">Semi-monthly</option><option value="12">Monthly</option><option value="1">Annual</option>';
    var common =
      '<div class="field"><label for="filingStatus">Filing status</label><select id="filingStatus">' + statusOpts + '</select><div class="hint" id="statusHint"></div></div>' +
      '<div class="field"><label for="state">State</label><select id="state">' + stateOptionsHtml() + '</select><div class="hint" id="stateHint"></div></div>' +
      '<div class="field"><label for="frequency">Pay frequency</label><select id="frequency">' + freq + '</select></div>';

    if (variant === 'embed') {
      return '<div class="field"><label for="salary">Annual salary</label><div class="salary-wrap"><span>$</span><input type="number" id="salary" value="65000" min="0" step="500"></div></div>' + common;
    }

    return '' +
      '<div class="field"><span class="ppm-label" id="payModeLabel" style="display:block;font-size:.85rem;font-weight:600;margin-bottom:6px">How are you paid?</span>' +
        '<div class="ppm-seg" role="radiogroup" aria-labelledby="payModeLabel">' +
          '<label><input type="radio" name="payMode" id="payModeSalary" value="salary" checked><span>Salary</span></label>' +
          '<label><input type="radio" name="payMode" id="payModeHourly" value="hourly"><span>Hourly</span></label>' +
        '</div></div>' +
      '<div class="field" id="salaryField"><label for="salary">Annual salary</label><div class="salary-wrap"><span>$</span><input type="number" inputmode="decimal" id="salary" value="65000" min="0" step="500"></div></div>' +
      '<div id="hourlyFields" hidden>' +
        '<div class="field"><label for="hourlyRate">Hourly rate</label><div class="salary-wrap"><span>$</span><input type="number" inputmode="decimal" id="hourlyRate" value="31.25" min="0" step="0.25"></div></div>' +
        '<div class="ppm-row2">' +
          '<div class="field"><label for="hours">Hours per week</label><input type="number" inputmode="decimal" id="hours" value="40" min="0" max="168" step="1"></div>' +
          '<div class="field"><label for="otHours">Overtime hours / week</label><input type="number" inputmode="decimal" id="otHours" value="0" min="0" max="168" step="1"></div>' +
        '</div>' +
        '<div class="ppm-row2">' +
          '<div class="field"><label for="otMult">Overtime rate</label><select id="otMult"><option value="1.5" selected>1.5\u00d7 hourly</option><option value="2">2\u00d7 hourly</option><option value="1">1\u00d7 hourly</option></select></div>' +
          '<div class="field"><label for="weeks">Weeks worked / year</label><input type="number" inputmode="decimal" id="weeks" value="52" min="0" max="52" step="1"></div>' +
        '</div>' +
      '</div>' +
      common +
      '<details class="ppm-more" id="moreOptions"><summary><span>More options</span><span class="ppm-used" id="moreUsed"></span></summary>' +
        '<div class="field"><label for="k401Value">Traditional 401(k) / 403(b)</label>' +
          '<div class="ppm-inline"><input type="number" inputmode="decimal" id="k401Value" value="0" min="0" step="0.5"><select id="k401Unit" aria-label="401(k) amount type"><option value="pct">% of pay</option><option value="amt">$ per year</option></select></div>' +
          '<div class="hint" id="k401Hint"></div></div>' +
        moneyField('pretaxOther', 'Pre-tax health, FSA &amp; HSA ($ per year)', 0, { step: 100, hint: 'Premiums and savings taken from your paycheck before tax.' }) +
        moneyField('afterTax', 'After-tax deductions ($ per year)', 0, { step: 100, hint: 'Roth 401(k), union dues, garnishments \u2014 anything taken after tax.' }) +
        moneyField('bonus', 'One-time bonus ($)', 0, { step: 500, hint: 'Shows what you actually keep after tax.' }) +
        '<div class="field"><label for="otherIncome" id="otherIncomeLabel">Second job\u2019s annual pay ($)</label>' +
          '<div class="salary-wrap"><span>$</span><input type="number" inputmode="decimal" id="otherIncome" value="0" min="0" step="1000"></div>' +
          '<div class="hint" id="otherIncomeHint"></div></div>' +
        '<div class="ppm-row2">' +
          '<div class="field"><label for="kids">Children under 17</label><input type="number" inputmode="numeric" id="kids" value="0" min="0" max="20" step="1"></div>' +
          '<div class="field"><label for="otherDeps">Other dependents</label><input type="number" inputmode="numeric" id="otherDeps" value="0" min="0" max="20" step="1"></div>' +
        '</div>' +
        '<div class="field" style="margin-top:-6px"><div class="hint" id="creditHint"></div></div>' +
      '</details>';
  }

  function buildResults(variant) {
    var head =
      '<div class="take-home"><h2>Take-home pay per paycheck</h2><div class="amount" id="netPerPeriod">$0</div><div class="sub" id="netAnnualSub"></div></div>';
    var table =
      '<table class="breakdown"><thead><tr><th>Item</th><th>Per year</th><th>Per paycheck</th></tr></thead><tbody id="breakdownBody"></tbody></table>';
    if (variant === 'embed') {
      return head + table +
        '<div class="rate-strip"><span class="chip">Effective rate: <b id="effRate">0%</b></span><span class="chip">Marginal bracket: <b id="marginalRate">0%</b></span></div>';
    }
    return head +
      '<div class="ppm-notes" id="ppmNotes" aria-live="polite"></div>' +
      table +
      '<div class="rate-strip"><span class="chip">Effective tax rate: <b id="effRate">0%</b></span>' +
        '<span class="chip">Marginal federal bracket: <b id="marginalRate">0%</b></span>' +
        '<span class="chip">Of each extra $100 you earn, you keep: <b id="keepRate">$0</b></span></div>' +
      '<div class="ppm-box" id="ppmBonus" hidden></div>' +
      '<div class="ppm-box" id="ppmOvertime" hidden></div>';
  }

  // ---------------------------------------------------------------------
  //  mount(): build the inputs + results into #ppmInputs / #ppmResults and wire them up
  // ---------------------------------------------------------------------
  function mount(opts) {
    opts = opts || {};
    var doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) return null;
    var inputsEl = doc.getElementById('ppmInputs');
    var resultsEl = doc.getElementById('ppmResults');
    if (!inputsEl || !resultsEl) return null;
    var variant = opts.variant === 'embed' ? 'embed' : 'full';
    var defaultState = STATES.hasOwnProperty(opts.state) ? opts.state : 'TX';

    injectCss(doc);
    inputsEl.innerHTML = buildInputs(variant);
    resultsEl.innerHTML = buildResults(variant);
    doc.getElementById('state').value = defaultState;

    function $(id) { return doc.getElementById(id); }
    function val(id) { var e = $(id); return e ? e.value : undefined; }
    function setText(id, t) { var e = $(id); if (e) e.textContent = t; }

    var rateTouched = false;

    function readInputs() {
      var hourly = !!($('payModeHourly') && $('payModeHourly').checked);
      return {
        mode: hourly ? 'hourly' : 'salary',
        salary: val('salary'), rate: val('hourlyRate'), hours: val('hours'), otHours: val('otHours'), otMult: val('otMult'), weeks: val('weeks'),
        status: val('filingStatus'), state: val('state'), periods: val('frequency'),
        k401: { unit: val('k401Unit'), value: val('k401Value') },
        pretaxOther: val('pretaxOther'), afterTax: val('afterTax'), bonus: val('bonus'), otherIncome: val('otherIncome'),
        kids: val('kids'), otherDeps: val('otherDeps')
      };
    }

    function rowHtml(label, yearVal, perVal, kind) {
      var cls = (kind === 'tax' || kind === 'ded') ? 'neg' : '';
      var trCls = kind === 'net' ? ' class="net"' : (kind === 'sum' ? ' class="sum"' : '');
      return '<tr' + trCls + '><td>' + esc(label) + '</td><td class="' + cls + '">' + fmt(yearVal) + '</td><td class="' + cls + '">' + fmt(perVal) + '</td></tr>';
    }

    function renderTable(res, bd) {
      var rows = bd.lines, html = '';
      for (var i = 0; i < rows.length; i++) html += rowHtml(rows[i].label, rows[i].year, rows[i].per, rows[i].kind);
      $('breakdownBody').innerHTML = html;
    }

    function renderNotes(res) {
      var box = $('ppmNotes');
      if (!box) return;
      var html = '';
      for (var i = 0; i < res.notes.length; i++) {
        html += '<p class="ppm-note ppm-note-' + res.notes[i].kind + '">' + esc(res.notes[i].text) + '</p>';
      }
      box.innerHTML = html;
    }

    function renderBonus(res) {
      var box = $('ppmBonus');
      if (!box) return;
      var bn = res.bonus;
      if (!bn) { box.hidden = true; box.innerHTML = ''; return; }
      var bb = bonusBreakdown(res), yb = breakdownOf(res.year, res.input, 1);
      var gap = bn.withheld - bn.fed;
      var rowsHtml = '';
      for (var i = 0; i < bb.lines.length; i++) rowsHtml += '<tr><td>' + esc(bb.lines[i].label) + '</td><td class="neg">' + fmt(bb.lines[i].amount) + '</td></tr>';
      var html = '<h3>Your ' + fmt(bb.gross) + ' bonus</h3>' +
        '<table class="breakdown"><tbody>' +
        '<tr><td>Bonus (gross)</td><td>' + fmt(bb.gross) + '</td></tr>' +
        rowsHtml +
        '<tr class="net"><td>You keep</td><td>' + fmt(bb.keep) + ' (' + bb.keepPct + '%)</td></tr>' +
        '</tbody></table>' +
        '<p>If the bonus is paid on its own check, employers usually withhold federal tax at a flat ' + Math.round(FED.supplemental.rate * 100) + '% (<strong>' + fmt(bn.withheld) + '</strong>). ' +
        (Math.abs(gap) < 1 ? 'That matches what you really owe on it.' :
          (gap > 0 ? 'Your real federal tax on it is ' + fmt(bn.fed) + ', so about <strong>' + fmt(gap) + '</strong> more is withheld than you owe \u2014 it comes back when you file.'
                   : 'Your real federal tax on it is ' + fmt(bn.fed) + ', so about <strong>' + fmt(-gap) + '</strong> less is withheld than you owe \u2014 plan to owe that when you file.')) + '</p>' +
        '<p>Whole year with the bonus: ' + fmt(yb.gross.year) + ' gross, ' + fmt(yb.taxes.year) + ' in taxes, <strong>' + fmt(yb.net.year) + '</strong> take-home.</p>';
      box.innerHTML = html;
      box.hidden = false;
    }

    function renderOvertime(res) {
      var box = $('ppmOvertime');
      if (!box) return;
      var ot = res.overtime;
      if (!ot) { box.hidden = true; box.innerHTML = ''; return; }
      var c = res.input;
      var perHourGross = c.rate * c.otMult;
      var perHourNet = ot.hoursPerYear > 0 ? ot.net / ot.hoursPerYear : 0;
      var html = '<h3>Your overtime</h3>' +
        '<p style="margin-top:0">' + c.otHours + ' overtime hour' + (c.otHours === 1 ? '' : 's') + ' a week \u00d7 ' + c.weeks + ' weeks at ' + c.otMult + '\u00d7 = <strong>' + fmt(ot.gross) + '</strong> gross a year. ' +
        'After tax you keep about <strong>' + fmt(ot.net) + '</strong> of it \u2014 around <strong>' + fmt2(perHourNet) + '</strong> for each overtime hour (' + fmt2(perHourGross) + ' before tax).</p>';
      if (ot.eligible && ot.deduction > 0) {
        html += '<p>The 2025\u20132028 federal overtime deduction takes <strong>' + fmt(ot.deduction) + '</strong> of the extra \u201chalf\u201d pay out of your taxable income, saving about <strong>' + fmt(ot.deductionSavings) + '</strong> in federal tax. ' +
          'It only counts overtime your employer is required to pay under federal law (hours beyond 40 a week), and your W-2 must show it.</p>';
      }
      box.innerHTML = html;
      box.hidden = false;
    }

    function renderHints(res) {
      var c = res.input, b = res.base;
      setText('stateHint', stateHint(c.state));
      var hints = {
        single: '',
        mfj: 'Also choose this if you\u2019re a qualifying surviving spouse.',
        mfs: 'Married, filing a separate return from your spouse.',
        hoh: 'Unmarried and paying over half the cost of a home for a qualifying person.'
      };
      setText('statusHint', hints[c.status] || '');
      var kh = $('k401Hint');
      if (kh) {
        kh.textContent = (c.k401.unit === 'pct' && b.p401 > 0 ? '= ' + fmt(b.p401) + ' a year. ' : '') + '2026 limit: ' + fmt(FED.k401.limit) + ' (higher if you\u2019re 50+).';
      }
      var lab = $('otherIncomeLabel'), oh = $('otherIncomeHint'), oi = $('otherIncome');
      if (lab) {
        if (c.status === 'mfj') { lab.textContent = 'Spouse\u2019s annual pay ($)'; if (oh) oh.textContent = 'Joint tax is figured on both of you together; you see your share.'; }
        else if (c.status === 'mfs') { lab.textContent = 'Spouse\u2019s annual pay ($)'; if (oh) oh.textContent = 'Not used when you file separately.'; }
        else { lab.textContent = 'Second job\u2019s annual pay ($)'; if (oh) oh.textContent = 'Tax and Social Security are figured on both jobs together.'; }
        if (oi) oi.disabled = (c.status === 'mfs');
      }
      var ch = $('creditHint');
      if (ch) {
        ch.textContent = (c.kids || c.otherDeps)
          ? 'Child tax credit: ' + fmt(FED.credits.child) + ' per child, ' + fmt(FED.credits.other) + ' per other dependent (federal, up to the tax you owe).'
          : '';
      }
      var used = $('moreUsed');
      if (used) {
        var n = 0;
        if (c.k401.value > 0) n++;
        if (c.pretaxOther > 0) n++;
        if (c.afterTax > 0) n++;
        if (c.bonus > 0) n++;
        if (c.otherIncome > 0) n++;
        if (c.kids > 0 || c.otherDeps > 0) n++;
        used.textContent = n ? n + ' in use' : '';
      }
    }

    function render(res) {
      var b = res.base, c = res.input, bd = breakdown(res);
      // the headline and the "per year" line are the table's own take-home figures
      setText('netPerPeriod', fmt(bd.net.per));
      var sub = fmt(bd.net.year) + ' per year, after taxes';
      if (c.mode === 'hourly' && c.hours + c.otHours > 0 && c.weeks > 0) {
        sub += ' \u00b7 about ' + fmt2(bd.net.year / ((c.hours + c.otHours) * c.weeks)) + ' per hour worked';
      }
      setText('netAnnualSub', sub);
      setText('effRate', (b.effective * 100).toFixed(1) + '%');
      setText('marginalRate', (b.marginal * 100).toFixed(0) + '%');
      setText('keepRate', '$' + Math.round(res.keep * 100));
      renderTable(res, bd);
      renderNotes(res);
      renderBonus(res);
      renderOvertime(res);
      renderHints(res);
    }

    function recalc() {
      var res = compute(readInputs());
      render(res);
      return res;
    }

    function setMode(hourly) {
      var sf = $('salaryField'), hf = $('hourlyFields');
      if (sf) sf.hidden = hourly;
      if (hf) hf.hidden = !hourly;
    }

    function onChange(ev) {
      var t = ev && ev.target;
      if (t && t.id === 'hourlyRate') rateTouched = true;
      if (t && t.name === 'payMode') {
        var hourly = $('payModeHourly').checked;
        setMode(hourly);
        // first switch to hourly: start from the pay they already typed (salary / 2,080 hours)
        if (hourly && !rateTouched) {
          var s = parseFloat($('salary').value);
          if (s > 0) $('hourlyRate').value = (Math.round(s / 2080 * 100) / 100).toFixed(2);
        }
      }
      recalc();
      if (typeof window !== 'undefined' && window.ppmMaybeShowThanks) window.ppmMaybeShowThanks();
    }

    inputsEl.addEventListener('input', onChange);
    inputsEl.addEventListener('change', onChange);
    recalc();
    return { recalc: recalc, read: readInputs };
  }

  return {
    version: VERSION, dataChecked: DATA_CHECKED,
    FED: FED, STATES: STATES,
    compute: compute, scenario: scenario, normalize: normalize,
    pt: pt, marginalRateOf: marginalRateOf, stateIncomeTax: stateIncomeTax, stateAddon: stateAddon,
    supplementalWithholding: supplementalWithholding,
    breakdown: breakdown, breakdownOf: breakdownOf, bonusBreakdown: bonusBreakdown,
    fmt: fmt, mount: mount
  };
}));
