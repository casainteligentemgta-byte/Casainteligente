import { useEffect, useState } from 'react';
export function useQuery({ queryFn, enabled = true, queryKey }: any) {
  const [s, setS] = useState<any>({ isLoading: enabled, data: undefined, error: null });
  useEffect(() => {
    if (!enabled) return;
    let vivo = true;
    Promise.resolve().then(queryFn).then(
      (data: any) => vivo && setS({ isLoading: false, data, error: null }),
      (error: any) => vivo && setS({ isLoading: false, data: undefined, error }),
    );
    return () => { vivo = false; };
  }, [JSON.stringify(queryKey)]);
  return s;
}
export function QueryClientProvider({ children }: any) { return children; }
export class QueryClient {}
export function useQueryClient() { return { invalidateQueries() {} }; }
export function useMutation() { return { mutate() {}, mutateAsync: async () => {}, isPending: false }; }
