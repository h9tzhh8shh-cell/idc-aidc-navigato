// Product-level decisions only. The energy agency and power-policy domain remain usable.
export function excludedProduct(data,record,type='report') {
  const source=type==='source'?record:data.sources.find(s=>s.id===record.sourceId);
  return (Array.isArray(data.excludedProducts)?data.excludedProducts:[]).find(rule=>{
    if (!rule || !['sourceIds','reportIds','urls','sourceNames'].every(k=>Array.isArray(rule[k]))) return false;
    if(rule.sourceIds.includes(type==='source'?record.id:record.sourceId)||rule.reportIds.includes(record.id)||rule.urls.some(u=>[record.url,record.originalUrl,record.entryUrl].includes(u)))return true;
    if(type==='source'&&rule.sourceNames.includes(record.name))return true;
    const identity=[record.originalPublisher,source?.organization,source?.name,record.url,record.originalUrl,record.entryUrl].filter(Boolean).join(' ');
    const subject=[record.title,record.name].filter(Boolean).join(' ');
    return rule.id==='nea-macro-electricity' ? /国家能源局|nea\.gov\.cn/i.test(identity)&&/全社会用电量|分产业用电|宏观用电|用电.*宏观/.test(subject)
      : rule.id==='smm-compute-weekly' && /SMM|上海有色|smm\.cn/i.test(identity)&&/算力.*周报|周报.*算力|算力.*周度/.test(subject);
  });
}
