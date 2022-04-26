import React, { useState, Fragment, useEffect } from "react";
import {
  FormComposer,
  Header,
  Card,
  CardSectionHeader,
  PDFSvg,
  Loader,
  StatusTable,
  Row,
  ActionBar,
  SubmitBar,
  MultiLink,
} from "@egovernments/digit-ui-react-components";
import { useParams, useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ApplicationDetailsTemplate from "../../../../templates/ApplicationDetails";
import get from "lodash/get";
import orderBy from "lodash/orderBy";
import cloneDeep from "lodash/cloneDeep";
import * as func from "../../utils";
import getPDFData from "../../utils/getWSAcknowledgementData";
import { getFiles, getBusinessService } from "../../utils";
import _ from "lodash";

const ApplicationDetails = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const userInfo = Digit.UserService.getUser();
  const tenantId = Digit.ULBService.getCurrentTenantId();
  const stateCode = Digit.ULBService.getStateId();
  const [showToast, setShowToast] = useState(null);
  const [canSubmit, setSubmitValve] = useState(false);
  const defaultValues = {};
  const history = useHistory();
  const stateId = Digit.ULBService.getStateId();
  const isMobile = window.Digit.Utils.browser.isMobile();
  const [showOptions, setShowOptions] = useState(false);
  let filters = func.getQueryStringParams(location.search);
  const applicationNumber = filters?.applicationNumber;
  const serviceType = filters?.service;

  sessionStorage.removeItem("Digit.PT_CREATE_EMP_WS_NEW_FORM");
  sessionStorage.removeItem("IsDetailsExists");

  //for common receipt key.
  const { isBillingServiceLoading, data: mdmsBillingServiceData } = Digit.Hooks.obps.useMDMS(stateCode, "BillingService", ["BusinessService"]);
  const { isCommonmastersLoading, data: mdmsCommonmastersData } = Digit.Hooks.obps.useMDMS(stateCode, "common-masters", ["uiCommonPay"]);
  const commonPayDetails = mdmsCommonmastersData?.["common-masters"]?.uiCommonPay || [];
  const index = commonPayDetails && commonPayDetails.findIndex((item) => { return item.code == "WS.ONE_TIME_FEE"; });
  let commonPayInfo = "";
  if (index > -1) commonPayInfo = commonPayDetails[index];
  else commonPayInfo = commonPayDetails && commonPayDetails.filter(item => item.code === "DEFAULT");
  const receiptKey = commonPayInfo?.receiptKey || "consolidatedreceipt";
  
  let { isLoading, isError, data: applicationDetails, error } = Digit.Hooks.ws.useWSDetailsPage(t, tenantId, applicationNumber, serviceType);
  let workflowDetails = Digit.Hooks.useWorkflowDetails(
    {
      tenantId: tenantId,
      id: applicationNumber,
      moduleCode: applicationDetails?.processInstancesDetails?.[0]?.businessService,
    },
    {
      enabled: applicationDetails?.processInstancesDetails?.[0]?.businessService ? true : false,
    }
  );

  const { data: reciept_data, isLoading: recieptDataLoading } = Digit.Hooks.useRecieptSearch(
    {
      tenantId: stateCode,
      businessService:  serviceType == "WATER" ? "WS.ONE_TIME_FEE" : "SW.ONE_TIME_FEE",
      consumerCodes: applicationDetails?.applicationData?.applicationNo
    },
    {
      enabled: applicationDetails?.applicationData?.applicationType?.includes("NEW_")
    }
  );

  const { data: oldData } = Digit.Hooks.ws.useOldValue({
    tenantId,
    filters: { connectionNumber: applicationDetails?.applicationData?.connectionNo, isConnectionSearch: true },
    businessService: serviceType,
  });

  const oldValueWC = oldData?.WaterConnection;
  const oldValueSC = oldData?.SewerageConnections;

  const oldValueCopy = [oldValueWC, oldValueSC];

  const newValueFilter = oldValueCopy?.filter((ele) => ele);

  const currentValue = applicationDetails?.applicationData;
  const res = newValueFilter[0]?.flatMap((o) => {
    const pairs = Object.entries(o).filter(([k, v]) => currentValue?.[k] !== v);
    return pairs?.length ? Object.fromEntries(pairs) : [];
  });

  const {
    isLoading: updatingApplication,
    isError: updateApplicationError,
    data: updateResponse,
    error: updateError,
    mutate,
  } = Digit.Hooks.ws.useWSApplicationActions(serviceType);

  const closeToast = () => {
    setShowToast(null);
    // setError(null);
  };

  workflowDetails?.data?.actionState?.nextActions?.forEach((action) => {
    if (action?.action === "ACTIVATE_CONNECTION") {
      action.redirectionUrll = {
        action: "ACTIVATE_CONNECTION",
        pathname: `/digit-ui/employee/ws/activate-connection?applicationNumber=${applicationNumber}&service=${serviceType}&action=ACTIVATE_CONNECTION`,
        state: applicationDetails?.applicationData,
      };
    }
    if (action?.action === "RESUBMIT_APPLICATION") {
      action.redirectionUrll = {
        action: "ACTIVATE_CONNECTION",
        pathname: `/digit-ui/employee/ws/edit-application?applicationNumber=${applicationNumber}&service=${serviceType}&propertyId=${applicationDetails?.propertyDetails?.propertyId}`,
        state: applicationDetails,
      };
    }
    if (action?.action === "SUBMIT_APPLICATION") {
      action.redirectionUrll = {
        action: "ACTIVATE_CONNECTION",
        pathname: `/digit-ui/employee/ws/modify-application-edit?applicationNumber=${applicationNumber}&service=${serviceType}&propertyId=${applicationDetails?.propertyDetails?.propertyId}`,
        state: applicationDetails,
      };
    }
  });

  if (
    workflowDetails?.data?.nextActions?.length > 0 &&
    workflowDetails?.data?.actionState?.nextActions?.length > 0 &&
    !workflowDetails?.data?.actionState?.nextActions?.find((e) => e.action === "EDIT") &&
    !workflowDetails?.data?.actionState?.nextActions?.find((e) => e.action === "RESUBMIT_APPLICATION") &&
    !workflowDetails?.data?.actionState?.nextActions?.find((e) => e.action === "ACTIVATE_CONNECTION") && 
    !workflowDetails?.data?.actionState?.nextActions?.find((e) => e.action === "SUBMIT_APPLICATION")
  ) {
    workflowDetails?.data?.nextActions?.forEach((data) => {
      if (data.action == "EDIT") workflowDetails.data.actionState.nextActions.push(data);
    });
  }

  workflowDetails?.data?.nextActions?.forEach((action) => {
    if (action?.action === "PAY") {
      action.redirectionUrll = {
        pathname: `${getBusinessService(filters)}/${applicationDetails?.applicationNo}/${applicationDetails?.tenantId}?tenantId=${
          applicationDetails?.tenantId
        }&ISWSAPP&applicationNumber=${applicationDetails?.applicationNo}`,
        state: applicationDetails?.tenantId,
      };
    }
  });

  workflowDetails?.data?.actionState?.nextActions?.forEach((action) => {
    if (action?.action === "PAY") {
      action.redirectionUrll = {
        pathname: `${getBusinessService(filters)}/${applicationDetails?.applicationNo}/${applicationDetails?.tenantId}?tenantId=${
          applicationDetails?.tenantId
        }&ISWSAPP&applicationNumber=${applicationDetails?.applicationNo}`,
        state: applicationDetails?.tenantId,
      };
    }
  });

  const handleDownloadPdf = async () => {
    const tenantInfo = applicationDetails?.applicationData?.tenantId;
    let res = applicationDetails?.applicationData;
    const PDFdata = getPDFData({ ...res }, { ...applicationDetails?.propertyDetails }, tenantInfo, t);
    PDFdata.then((ress) => Digit.Utils.pdf.generate(ress));
  };

  async function getRecieptSearch(tenantId, payments, consumerCodes, receiptKey) {
    let response = await Digit.PaymentService.generatePdf(tenantId, { Payments: [{...payments}] }, receiptKey);
    const fileStore = await Digit.PaymentService.printReciept(tenantId, { fileStoreIds: response.filestoreIds[0] });
    window.open(fileStore[response?.filestoreIds[0]], "_blank");
  }


  let dowloadOptions = [],
    appStatus = applicationDetails?.applicationData?.applicationStatus || "";

  const wsEstimateDownloadObject = {
    order: 1,
    label: t("WS_ESTIMATION_NOTICE"),
    onClick: () => getFiles([applicationDetails?.applicationData?.additionalDetails?.estimationFileStoreId], stateCode),
  };

  const sanctionDownloadObject = {
    order: 2,
    label: t("WS_SANCTION_LETTER"),
    onClick: () => getFiles([applicationDetails?.applicationData?.additionalDetails?.sanctionFileStoreId], stateCode),
  };

  const applicationDownloadObject = {
    order: 3,
    label: t("WS_APPLICATION"),
    onClick: handleDownloadPdf,
  };

  const appFeeDownloadReceipt = {
    order: 4,
    label: t("DOWNLOAD_RECEIPT_HEADER"),
    onClick: () => getRecieptSearch(applicationDetails?.applicationData?.tenantId ? applicationDetails?.applicationData?.tenantId : Digit.ULBService.getCurrentTenantId(), reciept_data?.Payments?.[0], applicationDetails?.applicationData?.applicationNo, receiptKey ),
  };
  
  const applicationFeeReceipt = {
    order: 4,
    label: t("WS_APLICATION_RECEIPT"),
    onClick: async () => {
      const ConnectionDetailsfile = await Digit.PaymentService.generatePdf(tenantId, { WaterConnection: [applicationDetails?.applicationData] }, "ws-consolidatedacknowlegment");
      const file = await Digit.PaymentService.printReciept(tenantId, { fileStoreIds: ConnectionDetailsfile.filestoreIds[0] });
      window.open(file[ConnectionDetailsfile.filestoreIds[0]], "_blank");
    }
  };

  switch (appStatus) {
    case "PENDING_FOR_DOCUMENT_VERIFICATION":
    case "PENDING_FOR_CITIZEN_ACTION":
    case "PENDING_FOR_FIELD_INSPECTION":
      dowloadOptions = [applicationDownloadObject];
      break;
    case "PENDING_APPROVAL_FOR_CONNECTION":
    case "PENDING_FOR_PAYMENT":
      dowloadOptions = [applicationDownloadObject, wsEstimateDownloadObject];
      break;
    case "PENDING_FOR_CONNECTION_ACTIVATION":
    case "CONNECTION_ACTIVATED":
      if (applicationDetails?.applicationData?.applicationType?.includes("NEW_") && reciept_data?.Payments?.length > 0) dowloadOptions = [sanctionDownloadObject, wsEstimateDownloadObject, applicationDownloadObject, appFeeDownloadReceipt]; 
      else dowloadOptions = [sanctionDownloadObject, wsEstimateDownloadObject, applicationDownloadObject];
      break;
    case "REJECTED":
      dowloadOptions = [applicationDownloadObject];
      break;

    default:
      dowloadOptions = [applicationDownloadObject];
      break;
  }

  dowloadOptions.sort(function (a, b) {
    return a.order - b.order;
  });

  return (
    <Fragment>
      <div className={"employee-main-application-details"}>
        <div className={"employee-application-details"} style={{ marginBottom: "15px" }}>
          <Header styles={{ marginLeft: "0px", paddingTop: "10px", fontSize: "32px" }}>{t("CS_TITLE_APPLICATION_DETAILS")}</Header>

          {dowloadOptions && dowloadOptions.length > 0 && (
            <MultiLink
              className="multilinkWrapper employee-mulitlink-main-div"
              onHeadClick={() => setShowOptions(!showOptions)}
              displayOptions={showOptions}
              options={dowloadOptions}
              downloadBtnClassName={"employee-download-btn-className"}
              optionsClassName={"employee-options-btn-className"}
            />
          )}
        </div>
        <ApplicationDetailsTemplate
          applicationDetails={applicationDetails}
          isLoading={isLoading || isBillingServiceLoading || isCommonmastersLoading}
          isDataLoading={isLoading || isBillingServiceLoading || isCommonmastersLoading}
          applicationData={applicationDetails?.applicationData}
          mutate={mutate}
          workflowDetails={workflowDetails}
          businessService={applicationDetails?.processInstancesDetails?.[0]?.businessService?.toUpperCase()}
          moduleCode="WS"
          showToast={showToast}
          setShowToast={setShowToast}
          closeToast={closeToast}
          timelineStatusPrefix={`WF_${applicationDetails?.processInstancesDetails?.[0]?.businessService?.toUpperCase()}_`}
          oldValue={res}
        />
      </div>
    </Fragment>
  );
};

export default ApplicationDetails;