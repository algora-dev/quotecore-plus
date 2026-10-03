'use client';

import type { RefObject } from 'react';
import type { EventPref, PrefSurface } from '@/app/lib/alerts/prefs';
import { NOTIFICATION_MATRIX, type NotificationChannelKey } from './message-center-model';

/** Native accessible switches with 44px targets, using existing preference callbacks. */
function PreferenceSwitch({ checked, disabled, label, onChange }: {
  checked: boolean; disabled: boolean; label: string; onChange: () => void;
}) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label}
    disabled={disabled} className="qc-message-switch" onClick={onChange}>
    <span aria-hidden="true" className="qc-message-switch-track"><span /></span>
  </button>;
}

export function MessageCenterPreferences({ headingRef, prefs, saving, eventOn, masterOn, onToggleEvent, onToggleMaster }: {
  headingRef?: RefObject<HTMLHeadingElement>; prefs: Record<string, EventPref>; saving: boolean;
  eventOn: (key: string, surface: PrefSurface) => boolean;
  masterOn: (key: NotificationChannelKey, surface: PrefSurface) => boolean;
  onToggleEvent: (key: string, surface: PrefSurface) => void;
  onToggleMaster: (key: NotificationChannelKey, surface: PrefSurface) => void;
}) {
  return <div className="qc-message-preferences">
    <div className="qc-message-preferences-intro">
      <h2 ref={headingRef} tabIndex={-1}>Notification settings</h2>
      <p>Choose the updates you see here and the emails sent to your team. These settings do not change the status of a quote, order or invoice.</p>
      <p className="qc-message-preferences-saving" role="status">{saving ? 'Saving notification setting…' : 'Changes save when you switch a setting.'}</p>
    </div>
    {NOTIFICATION_MATRIX.map(channel => <div key={channel.key} className="qc-message-preference-card">
      <div className="qc-message-preference-heading">
        <h3>{channel.label}</h3>
        <span>{channel.events.length} {channel.events.length === 1 ? 'event' : 'events'}</span>
      </div>
      <div className="qc-message-master-row">
        {(['app', 'email'] as const).map(surface => {
          const enabledCount = channel.events.filter(event => prefs[event.key]?.[surface] ?? eventOn(event.key, surface)).length;
          return <div key={surface} className="qc-message-master">
            <div><strong>{surface === 'app' ? 'In-app alerts' : 'Email alerts'}</strong>
              <span>{enabledCount === 0 ? 'All off' : enabledCount === channel.events.length ? 'All on' : `${enabledCount} of ${channel.events.length} on`}</span>
            </div>
            <PreferenceSwitch checked={masterOn(channel.key, surface)} disabled={saving}
              label={`All ${channel.label} ${surface === 'app' ? 'in-app alerts' : 'emails'}`}
              onChange={() => onToggleMaster(channel.key, surface)} />
          </div>;
        })}
      </div>
      <details className="qc-message-event-details">
        <summary>Choose individual events</summary>
        <p className="qc-message-event-help">The channel switches turn all events off or on. Use the controls below for individual choices.</p>
        <div className="qc-message-event-labels" aria-hidden="true"><span>Event</span><span>In-app</span><span>Email</span></div>
        {channel.events.map(event => <div key={event.key} className="qc-message-event">
          <strong>{event.label}</strong>
          {(['app', 'email'] as const).map(surface => <div key={surface} className="qc-message-event-control">
            <span aria-hidden="true">{surface === 'app' ? 'In-app' : 'Email'}</span>
            <PreferenceSwitch checked={eventOn(event.key, surface)} disabled={saving}
              label={`${channel.label} – ${event.label} – ${surface === 'app' ? 'in-app' : 'email'}`}
              onChange={() => onToggleEvent(event.key, surface)} />
          </div>)}
        </div>)}
      </details>
    </div>)}
  </div>;
}
