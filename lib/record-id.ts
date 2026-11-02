// randomUUID is restricted to secure contexts in some browsers. getRandomValues
// is also available on HTTP previews and provides the same secure UUID entropy.
export function createRecordId(source:Pick<Crypto,'getRandomValues'> & Partial<Pick<Crypto,'randomUUID'>>=globalThis.crypto):string{
 if(typeof source?.randomUUID==='function')return source.randomUUID();
 if(typeof source?.getRandomValues!=='function')throw Error('이 브라우저에서 기록 번호를 만들 수 없습니다. 최신 브라우저에서 다시 시도해주세요.');
 const bytes=source.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
