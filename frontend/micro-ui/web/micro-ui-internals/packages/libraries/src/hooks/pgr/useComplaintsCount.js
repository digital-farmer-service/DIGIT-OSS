import { useQuery, useQueryClient } from "react-query";

const useComplaintsCount = (searchParams) => {
  const client = useQueryClient();

  const fetchCount = async () => {
    const tenantId = Digit.ULBService.getCurrentTenantId();
    let serviceIds = [];
    const workflowInstances = await Digit.WorkflowService.getByBusinessId(tenantId, serviceIds, searchParams, false);
    return workflowInstances.totalCount;
  };

  const result = useQuery(["fetchCount"], fetchCount, { staleTime: 0 });

  return { ...result, revalidate: () => client.refetchQueries(["fetchCount"]) };
};
export default useComplaintsCount;
