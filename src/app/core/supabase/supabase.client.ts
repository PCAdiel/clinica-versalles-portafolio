import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private supabaseClient?: SupabaseClient;

  get client(): SupabaseClient {
    this.assertConfigured();

    this.supabaseClient ??= createClient(
      environment.supabaseUrl.trim(),
      environment.supabaseAnonKey.trim(),
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true
        }
      }
    );

    return this.supabaseClient;
  }

  get isConfigured(): boolean {
    return Boolean(environment.supabaseUrl.trim() && environment.supabaseAnonKey.trim());
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new Error('Configura SUPABASE_URL y SUPABASE_ANON_KEY en los archivos de environment antes de usar Supabase.');
    }
  }
}
