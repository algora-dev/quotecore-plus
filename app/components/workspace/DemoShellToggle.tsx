/**
 * Demo/Workspace segmented toggle (owner request 2026-11-02): a switch-looking
 * control in the app shell top-right. The ACTIVE side shows where the user is
 * (orange highlight); clicking the other side navigates. Both sessions coexist
 * in separate cookie namespaces, so switching is plain navigation - no
 * re-login, no state to restore.
 */
export function DemoShellToggle({ active, otherHref }: { active: 'workspace' | 'demo'; otherHref: string }) {
  const segment = (key: 'workspace' | 'demo', label: string) =>
    key === active
      ? <span key={key} className="qc-demo-toggle-seg is-active" aria-current="page">{label}</span>
      : <a key={key} className="qc-demo-toggle-seg" href={otherHref}>{label}</a>;

  return (
    <div className="qc-demo-toggle" role="group" aria-label="Switch between your workspace and the guided walkthrough">
      {segment('workspace', 'My Workspace')}
      {segment('demo', 'Demo')}
    </div>
  );
}
