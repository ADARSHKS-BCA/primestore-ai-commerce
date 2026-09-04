import { NextResponse } from 'next/server';
import { getUserProfile, saveUserProfile } from '@/lib/supabaseStore';
import { findUserById, updateUserProfileInDB } from '@/lib/userStore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Try Supabase store first
    let profile = await getUserProfile(userId);

    // If not found in Supabase, check UserStore
    if (!profile) {
      const dbUser = await findUserById(userId);
      if (dbUser) {
        profile = {
          id: dbUser.id,
          email: dbUser.email,
          fullName: dbUser.fullName,
          phone: dbUser.phone || '',
          address: dbUser.address || '',
          createdAt: dbUser.createdAt,
        };
      }
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('❌ [GET /api/user/profile] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, email, fullName, phone, address } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const profile = {
      id,
      email: email || '',
      fullName: fullName || '',
      phone: phone || '',
      address: address || '',
      createdAt: new Date().toISOString(),
    };

    await saveUserProfile(profile);
    await updateUserProfileInDB(id, { fullName, phone, address });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('❌ [POST /api/user/profile] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save profile' },
      { status: 500 }
    );
  }
}

