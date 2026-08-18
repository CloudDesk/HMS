import { useQuery } from '@tanstack/react-query';
import { servicesApi, type ServiceListParams } from '../../api/services';

export const servicesKeys = {
  all: ['services'] as const,
  lists: () => [...servicesKeys.all, 'list'] as const,
  list: (params: ServiceListParams) => [...servicesKeys.lists(), params] as const,
};

export function useServicesList(params: ServiceListParams, enabled = true) {
  return useQuery({
    queryKey: servicesKeys.list(params),
    queryFn: () => servicesApi.list(params),
    enabled,
  });
}
