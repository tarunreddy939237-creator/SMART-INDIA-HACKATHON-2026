import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { getVideoLectures, createVideoLecture, deleteVideoLecture } from '@/lib/queries.js';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject') || undefined;
    const mine = searchParams.get('mine');

    if (role === 'student') {
      const audienceSection = session?.user?.classOrSubject;
      if (!audienceSection) return NextResponse.json({ videos: [] });
      const videos = await getVideoLectures({ subject, audienceSection });
      return NextResponse.json({ videos });
    }

    if (role === 'faculty' || role === 'admin') {
      const uploadedBy = mine && role === 'faculty' ? session.user.id : undefined;
      const videos = await getVideoLectures({ subject, uploadedBy });
      return NextResponse.json({ videos });
    }

    return NextResponse.json({ videos: [] }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Faculty or Admin role required' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, subject, branch, section, videoUrl, duration } = body;

    if (!title || !subject || !videoUrl) {
      return NextResponse.json({ error: 'title, subject and videoUrl are required' }, { status: 400 });
    }
    if (!branch || !section) {
      return NextResponse.json({ error: 'branch and section are required' }, { status: 400 });
    }

    const uploadedBy = session?.user?.id;
    if (!uploadedBy) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const video = await createVideoLecture({ title, description, subject, branch, section, videoUrl, duration, uploadedBy });
    return NextResponse.json({ success: true, video });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');
    if (!videoId) return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    await deleteVideoLecture(videoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
