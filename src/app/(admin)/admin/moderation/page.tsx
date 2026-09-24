'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ModerationItem {
  id: string;
  contentId: string;
  thumbnailUrl: string;
  title: string;
  creator: {
    username: string;
    email: string;
  };
  aiScore: number;
  flags: string[];
  uploadedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

type Tab = 'pending' | 'approved' | 'rejected';

type Counts = Record<Tab, number>;

export default function ModerationQueue() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<Tab>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchModerationQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/moderation?status=${selectedTab}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItems([]);
        setError(typeof data.error === 'string' ? data.error : 'Could not load the queue');
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setCounts({
        pending: Number(data.counts?.pending ?? 0),
        approved: Number(data.counts?.approved ?? 0),
        rejected: Number(data.counts?.rejected ?? 0),
      });
    } catch {
      setItems([]);
      setError('Could not load the queue');
    } finally {
      setLoading(false);
    }
  }, [selectedTab]);

  useEffect(() => {
    void fetchModerationQueue();
  }, [fetchModerationQueue]);

  const handleDecision = async (contentId: string, decision: 'approve' | 'reject') => {
    setBusyId(contentId);
    setError(null);
    try {
      const res = await fetch('/api/admin/moderation/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Decision failed');
        return;
      }
      await fetchModerationQueue();
    } catch {
      setError('Decision failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl p-8">
      <h1 className="mb-8 text-3xl font-bold text-white">Content Moderation</h1>

      <div className="mb-6 flex gap-4">
        {(['pending', 'approved', 'rejected'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSelectedTab(tab)}
            className={`rounded-lg px-4 py-2 font-medium capitalize ${
              selectedTab === tab ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-zinc-400" role="status">
          Loading queue…
        </p>
      ) : items.length === 0 ? (
        <p className="text-zinc-400">No {selectedTab} items right now.</p>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                <Image
                  src={item.thumbnailUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {item.aiScore > 50 && (
                  <div className="absolute right-2 top-2 rounded bg-red-500 px-2 py-1 text-xs text-white">
                    AI Flag: {item.aiScore}%
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="mb-1 font-semibold text-white">{item.title}</h3>
                <p className="mb-2 text-sm text-zinc-400">
                  by {item.creator.username}
                  {item.creator.email ? ` · ${item.creator.email}` : ''}
                </p>

                <div className="mb-3 flex flex-wrap gap-2">
                  {item.flags.map((flag) => (
                    <Badge key={flag} variant="destructive" className="text-xs">
                      <AlertTriangle size={12} className="mr-1" />
                      {flag}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                    disabled={busyId === item.contentId || item.status !== 'pending'}
                    onClick={() => handleDecision(item.contentId, 'approve')}
                  >
                    <CheckCircle size={16} className="mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                    disabled={busyId === item.contentId || item.status !== 'pending'}
                    onClick={() => handleDecision(item.contentId, 'reject')}
                  >
                    <XCircle size={16} className="mr-1" />
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/content/${item.contentId}`}>
                      <Eye size={16} className="mr-1" />
                      View
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
