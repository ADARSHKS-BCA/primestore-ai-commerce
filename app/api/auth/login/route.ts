import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, hashPassword } from '@/lib/userStore';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Lookup user in database
    const user = await findUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email. Please sign up first.' },
        { status: 404 }
      );
    }

    // Verify password hash
    const inputHash = hashPassword(password);
    if (user.passwordHash !== inputHash) {
      return NextResponse.json(
        { error: 'Incorrect password. Please verify your credentials and try again.' },
        { status: 401 }
      );
    }

    // Login successful
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        phone: user.phone || '',
        address: user.address || '',
      },
    });
  } catch (err: unknown) {
    console.error('Login API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
