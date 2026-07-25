/**
 * Edge Function opcional: procesa una reunión Pheme (STT + LLM + embeddings).
 * Preferido en producción: POST /api/pheme/reuniones/[id]/process (Next.js).
 *
 * Auth: Authorization Bearer <user JWT>
 * Body: { reunion_id: string, preferred_stt_provider?: 'openai'|'groq'|'auto' }
 *
 * Variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * OPENAI_API_KEY, GROQ_API_KEY (opcional), APP_BASE_URL (URL del Next.js).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization Bearer requerido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const appBase = (Deno.env.get('APP_BASE_URL') ?? Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? '').replace(
      /\/$/,
      '',
    );

    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: 'Supabase env incompleto' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: 'JWT inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as {
      reunion_id?: string;
      preferred_stt_provider?: string;
    };
    const reunionId = String(body.reunion_id ?? '').trim();
    if (!reunionId) {
      return new Response(JSON.stringify({ error: 'reunion_id requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: reunion, error: reunionError } = await userClient
      .from('reuniones')
      .select('id')
      .eq('id', reunionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (reunionError || !reunion) {
      return new Response(JSON.stringify({ error: 'Reunión no encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!appBase) {
      return new Response(
        JSON.stringify({
          error:
            'Configure APP_BASE_URL para delegar el pipeline a /api/pheme/reuniones/[id]/process',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const upstream = await fetch(`${appBase}/api/pheme/reuniones/${reunionId}/process`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Cookie: req.headers.get('Cookie') ?? '',
      },
      body: JSON.stringify({
        preferredSttProvider: body.preferred_stt_provider ?? 'auto',
      }),
    });

    const payload = await upstream.text();
    return new Response(payload, {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
