import { QueryClient, MutationCache, QueryCache } from "@tanstack/react-query";
import { toast } from "@icupa/ui/use-toast";

export const createQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof Error) {
          toast({
            title: "Request failed",
            description: error.message,
            variant: "destructive",
          });
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error instanceof Error) {
          toast({
            title: "Action failed",
            description: error.message,
            variant: "destructive",
          });
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
