import { useEffect, useState } from 'react';
import { RemoteGateway } from '../../../../packages/shared/src/gateway.ts';
import type { Gateway } from '../../../../packages/shared/src/gateway.ts';
// This link always stays on the current environment. Preview URLs do not share auth cookies.
export function AccountAccess({ gateway, visibleEntry = false }: { gateway: Gateway | null; visibleEntry?: boolean }) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let alive = true;
    setAllowed(false);
    async function check() {
      try {
        const ok = gateway instanceof RemoteGateway ? await gateway.betaAccess() : false;
        if (alive) setAllowed(ok);
      } catch { if (alive) setAllowed(false); }
    }
    void check();
    const timer = setInterval(() => void check(), 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [gateway, gateway?.actor.id]);
  if (!allowed && !visibleEntry) return null;
  return <section aria-label="Tests du site"><h2>Version test</h2><p>{allowed ? "Essaie les variantes de cette version du site et partage ton avis." : "Compte testeur ou lien d’invitation requis pour ouvrir le configurateur."}</p><a className="btn secondary" href="/beta">Accès bêta version</a></section>;
}
