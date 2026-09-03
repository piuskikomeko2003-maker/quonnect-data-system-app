import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const createServiceInstance = () =>
  createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

let serviceClientInstance: ReturnType<typeof createServiceInstance> | null = null;

export const createServiceClient = (): ReturnType<typeof createServiceInstance> => {
  if (!serviceClientInstance) {
    serviceClientInstance = createServiceInstance();
  }
  return serviceClientInstance;
};
