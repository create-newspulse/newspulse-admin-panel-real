import { toast, type ToastOptions } from 'react-hot-toast';

export function useNotify() {
  return {
    ok: (title: string, desc?: string, opts?: ToastOptions) => toast.success(desc ? `${title}: ${desc}` : title, opts),
    err: (title: string, desc?: string, opts?: ToastOptions) => toast.error(desc ? `${title}: ${desc}` : title, opts),
    info: (msg: string, opts?: ToastOptions) => toast(msg, opts),
  };
}
