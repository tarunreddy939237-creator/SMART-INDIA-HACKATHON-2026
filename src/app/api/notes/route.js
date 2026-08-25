import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth.js';
import { getNotes, createNote, deleteNote } from '@/lib/queries.js';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = session?.user?.role;
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject') || undefined;
    const mine = searchParams.get('mine');

    if (role === 'student') {
      const audienceSection = session?.user?.classOrSubject;
      if (!audienceSection) return NextResponse.json({ notes: [] });
      const notes = await getNotes({ subject, audienceSection });
      return NextResponse.json({ notes });
    }

    if (role === 'faculty' || role === 'admin') {
      const uploadedBy = mine && role === 'faculty' ? session.user.id : undefined;
      const notes = await getNotes({ subject, uploadedBy });
      return NextResponse.json({ notes });
    }

    return NextResponse.json({ notes: [] }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session  = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    if (userRole !== 'faculty' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const body = await request.json();
    const { title, content, subject, branch, section, type, resourceUrl } = body;
    if (!title || !content || !subject) {
      return NextResponse.json({ error: 'title, content and subject are required' }, { status: 400 });
    }
    if (!branch || !section) {
      return NextResponse.json({ error: 'branch and section are required' }, { status: 400 });
    }
    const uploadedBy = session?.user?.id;
    if (!uploadedBy) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const note = await createNote({ title, content, subject, branch, section, type, resourceUrl, uploadedBy });
    return NextResponse.json({ success: true, note });
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
    const noteId = searchParams.get('id');
    if (!noteId) return NextResponse.json({ error: 'Note ID required' }, { status: 400 });
    await deleteNote(noteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
