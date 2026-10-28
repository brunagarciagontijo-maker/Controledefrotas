import {csvCell}from'./html';
export function downloadRows(name:string,headers:string[],rows:unknown[][]):void {
  const blob=new Blob(['\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
