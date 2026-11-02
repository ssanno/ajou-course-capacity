const unavailable=()=>Response.json({error:'입력과 예측 기록은 각자의 브라우저에서만 저장·조회할 수 있습니다.'},{status:403,headers:{'Cache-Control':'no-store'}});
export async function GET(){return unavailable();}
export async function PUT(){return unavailable();}
