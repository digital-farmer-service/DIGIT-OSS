import { useQuery, useQueryClient } from "react-query";

const useInboxData = (searchParams) => {
  const client = useQueryClient();
  // const [complaintList, setcomplaintList] = useState([]);
  // const user = Digit.UserService.getUser();
  // const tenantId = user?.info?.tenantId;


  const fetchInboxData = async () => {
    const tenantId = Digit.ULBService.getCurrentTenantId();
    let serviceIds = [];
    let commonFilters = { start: 1, end: 10 };
    const { limit, offset } = searchParams;
    let appFilters = { ...commonFilters, ...searchParams.filters.pgrQuery, ...searchParams.search, limit, offset };
    let wfFilters = { ...commonFilters, ...searchParams.filters.wfQuery };
    let complaintDetailsResponse = null;
    let combinedRes = [];
    let workflowInstances = null;

    if(searchParams.filters.wfQuery.assignee) {
      let serviceIdParams = '';
      workflowInstances = await Digit.WorkflowService.getByBusinessId(tenantId, serviceIds, wfFilters, false);
      if (workflowInstances.ProcessInstances.length) {
        workflowInstances.ProcessInstances.forEach((instance) => serviceIds.push(instance.businessId));
        serviceIdParams = serviceIds.join();
      }
      complaintDetailsResponse = await Digit.PGRService.search(tenantId , appFilters, serviceIdParams);
    } else {
      complaintDetailsResponse = await Digit.PGRService.search(tenantId, appFilters);
      complaintDetailsResponse.ServiceWrappers.forEach((service) => serviceIds.push(service.service.serviceRequestId));
      const serviceIdParams = serviceIds.join();
      workflowInstances = await Digit.WorkflowService.getByBusinessId(tenantId, serviceIdParams, wfFilters, false);  
    }
    if (workflowInstances.ProcessInstances.length) {
      combinedRes = combineResponses(complaintDetailsResponse, workflowInstances).map((data) => ({
        ...data,
        sla: Math.round(data.sla / (24 * 60 * 60 * 1000)),
      }));
    }
    return {complaints:combinedRes, totalCount: workflowInstances?.totalCount};
  };

  const result = useQuery(["fetchInboxData", 
  ...Object.keys(searchParams).map(i =>
      typeof searchParams[i] === "object" ? Object.keys(searchParams[i]).map(e => searchParams[i][e]) : searchParams[i]
     )],
  fetchInboxData,
  { staleTime: Infinity }
  );
  return { ...result, revalidate: () => client.refetchQueries(["fetchInboxData"]) };
};

const mapWfBybusinessId = (wfs) => {
  return wfs.reduce((object, item) => {
    return { ...object, [item["businessId"]]: item };
  }, {});
};

const combineResponses = (complaintDetailsResponse, workflowInstances) => {
  let wfMap = mapWfBybusinessId(workflowInstances.ProcessInstances);
  return complaintDetailsResponse.ServiceWrappers.map((complaint) => ({
    serviceRequestId: complaint.service.serviceRequestId,
    complaintSubType: complaint.service.serviceCode,
    complaintSubSubCategory: complaint.service?.additionalDetail?.subSubcategory,
    locality: complaint.service.address.locality.code,
    status: complaint.service.applicationStatus,
    taskOwner: wfMap[complaint.service.serviceRequestId]?.assignes?.[0]?.name || "-",
    sla: wfMap[complaint.service.serviceRequestId]?.businesssServiceSla,
    tenantId: complaint.service.tenantId,
    district: complaint.service?.address?.district
  }));
};

export default useInboxData;
