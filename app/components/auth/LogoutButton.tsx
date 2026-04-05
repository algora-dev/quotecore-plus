import { logoutAction } from '@/app/actions';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="inline-flex items-center rounded-full border-2 border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600 pill-shimmer"
      >
        Logout
      </button>
    </form>
  );
}
