// Fonction Edge Supabase (Deno). Toute la logique est dans ../_shared/paiement.ts, testée sous Node.
import { checkout } from '../_shared/paiement.ts';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };
Deno.serve(request => checkout(request, { env: Deno.env, fetch }));
