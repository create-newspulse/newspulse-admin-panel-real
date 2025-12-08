import { toast } from 'react-hot-toast';

export function useNotify() {
  return {
    ok: (title: string, desc?: string) => toast.success(desc ? `${title}: ${desc}` : title),
    err: (title: string, desc?: string) => toast.error(desc ? `${title}: ${desc}` : title),
    info: (msg: string) => toast(msg),
  };
}
