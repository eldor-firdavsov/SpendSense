'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  type AuthActionResult,
} from './schemas';


export async function registerAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const validated = registerSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      fieldErrors: validated.error.flatten().fieldErrors,
      error: 'Iltimos, quyidagi xatoliklarni to‘g‘rilang.',
    };
  }

  const { firstName, lastName, email, password } = validated.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('already registered') ||
      msg.includes('user already exists')
    ) {
      return {
        success: false,
        error: 'Ushbu elektron pochta manziliga ega hisob allaqachon mavjud. Iltimos, tizimga kiring.',
      };
    }
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return {
        success: false,
        error: 'Juda ko‘p urinishlar qilindi. Iltimos, biroz kutib qayta urining.',
      };
    }
    return {
      success: false,
      error: error.message,
    };
  }

  // If identities is empty or user already registered, Supabase sometimes returns an obfuscated user
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      success: false,
      error: 'Ushbu elektron pochta manziliga ega hisob allaqachon mavjud. Iltimos, tizimga kiring.',
    };
  }

  // Ensure active session cookie is established: if signUp did not return a session, sign in directly
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      const msg = signInError.message.toLowerCase();
      if (msg.includes('confirm') || msg.includes('not verified')) {
        return {
          success: false,
          error: 'Hisob yaratildi! Tizimga kirishdan oldin pochtangizni tasdiqlang.',
        };
      }
      return {
        success: false,
        error: signInError.message,
      };
    }
  }

  redirect('/dashboard');
}

export async function loginAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      fieldErrors: validated.error.flatten().fieldErrors,
      error: 'Iltimos, to‘g‘ri elektron pochta va parolni kiriting.',
    };
  }

  const { email, password } = validated.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return {
        success: false,
        error: 'Juda ko‘p urinishlar qilindi. Iltimos, biroz kutib qayta urining.',
      };
    }
    if (msg.includes('email not confirmed') || msg.includes('not verified')) {
      return {
        success: false,
        error: 'Elektron pochta manzilingiz tasdiqlanmagan. Iltimos, pochtangizni tekshiring.',
      };
    }
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      return {
        success: false,
        error: 'Noto‘g‘ri elektron pochta yoki parol. Ma’lumotlaringizni tekshirib qayta urining.',
      };
    }
    return {
      success: false,
      error: error.message || 'Noto‘g‘ri elektron pochta yoki parol. Qayta urining.',
    };
  }

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}


export async function updateProfileAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
  };

  const validated = updateProfileSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      fieldErrors: validated.error.flatten().fieldErrors,
      error: 'Please fix the errors below.',
    };
  }

  const { firstName, lastName } = validated.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: 'You must be logged in to update your profile.',
    };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
  };
}
