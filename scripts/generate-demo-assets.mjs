// Arquivos artificiais e deterministas. Sem imagens, documentos ou nomes reais.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const folder = 'supabase/dev/assets';
mkdirSync(folder, { recursive: true });
const width = 640, height = 360;
const pixels = Buffer.alloc(width * height * 3, 245);
function rectangle(x,y,w,h,color) {
  for (let yy=y; yy<Math.min(y+h,height); yy++) for (let xx=x; xx<Math.min(x+w,width); xx++) {
    for (let k=0;k<3;k++) pixels[(yy*width+xx)*3+k]=color[k];
  }
}
rectangle(0,0,width,70,[153,27,27]);
rectangle(35,100,110,110,[185,28,28]);
rectangle(165,100,110,110,[30,64,175]);
rectangle(295,100,110,110,[21,128,61]);
rectangle(425,100,180,110,[217,119,6]);
const font={T:['11111','00100','00100','00100','00100','00100','00100'],E:['11111','10000','10000','11110','10000','10000','11111'],S:['11111','10000','10000','11111','00001','00001','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],V:['10001','10001','10001','10001','10001','01010','00100'],A:['01110','10001','10001','11111','10001','10001','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],I:['11111','00100','00100','00100','00100','00100','11111'],D:['11110','10001','10001','10001','10001','10001','11110'],' ':['00000','00000','00000','00000','00000','00000','00000'],'-':['00000','00000','00000','11111','00000','00000','00000']};
function label(text,x,y,scale,color) {
  for(const char of text){const glyph=font[char];for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(glyph[row][col]==='1')rectangle(x+col*scale,y+row*scale,scale,scale,color);x+=6*scale;}
}
label('TESTE',30,17,5,[255,255,255]);
label('SEM VALIDADE',55,270,7,[31,41,55]);
function crc32(buffer) {let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,checksum]);}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
const scanlines=Buffer.alloc((width*3+1)*height);
for(let row=0;row<height;row++)pixels.copy(scanlines,row*(width*3+1)+1,row*width*3,(row+1)*width*3);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('tEXt',Buffer.from('Comment\0DADO FICTICIO - SEM VALIDADE')),chunk('IDAT',deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]);
writeFileSync(folder+'/foto-teste.png',png);

const content='BT /F1 24 Tf 50 760 Td (DOCUMENTO DE TESTE) Tj 0 -45 Td (SEM VALIDADE) Tj /F1 14 Tf 0 -50 Td (Sistema Portaria DEV) Tj 0 -30 Td (Somente dados ficticios. Nenhuma pessoa real.) Tj ET';
const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+Buffer.byteLength(content)+' >>\nstream\n'+content+'\nendstream',
];
let pdf='%PDF-1.4\n';const offsets=[0];
objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(index+1)+' 0 obj\n'+object+'\nendobj\n';});
const xref=Buffer.byteLength(pdf);pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
pdf+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
writeFileSync(folder+'/documento-teste.pdf',pdf);
console.log('PNG geometrico e PDF demonstrativo gerados em supabase/dev/assets. Nenhum upload realizado.');
