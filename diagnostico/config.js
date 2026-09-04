/*
 * Configuração pública do novo projeto Supabase exclusivo da consultoria.
 *
 * Configurado somente depois de:
 * 1. criar o projeto "rodocore-consultoria";
 * 2. aplicar a migration em diagnostico/supabase/migrations;
 * 3. confirmar que a RLS está ativa e que o usuário anon não possui SELECT,
 *    UPDATE ou DELETE na tabela de contatos.
 *
 * Nunca coloque service_role, senha ou segredo administrativo neste arquivo.
 */
window.RODOCORE_CONFIG = {
  supabaseUrl: 'https://welkztrgmgqjhceulcms.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlbGt6dHJnbWdxamhjZXVsY21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Mjc3NTQsImV4cCI6MjEwNDAwMzc1NH0.tzIoCxB3RZxMEVaNY6-1wO_ryT6vrfT7XRZNauhxKMk',
  leadsTable: 'public_diagnostic_leads'
};
