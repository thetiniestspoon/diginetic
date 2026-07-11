// Family Core Supabase client + porch-gate + edge-fn wrapper.
const SUPABASE_URL = 'https://ckjcieeccopqowlfljja.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IRcRu0nSCDCInd8XPpImaA_ztlZ2poj';
const PORCH_URL = 'https://thetiniestspoon.github.io/command-center/porch.html';

let _client = null;
export function getClient() {
  if (_client) return _client;
  // supabase UMD global is `supabase`
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return _client;
}

export async function requirePorchSession() {
  const { data: { session } } = await getClient().auth.getSession();
  if (!session) {
    window.location.replace(PORCH_URL + '?return=' + encodeURIComponent(window.location.href));
    return false;
  }
  return true;
}

export async function invokeAction(action, payload = {}) {
  const { data, error } = await getClient().functions.invoke('diginetic', {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data;
}
