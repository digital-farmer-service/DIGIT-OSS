import { WSService } from "../../elements/WS";
import { PTService } from "../../elements/PT";
import cloneDeep from "lodash/cloneDeep";
import { PaymentService } from "../../elements/Payment";
import { MdmsService } from "../../elements/MDMS";

const stringReplaceAll = (str = "", searcher = "", replaceWith = "") => {
  if (searcher == "") return str;
  while (str.includes(searcher)) {
    str = str.replace(searcher, replaceWith);
  }
  return str;
};

const convertEpochToDate = (dateEpoch) => {
  if (dateEpoch) {
    const dateFromApi = new Date(dateEpoch);
    let month = dateFromApi.getMonth() + 1;
    let day = dateFromApi.getDate();
    let year = dateFromApi.getFullYear();
    month = (month > 9 ? "" : "0") + month;
    day = (day > 9 ? "" : "0") + day;
    return `${day}/${month}/${year}`;
  } else {
    return null;
  }
};

export const WSSearch = {
  application: async (tenantId, filters = {}, serviceType) => {
    const response = await WSService.search({ tenantId, filters: { ...filters }, businessService: serviceType === "WATER" ? "WS" : "SW" });
    return response;
  },

  property: async (tenantId, propertyfilter = {}) => {
    const response = await PTService.search({ tenantId, filters: propertyfilter, auth: true });
    return response;
  },

  searchBills: async (tenantId, consumercodes) => {
    const response = await Digit.PaymentService.searchBill(tenantId, { consumerCode: consumercodes, Service: "WS.ONE_TIME_FEE" });
    return response;
  },

  searchAmendment: async (tenantId, consumercodes, businessService="WS") => {
    const response = await Digit.PaymentService.searchAmendment(tenantId, { consumerCode: consumercodes, businessService });
    return response;
  },

  workflowDataDetails: async (tenantId, businessIds) => {
    const response = await Digit.WorkflowService.getByBusinessId(tenantId, businessIds);
    return response;
  },

  wsEstimationDetails: async (data, serviceType) => {
    let businessService = serviceType === "WATER" ? "WS" : "SW";
    const response = await WSService.wsCalculationEstimate(data, businessService);
    return response;
  },

  colletionData: async ({tenantId, serviceTypeOfData, collectionNumber}) => {
    const businessService = serviceTypeOfData;
    const consumerCodes = collectionNumber;
    const response = await Digit.PaymentService.recieptSearch(tenantId, businessService, {consumerCodes: consumerCodes });
    return response;
  },


  applicationDetails: async (t, tenantId, applicationNumber, serviceType = "WATER", config = {}) => {
    const filters = { applicationNumber };

    let propertyids = "",
      consumercodes = "",
      businessIds = "";

    const response = await WSSearch.application(tenantId, filters, serviceType);

    const wsData = cloneDeep(serviceType == "WATER" ? response?.WaterConnection : response?.SewerageConnections);

    wsData?.forEach((item) => {
      propertyids = propertyids + item?.propertyId + ",";
      consumercodes = consumercodes + item?.applicationNo + ",";
    });

    let propertyfilter = { propertyIds: propertyids.substring(0, propertyids.length - 1) };

    if (propertyids !== "" && filters?.locality) propertyfilter.locality = filters?.locality;

    config = { enabled: propertyids !== "" ? true : false };

    const properties = await WSSearch.property(tenantId, propertyfilter);

    const billData = await WSSearch.searchBills(tenantId, consumercodes);

    if (filters?.applicationNumber) businessIds = filters?.applicationNumber;

    const workflowDetails = await WSSearch.workflowDataDetails(tenantId, businessIds);

    const data = {
      CalculationCriteria:
        serviceType == "WATER"
          ? [
              {
                applicationNo: filters?.applicationNumber,
                tenantId: wsData?.[0]?.tenantId ? wsData?.[0]?.tenantId : tenantId,
                waterConnection: { ...wsData?.[0], property: properties?.Properties?.[0] },
              },
            ]
          : [
              {
                applicationNo: filters?.applicationNumber,
                tenantId: wsData?.[0]?.tenantId ? wsData?.[0]?.tenantId : tenantId,
                sewerageConnection: { ...wsData?.[0], property: properties?.Properties?.[0], service: "SEWERAGE" },
              },
            ],
      isconnectionCalculation: false,
    };
    let estimationResponse = {};
    if (serviceType == "WATER" && response?.WaterConnection?.length > 0) {
      estimationResponse = await WSSearch.wsEstimationDetails(data, serviceType);
    }
    if (serviceType !== "WATER" && response?.SewerageConnections?.length > 0) {
      estimationResponse = await WSSearch.wsEstimationDetails(data, serviceType);
    }

    const wsDataDetails = cloneDeep(serviceType == "WATER" ? response?.WaterConnection?.[0] : response?.SewerageConnections?.[0]);
    const propertyDataDetails = cloneDeep(properties?.Properties?.[0]);
    const billDetails = cloneDeep(billData);
    const workFlowDataDetails = cloneDeep(workflowDetails);
    const serviceDataType = cloneDeep(serviceType);

    const applicationHeaderDetails = {
      title: " ",
      asSectionHeader: true,
      values:
        serviceType == "WATER"
          ? [
              { title: "PDF_STATIC_LABEL_APPLICATION_NUMBER_LABEL", value: wsDataDetails?.applicationNo || t("NA") },
              { title: "WS_SERVICE_NAME_LABEL", value: serviceType == "WATER" ? t("WATER") : t("SEWERAGE") },
              { title: "WS_NO_OF_CONNECTIONS_PROPOSED_LABEL", value: wsDataDetails?.proposedTaps || t("NA") },
              { title: "WS_PROPOSED_PIPE_SIZE", value: wsDataDetails?.proposedPipeSize || t("NA") },
            ]
          : [
              { title: "PDF_STATIC_LABEL_APPLICATION_NUMBER_LABEL", value: wsDataDetails?.applicationNo || t("NA") },
              { title: "WS_SERVICE_NAME_LABEL", value: serviceType == "WATER" ? "WATER" : "SEWERAGE" },
              { title: "WS_NO_WATER_CLOSETS_LABEL", value: wsDataDetails?.proposedWaterClosets || t("NA") },
              { title: "WS_SERV_DETAIL_NO_OF_TOILETS", value: wsDataDetails?.proposedToilets || t("NA") },
            ],
    };

    const feeEstimation = {
      title: "WS_TASK_DETAILS_FEE_ESTIMATE",
      asSectionHeader: true,
      additionalDetails: {
        estimationDetails: true,
        data: estimationResponse?.Calculation?.[0],
        appDetails: wsDataDetails,
        values: [
          { title: "WS_APPLICATION_FEE_HEADER", value: estimationResponse?.Calculation?.[0]?.fee },
          { title: "WS_SERVICE_FEE_HEADER", value: estimationResponse?.Calculation?.[0]?.charge },
          { title: "WS_TAX_HEADER", value: estimationResponse?.Calculation?.[0]?.taxAmount },
        ],
      },
    };

    const propertyDetails = {
      title: "WS_COMMON_PROPERTY_DETAILS",
      asSectionHeader: true,
      values: [
        { title: "WS_PROPERTY_ID_LABEL", value: propertyDataDetails?.propertyId },
        { title: "WS_COMMON_OWNER_NAME_LABEL", value: propertyDataDetails?.owners?.[0]?.name },
        { title: "WS_PROPERTY_ADDRESS_LABEL", value: propertyDataDetails?.address?.locality?.name },
      ],
      additionalDetails: {
        redirectUrl: {
          title: "View Complete Property details",
          url: `/digit-ui/employee/pt/property-details/${propertyDataDetails?.propertyId}`,
        },
      },
    };

    const connectionHolderDetails = {
      title: "WS_COMMON_CONNECTION_HOLDER_DETAILS_HEADER",
      asSectionHeader: true,
      values:
        wsDataDetails?.connectionHolders?.length > 0
          ? [
              { title: "WS_OWN_DETAIL_NAME", value: wsDataDetails?.connectionHolders?.[0]?.name || t("NA") },
              { title: "WS_CONN_HOLDER_OWN_DETAIL_GENDER_LABEL", value: wsDataDetails?.connectionHolders?.[0]?.gender },
              { title: "CORE_COMMON_MOBILE_NUMBER", value: wsDataDetails?.connectionHolders?.[0]?.mobileNumber },
              { title: "WS_CONN_HOLDER_COMMON_FATHER_OR_HUSBAND_NAME", value: wsDataDetails?.connectionHolders?.[0]?.fatherOrHusbandName },
              { title: "WS_CONN_HOLDER_OWN_DETAIL_RELATION_LABEL", value: wsDataDetails?.connectionHolders?.[0]?.relationship },
              { title: "WS_CORRESPONDANCE_ADDRESS_LABEL", value: wsDataDetails?.connectionHolders?.[0]?.correspondenceAddress },
            ]
          : [{ title: "WS_CONN_HOLDER_SAME_AS_OWNER_DETAILS", value: t("SCORE_YES") }],
    };

    const documentDetails = {
      title: "",
      asSectionHeader: true,
      additionalDetails: {
        documents: [
          {
            title: "WS_COMMON_DOCS",
            values: wsDataDetails?.documents?.map((document) => {
              return {
                title: `WS_${document?.documentType}`,
                documentType: document?.documentType,
                documentUid: document?.documentUid,
                fileStoreId: document?.fileStoreId,
              };
            }),
          },
        ],
      },
    };

    const AdditionalDetailsByWS = {
      title: "WS_COMMON_ADDITIONAL_DETAILS_HEADER",
      isWaterConnectionDetails: true,
      additionalDetails: {
        values: [],
        connectionDetails:
          serviceType == "WATER"
            ? [
                {
                  title: "WS_SERV_DETAIL_CONN_TYPE",
                  value: wsDataDetails?.connectionType
                    ? t(`WS_SERVICES_MASTERS_WATERSOURCE_${stringReplaceAll(wsDataDetails?.connectionType?.toUpperCase(), " ", "_")}`)
                    : t("NA"),
                },
                { title: "WS_SERV_DETAIL_NO_OF_TAPS", value: wsDataDetails?.noOfTaps || t("NA") },
                {
                  title: "WS_SERV_DETAIL_WATER_SOURCE",
                  value: wsDataDetails?.waterSource
                    ? t(`WS_SERVICES_MASTERS_WATERSOURCE_${wsDataDetails?.waterSource?.toUpperCase()?.split(".")[0]}`)
                    : t("NA"),
                },
                { title: "WS_PIPE_SIZE_IN_INCHES_LABEL", value: wsDataDetails?.pipeSize || t("NA") },
                {
                  title: "WS_SERV_DETAIL_WATER_SUB_SOURCE",
                  value: wsDataDetails?.waterSource ? t(`${wsDataDetails?.waterSource?.toUpperCase()?.split(".")[1]}`) : t("NA"),
                },
              ]
            : [
                {
                  title: "WS_SERV_DETAIL_CONN_TYPE",
                  value: wsDataDetails?.connectionType
                    ? t(`WS_SERVICES_MASTERS_WATERSOURCE_${stringReplaceAll(wsDataDetails?.connectionType?.toUpperCase(), " ", "_")}`)
                    : t("NA"),
                },
                { title: "WS_NUMBER_WATER_CLOSETS_LABEL", value: wsDataDetails?.noOfWaterClosets || t("NA") },
                { title: "WS_SERV_DETAIL_NO_OF_TOILETS", value: wsDataDetails?.noOfToilets || t("NA") },
              ],
        plumberDetails:
          wsDataDetails?.additionalDetails?.detailsProvidedBy === "ULB"
            ? [
                {
                  title: "WS_ADDN_DETAILS_PLUMBER_PROVIDED_BY",
                  value: wsDataDetails?.additionalDetails?.detailsProvidedBy
                    ? t(`WS_PLUMBER_${wsDataDetails?.additionalDetails?.detailsProvidedBy?.toUpperCase()}`)
                    : t("NA"),
                },
                { title: "WS_ADDN_DETAILS_PLUMBER_LICENCE_NO_LABEL", value: wsDataDetails?.plumberInfo?.[0]?.licenseNo || t("NA") },
                { title: "WS_ADDN_DETAILS_PLUMBER_NAME_LABEL", value: wsDataDetails?.plumberInfo?.[0]?.name || t("NA") },
                { title: "WS_PLUMBER_MOBILE_NO_LABEL", value: wsDataDetails?.plumberInfo?.[0]?.mobileNumber || t("NA") },
              ]
            : [
                {
                  title: "WS_ADDN_DETAILS_PLUMBER_PROVIDED_BY",
                  value: wsDataDetails?.additionalDetails?.detailsProvidedBy
                    ? t(`WS_PLUMBER_${wsDataDetails?.additionalDetails?.detailsProvidedBy?.toUpperCase()}`)
                    : t("NA"),
                },
              ],
        roadCuttingDetails: wsDataDetails?.roadCuttingInfo
          ? wsDataDetails?.roadCuttingInfo?.map((info, index) => {
              return {
                title: "WS_ROAD_CUTTING_DETAIL",
                values: [
                  { title: "WS_ADDN_DETAIL_ROAD_TYPE", value: t(`WS_ROADTYPE_${info?.roadType}`) },
                  { title: "WS_ROAD_CUTTING_AREA_LABEL", value: info?.roadCuttingArea },
                ],
              };
            })
          : [
              {
                title: "WS_ROAD_CUTTING_DETAIL",
                values: [
                  { title: "WS_ADDN_DETAIL_ROAD_TYPE", value: t("NA") },
                  { title: "WS_ROAD_CUTTING_AREA_LABEL", value: t("NA") },
                ],
              },
            ],
        activationDetails:
          wsDataDetails?.connectionType == "Metered"
            ? [
                { title: "WS_SERV_DETAIL_METER_ID", value: wsDataDetails?.meterId || t("NA") },
                { title: "WS_INITIAL_METER_READING_LABEL", value: wsDataDetails?.additionalDetails?.initialMeterReading || t("NA") },
                {
                  title: "WS_INSTALLATION_DATE_LABEL",
                  value: wsDataDetails?.meterInstallationDate ? convertEpochToDate(wsDataDetails?.meterInstallationDate) : t("NA"),
                },
                {
                  title: "WS_SERV_DETAIL_CONN_EXECUTION_DATE",
                  value: wsDataDetails?.connectionExecutionDate ? convertEpochToDate(wsDataDetails?.connectionExecutionDate) : t("NA"),
                },
              ]
            : [
                {
                  title: "WS_SERV_DETAIL_CONN_EXECUTION_DATE",
                  value: wsDataDetails?.connectionExecutionDate ? convertEpochToDate(wsDataDetails?.connectionExecutionDate) : t("NA"),
                },
              ],
      },
    };

    let details = [];
    details = [...details, applicationHeaderDetails, feeEstimation, propertyDetails, connectionHolderDetails, documentDetails, AdditionalDetailsByWS];
    wsDataDetails.serviceType = serviceDataType;
    return {
      applicationData: wsDataDetails,
      applicationDetails: details,
      tenantId: wsDataDetails?.tenantId,
      applicationNo: wsDataDetails?.applicationNo,
      applicationStatus: wsDataDetails?.applicationStatus,
      propertyDetails: propertyDataDetails,
      billDetails: billDetails?.Bill,
      processInstancesDetails: workFlowDataDetails?.ProcessInstances,
    };
  },

  applicationDetailsBillAmendment: async (t, tenantId, applicationNumber, serviceType = "WATER", config = {}) => {
    const filtersForWSSearch = { connectionNumber: applicationNumber };
    // 1. sewarage or water search thru connection number
    // 2. property search thru propertyId from search swc or ws
    // 3. billing service demand search thru consumer code === connection number
    // 4. billing servic amendment search thru consumer code === connection number

    let propertyids = "", consumercodes = "", businessIds = "";

    const response = await WSSearch.application(tenantId, filtersForWSSearch, serviceType);
    
    const wsData = cloneDeep(response?.WaterConnection || response?.SewerageConnections)

    const filters = { applicationNumber: wsData?.[0]?.applicationNo };

    wsData?.forEach(item => {
      propertyids = propertyids + item?.propertyId + (",");
      consumercodes = consumercodes + item?.applicationNo + ",";
    });

    let propertyfilter = { propertyIds: propertyids.substring(0, propertyids.length - 1), }

    if (propertyids !== "" && filters?.locality) propertyfilter.locality = filters?.locality;

    config = { enabled: propertyids !== "" ? true : false }

    const properties = await WSSearch.property(tenantId, propertyfilter);

    const {Demands: BillDemandDetails} = await PaymentService.demandSearch(tenantId, filtersForWSSearch?.connectionNumber, "WS")
    const billServiceTaxHeadMaster = await MdmsService.getWSTaxHeadMaster(tenantId, "WS")
    const billServiceTaxHeadMasterForBillAmendment = billServiceTaxHeadMaster?.BillingService?.TaxHeadMaster?.filter(w=>w.IsBillamend)
    const actualFieldsAndAmountOfBillDetails = BillDemandDetails?.[0]?.demandDetails.filter( e => billServiceTaxHeadMasterForBillAmendment.find(taxHeadMaster => taxHeadMaster.code === e.taxHeadMasterCode))
    const billData = await WSSearch.searchBills(tenantId, consumercodes);
    const billAmendmentSearch = await WSSearch.searchAmendment(tenantId, applicationNumber)

    if (filters?.applicationNumber) businessIds = filters?.applicationNumber;

    const workflowDetails = await WSSearch.workflowDataDetails(tenantId, businessIds);

    const wsDataDetails = cloneDeep(response?.WaterConnection?.[0] || response?.SewerageConnections?.[0]);
    const propertyDataDetails = cloneDeep(properties?.Properties?.[0]);
    const billDetails = cloneDeep(billData);
    const workFlowDataDetails = cloneDeep(workflowDetails);
    const serviceDataType = cloneDeep(serviceType);

    const applicationHeaderDetails = {
      title: " ",
      asSectionHeader: true,
      values: [
        { title: "PDF_STATIC_LABEL_APPLICATION_NUMBER_LABEL", value: wsDataDetails?.applicationNo || t("NA") },
        { title: "WS_MOBILE_NUMBER", value: propertyDataDetails?.owners?.[0]?.mobileNumber|| t("NA") },
        { title: "WS_CONSUMER_ID", value: wsDataDetails?.connectionNo || t("NA") },
        { title: "WS_APPLICANT_NAME", value: propertyDataDetails?.owners?.[0]?.name || t("NA") },
        { title: "WS_APPLICANT_ADDRESS", value: propertyDataDetails?.owners?.[0]?.name || t("NA") },
        { title: "WS_NOTE_TYPE", value: t("NA") },
      ]
    };

    const propertyDetails = {
      title: "WS_AMOUNT_DETAILS",
      asSectionHeader: true,
      values: [...actualFieldsAndAmountOfBillDetails.map( e => ({
        title: e?.taxHeadMasterCode, value: `₹ ${e?.taxAmount}`
      })), { title: "WS_TOTAL_TAX", value: `₹ ${Math.round(actualFieldsAndAmountOfBillDetails.reduce((acc, curr) => curr.taxAmount + acc, 0))}` }]
    };

    const connectionHolderDetails = {
      title: " ",
      asSectionHeader: true,
      values: [
        { title: "WS_DEMAND_REVISION_REASON", value: billAmendmentSearch?.Amendments?.[0]?.amendmentReason },
        { title: "WS_DEMAND_REASON_DOCUMENT", value: billAmendmentSearch?.Amendments?.[0]?.reasonDocumentNumber },
        { title: "WS_DATE_EFFECT_FROM", value: Digit.DateUtils.ConvertTimestampToDate(billAmendmentSearch?.Amendments?.[0]?.effectiveFrom) },
        { title: "WS_DATE_EFFECT_TO", value: Digit.DateUtils.ConvertTimestampToDate(billAmendmentSearch?.Amendments?.[0]?.effectiveTill) },
      ]
    };

    const documentDetails = {
      title: "",
      asSectionHeader: true,
      additionalDetails: {
        documents: [{
          title: "WS_COMMON_DOCS",
          values: wsDataDetails?.documents?.map((document) => {
            return {
              title: `WS_${document?.documentType}`,
              documentType: document?.documentType,
              documentUid: document?.documentUid,
              fileStoreId: document?.fileStoreId,
            };
          }),
        },
        ]
      }
    };

    const details = [applicationHeaderDetails, propertyDetails, connectionHolderDetails, documentDetails]
    wsDataDetails.serviceType = serviceDataType;
    return {
      applicationData: wsDataDetails,
      applicationDetails: details,
      tenantId: wsDataDetails?.tenantId,
      applicationNo: wsDataDetails?.applicationNo,
      applicationStatus: wsDataDetails?.applicationStatus,
      propertyDetails: propertyDataDetails,
      billDetails: billDetails?.Bill,
      processInstancesDetails: workFlowDataDetails?.ProcessInstances
    };
  },

  applicationDetailsBillAmendment: async (t, tenantId, applicationNumber, serviceType = "WATER", config = {}) => {
    const filtersForWSSearch = { connectionNumber: applicationNumber };
    // 1. sewarage or water search thru connection number
    // 2. property search thru propertyId from search swc or ws
    // 3. billing service demand search thru consumer code === connection number
    // 4. billing servic amendment search thru consumer code === connection number

    let propertyids = "", consumercodes = "", businessIds = "";

    const response = await WSSearch.application(tenantId, filtersForWSSearch, serviceType);
    
    const wsData = cloneDeep(response?.WaterConnection || response?.SewerageConnections)

    const filters = { applicationNumber: wsData?.[0]?.applicationNo };

    wsData?.forEach(item => {
      propertyids = propertyids + item?.propertyId + (",");
      consumercodes = consumercodes + item?.applicationNo + ",";
    });

    let propertyfilter = { propertyIds: propertyids.substring(0, propertyids.length - 1), }

    if (propertyids !== "" && filters?.locality) propertyfilter.locality = filters?.locality;

    config = { enabled: propertyids !== "" ? true : false }

    const properties = await WSSearch.property(tenantId, propertyfilter);

    const {Demands: BillDemandDetails} = await PaymentService.demandSearch(tenantId, filtersForWSSearch?.connectionNumber, "WS")
    const billServiceTaxHeadMaster = await MdmsService.getWSTaxHeadMaster(tenantId, "WS")
    const billServiceTaxHeadMasterForBillAmendment = billServiceTaxHeadMaster?.BillingService?.TaxHeadMaster?.filter(w=>w.IsBillamend)
    const actualFieldsAndAmountOfBillDetails = BillDemandDetails?.[0]?.demandDetails.filter( e => billServiceTaxHeadMasterForBillAmendment.find(taxHeadMaster => taxHeadMaster.code === e.taxHeadMasterCode))
    const billData = await WSSearch.searchBills(tenantId, consumercodes);
    const billAmendmentSearch = await WSSearch.searchAmendment(tenantId, applicationNumber)

    if (filters?.applicationNumber) businessIds = filters?.applicationNumber;

    const workflowDetails = await WSSearch.workflowDataDetails(tenantId, businessIds);

    const wsDataDetails = cloneDeep(response?.WaterConnection?.[0] || response?.SewerageConnections?.[0]);
    const propertyDataDetails = cloneDeep(properties?.Properties?.[0]);
    const billDetails = cloneDeep(billData);
    const workFlowDataDetails = cloneDeep(workflowDetails);
    const serviceDataType = cloneDeep(serviceType);

    const applicationHeaderDetails = {
      title: " ",
      asSectionHeader: true,
      values: [
        { title: "PDF_STATIC_LABEL_APPLICATION_NUMBER_LABEL", value: wsDataDetails?.applicationNo || t("NA") },
        { title: "WS_MOBILE_NUMBER", value: propertyDataDetails?.owners?.[0]?.mobileNumber|| t("NA") },
        { title: "WS_CONSUMER_ID", value: wsDataDetails?.connectionNo || t("NA") },
        { title: "WS_APPLICANT_NAME", value: propertyDataDetails?.owners?.[0]?.name || t("NA") },
        { title: "WS_APPLICANT_ADDRESS", value: propertyDataDetails?.owners?.[0]?.name || t("NA") },
        { title: "WS_NOTE_TYPE", value: t("NA") },
      ]
    };

    const propertyDetails = {
      title: "WS_AMOUNT_DETAILS",
      asSectionHeader: true,
      values: [...actualFieldsAndAmountOfBillDetails.map( e => ({
        title: e?.taxHeadMasterCode, value: `₹ ${e?.taxAmount}`
      })), { title: "WS_TOTAL_TAX", value: `₹ ${Math.round(actualFieldsAndAmountOfBillDetails.reduce((acc, curr) => curr.taxAmount + acc, 0))}` }]
    };

    const connectionHolderDetails = {
      title: " ",
      asSectionHeader: true,
      values: [
        { title: "WS_DEMAND_REVISION_REASON", value: billAmendmentSearch?.Amendments?.[0]?.amendmentReason },
        { title: "WS_DEMAND_REASON_DOCUMENT", value: billAmendmentSearch?.Amendments?.[0]?.reasonDocumentNumber },
        { title: "WS_DATE_EFFECT_FROM", value: Digit.DateUtils.ConvertTimestampToDate(billAmendmentSearch?.Amendments?.[0]?.effectiveFrom) },
        { title: "WS_DATE_EFFECT_TO", value: Digit.DateUtils.ConvertTimestampToDate(billAmendmentSearch?.Amendments?.[0]?.effectiveTill) },
      ]
    };

    const documentDetails = {
      title: "",
      asSectionHeader: true,
      additionalDetails: {
        documents: [{
          title: "WS_COMMON_DOCS",
          values: wsDataDetails?.documents?.map((document) => {
            return {
              title: `WS_${document?.documentType}`,
              documentType: document?.documentType,
              documentUid: document?.documentUid,
              fileStoreId: document?.fileStoreId,
            };
          }),
        },
        ]
      }
    };

    const details = [applicationHeaderDetails, propertyDetails, connectionHolderDetails, documentDetails]
    wsDataDetails.serviceType = serviceDataType;
    return {
      applicationData: wsDataDetails,
      applicationDetails: details,
      tenantId: wsDataDetails?.tenantId,
      applicationNo: wsDataDetails?.applicationNo,
      applicationStatus: wsDataDetails?.applicationStatus,
      propertyDetails: propertyDataDetails,
      billDetails: billDetails?.Bill,
      processInstancesDetails: workFlowDataDetails?.ProcessInstances,
      billAmendmentSearch,
    };
  },

  connectionDetails: async (t, tenantId, connectionNumber, serviceType = "WATER", config = {}) => {
    const filters = { connectionNumber, searchType: "CONNECTION" };

    let propertyids = "",
      consumercodes = "",
      businessIds = "";

    const response = await WSSearch.application(tenantId, filters, serviceType);

    const wsData = cloneDeep(serviceType == "WATER" ? response?.WaterConnection : response?.SewerageConnections);

    wsData?.forEach((item) => {
      propertyids = propertyids + item?.propertyId + ",";
      consumercodes = consumercodes + item?.connectionNo + ",";
    });

    let propertyfilter = { propertyIds: propertyids.substring(0, propertyids.length - 1) };

    if (propertyids !== "" && filters?.locality) propertyfilter.locality = filters?.locality;

    config = { enabled: propertyids !== "" ? true : false };

    const properties = await WSSearch.property(tenantId, propertyfilter);

    if (filters?.connectionNumber) businessIds = filters?.connectionNumber;

    const workflowDetails = await WSSearch.workflowDataDetails(tenantId, businessIds);

    const wsDataDetails = cloneDeep(serviceType == "WATER" ? response?.WaterConnection?.[0] : response?.SewerageConnections?.[0]);
    const propertyDataDetails = cloneDeep(properties?.Properties?.[0]);
    const workFlowDataDetails = cloneDeep(workflowDetails);
    const serviceDataType = cloneDeep(serviceType);

    const serviceTypeOfData = serviceType == "WATER" ? "WS" : "SW";
    const collectionNumber = wsDataDetails?.connectionNo;
    const colletionOFData = await WSSearch.colletionData({tenantId, serviceTypeOfData, collectionNumber}, {});


    const applicationHeaderDetails = {
      title: "WS_SERVICE_DETAILS",
      asSectionHeader: true,
      values:
        serviceType == "WATER"
          ? [
              { title: "PDF_STATIC_LABEL_CONSUMER_NUMBER_LABEL", value: wsDataDetails?.connectionNo || t("NA") },
              { title: "WS_SERVICE_NAME_LABEL", value: serviceType == "WATER" ? t("WATER") : t("SEWERAGE") },
              {
                title: "WS_SERV_DETAIL_CONN_TYPE",
                value: wsDataDetails?.connectionType
                  ? t(`WS_SERVICES_MASTERS_WATERSOURCE_${stringReplaceAll(wsDataDetails?.connectionType?.toUpperCase(), " ", "_")}`)
                  : t("NA"),
              },
              { title: "WS_SERV_DETAIL_NO_OF_TAPS", value: wsDataDetails?.noOfTaps || t("NA") },
              { title: "WS_PIPE_SIZE_IN_INCHES_LABEL", value: wsDataDetails?.pipeSize || t("NA") },
              {
                title: "WS_SERV_DETAIL_WATER_SOURCE",
                value: wsDataDetails?.waterSource
                  ? t(`WS_SERVICES_MASTERS_WATERSOURCE_${wsDataDetails?.waterSource?.toUpperCase()?.split(".")[0]}`)
                  : t("NA"),
              },
              {
                title: "WS_SERV_DETAIL_WATER_SUB_SOURCE",
                value: wsDataDetails?.waterSource ? t(`${wsDataDetails?.waterSource?.toUpperCase()?.split(".")[1]}`) : t("NA"),
              },
              {
                title: "WS_SERV_DETAIL_CONN_EXECUTION_DATE",
                value: wsDataDetails?.connectionExecutionDate ? convertEpochToDate(wsDataDetails?.connectionExecutionDate) : t("NA"),
              },
              { title: "WS_SERV_DETAIL_METER_ID", value: wsDataDetails?.meterId || t("NA") },
              {
                title: "WS_INSTALLATION_DATE_LABEL",
                value: wsDataDetails?.meterInstallationDate ? convertEpochToDate(wsDataDetails?.meterInstallationDate) : t("NA"),
              },
              { title: "WS_INITIAL_METER_READING_LABEL", value: wsDataDetails?.additionalDetails?.initialMeterReading || t("NA") },
              {
                title: "WS_VIEW_CONSUMPTION_DETAIL",
                to: `/digit-ui/employee/ws/consumption-details?applicationNo=${wsDataDetails?.connectionNo}&tenantId=${wsDataDetails?.tenantId}&service=${serviceType}`,
                value: "",
                isLink: true,
              },
            ]
          : [
              { title: "PDF_STATIC_LABEL_CONSUMER_NUMBER_LABEL", value: wsDataDetails?.connectionNo || t("NA") },
              { title: "WS_SERVICE_NAME_LABEL", value: serviceType == "WATER" ? "WATER" : "SEWERAGE" },
              { title: "WS_NUMBER_WATER_CLOSETS_LABEL", value: wsDataDetails?.noOfWaterClosets || t("NA") },
              { title: "WS_SERV_DETAIL_NO_OF_TOILETS", value: wsDataDetails?.noOfToilets || t("NA") },
              {
                title: "WS_SERV_DETAIL_CONN_EXECUTION_DATE",
                value: wsDataDetails?.connectionExecutionDate ? convertEpochToDate(wsDataDetails?.connectionExecutionDate) : t("NA"),
              },
            ],
    };

    const propertyDetails = {
      title: "WS_COMMON_PROPERTY_DETAILS",
      asSectionHeader: true,
      values: [
        { title: "WS_PROPERTY_ID_LABEL", value: propertyDataDetails?.propertyId },
        { title: "WS_COMMON_OWNER_NAME_LABEL", value: propertyDataDetails?.owners?.[0]?.name },
        { title: "WS_PROPERTY_ADDRESS_LABEL", value: propertyDataDetails?.address?.locality?.name },
        {
          title: "WS_VIEW_PROPERTY_DETAIL",
          to: `/digit-ui/employee/pt/property-details/${propertyDataDetails?.propertyId}`,
          value: "",
          isLink: true,
        },
      ],
    };

    const connectionHolderDetails = {
      title: "WS_COMMON_CONNECTION_HOLDER_DETAILS_HEADER",
      asSectionHeader: true,
      values:
        wsDataDetails?.connectionHolders != null && wsDataDetails?.connectionHolders.length > 0
          ? [
              { title: "WS_OWN_DETAIL_NAME", value: wsDataDetails?.connectionHolders?.[0]?.name || t("NA") },
              { title: "WS_CONN_HOLDER_OWN_DETAIL_GENDER_LABEL", value: wsDataDetails?.connectionHolders?.[0]?.gender },
              { title: "CORE_COMMON_MOBILE_NUMBER", value: wsDataDetails?.connectionHolders?.[0]?.mobileNumber },
              { title: "WS_CONN_HOLDER_COMMON_FATHER_OR_HUSBAND_NAME", value: wsDataDetails?.connectionHolders?.[0]?.fatherOrHusbandName },
              { title: "WS_CONN_HOLDER_OWN_DETAIL_RELATION_LABEL", value: wsDataDetails?.connectionHolders?.[0]?.relationship },
              { title: "WS_CORRESPONDANCE_ADDRESS_LABEL", value: wsDataDetails?.connectionHolders?.[0]?.correspondenceAddress },
            ]
          : [{ title: "WS_CONN_HOLDER_SAME_AS_OWNER_DETAILS", value: t("SCORE_YES") }],
    };

    let details = [];
    details = [...details, applicationHeaderDetails, propertyDetails, connectionHolderDetails];
    wsDataDetails.serviceType = serviceDataType;
    wsDataDetails.property = propertyDataDetails;
    return {
      applicationData: wsDataDetails,
      applicationDetails: details,
      tenantId: wsDataDetails?.tenantId,
      applicationNo: wsDataDetails?.applicationNo,
      applicationStatus: wsDataDetails?.applicationStatus,
      propertyDetails: propertyDataDetails,
      processInstancesDetails: workFlowDataDetails?.ProcessInstances,
      colletionOfData: colletionOFData?.Payments
    };
  },
};