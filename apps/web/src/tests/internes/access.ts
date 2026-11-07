let allowed=false;
export const hasInternalTestsAccess=()=>allowed;
export async function checkInternalTestsAccess(){try{const res=await fetch('/.netlify/functions/tests-internes-auth',{cache:'no-store'});allowed=res.ok&&(await res.json()).allowed===true;}catch{allowed=false;}dispatchEvent(new Event('flemme-tests-internes-access'));return allowed;}
export async function loginInternalTests(body:Record<string,string>){const res=await fetch('/.netlify/functions/tests-internes-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!res.ok)throw new Error(res.status===503?'Accès tests/internes pas encore configuré.':'Accès refusé ou invitation expirée.');return checkInternalTestsAccess();}
export async function logoutInternalTests(){await fetch('/.netlify/functions/tests-internes-auth',{method:'DELETE'});return checkInternalTestsAccess();}
