import { logoutAction } from '@/app/actions';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="inline-flex items-center rounded-full border-2 border-transparent bg-white px-3 py-1 text-sm font-semibold text-slate-600 transition-all duration-200 ease-in-out hover:border-orange-500 hover:shadow-[0_0_8px_rgba(255,107,53,0.3)] hover:scale-102"
      >
        Logout
      </button>
    </form>
  );
}
