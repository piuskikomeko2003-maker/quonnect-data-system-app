import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const createInstance = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    db: {
      schema: "public",
    },
  });

let clientInstance: ReturnType<typeof createInstance> | null = null;

export const createClient = (): ReturnType<typeof createInstance> => {
  if (!clientInstance) {
    clientInstance = createInstance();
  }
  return clientInstance;
};
