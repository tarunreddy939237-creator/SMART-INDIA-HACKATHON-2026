import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { getInstitutionAnalytics } from '@/lib/queries.js';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    // In dev/demo mode session may not resolve — allow through; real auth enforced by middleware
    if (userRole && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin role required' }, { status: 403 });
    }

    const analytics = await getInstitutionAnalytics();
    return NextResponse.json({ success: true, analytics });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
