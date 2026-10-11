// Las llaves se leen del entorno (p. ej. `node --env-file=.env.local <este archivo>`); nunca van escritas en el repositorio.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = 'testuser1776821675275@gmail.com';
  const password = "Password123!";

  console.log("1. Signing in user...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (authErr) {
    console.error("SignIn error:", authErr);
    return;
  }
  
  console.log("User signed in, JWT acquired.");

  console.log("2. Attempting to insert employee...");
  const payload = {
    nombres: "Luis",
    apellidos: "Mata",
    cedula: "V-" + Date.now(),
    organization_id: '5607a881-e65e-493b-ab06-d129d50fe9e2'
  };
  
  const { data: emp, error: empErr } = await supabase.from('employees').insert([payload]).select();
  if (empErr) {
    console.error("Employee insert error:", empErr);
  } else {
    console.log("Employee inserted successfully:", emp);
  }
}

run();
