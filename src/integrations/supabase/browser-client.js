(function(){
  const PROJECT_URL = 'https://bitviprtefkgyahtltez.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_rgSKh81ja49hTIk_VE-kEg_3hKJqJxI';
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
  let clientPromise = null;

  async function createClient(){
    if(clientPromise) return clientPromise;
    clientPromise = import(CDN).then(({ createClient }) => createClient(PROJECT_URL, PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }));
    return clientPromise;
  }

  async function isAvailable(){
    try {
      await createClient();
      return true;
    } catch (_) {
      return false;
    }
  }

  window.StrikeglassSupabase = {
    url: PROJECT_URL,
    publishableKey: PUBLISHABLE_KEY,
    createClient,
    isAvailable
  };
})();
