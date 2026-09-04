import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, registerUser } from '@/lib/userStore';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    if (!fullName || fullName.trim().length === 0) {
      return NextResponse.json({ error: 'Please provide your full name.' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // Register user into Database
    const newUser = await registerUser(email, password, fullName);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.fullName,
        phone: newUser.phone || '',
        address: newUser.address || '',
      },
    });
  } catch (err: unknown) {
    console.error('Signup API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Signup failed. Please try again.' },
      { status: 500 }
    );
  }
}
