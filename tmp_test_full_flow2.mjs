import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mibxmhiruhrbbwcjdvks.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnhtaGlydWhyYmJ3Y2pkdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDA1MDAsImV4cCI6MjA4NzAxNjUwMH0.SZGCik5AzKhtFpmm5EkOe4ShMb7Fu6QaOPI8eQi5W7k';

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
