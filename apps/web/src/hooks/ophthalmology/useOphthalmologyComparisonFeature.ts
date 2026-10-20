import { useAppLocation } from '../../routing/navigation';
import { useOphthalmologyComparisons } from './useOphthalmology';

export function useOphthalmologyComparisonFeature(taskId: string, resultId: string | null, version: number, ready: boolean) {
  const { search } = useAppLocation(); const params = new URLSearchParams(search);
  const open = params.get('comparison_lookup') === 'open';
  const rawPage = Number(params.get('comparison_page') ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const query = useOphthalmologyComparisons(taskId, version, page, ready && open && Boolean(resultId));
  const current = ready && open && query.data?.task_id === taskId && query.data.result_id === resultId && query.data.expected_result_version === version;
  return { open, page, query, data: current ? query.data : undefined,
    canSelect: current && query.isSuccess && !query.isError && !query.isFetching };
}
