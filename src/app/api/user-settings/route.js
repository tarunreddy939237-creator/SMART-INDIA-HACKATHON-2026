import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import connectToDatabase from '@/lib/mongodb.js';
import User from '@/lib/models/User.js';
import { isValidObjectId } from '@/lib/queries.js';

const VALID_LANGUAGES = ['en', 'te', 'hi'];
const VALID_FONT_SIZES = ['normal', 'large', 'xlarge'];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await connectToDatabase();
    if (!db || !isValidObjectId(userId)) {
      return NextResponse.json({ settings: { languagePreference: 'en', accessibilitySettings: { fontSize: 'normal', highContrast: false, reducedMotion: false } } });
    }

    const user = await User.findById(userId).select('languagePreference accessibilitySettings').lean();
    return NextResponse.json({
      settings: {
        languagePreference: user?.languagePreference || 'en',
        accessibilitySettings: user?.accessibilitySettings || { fontSize: 'normal', highContrast: false, reducedMotion: false },
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[user-settings] GET error:', e.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const db = await connectToDatabase();
    if (!db || !isValidObjectId(userId)) return NextResponse.json({ error: 'Database not available' }, { status: 503 });

    // Whitelist only allowed fields — prevents mass assignment
    const update = {};

    // Validate language preference
    if (body.languagePreference !== undefined) {
      const lang = String(body.languagePreference).trim();
      if (VALID_LANGUAGES.includes(lang)) {
        update.languagePreference = lang;
      }
    }

    // Validate accessibility settings — whitelist only known fields
    if (body.accessibilitySettings && typeof body.accessibilitySettings === 'object') {
      const settings = {};
      const src = body.accessibilitySettings;
      if (typeof src.fontSize === 'string' && VALID_FONT_SIZES.includes(src.fontSize)) {
        settings.fontSize = src.fontSize;
      }
      if (typeof src.highContrast === 'boolean') {
        settings.highContrast = src.highContrast;
      }
      if (typeof src.reducedMotion === 'boolean') {
        settings.reducedMotion = src.reducedMotion;
      }
      if (Object.keys(settings).length > 0) {
        update.accessibilitySettings = settings;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true, message: 'No valid changes provided.' });
    }

    await User.findByIdAndUpdate(userId, { $set: update });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[user-settings] PATCH error:', e.message);
    }
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
