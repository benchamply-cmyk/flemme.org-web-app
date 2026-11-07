let allowed=false;
export const hasBetaAccess=()=>allowed;
export async function checkBetaAccess(){try{const res=await fetch('/.netlify/functions/beta-auth',{cache:'no-store'});allowed=res.ok&&(await res.json()).allowed===true;}catch{allowed=false;}dispatchEvent(new Event('flemme-beta-access'));return allowed;}
export async function loginBeta(body:Record<string,string>){const res=await fetch('/.netlify/functions/beta-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!res.ok)throw new Error(res.status===503?'Accès bêta pas encore configuré.':'Accès refusé ou invitation expirée.');return checkBetaAccess();}
export async function logoutBeta(){await fetch('/.netlify/functions/beta-auth',{method:'DELETE'});return checkBetaAccess();}
