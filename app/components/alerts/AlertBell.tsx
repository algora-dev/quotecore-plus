'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  quote_id: string | null;
}

interface Props {
  initialAlerts: Alert[];
  initialUnreadCount: number;
  workspaceSlug: string;
}

export function AlertBell({ initialAlerts, initialUnreadCount, workspaceSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Poll for new alerts every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [router]);

  // Sync from server
  useEffect(() => {
    setAlerts(initialAlerts);
    setUnreadCount(initialUnreadCount);
  }, [initialAlerts, initialUnreadCount]);

  async function markAsRead(alertId: string) {
    try {
      const res = await fetch(`/api/alerts/${alertId}/read`, { method: 'POST' });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {}
  }

  async function markAllRead() {
    try {
      const res = await fetch('/api/alerts/read-all', { method: 'POST' });
      if (res.ok) {
        setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
        setUnreadCount(0);
      }
    } catch {}
  }

  async function clearAll() {
    try {
      const res = await fetch('/api/alerts/clear-all', { method: 'POST' });
      if (res.ok) {
        setAlerts([]);
        setUnreadCount(0);
      }
    } catch {}
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition"
      >
        {/* Bell icon */}
        <svg
          className={`w-5 h-5 ${unreadCount > 0 ? 'text-orange-500' : 'text-slate-500'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Pulsing badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500 items-center justify-center text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-orange-600 hover:text-orange-800">Mark read</button>
              )}
              {alerts.length > 0 && (
                <button onClick={clearAll} className="text-xs text-slate-400 hover:text-red-500">Clear all</button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {alerts.length > 0 ? (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => {
                    if (!alert.is_read) markAsRead(alert.id);
                    if (alert.quote_id) {
                      router.push(`/${workspaceSlug}/quotes/${alert.quote_id}/summary`);
                      setOpen(false);
                    }
                  }}
                  className={`w-full text-left p-3 border-b border-slate-50 hover:bg-slate-50 transition ${
                    !alert.is_read ? 'bg-orange-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!alert.is_read && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                    )}
                    <div className={!alert.is_read ? '' : 'ml-4'}>
                      <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                      {alert.message && (
                        <p className="text-xs text-slate-500 mt-0.5">{alert.message}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(alert.created_at).toLocaleDateString('en-NZ', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-6 text-center text-sm text-slate-400">
                No notifications yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
