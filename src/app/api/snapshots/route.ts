import { NextRequest, NextResponse } from 'next/server';
import { saveSnapshot, getAllSnapshots, getLatestSnapshot, getSnapshotCount } from '@/lib/supabase';

// Secret key for protecting write operations
const CRON_SECRET = process.env.CRON_SECRET;

// GET: Retrieve snapshots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (mode === 'latest') {
      const snapshot = await getLatestSnapshot();
      if (!snapshot) {
        return NextResponse.json({ error: 'No snapshots found' }, { status: 404 });
      }
      return NextResponse.json(snapshot);
    }

    if (mode === 'count') {
      const count = await getSnapshotCount();
      return NextResponse.json({ count });
    }

    const snapshots = await getAllSnapshots(limit);
    return NextResponse.json(snapshots);
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

// POST: Save a new snapshot (protected by CRON_SECRET)
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.capturedAt || !body.summary || !body.tableCondensed) {
      return NextResponse.json(
        { error: 'Missing required fields: capturedAt, summary, tableCondensed' },
        { status: 400 }
      );
    }

    const snapshot = {
      captured_at: body.capturedAt,
      captured_at_unix: body.capturedAtUnix || Math.floor(new Date(body.capturedAt).getTime() / 1000),
      summary: body.summary,
      table_condensed: body.tableCondensed,
    };

    const result = await saveSnapshot(snapshot);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to save snapshot' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Snapshot saved successfully' });
  } catch (error) {
    console.error('Error saving snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to save snapshot' },
      { status: 500 }
    );
  }
}
